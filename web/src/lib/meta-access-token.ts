export function metaAccessToken() {
  const raw = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
  return raw.trim().replace(/^Bearer\s+/i, "").replace(/^['"]|['"]$/g, "").trim();
}
