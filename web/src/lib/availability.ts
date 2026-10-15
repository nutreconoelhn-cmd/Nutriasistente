import { supabase } from "./supabase";
import { currentBookingDates } from "./schedule";

export async function getAvailability(clinicId: string) {
  const { data, error } = await supabase
    .from("availability")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("day_of_week");

  if (error) {
    throw new Error(
      `Error al obtener disponibilidad: ${error.message}`
    );
  }

  return data;
}

export async function getScheduleDays(clinicId: string) {
  const dates = currentBookingDates();
  const { data, error } = await supabase.from("clinic_schedule_days")
    .select("date,status,city,address,start_time,end_time,modality,slot_times")
    .eq("clinic_id", clinicId).gte("date", dates[0]).lte("date", dates[dates.length - 1]);
  if (error) throw new Error(`Error al obtener los días de atención: ${error.message}`);
  return data ?? [];
}
