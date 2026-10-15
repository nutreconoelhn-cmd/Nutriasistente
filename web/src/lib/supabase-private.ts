import { createClient } from "@supabase/supabase-js";
// Importar únicamente desde rutas de servidor; nunca desde componentes cliente.
export function whatsappDb() {
 if(typeof window !== "undefined") throw new Error("Acceso exclusivo del servidor.");
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
 if(!url||!key) throw new Error("Falta la configuración privada de Supabase en el servidor.");
 return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}
