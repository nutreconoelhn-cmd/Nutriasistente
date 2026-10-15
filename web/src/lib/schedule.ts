export type ScheduleDay = {
  date: string; status: string; city: string; address: string | null;
  start_time: string | null; end_time: string | null; modality: string;
};
export type WeeklyHours = { day_of_week: number; start_time: string; end_time: string; modality: string; active?: boolean };

export const defaultAddress = "Hospital del Valle, Condominio 2, Consultorio 303";
export const hondurasDate = (at = new Date()) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit", day: "2-digit",
}).format(at);
export function addDays(date: string, days: number) {
  const at = new Date(`${date}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}
export function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}
export function currentBookingDates(today = hondurasDate()) {
  const day = weekday(today);
  const sunday = addDays(today, day === 6 ? 1 : -day);
  const result: string[] = [];
  for (let offset = 0; offset < 6; offset++) {
    const date = addDays(sunday, offset);
    if (date >= today) result.push(date);
  }
  return result;
}
export function hoursFor(date: string, modality: string, weekly: WeeklyHours[], overrides: ScheduleDay[]): WeeklyHours[] {
  const override = overrides.find((item) => item.date === date);
  if (override) {
    if (override.status !== "open" || !override.start_time || !override.end_time
      || ![modality, "ambas"].includes(override.modality)) return [];
    return [{ day_of_week: weekday(date) || 7, start_time: override.start_time, end_time: override.end_time, modality: override.modality }];
  }
  if (weekday(date) === 0 || weekday(date) === 6) return [];
  const day = weekday(date);
  return weekly.filter((row) => row.day_of_week === day && row.active !== false
    && [modality, "ambas", "both", "presencial + online"].includes(row.modality));
}
export function placeFor(date: string, modality: string, overrides: ScheduleDay[]) {
  if (modality === "online") return "💻 Consulta en línea; el consultorio te indicará cómo conectarte.";
  const override = overrides.find((item) => item.date === date && item.status === "open");
  return `📍 Lugar: ${override?.city || "San Pedro Sula"} · ${override?.address || defaultAddress}`;
}
