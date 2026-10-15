import {createSupabaseServerClient} from "./supabase-server";
import {whatsappDb} from "./supabase-private";
export async function clinicAccess(){
 const client=await createSupabaseServerClient();
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return {response:Response.json({error:"Inicia sesión nuevamente."},{status:401})};
 const clinic=process.env.WHATSAPP_CLINIC_ID?.trim();
 if(!clinic||!process.env.SUPABASE_SERVICE_ROLE_KEY)return {response:Response.json({error:"Falta configurar la conexión privada y el consultorio."},{status:503})};
 const db=whatsappDb();
 const {data:admin,error:adminError}=await db.from("whatsapp_bot_admins").select("user_id").eq("clinic_id",clinic).eq("user_id",user.id).maybeSingle();
 if(adminError||!admin)return {response:Response.json({error:"Tu usuario no tiene acceso a este consultorio."},{status:403})};
 return {db,clinic};
}
export function sameRequestOrigin(request:Request){
 try{const origin=new URL(request.headers.get("origin")??"");return ["https:","http:"].includes(origin.protocol)&&[request.headers.get("host"),request.headers.get("x-forwarded-host")].some(h=>h===origin.host);}catch{return false;}
}
