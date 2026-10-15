"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { currentBookingDates, hoursFor, placeFor, type ScheduleDay } from "@/lib/schedule";

type Availability = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  modality: string;
};

type BookingCalendarProps = {
  availability: Availability[];
  scheduleDays: ScheduleDay[];
  today: string;
  nowIso: string;
  occupancy: { date: string; slots: { starts_at: string; ends_at: string }[] }[];
  durationMinutes: number;
  clinicId: string;
  serviceId: string;
  modality: "presencial" | "online";
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-HN", {
    timeZone: "UTC", weekday: "long",
    day: "numeric",
    month: "long", year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

function generateTimeSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number
) {
  const slots: string[] = [];

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  let current = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;

  while (current + durationMinutes <= end) {
    const hour = Math.floor(current / 60);
    const minute = current % 60;

    slots.push(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    );

    current += durationMinutes;
  }

  return slots;
}

function slotsFor(row: { start_time: string; end_time: string; slot_start_only?: boolean }, duration: number) {
  const times = generateTimeSlots(row.start_time, row.end_time, duration);
  return row.slot_start_only ? times.slice(0, 1) : times;
}

export default function BookingCalendar({
  availability,
  scheduleDays,
  today,
  nowIso,
  occupancy,
  durationMinutes,
  clinicId,
  serviceId,
  modality,
}: BookingCalendarProps) {
  const router = useRouter();
  const days = useMemo(() => currentBookingDates(today), [today]);

  const availableDays = days.filter((date) => {
    const rows = hoursFor(date, modality, availability, scheduleDays);
    const booked = occupancy.find((entry) => entry.date === date)?.slots ?? [];
    return rows.some((row) => slotsFor(row, durationMinutes).some((time) => {
      const start = new Date(`${date}T${time}:00-06:00`).getTime();
      const end = start + durationMinutes * 60000;
      return start > Date.parse(nowIso) + 15 * 60000 && !booked.some((item) =>
        new Date(item.starts_at).getTime() < end && new Date(item.ends_at).getTime() > start);
    }));
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const timeSlots = selectedDate ? hoursFor(selectedDate, modality, availability, scheduleDays)
    .flatMap((item) => slotsFor(item, durationMinutes))
    .filter((slot, i, slots) => slots.indexOf(slot) === i)
    .filter((slot) => new Date(`${selectedDate}T${slot}:00-06:00`).getTime() > Date.parse(nowIso) + 15 * 60000) : [];

  async function loadBookedSlots(date: string) {
    setLoadingSlots(true);
    setBookedSlots([]);
    setSelectedTime(null);

    const start = new Date(`${date}T00:00:00-06:00`);
    const end = new Date(`${date}T23:59:59-06:00`);

    const { data, error } = await supabase.rpc("get_booked_slots", {
      p_clinic_id: clinicId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    });

    if (error) {
      console.error(error);
      setLoadingSlots(false);
      return;
    }

    const dayTimes = hoursFor(date, modality, availability, scheduleDays)
      .flatMap((item) => slotsFor(item, durationMinutes));
    const booked = dayTimes.filter((time) => {
      const slotStart = new Date(`${date}T${time}:00-06:00`).getTime();
      const slotEnd = slotStart + durationMinutes * 60000;
      return (data ?? []).some((row: { starts_at: string; ends_at: string }) =>
        new Date(row.starts_at).getTime() < slotEnd && new Date(row.ends_at).getTime() > slotStart);
    });

    setBookedSlots(booked);
    setLoadingSlots(false);
  }

  function continueBooking() {
    if (!selectedDate || !selectedTime) return;

    const params = new URLSearchParams({
      serviceId,
      modality,
      date: selectedDate,
      time: selectedTime,
    });

    router.push(`/reservar/datos?${params.toString()}`);
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">
        Elige fecha y hora
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Selecciona uno de los horarios disponibles.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {availableDays.map((key) => {
          const selected = selectedDate === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSelectedDate(key);
                loadBookedSlots(key);
              }}
              className={`rounded-xl border p-4 text-left transition ${
                selected
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-slate-200 hover:border-emerald-500"
              }`}
            >
              <span className="block text-sm font-medium capitalize text-slate-500">
                {formatDate(key)}
              </span>

              <span className="mt-1 block font-semibold text-slate-900">
                {scheduleDays.find((item) => item.date === key)?.city || "San Pedro Sula"}
              </span>
            </button>
          );
        })}
      </div>

      {!availableDays.length && <p className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-900">No quedan horarios publicados para esta semana. Consulta de nuevo cuando se actualice el calendario.</p>}

      {selectedDate && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-slate-900">
            Horarios disponibles
          </h3>
          <p className="mt-1 text-sm text-slate-600">{placeFor(selectedDate, modality, scheduleDays).replace(/^[^ ]+ /u, "")}</p>

          {loadingSlots ? (
            <p className="mt-4 text-sm text-slate-500">
              Comprobando disponibilidad...
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {timeSlots.map((time) => {
                const isBooked = bookedSlots.includes(time);
                const selected = selectedTime === time;

                return (
                  <button
                    key={time}
                    type="button"
                    disabled={isBooked}
                    onClick={() => setSelectedTime(time)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                      isBooked
                        ? "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400"
                        : selected
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-200 text-slate-700 hover:border-emerald-500"
                    }`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedDate && selectedTime && (
        <div className="mt-8 rounded-xl bg-slate-50 p-5">
          <p className="text-sm text-slate-500">
            Horario seleccionado
          </p>

          <p className="mt-1 font-semibold text-slate-900">
            {selectedDate} · {selectedTime}
          </p>

          <p className="mt-2 text-sm text-slate-600">{placeFor(selectedDate, modality, scheduleDays).replace(/^[^ ]+ /u, "")}</p>

          <p className="mt-2 text-sm text-slate-500">
            Modalidad:{" "}
            <span className="font-medium text-slate-700">
              {modality === "presencial" ? "Presencial" : "Online"}
            </span>
          </p>

          <button
            type="button"
            onClick={continueBooking}
            className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
          >
            Continuar
          </button>
        </div>
      )}
    </div>
  );
}
