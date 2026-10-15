import Link from "next/link";

import { Suspense } from "react";
import { clinicAccess } from "@/lib/clinic-access";



async function serverTime() { return Date.now(); }

async function ConversationsPage({ searchParams }: { searchParams: Promise<{ phone?: string; notice?: string; error?: string }> }) {
  const access=await clinicAccess();
  if(access.response)return <main className="p-8"><Link href="/panel">← Volver al panel</Link><p className="mt-4">{(await access.response.json()).error}</p></main>;
  const db=access.db!;
  const { data, error } = await db.from("whatsapp_inbox_conversations")
    .select("phone,mode,last_inbound_at,updated_at")
    .eq("clinic_id", process.env.WHATSAPP_CLINIC_ID!)
    .order("updated_at", { ascending: false }).limit(50);
  if (error) throw new Error("No se pudieron cargar las conversaciones. Comprueba que las tablas de la bandeja anterior existan en este proyecto de Supabase.");
  const params = await searchParams;
  const selected = data?.find((item) => item.phone === params.phone) ?? data?.[0];
  const { data: messages, error: messagesError } = selected ? await db.from("whatsapp_inbox_messages")
    .select("id,direction,body,media_id,media_type,created_at")
    .eq("clinic_id", process.env.WHATSAPP_CLINIC_ID!).eq("phone", selected.phone)
    .order("created_at", { ascending: false }).limit(100) : { data: [], error: null };
  if (messagesError) throw new Error("No se pudieron cargar los mensajes");
  const now = await serverTime();
  const openWindow = Boolean(selected?.last_inbound_at && now - Date.parse(selected.last_inbound_at) < 24 * 3600000);
  return <main className="mx-auto max-w-6xl px-5 py-10">
    <Link href="/panel" className="text-emerald-700">← Volver al panel</Link>
    <Link href="/panel/conversaciones" className="ml-5 inline-block rounded-lg border px-3 py-2 text-sm text-emerald-800">↻ Actualizar conversaciones</Link>
    <h1 className="mt-5 text-3xl font-semibold">💬 Conversaciones de WhatsApp</h1>
    <p className="mt-2 text-slate-600">Aquí aparecen los mensajes nuevos que llegan al número conectado a NutriBot. Los chats anteriores de tu teléfono no se importan.</p>
    {params.notice && <p role="status" className="mt-4 rounded bg-emerald-50 p-3 text-emerald-900">{params.notice}</p>}
    {params.error && <p role="alert" className="mt-4 rounded bg-amber-50 p-3 text-amber-900">{params.error}</p>}
    <div className="mt-6 grid gap-5 md:grid-cols-[15rem_1fr]">
      <aside className="rounded-xl border p-3">
        <h2 className="px-2 pb-2 font-semibold">Chats recientes</h2>
        {!data?.length && <p className="px-2 text-sm text-slate-500">Aún no hay conversaciones.</p>}
        {data?.map((item) => <Link key={item.phone} href={`${"/panel/conversaciones"}?phone=${encodeURIComponent(item.phone)}`}
          className={`block rounded-lg px-3 py-3 text-sm ${selected?.phone === item.phone ? "bg-emerald-50 text-emerald-900" : "hover:bg-slate-50"}`}>
          <span className="block font-semibold">+{item.phone}</span>
          <span>{item.mode === "human" ? "👤 Atención personal" : "🤖 Bot"}</span>
          <span className="block text-xs text-slate-500">{new Date(item.updated_at).toLocaleString("es-HN", { timeZone: "America/Tegucigalpa" })}</span>
        </Link>)}
      </aside>
      <section className="rounded-xl border p-5">
        {!selected ? <p className="text-slate-500">Cuando llegue un mensaje aparecerá aquí.</p> : <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div><h2 className="font-semibold">Conversación con +{selected.phone}</h2><p className="text-sm text-slate-500">{selected.mode === "human" ? "Atención personal" : "Responde el bot"}</p></div>
            <form method="post" action="/api/conversations"><input type="hidden" name="operation" value="mode" /><input type="hidden" name="phone" value={selected.phone} />
              <input type="hidden" name="mode" value={selected.mode === "human" ? "bot" : "human"} />
              <button className="rounded-lg border border-emerald-700 px-3 py-2 text-sm text-emerald-800">{selected.mode === "human" ? "Devolver al bot" : "Atender personalmente"}</button>
            </form>
          </div>
          <div className="my-5 max-h-[34rem] space-y-3 overflow-y-auto">
            {messages?.slice().reverse().map((message) => <div key={message.id} className={`max-w-[90%] rounded-xl p-3 text-sm whitespace-pre-wrap ${message.direction === "outbound" ? "ml-auto bg-emerald-50" : "bg-slate-100"}`}>
              <p>{message.body}</p>
              {message.media_id && <a className="mt-2 inline-block text-emerald-700 underline" href={`/api/admin/whatsapp/media/${message.id}`}>Descargar archivo</a>}
              <p className="mt-2 text-xs text-slate-500">{message.direction === "outbound" ? "Enviado" : "Recibido"} · {new Date(message.created_at).toLocaleString("es-HN", { timeZone: "America/Tegucigalpa" })}</p>
            </div>)}
          </div>
          {!openWindow && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Pasaron 24 horas desde el último mensaje del paciente. Espera a que escriba de nuevo o utiliza una plantilla aprobada por Meta.</p>}
          <form method="post" action="/api/conversations" className="mt-5"><input type="hidden" name="operation" value="reply" /><input type="hidden" name="phone" value={selected.phone} />
            <label htmlFor="reply" className="text-sm font-medium">Responder personalmente</label>
            <textarea id="reply" name="message" required maxLength={1500} rows={3} disabled={!openWindow} className="mt-2 w-full rounded-lg border p-3 disabled:bg-slate-100" />
            <button disabled={!openWindow} className="mt-2 rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">Enviar mensaje</button>
          </form>
        </>}
      </section>
    </div>
  </main>;
}

export default function Page(props:{searchParams:Promise<{phone?:string;notice?:string;error?:string}>}){return <Suspense fallback={<p className="p-8">Cargando conversaciones…</p>}><ConversationsPage {...props}/></Suspense>;}
