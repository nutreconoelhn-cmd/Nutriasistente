import {createSupabaseServerClient} from "@/lib/supabase-server";
import {whatsappDb} from "@/lib/supabase-private";
import {hondurasDate} from "@/lib/schedule";
import {validateAgenda} from "@/lib/agenda-validation";
const headers={"Cache-Control":"no-store"};
async function access(){
 const client=await createSupabaseServerClient();
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return {response:Response.json({error:"Inicia sesión para abrir la agenda."},{status:401,headers})};
 const clinic=process.env.WHATSAPP_CLINIC_ID?.trim();
 if(!clinic||!process.env.SUPABASE_SERVICE_ROLE_KEY)return {response:Response.json({error:"Falta configurar el consultorio o la conexión privada de Supabase."},{status:503,headers})};
 const db=whatsappDb();
 const {data:admin,error:adminError}=await db.from("whatsapp_bot_admins").select("user_id").eq("user_id",user.id).eq("clinic_id",clinic).maybeSingle();
 if(adminError||!admin)return {response:Response.json({error:"Tu usuario no tiene acceso a la agenda de este consultorio."},{status:403,headers})};
 return {db,clinic};
}
export async function GET(){
 try{
  const auth=await access();if(auth.response)return auth.response;
  const today=hondurasDate();
  const [overrides,weekly]=await Promise.all([
   auth.db!.from("clinic_schedule_days").select("date,status,city,address,start_time,end_time,modality,slot_times").eq("clinic_id",auth.clinic!).gte("date",today).order("date").limit(750),
   auth.db!.from("availability").select("day_of_week,start_time,end_time,modality,active").eq("clinic_id",auth.clinic!).eq("active",true).order("day_of_week")
  ]);
  if(overrides.error||weekly.error)return Response.json({error:"No se pudo leer la agenda actual. Revisa la conexión y la tabla clinic_schedule_days del proyecto existente."},{status:503,headers});
  return Response.json({days:overrides.data,weekly:weekly.data,today},{headers});
 }catch{return Response.json({error:"No se pudo cargar la agenda. Inténtalo de nuevo."},{status:503,headers});}
}
export async function POST(request:Request){
 const origin=request.headers.get("origin");let valid=false;
 try{const source=new URL(origin??"");valid=[request.headers.get("host"),request.headers.get("x-forwarded-host")].some(h=>h===source.host)&&["https:","http:"].includes(source.protocol);}catch{}
 if(!valid)return Response.json({error:"Origen no permitido."},{status:403,headers});
 try{
  const auth=await access();if(auth.response)return auth.response;
  let input;
  try{input=validateAgenda(await request.json(),hondurasDate());}catch(e){return Response.json({error:e instanceof Error?e.message:"Datos inválidos."},{status:400,headers});}
  const {error}=await auth.db!.rpc("nutriasistente_save_schedule_slots",{p_clinic_id:auth.clinic!,p_date:input.date,p_action:input.action,p_city:input.city??"San Pedro Sula",p_address:input.address??null,p_slots:input.slots??[],p_modality:input.modality??"ambas"});
  if(error){const message=error.code==="PGRST202"?"Falta instalar la función de agenda. Ejecuta supabase/nutriasistente_horarios.sql en Supabase.":error.code==="P0001"?error.message:"No se pudo guardar la jornada. Actualiza la agenda antes de reintentar.";return Response.json({error:message},{status:409,headers});}
  return Response.json({message:input.action==="closed"?"Día cerrado para nuevas reservas.":input.action==="restore"?"Se restauró el horario habitual de San Pedro Sula para esa fecha.":`Jornada guardada en ${input.city}. Esa fecha sustituye la atención habitual en San Pedro Sula.`},{headers});
 }catch{return Response.json({error:"No se pudo confirmar el cambio. Actualiza la agenda para comprobar si se guardó."},{status:503,headers});}
}
