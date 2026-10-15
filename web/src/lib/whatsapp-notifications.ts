import { whatsappDb } from "@/lib/supabase-private";
import { appointmentLocation } from "@/lib/clinic-location";
import { recordOutgoing } from "@/lib/whatsapp-inbox";
import { consultationTips } from "@/lib/consultation-tips";
import { metaAccessToken } from "@/lib/meta-access-token";

export function whatsappPhone(phone: string | null | undefined) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return /^\d{8,16}$/.test(digits) ? digits : null;
}

export async function sendWhatsappText(phone: string, message: string) {
  const version = process.env.WHATSAPP_GRAPH_VERSION;
  const numberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = metaAccessToken();
  if (!version || !/^v\d+\.\d+$/.test(version) || !numberId || !token || !whatsappPhone(phone)) {
    throw new Error("Configuración de WhatsApp incompleta");
  }
  const result = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(numberId)}/messages`, {
    method: "POST", signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: message } }),
  });
  if (!result.ok) {
    const body = await result.json().catch(() => null) as { error?: { code?: number; error_subcode?: number } } | null;
    throw new Error(`Meta rechazó el mensaje (${result.status}, código ${body?.error?.code ?? "desconocido"}, subcódigo ${body?.error?.error_subcode ?? "ninguno"})`);
  }
  const sent = await result.json().catch(() => null) as { messages?: { id?: string }[] } | null;
  try { await recordOutgoing(whatsappDb(), phone, message, sent?.messages?.[0]?.id); }
  catch (error) { console.error("WhatsApp sent but inbox log failed", error instanceof Error ? error.message : "unknown"); }
  return sent?.messages?.[0]?.id;
}

export async function sendWhatsappTemplate(phone: string, name: string, fields: string[]) {
  const version = process.env.WHATSAPP_GRAPH_VERSION;
  const numberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = metaAccessToken();
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "es";
  if (!version || !/^v\d+\.\d+$/.test(version) || !numberId || !token || !whatsappPhone(phone) || !name) {
    throw new Error("Configuración de plantillas de WhatsApp incompleta");
  }
  const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(numberId)}/messages`, {
    method: "POST", signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "template", template: {
      name, language: { code: language }, components: [{ type: "body", parameters: fields.map((text) => ({ type: "text", text })) }],
    } }),
  });
  const result = await response.json().catch(() => null) as { messages?: { id?: string }[]; error?: { code?: number } } | null;
  if (!response.ok) throw new Error(`Meta rechazó la plantilla (${response.status}, código ${result?.error?.code ?? "desconocido"})`);
  return result?.messages?.[0]?.id;
}

