import { createBrowserClient } from "@supabase/ssr";

// Se crea al usarlo, nunca al compilar ni con una clave privada.
export function browserDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error("Falta la configuración pública de Supabase en web/.env.local.");
  return createBrowserClient(url, key);
}
