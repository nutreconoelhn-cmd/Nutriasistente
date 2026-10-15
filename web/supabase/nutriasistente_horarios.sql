begin;
-- Las jornadas existentes conservan su horario continuo hasta que se editen.
alter table public.clinic_schedule_days add column if not exists slot_times time[];

-- Añade una función nueva; no elimina tablas ni cambia reservas existentes.
create or replace function public.nutriasistente_save_schedule_slots(
 p_clinic_id uuid,
 p_date date,
 p_action text,
 p_city text default 'San Pedro Sula',
 p_address text default null,
 p_slots time[] default '{}'::time[],
 p_modality text default 'ambas'
) returns boolean
language plpgsql security definer set search_path = public
as $function$
declare v_slots time[]; v_start time; v_end time;
begin
 if auth.role() is distinct from 'service_role' then
  raise exception 'Acceso no autorizado';
 end if;
 if p_clinic_id is null or not exists(select 1 from public.clinics where id=p_clinic_id)
  or p_date is null or p_date < (now() at time zone 'America/Tegucigalpa')::date
  or p_date > (now() at time zone 'America/Tegucigalpa')::date + 730
  or p_action is null or p_action not in ('open','closed','restore') then
  raise exception 'Fecha o acción inválida';
 end if;
 if p_action='open' then
  if p_slots is null or cardinality(p_slots)<1 or cardinality(p_slots)>15
   or array_position(p_slots,null::time) is not null
   or exists(select 1 from unnest(p_slots) t where t<time '08:00' or t>time '15:00'
    or extract(minute from t) not in (0,30) or extract(second from t)<>0) then
   raise exception 'Selecciona horarios de inicio entre 8:00 a. m. y 3:00 p. m.';
  end if;
  select array_agg(distinct t order by t) into v_slots from unnest(p_slots) t;
  v_start:=v_slots[1];v_end:=(v_slots[cardinality(v_slots)]+interval '60 minutes')::time;
  if p_city is null or length(trim(p_city))<2 or length(p_city)>100
   or p_modality is null or p_modality not in ('presencial','online','ambas')
   or extract(dow from p_date)=6
   or length(coalesce(p_address,''))>240
   or (p_modality<>'online' and length(trim(coalesce(p_address,'')))<5) then
   raise exception 'Revisa ciudad, dirección y horario entre 8:00 a. m. y 4:00 p. m. Los sábados no se abren.';
  end if;
 end if;
 -- Comparte el bloqueo que usan las reservas del bot en la base existente.
 perform pg_advisory_xact_lock(hashtextextended(p_clinic_id::text,0));
 if exists(select 1 from public.appointments
   where clinic_id=p_clinic_id and status in ('pending','confirmed')
    and starts_at < ((p_date+1)::timestamp at time zone 'America/Tegucigalpa')
    and ends_at > (p_date::timestamp at time zone 'America/Tegucigalpa')) then
  raise exception 'Ya hay citas pendientes o confirmadas ese día. Revísalas antes de cambiar la jornada.';
 end if;
 if p_action='restore' then
  delete from public.clinic_schedule_days where clinic_id=p_clinic_id and date=p_date;
 else
  insert into public.clinic_schedule_days
   (clinic_id,date,status,city,address,start_time,end_time,modality,slot_times,updated_at)
  values(p_clinic_id,p_date,p_action,coalesce(nullif(trim(p_city),''),'San Pedro Sula'),
   case when p_action='open' then nullif(trim(p_address),'') else null end,
   case when p_action='open' then v_start else null end,
   case when p_action='open' then v_end else null end,
   case when p_action='open' then p_modality else 'ambas' end,case when p_action='open' then v_slots else null end,now())
  on conflict(clinic_id,date) do update set
   status=excluded.status,city=excluded.city,address=excluded.address,
   start_time=excluded.start_time,end_time=excluded.end_time,
   modality=excluded.modality,slot_times=excluded.slot_times,updated_at=now();
 end if;
 return true;
end;
$function$;
revoke all on function public.nutriasistente_save_schedule_slots(uuid,date,text,text,text,time[],text) from public,anon,authenticated;
grant execute on function public.nutriasistente_save_schedule_slots(uuid,date,text,text,text,time[],text) to service_role;

create or replace function public.clinic_schedule_allows(
  p_clinic_id uuid,p_start timestamptz,p_end timestamptz,p_modality text
) returns boolean language plpgsql stable security definer set search_path = public
as $function$
declare v_date date; v_day integer; v_start time; v_end time; v_override public.clinic_schedule_days%rowtype;
begin
  if p_start is null or p_end is null or p_end <= p_start or p_modality not in ('presencial','online')
    then return false; end if;
  v_date := (p_start at time zone 'America/Tegucigalpa')::date;
  if (p_end at time zone 'America/Tegucigalpa')::date <> v_date then return false; end if;
  v_start := (p_start at time zone 'America/Tegucigalpa')::time;
  v_end := (p_end at time zone 'America/Tegucigalpa')::time;
  select * into v_override from public.clinic_schedule_days
    where clinic_id = p_clinic_id and date = v_date;
  if extract(dow from v_date) = 6 then return false; end if;
  if found then
    return v_override.status = 'open' and v_override.start_time <= v_start
      and v_override.end_time >= v_end
      and v_override.modality in ('ambas',p_modality)
      and (v_override.slot_times is null or
       (v_start=any(v_override.slot_times) and p_end<=p_start+interval '60 minutes'));
  end if;
  v_day := extract(isodow from p_start at time zone 'America/Tegucigalpa');
  if v_day = 7 then return false; end if;
  return exists (select 1 from public.availability a
    where a.clinic_id = p_clinic_id and a.active = true and a.day_of_week = v_day
      and a.start_time <= v_start and a.end_time >= v_end
      and a.modality in ('ambas','both','presencial + online',p_modality));
end;
$function$;
revoke all on function public.clinic_schedule_allows(uuid,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.clinic_schedule_allows(uuid,timestamptz,timestamptz,text) to service_role;


commit;
