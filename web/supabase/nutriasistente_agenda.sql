-- Añade una función nueva; no elimina tablas ni cambia reservas existentes.
create or replace function public.nutriasistente_save_schedule_day(
 p_clinic_id uuid,
 p_date date,
 p_action text,
 p_city text default 'San Pedro Sula',
 p_address text default null,
 p_start time default '08:00',
 p_end time default '16:00',
 p_modality text default 'ambas'
) returns boolean
language plpgsql security definer set search_path = public
as $function$
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
  if p_city is null or length(trim(p_city))<2 or length(p_city)>100
   or p_modality is null or p_modality not in ('presencial','online','ambas')
   or p_start is null or p_end is null or p_start>=p_end
   or p_start<time '08:00' or p_end>time '16:00'
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
   (clinic_id,date,status,city,address,start_time,end_time,modality,updated_at)
  values(p_clinic_id,p_date,p_action,coalesce(nullif(trim(p_city),''),'San Pedro Sula'),
   case when p_action='open' then nullif(trim(p_address),'') else null end,
   case when p_action='open' then p_start else null end,
   case when p_action='open' then p_end else null end,
   case when p_action='open' then p_modality else 'ambas' end,now())
  on conflict(clinic_id,date) do update set
   status=excluded.status,city=excluded.city,address=excluded.address,
   start_time=excluded.start_time,end_time=excluded.end_time,
   modality=excluded.modality,updated_at=now();
 end if;
 return true;
end;
$function$;
revoke all on function public.nutriasistente_save_schedule_day(uuid,date,text,text,text,time,time,text) from public,anon,authenticated;
grant execute on function public.nutriasistente_save_schedule_day(uuid,date,text,text,text,time,time,text) to service_role;
