import { createSupabaseServerClient } from "@/lib/supabase-server";
import { whatsappDb } from "@/lib/whatsapp-bot";
import { hoursFor, hondurasDate } from "@/lib/schedule";

export type RequestDetails = {
  kind?: string;
  appointmentId?: string;
  appointmentTitle?: string;
  requestedDate?: string;
  requestedTime?: string;
  message?: string;
  requestedAt?: string;
  lastReplyAt?: string;
  resolvedAt?: string;
  noticeText?: string;
  noticePending?: boolean;
  serviceId?: string;
  name?: string;
  birth?: string;
  email?: string;
  guardian?: string;
  contactPhone?: string;
  modality?: string;
  start?: string;
  end?: string;
  paymentId?: string;
};

export async function adminUser() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  return user;
}

export async function isWhatsappAdmin(userId: string) {
  const { data, error } = await whatsappDb().from("whatsapp_bot_admins")
    .select("user_id").eq("user_id", userId)
    .eq("clinic_id", process.env.WHATSAPP_CLINIC_ID!).maybeSingle();
  if (error) throw new Error("No se pudo comprobar el acceso al panel");
  return Boolean(data);
}

export async function requestedSlot(phone: string, details: RequestDetails) {
  const db = whatsappDb();
  const { data: appointment, error } = await db.from("appointments")
    .select("id,patient_id,clinic_id,modality,starts_at,ends_at,status")
    .eq("id", details.appointmentId ?? "").eq("clinic_id", process.env.WHATSAPP_CLINIC_ID!)
    .in("status", ["pending", "confirmed"]).maybeSingle();
  if (error || !appointment || !/^\d{4}-\d{2}-\d{2}$/.test(details.requestedDate ?? "")
      || !/^\d{2}:\d{2}$/.test(details.requestedTime ?? "")) return { available: false, reason: "Cita o fecha inválida" };
  const { data: patient, error: patientError } = await db.from("patients")
    .select("phone").eq("id", appointment.patient_id).eq("clinic_id", appointment.clinic_id).single();
  if (patientError || patient?.phone?.replace(/\D/g, "") !== phone) return { available: false, reason: "El WhatsApp no coincide con la reserva" };
  const start = new Date(`${details.requestedDate}T${details.requestedTime}:00-06:00`);
  const duration = new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime();
  const end = new Date(start.getTime() + duration);
  const endParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Tegucigalpa", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(end);
  const endTime = `${endParts.find((part) => part.type === "hour")?.value}:${endParts.find((part) => part.type === "minute")?.value}`;
  const day = new Date(`${details.requestedDate}T12:00:00-06:00`).getUTCDay();
  const isSunday = day === 0;
  if (!Number.isFinite(start.getTime()) || start.getTime() < Date.now() + 15 * 60000
      || duration <= 0 || duration > 4 * 3600000 || day === 6
      || hondurasDate(end) !== details.requestedDate) {
    return { available: false, reason: "Fecha pasada o fuera del horario de atención" };
  }
  const [{ data: weekly, error: weeklyError }, { data: special, error: specialError }] = await Promise.all([
    db.from("availability").select("day_of_week,start_time,end_time,modality")
      .eq("clinic_id", appointment.clinic_id).eq("day_of_week", isSunday ? 7 : day).eq("active", true),
    db.from("clinic_schedule_days").select("date,status,city,address,start_time,end_time,modality,slot_times")
      .eq("clinic_id", appointment.clinic_id).eq("date", details.requestedDate!).maybeSingle(),
  ]);
  if (weeklyError || specialError) throw new Error("No se pudo comprobar el horario");
  const matches = hoursFor(details.requestedDate!, appointment.modality, weekly ?? [], special ? [special] : [])
    .some((row) => (!row.slot_start_only || row.start_time.slice(0,5) === details.requestedTime!) && row.start_time.slice(0, 5) <= details.requestedTime!
      && row.end_time.slice(0, 5) >= endTime);
  if (!matches) return { available: false, reason: "No hay atención configurada a esa hora, ciudad y modalidad" };
  const { data: clashes, error: clashError } = await db.from("appointments")
    .select("id").eq("clinic_id", appointment.clinic_id).neq("id", appointment.id)
    .in("status", ["pending", "confirmed"]).lt("starts_at", end.toISOString())
    .gt("ends_at", start.toISOString()).limit(1);
  if (clashError) throw new Error(clashError.message);
  if (clashes?.length) return { available: false, reason: "El horario ya está ocupado" };
  return { available: true, isSunday, start: start.toISOString(), end: end.toISOString(), appointmentId: appointment.id };
}

export async function sundaySlot(details: RequestDetails) {
  const db = whatsappDb();
  if (!details.serviceId || !details.start || !details.end || !details.name || !details.birth
      || !["presencial", "online"].includes(details.modality ?? "")) return { available: false, reason: "Faltan datos de esta solicitud" };
  const start = new Date(details.start);
  const end = new Date(details.end);
  if (!Number.isFinite(start.getTime()) || start.getTime() < Date.now() + 15 * 60000 || end <= start
    || start.getUTCDay() !== 0 || start.getUTCHours() * 60 + start.getUTCMinutes() - 360 < 480
    || end.getUTCHours() * 60 + end.getUTCMinutes() - 360 > 960
    || start.toISOString().slice(0, 10) !== end.toISOString().slice(0, 10)) {
    return { available: false, reason: "La fecha u hora del domingo ya no es válida" };
  }
  const { data: service, error: serviceError } = await db.from("services")
    .select("id").eq("id", details.serviceId).eq("clinic_id", process.env.WHATSAPP_CLINIC_ID!).eq("active", true).maybeSingle();
  if (serviceError || !service) return { available: false, reason: "Servicio no disponible" };
  const { data: clashes, error: clashError } = await db.from("appointments")
    .select("id").eq("clinic_id", process.env.WHATSAPP_CLINIC_ID!)
    .in("status", ["pending", "confirmed"]).lt("starts_at", end.toISOString())
    .gt("ends_at", start.toISOString()).limit(1);
  if (clashError) throw new Error(clashError.message);
  return clashes?.length ? { available: false, reason: "El horario ya está ocupado" } : { available: true, isSunday: true, start: start.toISOString(), end: end.toISOString() };
}
