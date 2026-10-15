import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { appointmentDate, appointmentTime, binaryAnswer, choiceNumber, menuIntent, modalityIntent, serviceIndex } from "@/lib/whatsapp-input";
import { currentBookingDates, hoursFor, placeFor, type ScheduleDay } from "@/lib/schedule";
import { setConversationMode } from "@/lib/whatsapp-inbox";
import { metaAccessToken } from "@/lib/meta-access-token";

type Session = { step: string; details: Record<string, string> };
type Incoming = { id: string; from: string; type: string; text?: { body?: string }; image?: { id?: string; mime_type?: string }; document?: { id?: string; mime_type?: string } };
type Service = { id: string; name: string; price: number; currency: string; duration_minutes: number | null };
type Slot = { label: string; start: string; end: string };

const clinicId = () => process.env.WHATSAPP_CLINIC_ID!;
const graphRoot = () => `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION}`;
const clean = (input: string) => input.trim().toLocaleLowerCase("es-HN").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const localDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const localDay = (date: string) => { const d = new Date(`${date}T12:00:00-06:00`).getUTCDay(); return d === 0 ? 7 : d; };
const localStamp = (date: string, time: string) => new Date(`${date}T${time}:00-06:00`);
const money = (amount: number, currency: string) => `${currency === "HNL" ? "L" : currency} ${Number(amount).toLocaleString("es-HN")}`;
const numberEmoji = (index: number) => ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"][index] ?? `${index + 1}.`;
const serviceEmoji = (name: string) => {
  const value = clean(name);
  if (value.includes("peso")) return "⚖️";
  if (value.includes("cronica") || value.includes("metabolica")) return "🩺";
  if (value.includes("gastrointestinal") || value.includes("digestiv")) return "🩺";
  if (value.includes("pediatr")) return "👶";
  if (value.includes("embarazo")) return "🤰";
  return "🥗";
};
const longDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-HN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const longBirth = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
};
const displayTime = (date: string) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Tegucigalpa", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(new Date(date));
  return `${parts.find((part) => part.type === "hour")?.value}:${parts.find((part) => part.type === "minute")?.value} ${parts.find((part) => part.type === "dayPeriod")?.value === "AM" ? "a. m." : "p. m."}`;
};
const parseBirth = (input: string): string | null => {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (!match) return null;
  const [, rawDay, rawMonth, rawYear] = match;
  const day = Number(rawDay), month = Number(rawMonth), year = Number(rawYear);
  const birth = new Date(Date.UTC(year, month - 1, day, 12));
  const today = localDate(new Date());
  const iso = `${rawYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (birth.getUTCFullYear() !== year || birth.getUTCMonth() !== month - 1 || birth.getUTCDate() !== day
      || iso > today || year < Number(today.slice(0, 4)) - 120) return null;
  return iso;
};
const patientAgeMonths = (birth: string) => {
  const [year, month, day] = birth.split("-").map(Number);
  const [nowYear, nowMonth, nowDay] = localDate(new Date()).split("-").map(Number);
  return (nowYear - year) * 12 + nowMonth - month - Number(nowDay < day);
};
const patientAge = (birth: string) => {
  const totalMonths = patientAgeMonths(birth);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return `${years} ${years === 1 ? "año" : "años"} y ${months} ${months === 1 ? "mes" : "meses"}`;
};
const welcome = "👋 ¡Hola! Bienvenido/a.\n\nSoy el asistente virtual del *Lic. Noel Márquez | Nutricionista Clínico y Pediátrico* 🥗\n\nEstoy aquí para ayudarte con tu consulta y hacer más fácil tu proceso de atención. 😊\n\n¿Qué deseas hacer?\n\n1️⃣ Agendar una consulta\n2️⃣ Ver servicios y precios\n3️⃣ Consultar una reserva\n4️⃣ Reprogramar una cita\n5️⃣ Cancelar una cita\n6️⃣ Hablar con el nutricionista\n7️⃣ ¿Qué incluye la consulta nutricional?\n\n💬 Responde con la opción que deseas.";
const consultationInfo = "🥗 *¿Qué incluye la consulta nutricional?*\n\nRealizaremos una valoración para conocer tu estado nutricional y establecer objetivos según tus necesidades. 🙌\n\n👤 Evaluación nutricional personalizada\n📏 Evaluación antropométrica y de composición corporal, cuando corresponda\n🩺 Revisión de antecedentes de salud y alimentación\n🍽️ Evaluación de hábitos alimentarios\n🎯 Objetivos nutricionales acordados contigo\n📋 Plan de alimentación personalizado\n💊 Orientación sobre suplementación, si es necesaria\n💬 Recomendaciones y educación nutricional\n\n💰 *Valor: L 1,200*\n🏥 La sede se indica al escoger fecha: regularmente Hospital del Valle en San Pedro Sula; también habrá jornadas en Santa Bárbara y otras ciudades. Puedes elegir consulta en línea.\n\n¿Te gustaría agendar? 😊\n\n1️⃣ 📅 Sí, quiero agendar\n2️⃣ 📋 Ver servicios disponibles\n3️⃣ 👨‍⚕️ Hablar con el nutricionista\n\n💬 Responde con la opción que prefieras.\n\n↩️ Escribe *MENÚ* para volver.";
const menuHint = "\n\n↩️ Escribe *MENÚ* para volver al menú principal.";
const backHint = "\n\n↩️ Escribe *ATRÁS* para regresar.";
const noNewAppointment = /\b(no (quiero|necesito|deseo) (otra |una )?(cita|consulta)|ya no (quiero|necesito) (cita|consulta))\b/;
const yesNo = (value: string) => {
  const answer = binaryAnswer(value);
  return answer === "yes" ? "1" : answer === "no" ? "2" : String(choiceNumber(value, 2) ?? value);
};
const parsePhone = (input: string) => {
  if (!/^[+\d\s()-]+$/.test(input.trim())) return null;
  const digits = input.replace(/[^\d]/g, "");
  return digits.length === 8 ? `+504${digits}` : digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
};

export function whatsappDb(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function checked<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const result = await promise;
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function save(db: SupabaseClient, from: string, step: string, details: Record<string, string>) {
  await checked(db.from("whatsapp_bot_sessions").upsert({ clinic_id: clinicId(), phone: from, step, details, updated_at: new Date().toISOString() }));
}

async function saveRequest(db: SupabaseClient, from: string, kind: string, details: Record<string, string>) {
  const { data, error } = await db.from("whatsapp_bot_requests")
    .insert({ clinic_id: clinicId(), phone: from, kind, details: { ...details, kind } })
    .select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Could not save request");
  await save(db, from, "human_pending", { ...details, kind, requestId: data.id });
  if (kind === "mensaje" || kind === "llamada") await setConversationMode(db, from, "human");
}

async function services(db: SupabaseClient): Promise<Service[]> {
  return (await checked(db.from("services").select("id,name,price,currency,duration_minutes").eq("clinic_id", clinicId()).eq("active", true).order("name"))) ?? [];
}

function serviceList(list: Service[]) {
  if (!list.length) return "📋 Por ahora no hay servicios disponibles. Intenta más tarde.";
  const samePrice = list.every((item) => item.price === list[0].price && item.currency === list[0].currency);
  return `📋 *Servicios disponibles*\n\n${samePrice ? `💰 *Precio de los servicios: ${money(list[0].price, list[0].currency)}*\n\n` : ""}${list.map((item, i) => `${numberEmoji(i)} ${serviceEmoji(item.name)} ${item.name}${samePrice ? "" : ` · ${money(item.price, item.currency)}`}`).join("\n")}\n\n💬 Responde con el número del servicio que deseas.${menuHint}`;
}

type PatientAppointment = { id: string; patient_id: string; service_id: string | null; starts_at: string; modality: string; status: string; full_name: string };

async function ownAppointments(db: SupabaseClient, from: string): Promise<PatientAppointment[]> {
  const phone = `+${from.replace(/\D/g, "")}`;
  const patients: { id: string; full_name: string }[] = (await checked(db.from("patients").select("id,full_name").eq("clinic_id", clinicId()).eq("phone", phone).limit(100))) ?? [];
  if (!patients.length) return [];
  const appointments: Omit<PatientAppointment, "full_name">[] = (await checked(db.from("appointments").select("id,patient_id,service_id,starts_at,modality,status").eq("clinic_id", clinicId()).in("patient_id", patients.map((patient) => patient.id)).gte("starts_at", new Date(Date.now() - 86400000).toISOString()).in("status", ["pending", "confirmed"]).order("starts_at").limit(10))) ?? [];
  return appointments.map((appointment) => ({ ...appointment, full_name: patients.find((patient) => patient.id === appointment.patient_id)?.full_name ?? "Paciente" }));
}

function appointmentList(list: PatientAppointment[], listServices: Service[], action: "consultar" | "reprogramar" | "cancelar") {
  if (!list.length) return `🔎 No encontré citas próximas asociadas a este WhatsApp.${menuHint}`;
  return `📅 *Tus próximas citas*\n\n${list.map((appointment, i) => `${numberEmoji(i)} ${appointment.full_name}\n${longDate(localDate(new Date(appointment.starts_at)))}, ${displayTime(appointment.starts_at)}\n${listServices.find((service) => service.id === appointment.service_id)?.name ?? "Consulta"} · ${appointment.status === "confirmed" ? "Confirmada" : "Pendiente"}`).join("\n\n")}\n\n💬 ¿Cuál cita deseas ${action}? Responde con la *opción* que aparece junto a la cita (por ejemplo, *1* para 1️⃣). No necesitas escribir tu teléfono.${menuHint}`;
}

async function dates(db: SupabaseClient, modality: string): Promise<string[]> {
  const week = currentBookingDates();
  const av: { day_of_week: number; start_time: string; end_time: string; modality: string }[] = (await checked(db.from("availability").select("day_of_week,start_time,end_time,modality").eq("clinic_id", clinicId()).eq("active", true))) ?? [];
  const overrides = await scheduleDays(db, week[0], week.at(-1));
  const possible = week.filter((date) => hoursFor(date, modality, av, overrides).length > 0);
  const open = await Promise.all(possible.map(async (date) => ({ date, count: (await slots(db, date, modality, 60)).length })));
  return open.filter((day) => day.count > 0).map((day) => day.date);
}
async function scheduleDays(db: SupabaseClient, first: string, last?: string): Promise<ScheduleDay[]> {
  const query = db.from("clinic_schedule_days").select("date,status,city,address,start_time,end_time,modality,slot_times")
    .eq("clinic_id", clinicId()).gte("date", first);
  return (await checked(last ? query.lte("date", last) : query.eq("date", first))) ?? [];
}
async function visitLocation(db: SupabaseClient, date: string, modality: string) {
  return placeFor(date, modality, await scheduleDays(db, date, date));
}
async function dateList(db: SupabaseClient, available: string[]) {
  if (!available.length) return "";
  const overrides = await scheduleDays(db, available[0], available.at(-1));
  return available.map((date, i) => {
    const special = overrides.find((row) => row.date === date && row.status === "open");
    return `${numberEmoji(i)} ${longDate(date)}${special ? ` · ${special.city}` : " · San Pedro Sula"}`;
  }).join("\n");
}

async function slots(db: SupabaseClient, date: string, modality: string, duration: number): Promise<Slot[]> {
  const weekly: { day_of_week: number; start_time: string; end_time: string; modality: string }[] = (await checked(db.from("availability").select("day_of_week,start_time,end_time,modality").eq("clinic_id", clinicId()).eq("active", true).eq("day_of_week", localDay(date)))) ?? [];
  const rows = hoursFor(date, modality, weekly, await scheduleDays(db, date, date));
  const { data: occupied, error } = await db.rpc("get_booked_slots", { p_clinic_id: clinicId(), p_start: localStamp(date, "00:00").toISOString(), p_end: localStamp(date, "23:59").toISOString() });
  if (error) throw new Error(error.message);
  const result: Slot[] = [];
  for (const row of rows) {
    const [sh, sm] = row.start_time.split(":").map(Number);
    const [eh, em] = row.end_time.split(":").map(Number);
    for (let m = sh * 60 + sm; m + duration <= eh * 60 + em && (!row.slot_start_only || m === sh * 60 + sm); m += duration) {
      const label = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const start = localStamp(date, label);
      const end = new Date(start.getTime() + duration * 60000);
      if (start.getTime() < Date.now() + 15 * 60000) continue;
      if ((occupied ?? []).some((b: { starts_at: string; ends_at: string }) => new Date(b.starts_at) < end && new Date(b.ends_at) > start)) continue;
      result.push({ label, start: start.toISOString(), end: end.toISOString() });
    }
  }
  return result.slice(0, 20);
}

export async function paymentInstructions(db: SupabaseClient) {
  const accounts: { bank_name: string; account_type: string; account_number: string; account_holder: string }[] = (await checked(db.from("payment_accounts").select("bank_name,account_type,account_number,account_holder").eq("clinic_id", clinicId()).eq("active", true).order("display_order"))) ?? [];
  return `💳 *Anticipo para reservar: L 600 (50% del precio de L 1,200)*\n\n${accounts.length ? accounts.map((a) => `${a.bank_name} · ${a.account_type}\nCuenta: ${a.account_number}\nTitular: ${a.account_holder}`).join("\n\n") : "Contacta al consultorio para recibir los datos de pago."}\n\n📎 Después de depositar, envía *en este chat* una foto o PDF legible del comprobante. El consultorio verificará el pago antes de confirmar la cita.\n\n📌 Si necesitas cancelar o reprogramar, avísanos con al menos *24 horas de anticipación*: podrás solicitar usar el depósito aprobado una vez en otra fecha, según disponibilidad. Con menos tiempo, no se puede reutilizar. El depósito *no es reembolsable*.`;
}

async function receipt(db: SupabaseClient, paymentId: string, message: Incoming): Promise<string> {
  const media = message.image ?? message.document;
  if (!media?.id) return "📎 Envía una imagen o PDF del comprobante para revisarlo.";
  const meta = await fetch(`${graphRoot()}/${encodeURIComponent(media.id)}`, { headers: { Authorization: `Bearer ${metaAccessToken()}` } });
  if (!meta.ok) throw new Error(`Media metadata ${meta.status}`);
  const mediaInfo: { url?: string; mime_type?: string; file_size?: number } = await meta.json();
  const mime = mediaInfo.mime_type;
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };
  if (!mime || !extensions[mime] || (mediaInfo.file_size ?? 0) > 5 * 1024 * 1024 || !mediaInfo.url?.startsWith("https://")) return "📎 Acepto comprobantes JPG, PNG o PDF de hasta 5 MB. Envíalo nuevamente.";
  const content = await fetch(mediaInfo.url, { headers: { Authorization: `Bearer ${metaAccessToken()}` } });
  if (!content.ok) throw new Error(`Media download ${content.status}`);
  const bytes = await content.arrayBuffer();
  if (bytes.byteLength > 5 * 1024 * 1024) return "📎 El archivo supera 5 MB. Envía uno más pequeño.";
  const path = `${paymentId}/${crypto.randomUUID()}.${extensions[mime]}`;
  const { error: uploadError } = await db.storage.from("payment-receipts").upload(path, bytes, { contentType: mime, upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { data: payment, error: findError } = await db.from("payments").select("id,appointment_id,status").eq("id", paymentId).eq("clinic_id", clinicId()).single();
  if (findError || !payment || !["pending", "rejected"].includes(payment.status)) throw new Error("Payment not awaiting receipt");
  const { data: updated, error: updateError } = await db.from("payments").update({ status: "pending", receipt_path: path, receipt_uploaded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", paymentId).eq("clinic_id", clinicId()).in("status", ["pending", "rejected"]).select("id").single();
  if (updateError || !updated) throw new Error("Could not register receipt");
  return "✅ Recibí tu comprobante. Quedó pendiente de revisión en el consultorio; te confirmaremos la cita después de verificarlo. Si deseas escribirle al Lic. Noel, escribe *MENÚ* y elige *6*.";
}

export async function handleWhatsappMessage(db: SupabaseClient, message: Incoming): Promise<string> {
  const from = message.from;
  const { data: saved, error: loadError } = await db.from("whatsapp_bot_sessions").select("step,details").eq("clinic_id", clinicId()).eq("phone", from).maybeSingle();
  if (loadError) throw new Error(loadError.message);
  const session: Session = saved ?? { step: "menu", details: {} };
  const input = message.text?.body?.trim() ?? "";
  const value = clean(input);
  const choice = yesNo(value);
  if (value === "menu" || value === "cancelar") { await save(db, from, "menu", {}); return welcome; }
  if (noNewAppointment.test(value) && session.step !== "human_write" && session.step !== "human_call") {
    if (session.step === "human_pending" && session.details.requestId) {
      await db.from("whatsapp_bot_requests").update({ status: "resolved" })
        .eq("clinic_id", clinicId()).eq("id", session.details.requestId)
        .eq("phone", from).eq("status", "pending");
    }
    await save(db, from, "menu", {});
    return `😊 Entiendo, no agendaremos otra cita. Si necesitas ayuda más adelante, aquí estaré. Puedes escribir *MENÚ* para ver las opciones o elegir *6* para hablar con el Lic. Noel.`;
  }
  if (value === "atras") {
    if (session.step === "sunday_time") {
      const available = await dates(db, session.details.modality);
      await save(db, from, "date", { ...session.details, manualSunday: "", choices: JSON.stringify(available) });
      return `📅 *Selecciona la fecha*\n\n${await dateList(db, available)}${backHint}`;
    }
    if (session.step === "modality") {
      const list = await services(db);
      await save(db, from, "service", { choices: JSON.stringify(list.map((item) => item.id)) });
      return serviceList(list);
    }
    if (session.step === "date") {
      const selected = (await services(db)).find((item) => item.id === session.details.serviceId);
      await save(db, from, "modality", session.details);
      return selected ? `🩺 Has seleccionado:\n\n*${selected.name}* ${serviceEmoji(selected.name)}\n💰 Precio: *${money(selected.price, selected.currency)}*\n\n¿Cómo deseas recibir tu consulta?\n\n1️⃣ 🏥 Presencial\n2️⃣ 💻 En línea\n\n💬 Responde con el número de tu elección.${backHint}` : welcome;
    }
    if (session.step === "time") {
      const available = await dates(db, session.details.modality);
      await save(db, from, "date", { ...session.details, choices: JSON.stringify(available) });
      return `📅 *Selecciona la fecha de tu consulta*\n\n${await dateList(db, available)}\n\n💬 Responde con la opción de la fecha que prefieras.${backHint}`;
    }
    if (session.step === "name") {
      if (session.details.manualSunday === "true") {
        await save(db, from, "sunday_time", session.details);
        return `🕐 Escribe otra hora para el domingo ${longDate(session.details.date)} (entre 8:00 a. m. y 4:00 p. m.).${backHint}`;
      }
      const service = (await services(db)).find((item) => item.id === session.details.serviceId);
      if (!service) return welcome;
      const times = await slots(db, session.details.date, session.details.modality, service.duration_minutes ?? 60);
      await save(db, from, "time", { ...session.details, choices: JSON.stringify(times.map((slot) => slot.start)) });
      return `🕐 *Horarios disponibles* · ${longDate(session.details.date)}\n\n${times.map((slot, i) => `${numberEmoji(i)} ${displayTime(slot.start)}`).join("\n")}\n\n💬 Responde con el número del horario que prefieras.${backHint}`;
    }
    if (session.step === "patient_confirm" || session.step === "confirm" || session.step === "booking_edit") {
      await save(db, from, "name", session.details);
      return `👤 Escribe nuevamente el nombre y apellido del paciente.${menuHint}`;
    }
    await save(db, from, "menu", {});
    return welcome;
  }
  if (session.step === "receipt" && (message.image || message.document)) {
    const answer = await receipt(db, session.details.paymentId, message);
    if (answer.includes("Recibí tu comprobante")) await save(db, from, "menu", {});
    return answer;
  }
  if (session.step === "receipt") return "📎 Tu cita está pendiente. Envía aquí la imagen o PDF del comprobante de L 600. Escribe MENÚ para empezar otra reserva.";
  if (message.type !== "text") return "💬 Por favor responde con texto. Para empezar escribe MENÚ.";
  if (session.step === "human_choice") {
    if (choice === "1") { await save(db, from, "human_write", {}); return "💬 Escribe el mensaje que deseas enviarle al Lic. Noel. Lo dejaré en su panel para que pueda revisarlo."; }
    if (choice === "2") { await save(db, from, "human_call", {}); return "📞 Escribe en qué horario te conviene recibir una llamada. El Lic. Noel verá tu solicitud en su panel."; }
    return "💬 Elige 1 para dejarle un mensaje o 2 para solicitar una llamada. También puedes escribir MENÚ.";
  }
  if (session.step === "human_write" || session.step === "human_call") {
    if (input.length < 3 || input.length > 1000) return "💬 Escribe un mensaje de 3 a 1000 caracteres o MENÚ para volver.";
    const kind = session.step === "human_call" ? "llamada" : "mensaje";
    await saveRequest(db, from, kind, { message: input, requestedAt: new Date().toISOString() });
    return kind === "llamada"
      ? "📞 Registré tu solicitud de llamada en el panel del Lic. Noel. Te contactará cuando esté disponible. Escribe MENÚ si necesitas otra opción."
      : "✅ Guardé tu mensaje en el panel del Lic. Noel. Te responderá cuando esté disponible. Escribe MENÚ si necesitas otra opción.";
  }
  if (session.step === "human_pending") {
    if (input.length > 1000) return "💬 Envía un mensaje más corto, por favor.";
    const updated = { ...session.details, message: input, requestedAt: new Date().toISOString() };
    if (session.details.requestId) {
      const { error } = await db.from("whatsapp_bot_requests").update({ details: updated })
        .eq("id", session.details.requestId).eq("clinic_id", clinicId()).eq("status", "pending");
      if (error) throw new Error(error.message);
    }
    await save(db, from, "human_pending", updated);
    return "✅ Agregué tu último mensaje a la solicitud para el Lic. Noel. Escribe MENÚ para volver a las opciones.";
  }
  if (session.step === "consultation_info") {
    const selected = choiceNumber(input, 3);
    if (selected === 1 || selected === 2) {
      const list = await services(db);
      if (!list.length) return "📋 Por ahora no hay servicios disponibles. Intenta más tarde.";
      await save(db, from, "service", { choices: JSON.stringify(list.map((item) => item.id)) });
      return serviceList(list);
    }
    if (selected === 3) {
      await save(db, from, "human_choice", {});
      return `💬 *Hablar con el Lic. Noel*\n\n1️⃣ Escribirle un mensaje\n2️⃣ Solicitar una llamada\n\n💬 Responde con la opción que prefieras.${menuHint}`;
    }
    return consultationInfo;
  }
  if (session.step === "menu") {
    const intent = menuIntent(input);
    if (intent === 1) {
      const list = await services(db);
      if (!list.length) return "📋 Por ahora no hay servicios disponibles. Intenta más tarde.";
      await save(db, from, "service", { choices: JSON.stringify(list.map((s) => s.id)) });
      return serviceList(list);
    }
    if (intent === 2) {
      const list = await services(db);
      if (!list.length) return serviceList(list);
      await save(db, from, "service", { choices: JSON.stringify(list.map((item) => item.id)) });
      return serviceList(list);
    }
    if (intent !== null && [3, 4, 5].includes(intent)) {
      const action = intent === 3 ? "consultar" : intent === 4 ? "reprogramar" : "cancelar";
      const list = await ownAppointments(db, from);
      if (!list.length) return appointmentList(list, [], action);
      await save(db, from, "appointment_choice", { action, choices: JSON.stringify(list.map((item) => item.id)) });
      return appointmentList(list, await services(db), action);
    }
    if (intent === 6) { await save(db, from, "human_choice", {}); return `💬 *Hablar con el Lic. Noel*\n\n1️⃣ Escribirle un mensaje\n2️⃣ Solicitar una llamada\n\n💬 Responde con el número de tu elección. Tu solicitud quedará visible en su panel.${menuHint}`; }
    if (intent === 7) { await save(db, from, "consultation_info", {}); return consultationInfo; }
    return welcome;
  }
  if (session.step === "appointment_choice") {
    const list = await ownAppointments(db, from);
    const choices: string[] = JSON.parse(session.details.choices ?? "[]");
    const index = choiceNumber(input, choices.length);
    if (index === null) return `💬 Para elegir una cita, responde solo con su *opción* de la lista (por ejemplo, *1* para 1️⃣). Tu teléfono ya está asociado a este chat; no necesitas enviarlo.${menuHint}`;
    const selected = list.find((item) => item.id === choices[index - 1]);
    if (!selected) return `📅 La cita de esa opción ya no aparece entre tus próximas reservas. Escribe *MENÚ* para consultar de nuevo la lista.`;
    const title = `${selected.full_name}, ${longDate(localDate(new Date(selected.starts_at)))} a las ${displayTime(selected.starts_at)}`;
    if (session.details.action === "consultar") {
      const { data: payment, error } = await db.from("payments").select("id,status,receipt_uploaded_at").eq("clinic_id", clinicId()).eq("appointment_id", selected.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      const needsReceipt = payment?.status === "rejected" || payment?.status === "pending" && !payment.receipt_uploaded_at;
      if (payment?.id && needsReceipt) {
        await save(db, from, "receipt", { paymentId: payment.id, appointmentId: selected.id });
      }
      const paymentStatus = ["paid", "approved", "verified"].includes(payment?.status ?? "")
        ? "Aprobado" : payment?.status === "rejected" ? "Comprobante no aprobado; puedes enviar otro aquí mismo"
          : payment?.receipt_uploaded_at ? "Comprobante recibido; pendiente de revisión"
            : payment?.status === "pending" ? "Pendiente de comprobante" : "Consulta al consultorio";
      return `📋 *Tu reserva*\n\n👤 ${title}\n🏥 Modalidad: ${selected.modality === "online" ? "En línea" : "Presencial"}\n${await visitLocation(db, localDate(new Date(selected.starts_at)), selected.modality)}\n📌 Estado: ${selected.status === "confirmed" ? "Confirmada" : "Pendiente"}\n💳 Anticipo: ${paymentStatus}.${needsReceipt ? payment.status === "rejected" ? "\n\n📎 No necesitas volver a pagar. Envía ahora una foto clara o PDF del comprobante para revisarlo otra vez." : "\n\n📎 Si ya depositaste, envía ahora la foto o PDF del comprobante (L 600)." : ""}${menuHint}`;
    }
    await save(db, from, "appointment_request", { action: session.details.action, appointmentId: selected.id, appointmentTitle: title });
    if (session.details.action === "reprogramar") {
      const available = await dates(db, selected.modality);
      await save(db, from, "reschedule_date", { action: "reprogramar", appointmentId: selected.id, appointmentTitle: title, modality: selected.modality, choices: JSON.stringify(available), serviceId: selected.service_id ?? "" });
      return `📅 *Nueva fecha disponible esta semana*\n\n${available.length ? await dateList(db, available) : "No quedan fechas disponibles en esta modalidad. El calendario se actualizará la próxima semana."}\n\nElige una opción de la lista. Si tenías un depósito aprobado, se conserva cuando solicitas el cambio con al menos *24 horas de anticipación*.${menuHint}`;
    }
    return `📝 *Solicitud para cancelar una cita*\n\n📅 ${title}\n\n${new Date(selected.starts_at).getTime() - Date.now() >= 24 * 3600000 ? "⏰ Si avisas al menos 24 horas antes, puedes reprogramar y aprovechar el depósito aprobado en una nueva fecha, según disponibilidad. El depósito no se devuelve." : "⏰ Faltan menos de 24 horas. Si cancelas ahora, el depósito no se devuelve ni se puede usar en otra cita."}\n\nTu cita seguirá vigente hasta que confirmemos la cancelación.\n\n1️⃣ ✅ Enviar solicitud\n2️⃣ ↩️ Volver al menú\n\n💬 Responde *1* o *2* (también puedes responder SÍ o NO).`;
  }
  if (session.step === "appointment_request") {
    if (choice === "2") { await save(db, from, "menu", {}); return welcome; }
    if (choice !== "1") return "💬 Responde *1* o *SÍ* para enviar la solicitud; *2* o *NO* para volver.";
    const own = (await ownAppointments(db, from)).some((item) => item.id === session.details.appointmentId);
    if (!own) { await save(db, from, "menu", {}); return "📅 No encontré esta cita entre tus próximas reservas. Escribe *MENÚ* para comenzar de nuevo."; }
    const requestedAt = new Date().toISOString();
    const isCancellation = session.details.action === "cancelar";
    const appointment = isCancellation ? (await ownAppointments(db, from)).find((item) => item.id === session.details.appointmentId) : null;
    if (isCancellation && !appointment) { await save(db, from, "menu", {}); return "📅 No encontré esa cita entre tus próximas reservas. Escribe *MENÚ* para consultar la lista."; }
    const timely = !!appointment && new Date(appointment.starts_at).getTime() - Date.parse(requestedAt) >= 24 * 3600000;
    await saveRequest(db, from, isCancellation ? "cancelacion" : "reprogramacion", { appointmentId: session.details.appointmentId, message: session.details.appointmentTitle, requestedAt });
    return `✅ Envié tu solicitud de ${isCancellation ? "cancelación" : "reprogramación"} al consultorio. Tu cita *no ha cambiado todavía*; te responderemos por WhatsApp para confirmarlo.${isCancellation ? timely ? " Avisaste con al menos 24 horas de anticipación. Si tu depósito está aprobado, podrás solicitar usarlo para reprogramar una vez, según disponibilidad; no se reembolsa." : " La solicitud llegó con menos de 24 horas de anticipación; el depósito no se puede usar para otra cita." : ""}${menuHint}`;
  }
  if (session.step === "reschedule_date") {
    const available = await dates(db, session.details.modality);
    const date = available[(choiceNumber(input, available.length) ?? 0) - 1] ?? appointmentDate(input, localDate(new Date()));
    if (!date || !available.includes(date)) return `📅 Elige una fecha disponible de *esta semana*:\n\n${await dateList(db, available)}${menuHint}`;
    await save(db, from, "reschedule_time", { ...session.details, requestedDate: date });
    const service = (await services(db)).find((item) => item.id === session.details.serviceId);
    const times = await slots(db, date, session.details.modality, service?.duration_minutes ?? 60);
    return `🕐 Para *${longDate(date)}* en ${await visitLocation(db, date, session.details.modality)}, estos son los horarios disponibles:\n\n${times.map((slot, i) => `${numberEmoji(i)} ${displayTime(slot.start)}`).join("\n") || "Sin cupos para esa fecha."}\n\nElige la opción o escribe la hora (por ejemplo *9*).${menuHint}`;
  }
  if (session.step === "reschedule_time") {
    const time = appointmentTime(input);
    const service = (await services(db)).find((item) => item.id === session.details.serviceId);
    const available = await slots(db, session.details.requestedDate, session.details.modality, service?.duration_minutes ?? 60);
    const option = choiceNumber(input, available.length);
    const byClock = available.find((slot) => slot.label === time);
    const chosen = /^\d{1,2}$/.test(input.trim()) && Number(input.trim()) >= 8
      ? byClock ?? (option ? available[option - 1] : undefined)
      : (option ? available[option - 1] : byClock);
    if (!chosen) return `🕐 Esa hora no está libre. Elige uno de estos cupos:\n\n${available.map((slot, i) => `${numberEmoji(i)} ${displayTime(slot.start)}`).join("\n") || "No quedan horarios; escribe *ATRÁS* para otra fecha."}${menuHint}`;
    const original = (await ownAppointments(db, from)).find((item) => item.id === session.details.appointmentId);
    if (!original) { await save(db, from, "menu", {}); return "📅 No encontré esa cita entre tus próximas reservas. Escribe *MENÚ* para empezar de nuevo."; }
    if (new Date(original.starts_at).getTime() - Date.now() < 24 * 3600000) return `⏰ Para conservar el depósito, la reprogramación debe solicitarse con al menos *24 horas de anticipación*. Tu cita no cambió. Escribe *MENÚ* y elige *6* si necesitas hablar con el consultorio.`;
    const requested = `${longDate(session.details.requestedDate)} a las ${displayTime(chosen.start)}`;
    await saveRequest(db, from, "reprogramacion", { appointmentId: session.details.appointmentId, appointmentTitle: session.details.appointmentTitle, requestedDate: session.details.requestedDate, requestedTime: chosen.label, message: `Solicita ${requested} · ${await visitLocation(db, session.details.requestedDate, session.details.modality)}`, requestedAt: new Date().toISOString() });
    return `✅ Envié tu propuesta de *${requested}* al consultorio. ${await visitLocation(db, session.details.requestedDate, session.details.modality)}\n\nVerificaremos el cupo y te confirmaremos por WhatsApp. Tu cita original se mantiene hasta recibir la confirmación.${menuHint}`;
  }
  if (session.step === "service") {
    const list = await services(db);
    const choices: string[] = JSON.parse(session.details.choices ?? "[]");
    const index = serviceIndex(input, choices.map((id) => list.find((item) => item.id === id)?.name ?? ""));
    const selected = index === null ? null : list.find((s) => s.id === choices[index]);
    if (!selected) return `📋 Responde con una *opción* de la lista (por ejemplo, *1*) o escribe el nombre del servicio.${menuHint}`;
    await save(db, from, "modality", { serviceId: selected.id });
    return `🩺 Has seleccionado:\n\n*${selected.name}* ${serviceEmoji(selected.name)}\n💰 Precio: *${money(selected.price, selected.currency)}*\n\n¿Cómo deseas recibir tu consulta?\n\n1️⃣ 🏥 Presencial\n2️⃣ 💻 En línea\n\n💬 Responde con el número de tu elección.\n\n↩️ Escribe *ATRÁS* para cambiar de servicio.`;
  }
  if (session.step === "modality") {
    const modality = modalityIntent(input);
    if (!modality) return `📍 Responde *1* o *presencial*, o *2* o *en línea*.${backHint}`;
    const available = await dates(db, modality);
    if (!available.length) {
      await save(db, from, "date", { ...session.details, modality, choices: "[]" });
      return `📅 No quedan fechas disponibles para esta semana en esa modalidad. El consultorio publica los días de atención de domingo a viernes. Escribe *MENÚ* para consultar después.${backHint}`;
    }
    await save(db, from, "date", { ...session.details, modality, choices: JSON.stringify(available) });
    return `📅 *Fechas disponibles esta semana*\n\n${await dateList(db, available)}\n\n💬 Elige una *opción* de la lista (por ejemplo, *1*) o escribe la fecha.${backHint}`;
  }
  if (session.step === "date") {
    const available = await dates(db, session.details.modality);
    const choices: string[] = JSON.parse(session.details.choices ?? "[]");
    const dateChoice = choiceNumber(input, choices.length);
    const spokenDate = appointmentDate(input, localDate(new Date()));
    const date = dateChoice ? choices[dateChoice - 1] : spokenDate;
    if (!date || !choices.includes(date) || !available.includes(date)) return `📅 Esa fecha no está en la lista o ya no está disponible. Responde con un número, una fecha de la lista o escribe *ATRÁS*.`;
    const list = await services(db);
    const service = list.find((s) => s.id === session.details.serviceId);
    if (!service) { await save(db, from, "menu", {}); return "📋 Ese servicio ya no está disponible. Escribe 1 para iniciar de nuevo."; }
    const times = await slots(db, date, session.details.modality, service.duration_minutes ?? 60);
    if (!times.length) return "📅 Esa fecha se llenó. Elige otra fecha de la lista.";
    await save(db, from, "time", { ...session.details, date, choices: JSON.stringify(times.map((slot) => slot.start)) });
    return `🕐 *Horarios disponibles*\n\n📅 ${longDate(date)}\n${await visitLocation(db, date, session.details.modality)}\n\n${times.map((slot, i) => `${numberEmoji(i)} ${displayTime(slot.start)}`).join("\n")}\n\n💬 Elige una *opción* de la lista (por ejemplo, *1*) o escribe la hora (por ejemplo, *9*).${backHint}`;
  }
  if (session.step === "sunday_time") {
    const time = appointmentTime(input);
    const service = (await services(db)).find((item) => item.id === session.details.serviceId);
    if (!service || !time) return "🕐 Escribe una hora válida, por ejemplo *9*, *9:30* o *2 pm*.";
    const start = localStamp(session.details.date, time);
    const end = new Date(start.getTime() + (service.duration_minutes ?? 60) * 60000);
    const endHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Tegucigalpa", hour: "2-digit", hour12: false }).format(end));
    if (time < "08:00" || endHour > 16 || (endHour === 16 && end.getUTCMinutes() !== 0) || start < new Date(Date.now() + 15 * 60000)) {
      return "🕐 La consulta debe iniciar desde las *8:00 a. m.* y terminar a más tardar a las *4:00 p. m.* Escribe otra hora.";
    }
    await save(db, from, "name", { ...session.details, start: start.toISOString(), end: end.toISOString() });
    return `👤 *Datos del paciente*\n\nEscribe el nombre y apellido de la persona que recibirá la consulta. Esta solicitud de domingo requiere aprobación del consultorio.${menuHint}`;
  }
  if (session.step === "time") {
    const service = (await services(db)).find((s) => s.id === session.details.serviceId);
    if (!service) { await save(db, from, "menu", {}); return "📋 Servicio no disponible. Escribe MENÚ."; }
    const times = await slots(db, session.details.date, session.details.modality, service.duration_minutes ?? 60);
    const choices: string[] = JSON.parse(session.details.choices ?? "[]");
    const clock = appointmentTime(input);
    const byClock = clock && times.find((slot) => slot.start === localStamp(session.details.date, clock).toISOString() && choices.includes(slot.start));
    const index = choiceNumber(input, choices.length);
    const byNumber = times.find((slot) => slot.start === choices[(index ?? 0) - 1]);
    const selected = index && index <= 7 ? byNumber : byClock || byNumber;
    if (!selected) return "🕒 Ese horario ya no está disponible. Elige un número de la lista, escribe la hora (por ejemplo *9*) o escribe MENÚ.";
    await save(db, from, "name", { ...session.details, start: selected.start, end: selected.end });
    return `👤 *Datos del paciente*\n\nEscribe el nombre y apellido de la persona que recibirá la consulta.${backHint}`;
  }
  if (session.step === "name") {
    if (input.length < 3 || input.length > 120) return "👤 Escribe el nombre y apellido del paciente (entre 3 y 120 caracteres).";
    await save(db, from, "birth", { ...session.details, name: input });
    return `🎂 ¿Cuál es la fecha de nacimiento del paciente?\n\nEscríbela en formato *DD/MM/AAAA*. Ejemplo: 15/05/2021.${menuHint}`;
  }
  if (session.step === "birth") {
    const birth = parseBirth(value);
    if (!birth) return "🎂 Escribe una fecha válida en formato *DD/MM/AAAA*. Ejemplo: 15/05/2021.";
    const guardianRequired = patientAgeMonths(birth) < 19 * 12;
    await save(db, from, guardianRequired ? "guardian" : "phone", { ...session.details, birth, guardian: "" });
    return guardianRequired
      ? `👤 El paciente es menor de 19 años. Escribe el nombre y apellido de su madre, padre o responsable.${menuHint}`
      : `📱 Escribe tu número de teléfono de contacto, por ejemplo *9999-9999*.${menuHint}`;
  }
  if (session.step === "guardian") {
    if (input.length < 3 || input.length > 120) return "👤 Escribe el nombre y apellido del responsable (entre 3 y 120 caracteres).";
    await save(db, from, "phone", { ...session.details, guardian: input });
    return `📱 Escribe el número de teléfono de contacto del responsable, por ejemplo *9999-9999*.${menuHint}`;
  }
  if (session.step === "phone") {
    const contactPhone = parsePhone(input);
    if (!contactPhone) return "📱 Escribe un teléfono válido. Para Honduras, usa ocho dígitos, por ejemplo *9999-9999*.";
    await save(db, from, "email", { ...session.details, contactPhone });
    return `✉️ Escribe un correo electrónico de contacto. Si no tienes, responde *OMITIR*.${menuHint}`;
  }
  if (session.step === "email") {
    const email = ["omitir", "no", "no tengo", "sin correo", "no tengo correo", "no tengo email", "sin email"].includes(value) ? "" : input;
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) return "✉️ Escribe un correo válido o responde *OMITIR* si no tienes uno.";
    await save(db, from, "patient_confirm", { ...session.details, email });
    return `👶 *Datos del paciente*\n\n👤 Nombre: ${session.details.name}\n🎂 Fecha de nacimiento: ${longBirth(session.details.birth)}\n🧒 Edad: ${patientAge(session.details.birth)}${session.details.guardian ? `\n👤 Responsable: ${session.details.guardian}` : ""}\n📱 Teléfono: ${session.details.contactPhone}\n✉️ Correo: ${email || "No proporcionado"}\n\n¿Los datos son correctos?\n\n1️⃣ ✅ Sí, continuar\n2️⃣ ✏️ No, corregir datos\n\n💬 Responde *1* o *2*; también puedes escribir *SÍ* o *NO*.${menuHint}`;
  }
  if (session.step === "patient_confirm") {
    if (choice === "2") { await save(db, from, "name", session.details); return `✏️ Vamos a corregir los datos. Escribe el nombre y apellido del paciente.${menuHint}`; }
    if (choice !== "1") return "💬 Responde *1* o *SÍ* si los datos son correctos; *2* o *NO* para corregirlos.";
    const selected = (await services(db)).find((item) => item.id === session.details.serviceId);
    if (!selected) { await save(db, from, "menu", {}); return "📋 Ese servicio ya no está disponible. Escribe *MENÚ* para comenzar de nuevo."; }
    await save(db, from, "confirm", session.details);
    return `📋 *Revisa tu reserva*\n\n👤 Paciente: ${session.details.name}${session.details.guardian ? `\n👤 Responsable: ${session.details.guardian}` : ""}\n🎂 Edad: ${patientAge(session.details.birth)}\n📱 Contacto: ${session.details.contactPhone}\n🩺 Servicio: ${selected.name}\n${session.details.modality === "online" ? "💻" : "🏥"} Modalidad: ${session.details.modality === "online" ? "En línea" : "Presencial"}\n${await visitLocation(db, session.details.date, session.details.modality)}\n📅 Fecha: ${longDate(session.details.date)}\n🕐 Hora: ${displayTime(session.details.start)}\n💰 Precio: ${money(selected.price, selected.currency)}\n💳 Depósito necesario: *L 600 (50%)*\n\n¿Toda la información está correcta?\n\n1️⃣ ✅ *Sí, confirmar mi cita*\n2️⃣ ✏️ *No, quiero hacer un cambio*\n\n💬 Responde con *1* o *2*, o escribe *SÍ* o *NO*.${menuHint}`;
  }
  if (session.step === "booking_edit") {
    if (value === "1") {
      const list = await services(db);
      await save(db, from, "service", { choices: JSON.stringify(list.map((item) => item.id)) });
      return serviceList(list);
    }
    if (value === "2") {
      const selected = (await services(db)).find((item) => item.id === session.details.serviceId);
      await save(db, from, "modality", session.details);
      return selected ? `📍 Selecciona la modalidad para *${selected.name}*:\n\n1️⃣ 🏥 Presencial\n2️⃣ 💻 En línea\n\n💬 Responde *1* o *2*.${backHint}` : welcome;
    }
    if (value === "3") {
      const available = await dates(db, session.details.modality);
      await save(db, from, "date", { ...session.details, choices: JSON.stringify(available) });
      return `📅 *Selecciona la fecha de tu consulta*\n\n${await dateList(db, available)}\n\n💬 Responde con la opción de la fecha.${backHint}`;
    }
    if (value === "4") {
      const selected = (await services(db)).find((item) => item.id === session.details.serviceId);
      if (!selected) return "📋 Servicio no disponible. Escribe *MENÚ* para empezar de nuevo.";
      const times = await slots(db, session.details.date, session.details.modality, selected.duration_minutes ?? 60);
      await save(db, from, "time", { ...session.details, choices: JSON.stringify(times.map((slot) => slot.start)) });
      return `🕐 *Horarios disponibles* · ${longDate(session.details.date)}\n\n${times.map((slot, i) => `${numberEmoji(i)} ${displayTime(slot.start)}`).join("\n")}\n\n💬 Responde con el número de tu elección.${backHint}`;
    }
    if (value === "5") { await save(db, from, "name", session.details); return "✏️ Escribe el nombre y apellido del paciente para corregir sus datos."; }
    return "💬 Responde con un número del *1* al *5* para indicar qué deseas cambiar.";
  }
  if (session.step === "confirm") {
    if (choice === "2") {
      await save(db, from, "booking_edit", session.details);
      return `✏️ *¿Qué deseas cambiar?*\n\n1️⃣ Servicio\n2️⃣ Modalidad\n3️⃣ Fecha\n4️⃣ Hora\n5️⃣ Datos del paciente\n\n💬 Responde con el número de la opción.${menuHint}`;
    }
    if (choice !== "1") return "💬 Responde *1* o *SÍ* para confirmar tu cita; *2* o *NO* para cambiar algún dato.";
    if (session.details.manualSunday === "true") {
      await saveRequest(db, from, "domingo", { ...session.details, message: `${session.details.name} solicita ${longDate(session.details.date)} a las ${displayTime(session.details.start)} (${session.details.modality})`, requestedAt: new Date().toISOString() });
      return `🗓️ *Solicitud de domingo recibida*\n\nAún no hay una cita ni se requiere depositar. El consultorio revisará el horario y te avisará por WhatsApp. Si lo aprueban, te enviaremos los datos para el anticipo de L 600.${menuHint}`;
    }
    const { data, error } = await db.rpc("create_whatsapp_booking", {
      p_clinic_id: clinicId(), p_service_id: session.details.serviceId, p_full_name: session.details.name,
      p_birth_date: session.details.birth, p_phone: `+${from.replace(/\D/g, "")}`, p_email: session.details.email,
      p_modality: session.details.modality, p_starts_at: session.details.start, p_ends_at: session.details.end,
    });
    if (error) {
      if (/slot unavailable|outside available hours/i.test(error.message)) { await save(db, from, "menu", {}); return "📅 Ese horario ya no está disponible. Escribe 1 para elegir otro."; }
      throw new Error(error.message);
    }
    const booked = (data as { appointment_id: string; payment_id: string }[] | null)?.[0];
    if (!booked) throw new Error("Booking returned no IDs");
    if (session.details.guardian || session.details.contactPhone) {
      const { error: guardianError } = await db.from("appointments")
        .update({ notes: [session.details.guardian && `Responsable del paciente: ${session.details.guardian}`, session.details.contactPhone && `Teléfono de contacto: ${session.details.contactPhone}`].filter(Boolean).join("\n") })
        .eq("clinic_id", clinicId()).eq("id", booked.appointment_id);
      if (guardianError) console.error("Could not save guardian in appointment", guardianError.code);
    }
    await save(db, from, "receipt", { paymentId: booked.payment_id, appointmentId: booked.appointment_id });
    return `✅ *Solicitud de cita registrada*\n\n📅 ${longDate(session.details.date)} · ${displayTime(session.details.start)}\n${await visitLocation(db, session.details.date, session.details.modality)}\n\nTu cita quedará confirmada cuando el consultorio verifique el depósito del 50% (L 600).\n\n${await paymentInstructions(db)}\n\n💬 Para escribirle al Lic. Noel, responde *MENÚ* y elige *6*.`;
  }
  await save(db, from, "menu", {});
  return "👋 Escribe MENÚ para comenzar.";
}