export async function notifyApprovedPayment(paymentId: string) {
  const db = whatsappDb();
  const { data: payment, error } = await db.from("payments")
    .select("id,clinic_id,patient_id,appointment_id,status,amount,currency")
    .eq("id", paymentId).eq("clinic_id", process.env.WHATSAPP_CLINIC_ID!).single();
  if (error || !payment || !["paid", "approved", "verified"].includes(payment.status) || !payment.appointment_id) {
    throw new Error("Este pago no está aprobado para una cita de WhatsApp");
  }
  const [{ data: patient, error: patientError }, { data: appointment, error: appointmentError }] = await Promise.all([
    db.from("patients").select("phone,full_name,source").eq("id", payment.patient_id).eq("clinic_id", payment.clinic_id).single(),
    db.from("appointments").select("starts_at,status,source,modality").eq("id", payment.appointment_id).eq("clinic_id", payment.clinic_id).single(),
  ]);
  if (patientError || appointmentError || !patient || !appointment
      || patient.source !== "whatsapp" || appointment.source !== "whatsapp"
      || appointment.status !== "confirmed") return { skipped: true, reason: "La cita no está confirmada desde WhatsApp; revisa su estado en el panel." };
  const phone = whatsappPhone(patient.phone);
  if (!phone) throw new Error("La reserva no tiene un WhatsApp válido");

  const { error: insertError } = await db.from("whatsapp_payment_notifications")
    .upsert({ payment_id: paymentId, clinic_id: payment.clinic_id, phone }, { onConflict: "payment_id", ignoreDuplicates: true });
  if (insertError) throw new Error(`No se pudo registrar el aviso (${insertError.code})`);
  const { data: claimed, error: claimError } = await db.rpc("claim_whatsapp_payment_notification", { p_payment_id: paymentId });
  if (claimError) throw new Error(`No se pudo reclamar el aviso (${claimError.code})`);
  if (!claimed) return { skipped: true, reason: "El aviso ya fue enviado o está en proceso. Revísalo en Solicitudes por WhatsApp." };

  const day = new Intl.DateTimeFormat("es-HN", { timeZone: "America/Tegucigalpa", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(appointment.starts_at));
  const hour = new Intl.DateTimeFormat("es-HN", { timeZone: "America/Tegucigalpa", hour: "numeric", minute: "2-digit" }).format(new Date(appointment.starts_at));
  const location = await appointmentLocation(db, appointment.starts_at, appointment.modality, payment.clinic_id);
  const date = day.charAt(0).toUpperCase() + day.slice(1);
  const content = `✅ *Pago aprobado y cita confirmada*\n\nHola, ${patient.full_name}. Verificamos tu anticipo de ${payment.currency === "HNL" ? "L" : payment.currency} ${Number(payment.amount).toLocaleString("es-HN")}.\n\n📅 ${date}\n🕐 ${hour}\n🏥 Modalidad: ${appointment.modality === "online" ? "En línea" : "Presencial"}\n${location}\n\n${consultationTips(appointment.modality)}\n\nSi necesitas cancelar o cambiar tu cita, avísanos con al menos *24 horas de anticipación* para poder usar este depósito una vez al reprogramar, según disponibilidad. Con menos tiempo, no se puede reutilizar. El depósito no es reembolsable.\n\n💬 Para escribirle al Lic. Noel, responde *MENÚ* y elige *6*.`;
  try {
    try {
      await sendWhatsappText(phone, content);
    } catch (textError) {
      // Outside the customer service window Meta accepts approved templates only.
      if (!(textError instanceof Error) || !textError.message.includes("código 131047") || !process.env.WHATSAPP_CONFIRMATION_TEMPLATE) throw textError;
      const id = await sendWhatsappTemplate(phone, process.env.WHATSAPP_CONFIRMATION_TEMPLATE,
        [patient.full_name, date, hour, appointment.modality === "online" ? "En línea" : "Presencial", location]);
      try { await recordOutgoing(db, phone, `✅ Pago aprobado y cita confirmada: ${date}, ${hour}. ${location}\n\n${consultationTips(appointment.modality)}`, id); }
      catch (logError) { console.error("Confirmation inbox logging failed", logError); }
    }
    const { error: doneError } = await db.from("whatsapp_payment_notifications")
      .update({ sent_at: new Date().toISOString(), sending_at: null }).eq("payment_id", paymentId);
    if (doneError) throw new Error(`Se envió el aviso pero no se pudo registrar (${doneError.code})`);
    return { sent: true };
  } catch (sendError) {
    await db.from("whatsapp_payment_notifications").update({ sending_at: null }).eq("payment_id", paymentId);
    throw sendError;
  }
}

export async function notifyRejectedPayment(paymentId: string) {
  const db = whatsappDb();
  const { data: payment, error } = await db.from("payments")
    .select("id,clinic_id,patient_id,appointment_id,status")
    .eq("id", paymentId).eq("clinic_id", process.env.WHATSAPP_CLINIC_ID!).single();
  if (error || !payment || payment.status !== "rejected" || !payment.appointment_id) throw new Error("Pago rechazado no encontrado");
  const [{ data: patient, error: patientError }, { data: appointment, error: appointmentError }] = await Promise.all([
    db.from("patients").select("phone,full_name,source").eq("id", payment.patient_id).eq("clinic_id", payment.clinic_id).single(),
    db.from("appointments").select("source,status").eq("id", payment.appointment_id).eq("clinic_id", payment.clinic_id).single(),
  ]);
  if (patientError || appointmentError || !patient || !appointment
    || patient.source !== "whatsapp" || appointment.source !== "whatsapp") return { skipped: true };
  const phone = whatsappPhone(patient.phone);
  if (!phone) throw new Error("La reserva no tiene un WhatsApp válido");
  const content = `📎 *Necesitamos revisar tu comprobante nuevamente*\n\nHola, ${patient.full_name}. No pudimos aprobar el comprobante de tu anticipo. Esto no significa que debas pagar otra vez.\n\nPor favor, envía por este chat una foto clara o un PDF del comprobante para volver a revisarlo. Si tienes alguna duda, escribe *MENÚ* y elige *6* para hablar con el consultorio. Tu pago y tu cita siguen pendientes de confirmación.`;
  const { data: session, error: sessionError } = await db.from("whatsapp_bot_sessions")
    .select("step").eq("clinic_id", payment.clinic_id).eq("phone", phone).maybeSingle();
  if (sessionError) throw new Error("No se pudo preparar el chat para recibir el comprobante");
  if (session) {
    const { error: updateError } = await db.from("whatsapp_bot_sessions")
      .update({ step: "receipt", details: { paymentId, appointmentId: payment.appointment_id }, updated_at: new Date().toISOString() })
      .eq("clinic_id", payment.clinic_id).eq("phone", phone);
    if (updateError) throw new Error("No se pudo preparar el chat para recibir el comprobante");
  } else {
    const { error: insertError } = await db.from("whatsapp_bot_sessions")
      .insert({ clinic_id: payment.clinic_id, phone, step: "receipt", details: { paymentId, appointmentId: payment.appointment_id } });
    if (insertError) throw new Error("No se pudo preparar el chat para recibir el comprobante");
  }
  await sendWhatsappText(phone, content);
  return { sent: true };
}
