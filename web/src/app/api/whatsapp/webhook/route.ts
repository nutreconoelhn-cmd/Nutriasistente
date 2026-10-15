import { createHmac, timingSafeEqual } from "node:crypto";
import { handleWhatsappMessage, whatsappDb } from "@/lib/whatsapp-bot";
import { recordIncoming, recordOutgoing, setConversationMode } from "@/lib/whatsapp-inbox";
import { metaAccessToken } from "@/lib/meta-access-token";


const requiredVariables = [
  "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_GRAPH_VERSION", "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY", "WHATSAPP_CLINIC_ID",
] as const;

function configured() {
  return requiredVariables.every((name) => Boolean(process.env[name]));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token || url.searchParams.get("hub.mode") !== "subscribe"
      || url.searchParams.get("hub.verify_token") !== token) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
}

export async function POST(request: Request) {
  if (!configured()) return new Response("Not configured", { status: 503 });
  const body = await request.text();
  if (body.length > 1024 * 1024) return new Response("Payload too large", { status: 413 });

  const signature = request.headers.get("x-hub-signature-256");
  const expected = createHmac("sha256", process.env.WHATSAPP_APP_SECRET!)
    .update(body).digest("hex");
  const supplied = signature?.startsWith("sha256=") ? signature.slice(7) : "";
  if (!/^[a-f0-9]{64}$/i.test(supplied)
      || !timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"))) {
    return new Response("Forbidden", { status: 403 });
  }

  let payload: unknown;
  try { payload = JSON.parse(body); }
  catch { return new Response("Invalid JSON", { status: 400 }); }
  if (!payload || typeof payload !== "object" || !("entry" in payload)
      || !Array.isArray(payload.entry)) return new Response("OK");

  type IncomingMessage = { id?: string; from?: string; type?: string; text?: { body?: string }; image?: { id?: string; mime_type?: string }; document?: { id?: string; mime_type?: string; filename?: string }; audio?: { id?: string } };
  type Change = { value?: { metadata?: { phone_number_id?: string }; messages?: IncomingMessage[] } };
  type Entry = { changes?: Change[] };

  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION!;
  if (!/^v\d+\.\d+$/.test(graphVersion)) return new Response("Invalid configuration", { status: 503 });
  const db = whatsappDb();
  const {data: settings,error: settingsError}=await db.from("whatsapp_bot_settings")
    .select("bot_enabled").eq("clinic_id",process.env.WHATSAPP_CLINIC_ID!).maybeSingle();
  if(settingsError){console.error("Bot settings unavailable",settingsError.code);return new Response("Settings unavailable",{status:503});}
  const botEnabled=settings?.bot_enabled!==false;
  let deliveredMessages = 0;
  let otherPhone = 0;
  let duplicateMessages = 0;
  let nonMessageEvents = 0;

  for (const entry of payload.entry as Entry[]) {
    for (const change of entry.changes ?? []) {
      if (!change.value?.messages?.length) { nonMessageEvents++; continue; }
      if (change.value?.metadata?.phone_number_id !== process.env.WHATSAPP_PHONE_NUMBER_ID) {
        otherPhone++;
        continue;
      }
      for (const message of change.value?.messages ?? []) {
        if (!message.id || !message.from || !["text", "image", "document", "audio"].includes(message.type ?? "")) {
          nonMessageEvents++;
          continue;
        }
        const { error: claimError } = await db.from("whatsapp_bot_messages").insert({ message_id: message.id, clinic_id: process.env.WHATSAPP_CLINIC_ID });
        if (claimError?.code === "23505") { duplicateMessages++; continue; }
        if (claimError) { console.error("WhatsApp event claim failed", claimError.code); return new Response("Storage failed", { status: 500 }); }
        let reply: string;
        try {
          const mode = await recordIncoming(db, {
            id: message.id, from: message.from, type: message.type!, text: message.text,
            image: message.image, document: message.document, audio: message.audio,
          });
          // Pausar conserva el mensaje en la bandeja y no avanza ninguna reserva.
          // MENÚ no puede reactivar el interruptor general.
          if(!botEnabled){deliveredMessages++;continue;}
          const resumeBot = message.type === "text" && /^men[uú]$/i.test(message.text?.body?.trim() ?? "");
          if (mode === "human" && !resumeBot) { deliveredMessages++; continue; }
          if (mode === "human") await setConversationMode(db, message.from, "bot");
          if (message.type === "audio") {
            await setConversationMode(db, message.from, "human");
            reply = "🎤 Recibí tu audio. Lo dejé en el panel para que el Lic. Noel pueda revisarlo y responderte. Si quieres volver al asistente, escribe *MENÚ*.";
          } else {
            reply = await handleWhatsappMessage(db, {
              id: message.id, from: message.from, type: message.type!, text: message.text,
              image: message.image, document: message.document,
            });
          }
        } catch (error) {
          console.error("WhatsApp bot failed", error instanceof Error ? error.message : "unknown");
          await db.from("whatsapp_bot_messages").delete().eq("message_id", message.id);
          return new Response("Processing failed", { status: 500 });
        }
        const response = await fetch(
          `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID!)}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${metaAccessToken()}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ messaging_product: "whatsapp", to: message.from, type: "text", text: { body: reply } }),
          }
        );
        if (!response.ok) {
          const error = await response.json().catch(() => null) as { error?: { code?: number; error_subcode?: number } } | null;
          console.error("WhatsApp send failed", response.status, error?.error?.code, error?.error?.error_subcode);
          return new Response("Send failed", { status: 502 });
        }
        try {
          const sent = await response.json() as { messages?: { id?: string }[] };
          await recordOutgoing(db, message.from, reply, sent.messages?.[0]?.id);
        } catch (error) {
          console.error("WhatsApp sent but inbox log failed", error instanceof Error ? error.message : "unknown");
        }
        deliveredMessages++;
      }
    }
  }
  console.info("WhatsApp webhook summary", { deliveredMessages, otherPhone, duplicateMessages, nonMessageEvents });
  return new Response("OK");
}
