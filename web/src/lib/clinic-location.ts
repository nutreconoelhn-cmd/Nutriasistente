import { defaultAddress, placeFor, type ScheduleDay } from "@/lib/schedule";
import { hondurasDate } from "@/lib/schedule";
import type { SupabaseClient } from "@supabase/supabase-js";

export const consultationAddress = defaultAddress;

export function consultationLocation(modality: string) {
  return modality === "online" ? "💻 Consulta en línea; el consultorio te indicará cómo conectarte." : `📍 Lugar: ${consultationAddress}`;
}

export function consultationLocationFor(date: string, modality: string, days: ScheduleDay[]) {
  return placeFor(date, modality, days);
}

export async function appointmentLocation(db: SupabaseClient, startsAt: string, modality: string, clinicId: string) {
  if(modality!=="online") {
    const {data:manual,error:manualError}=await db.from("whatsapp_manual_approvals")
      .select("city,address,appointments!inner(status)")
      .eq("clinic_id",clinicId).eq("starts_at",startsAt)
      .in("appointments.status",["pending","confirmed"]).maybeSingle();
    if(manualError)throw new Error("No se pudo comprobar el lugar aprobado de la consulta");
    if(manual)return `📍 Lugar: ${manual.city} · ${manual.address}`;
  }
  const date = hondurasDate(new Date(startsAt));
  const { data, error } = await db.from("clinic_schedule_days")
    .select("date,status,city,address,start_time,end_time,modality")
    .eq("clinic_id", clinicId).eq("date", date).maybeSingle();
  if (error) throw new Error("No se pudo comprobar el lugar de la consulta");
  return placeFor(date, modality, data ? [data as ScheduleDay] : []);
}
