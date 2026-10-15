begin;
create table if not exists public.whatsapp_bot_settings(
 clinic_id uuid primary key references public.clinics(id),
 bot_enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.whatsapp_bot_settings enable row level security;
revoke all on public.whatsapp_bot_settings from public,anon,authenticated;
grant all on public.whatsapp_bot_settings to service_role;

-- La excepción pertenece a una cita concreta, no abre el horario al público.
create table if not exists public.whatsapp_manual_approvals(
 appointment_id uuid primary key references public.appointments(id) on delete cascade deferrable initially deferred,
 clinic_id uuid not null references public.clinics(id),
 request_id uuid not null references public.whatsapp_bot_requests(id),
 starts_at timestamptz not null, ends_at timestamptz not null,
 modality text not null, city text not null, address text,
 created_at timestamptz not null default now()
);
alter table public.whatsapp_manual_approvals enable row level security;
revoke all on public.whatsapp_manual_approvals from public,anon,authenticated;
grant all on public.whatsapp_manual_approvals to service_role;

create or replace function public.check_appointment_schedule() returns trigger
language plpgsql security definer set search_path=public as $function$
begin
 if new.status in ('pending','confirmed')
  and (tg_op='INSERT' or new.starts_at is distinct from old.starts_at
   or new.ends_at is distinct from old.ends_at or new.modality is distinct from old.modality
   or old.status not in ('pending','confirmed'))
  and not public.clinic_schedule_allows(new.clinic_id,new.starts_at,new.ends_at,new.modality)
  and not exists(select 1 from public.whatsapp_manual_approvals m
   where m.appointment_id=new.id and m.clinic_id=new.clinic_id
    and m.starts_at=new.starts_at and m.ends_at=new.ends_at and m.modality=new.modality) then
  raise exception 'El día está cerrado o el horario no está disponible';
 end if;
 return new;
end;
$function$;

create or replace function public.nutriasistente_resolve_alternate(
 p_clinic_id uuid,p_request_id uuid,p_action text,p_city text,p_address text,p_note text default ''
) returns jsonb language plpgsql security definer set search_path=public
as $function$
declare
 r public.whatsapp_bot_requests%rowtype; d jsonb;
 a public.appointments%rowtype; s public.services%rowtype;
 v_start timestamptz; v_end timestamptz; v_birth date;
 v_patient uuid; v_appointment uuid; v_payment uuid;
 v_notice text; v_amount numeric; v_requested timestamptz; v_scheduled_city text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Acceso no autorizado'; end if;
 if p_action is null or p_action not in ('accept','reject') then raise exception 'Acción inválida'; end if;
 if length(coalesce(p_note,''))>1000 then raise exception 'El mensaje es demasiado largo'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_clinic_id::text,0));
 select * into r from public.whatsapp_bot_requests
  where id=p_request_id and clinic_id=p_clinic_id and kind='fecha_alternativa' for update;
 if not found or r.status<>'pending' or r.details ? 'resolvedAt' then
  raise exception 'La solicitud ya no está pendiente. Actualiza el panel.';
 end if;
 d:=r.details;
 if p_action='reject' then
  v_notice:='📅 *Sobre la fecha que solicitaste*'||E'\n\n'||
   coalesce(nullif(trim(p_note),''),'No podemos confirmar ese horario. Escríbenos para buscar otra opción que te convenga.')||
   E'\n\nTu cita anterior, si tienes una, no se ha cambiado. 💬 Escribe *MENÚ* para consultar opciones o hablar con el Lic. Noel.';
 else
  v_start:=(d->>'start')::timestamptz;
  v_requested:=(d->>'requestedAt')::timestamptz;
  if v_start is null or v_start<=now()+interval '15 minutes'
   or v_start>now()+interval '730 days'
   or extract(dow from v_start at time zone 'America/Tegucigalpa')=6
   or (v_start at time zone 'America/Tegucigalpa')::time<time '08:00' then
   raise exception 'La fecha propuesta ya pasó o está fuera de los días y horarios de atención';
  end if;
  if length(trim(coalesce(p_city,'')))<2 or length(p_city)>100
   or length(coalesce(p_address,''))>240 then raise exception 'Revisa la ciudad y dirección'; end if;
  if d->>'altType'='reprogramacion' then
   select * into a from public.appointments where id=(d->>'appointmentId')::uuid
    and clinic_id=p_clinic_id and status in ('pending','confirmed') for update;
   if not found or not exists(select 1 from public.patients where id=a.patient_id
    and clinic_id=p_clinic_id and regexp_replace(coalesce(phone,''),'\D','','g')=r.phone) then
    raise exception 'La cita original no corresponde a esta conversación'; end if;
   if v_requested is null or v_requested>now() or a.starts_at-v_requested<interval '24 hours' then
    raise exception 'El cambio se solicitó con menos de 24 horas de anticipación. Habla con el paciente.'; end if;
   select * into s from public.services where id=a.service_id and clinic_id=p_clinic_id and active;
   v_appointment:=a.id;v_patient:=a.patient_id;
  else
   select * into s from public.services where id=(d->>'serviceId')::uuid and clinic_id=p_clinic_id and active;
  end if;
  if s.id is null then raise exception 'El servicio ya no está disponible'; end if;
  v_end:=v_start+make_interval(mins=>coalesce(s.duration_minutes,60));
  if coalesce(s.duration_minutes,60)<1 or coalesce(s.duration_minutes,60)>240
   or (v_end at time zone 'America/Tegucigalpa')::date<>(v_start at time zone 'America/Tegucigalpa')::date
   or (v_end at time zone 'America/Tegucigalpa')::time>time '16:00'
   or d->>'modality' is null or d->>'modality' not in ('presencial','online') then
    raise exception 'La consulta debe terminar a más tardar a las 4:00 p. m.'; end if;
  if d->>'modality'<>'online' and length(trim(coalesce(p_address,'')))<5 then raise exception 'Escribe la dirección exacta'; end if;
  if d->>'modality'<>'online' then
   select city into v_scheduled_city from public.clinic_schedule_days
    where clinic_id=p_clinic_id and date=(v_start at time zone 'America/Tegucigalpa')::date;
   if translate(lower(trim(p_city)),'áéíóúüñ','aeiouun')<>
      translate(lower(trim(coalesce(v_scheduled_city,'San Pedro Sula'))),'áéíóúüñ','aeiouun') then
    raise exception 'Configura primero esa ciudad en Días y ciudades para la fecha solicitada. No se cambia la sede automáticamente al aceptar.';
   end if;
  end if;
  if exists(select 1 from public.appointments where clinic_id=p_clinic_id
   and status in ('pending','confirmed') and id<>coalesce(v_appointment,'00000000-0000-0000-0000-000000000000'::uuid)
   and starts_at<v_end and ends_at>v_start) then
   raise exception 'No hay cupo en ese horario. La solicitud sigue pendiente.'; end if;
  if d->>'altType' is distinct from 'reprogramacion' then
   v_birth:=(d->>'birth')::date;
   if length(trim(coalesce(d->>'name','')))<3 or length(d->>'name')>120
    or v_birth is null or v_birth>current_date or v_birth<current_date-interval '120 years'
    or (v_birth>current_date-interval '19 years' and length(trim(coalesce(d->>'guardian','')))<3)
    or r.phone !~ '^\d{8,16}$' then raise exception 'Faltan datos del paciente o del responsable'; end if;
   insert into public.patients(clinic_id,full_name,birth_date,phone,email,is_pediatric,status,source)
    values(p_clinic_id,trim(d->>'name'),v_birth,'+'||r.phone,nullif(d->>'email',''),v_birth>current_date-interval '19 years','active','whatsapp') returning id into v_patient;
   v_appointment:=gen_random_uuid();
  end if;
  insert into public.whatsapp_manual_approvals(appointment_id,clinic_id,request_id,starts_at,ends_at,modality,city,address)
   values(v_appointment,p_clinic_id,r.id,v_start,v_end,d->>'modality',trim(p_city),nullif(trim(p_address),''))
   on conflict(appointment_id) do update set request_id=excluded.request_id,starts_at=excluded.starts_at,
    ends_at=excluded.ends_at,modality=excluded.modality,city=excluded.city,address=excluded.address;
  if d->>'altType'='reprogramacion' then
   update public.appointments set starts_at=v_start,ends_at=v_end,modality=d->>'modality',updated_at=now(),hold_expires_at=case when status='pending' then now()+interval '30 minutes' else null end where id=v_appointment;
   v_notice:='✅ *Reprogramación aceptada*';
  else
   insert into public.appointments(id,clinic_id,patient_id,service_id,starts_at,ends_at,modality,status,source,notes,hold_expires_at)
    values(v_appointment,p_clinic_id,v_patient,s.id,v_start,v_end,d->>'modality','pending','whatsapp',
     concat_ws(E'\n','Solicitud de fecha alternativa aprobada',nullif('Responsable: '||coalesce(d->>'guardian',''), 'Responsable: '),nullif('Contacto: '||coalesce(d->>'contactPhone',''),'Contacto: ')),now()+interval '30 minutes');
   v_amount:=round(s.price*0.5,2);
   insert into public.payments(clinic_id,patient_id,appointment_id,amount,currency,payment_type,status)
    values(p_clinic_id,v_patient,v_appointment,v_amount,s.currency,'advance','pending') returning id into v_payment;
   v_notice:='✅ *Horario aceptado por el consultorio*';
  end if;
  v_notice:=v_notice||E'\n\n📅 '||coalesce(d->>'dateLabel',to_char(v_start at time zone 'America/Tegucigalpa','DD/MM/YYYY'))||
   E'\n🕐 '||coalesce(d->>'timeLabel',to_char(v_start at time zone 'America/Tegucigalpa','HH12:MI AM'))||
   E'\n📍 '||case when d->>'modality'='online' then 'Consulta en línea; el consultorio te indicará cómo conectarte.' else trim(p_city)||' · '||trim(p_address) end;
  if v_payment is null then
   v_notice:=v_notice||E'\n\nTu cita anterior ha sido reemplazada. Si ya tenías un depósito aprobado para esa reserva, se conserva; no necesitas pagar nuevamente.';
  else
   v_notice:=v_notice||E'\n\n💳 Para completar la reserva necesitas un anticipo del 50%: '||case when s.currency='HNL' then 'L ' else s.currency||' ' end||v_amount::text||E'.\nEnvía el comprobante por este chat. Si estás en otro paso, escribe *MENÚ* y elige *Consultar una reserva*. La cita se confirma después de revisar el pago.';
  end if;
  v_notice:=v_notice||E'\n\n📌 El depósito no es reembolsable. Para poder utilizarlo al reprogramar, avisa con al menos 24 horas de anticipación; con menos tiempo no se puede reutilizar.\n💬 Para hablar con el Lic. Noel, escribe *MENÚ* y elige *6*.';
  if nullif(trim(p_note),'') is not null then v_notice:=v_notice||E'\n\n💬 '||trim(p_note); end if;
  d:=d||jsonb_build_object('appointmentId',v_appointment,'city',trim(p_city),'address',trim(p_address));
  if v_payment is not null then d:=d||jsonb_build_object('paymentId',v_payment); end if;
 end if;
 d:=d||jsonb_build_object('resolvedAt',now(),'resolution',p_action,'noticeText',v_notice,'noticePending',true);
 update public.whatsapp_bot_requests set status='resolved',details=d where id=r.id;
 update public.whatsapp_bot_sessions set step=case when v_payment is not null then 'receipt' else 'menu' end,
  details=case when v_payment is not null then jsonb_build_object('paymentId',v_payment,'appointmentId',v_appointment) else '{}'::jsonb end,updated_at=now()
  where clinic_id=p_clinic_id and phone=r.phone
   and (details->>'requestId'=r.id::text or step='menu');
 return d;
end;
$function$;
revoke all on function public.nutriasistente_resolve_alternate(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.nutriasistente_resolve_alternate(uuid,uuid,text,text,text,text) to service_role;

create or replace function public.nutriasistente_claim_request_notice(p_clinic_id uuid,p_request_id uuid)
returns boolean language plpgsql security definer set search_path=public as $function$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Acceso no autorizado'; end if;
 update public.whatsapp_bot_requests set details=details||jsonb_build_object('noticeSendingAt',now())
 where id=p_request_id and clinic_id=p_clinic_id and kind='fecha_alternativa'
  and details->>'noticePending'='true'
  and (nullif(details->>'noticeSendingAt','') is null or (details->>'noticeSendingAt')::timestamptz<now()-interval '2 minutes');
 return found;
end;
$function$;
revoke all on function public.nutriasistente_claim_request_notice(uuid,uuid) from public,anon,authenticated;
grant execute on function public.nutriasistente_claim_request_notice(uuid,uuid) to service_role;
notify pgrst, 'reload schema';
commit;
