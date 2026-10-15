"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clinicAccess } from "@/lib/clinic-access";

import { setConversationMode } from "@/lib/whatsapp-inbox";
import { sendWhatsappText, whatsappPhone } from "@/lib/whatsapp-notifications";

const path = "/panel/conversaciones";

async function conversation(form: FormData) {
  const access=await clinicAccess();
  if(access.response)throw new Error((await access.response.json()).error);
  const phone = whatsappPhone(String(form.get("phone") ?? ""));
  if (!phone) throw new Error("Teléfono inválido");
  const db = access.db!;
  const { data, error } = await db.from("whatsapp_inbox_conversations")
    .select("mode,last_inbound_at").eq("clinic_id", process.env.WHATSAPP_CLINIC_ID!)
    .eq("phone", phone).single();
  if (error || !data) throw new Error("Conversación no encontrada");
  return { db, phone, ...data };
}

function finish(phone: string, message: string, failed = false): never {
  revalidatePath(path);
  redirect(`${path}?phone=${encodeURIComponent(phone)}&${failed ? "error" : "notice"}=${encodeURIComponent(message)}`);
}

export async function replyToConversation(form: FormData) {
  let phone = "", result = "", failed = false;
  try {
    const current = await conversation(form);
    phone = current.phone;
    const body = String(form.get("message") ?? "").trim();
    if (!body || body.length > 1500) throw new Error("Escribe un mensaje de hasta 1500 caracteres");
    if (!current.last_inbound_at || Date.now() - Date.parse(current.last_inbound_at) >= 24 * 3600000)
      throw new Error("Han pasado 24 horas desde el último mensaje del paciente. Para escribirle necesitas una plantilla aprobada por Meta.");
    await setConversationMode(current.db, phone, "human");
    await sendWhatsappText(phone, body);
    result = "Mensaje enviado. La conversación queda en atención personal.";
  } catch (error) { result = error instanceof Error ? error.message : "No se pudo enviar"; failed = true; }
  finish(phone, result, failed);
}

export async function changeConversationMode(form: FormData) {
  let phone = "", result = "", failed = false;
  try {
    const current = await conversation(form);
    phone = current.phone;
    const mode = String(form.get("mode"));
    if (mode !== "bot" && mode !== "human") throw new Error("Modo inválido");
    await setConversationMode(current.db, phone, mode);
    if (mode === "bot") {
      const { error } = await current.db.from("whatsapp_bot_sessions")
        .update({ step: "menu", details: {}, updated_at: new Date().toISOString() })
        .eq("clinic_id", process.env.WHATSAPP_CLINIC_ID!).eq("phone", phone);
      if (error) throw new Error("Modo cambiado, pero no se reinició el menú del bot");
    }
    result = mode === "bot" ? "El bot responderá a los próximos mensajes." : "Atención personal activada; el bot dejará de responder en este chat.";
  } catch (error) { result = error instanceof Error ? error.message : "No se pudo cambiar el modo"; failed = true; }
  finish(phone, result, failed);
}
