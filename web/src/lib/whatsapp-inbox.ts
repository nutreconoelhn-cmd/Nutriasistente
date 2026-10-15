import type { SupabaseClient } from "@supabase/supabase-js";

type Incoming = { id: string; from: string; type: string; text?: { body?: string }; image?: { id?: string }; document?: { id?: string; filename?: string }; audio?: { id?: string } };
const clinicId = () => process.env.WHATSAPP_CLINIC_ID!;

export async function recordIncoming(db: SupabaseClient, message: Incoming) {
  const now = new Date().toISOString();
  const { error: conversationError } = await db.from("whatsapp_inbox_conversations")
    .upsert({ clinic_id: clinicId(), phone: message.from, last_inbound_at: now, updated_at: now },
      { onConflict: "clinic_id,phone", ignoreDuplicates: true });
  if (conversationError) throw new Error(conversationError.message);
  const { error: updateError } = await db.from("whatsapp_inbox_conversations")
    .update({ last_inbound_at: now, updated_at: now })
    .eq("clinic_id", clinicId()).eq("phone", message.from);
  if (updateError) throw new Error(updateError.message);
  const mediaId = message.image?.id || message.document?.id || message.audio?.id || null;
  const body = message.type === "text" ? (message.text?.body ?? "")
    : message.type === "image" ? "📷 Imagen recibida"
    : message.type === "document" ? `📄 Documento recibido${message.document?.filename ? `: ${message.document.filename}` : ""}`
    : "🎤 Audio recibido";
  const { error } = await db.from("whatsapp_inbox_messages").insert({
    clinic_id: clinicId(), phone: message.from, direction: "inbound", body: body.slice(0, 4000),
    media_id: mediaId, media_type: mediaId ? message.type : null, provider_message_id: message.id,
  });
  if (error && error.code !== "23505") throw new Error(error.message);
  const { data: conversation, error: readError } = await db.from("whatsapp_inbox_conversations")
    .select("mode").eq("clinic_id", clinicId()).eq("phone", message.from).single();
  if (readError) throw new Error(readError.message);
  return conversation.mode as "bot" | "human";
}

export async function recordOutgoing(db: SupabaseClient, phone: string, body: string, providerMessageId?: string) {
  const { error } = await db.from("whatsapp_inbox_messages").insert({
    clinic_id: clinicId(), phone, direction: "outbound", body,
    provider_message_id: providerMessageId ?? null,
  });
  if (error) throw new Error(error.message);
  await db.from("whatsapp_inbox_conversations").update({ updated_at: new Date().toISOString() })
    .eq("clinic_id", clinicId()).eq("phone", phone);
}

export async function setConversationMode(db: SupabaseClient, phone: string, mode: "bot" | "human") {
  const { error } = await db.from("whatsapp_inbox_conversations")
    .update({ mode, updated_at: new Date().toISOString() })
    .eq("clinic_id", clinicId()).eq("phone", phone);
  if (error) throw new Error(error.message);
}
