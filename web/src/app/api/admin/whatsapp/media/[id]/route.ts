import { clinicAccess } from "@/lib/clinic-access";

import { metaAccessToken } from "@/lib/meta-access-token";



export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access=await clinicAccess();
  if(access.response)return access.response;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Invalid ID", { status: 400 });
  const { data, error } = await access.db!.from("whatsapp_inbox_messages")
    .select("media_id,media_type").eq("id", id)
    .eq("clinic_id", process.env.WHATSAPP_CLINIC_ID!).eq("direction", "inbound").single();
  if (error || !data?.media_id) return new Response("Not found", { status: 404 });
  const version = process.env.WHATSAPP_GRAPH_VERSION;
  const token = metaAccessToken();
  if (!version || !/^v\d+\.\d+$/.test(version) || !token) return new Response("Not configured", { status: 503 });
  const metadata = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(data.media_id)}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!metadata.ok) return new Response("Media unavailable", { status: 502 });
  const info = await metadata.json() as { url?: string; mime_type?: string; file_size?: number };
  if (!info.url || !/^https:\/\//.test(info.url) || (info.file_size ?? 0) > 16 * 1024 * 1024)
    return new Response("Media unavailable", { status: 502 });
  const host = new URL(info.url).hostname;
  if (!/(^|\.)(fbcdn\.net|fbsbx\.com|facebook\.com)$/.test(host)) return new Response("Invalid media host", { status: 502 });
  const content = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!content.ok) return new Response("Media unavailable", { status: 502 });
  const bytes = await content.arrayBuffer();
  if (bytes.byteLength > 16 * 1024 * 1024) return new Response("Media too large", { status: 413 });
  const mime = info.mime_type?.split(";")[0] ?? "application/octet-stream";
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf", "audio/ogg", "audio/mpeg", "audio/mp4"];
  return new Response(bytes, {
    headers: {
      "Content-Type": allowed.includes(mime) ? mime : "application/octet-stream",
      "Content-Disposition": `attachment; filename="whatsapp-${data.media_type || "archivo"}.${mime === "application/pdf" ? "pdf" : mime.startsWith("image/") ? mime.split("/")[1] : "bin"}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
