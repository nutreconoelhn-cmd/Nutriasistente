import { createSupabaseServerClient } from "@/lib/supabase-server";
import { whatsappDb } from "@/lib/supabase-private";
import { notifyApprovedPayment, notifyRejectedPayment } from "@/lib/whatsapp-notifications";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers={"Cache-Control":"no-store"};
function configuration(){return ["SUPABASE_SERVICE_ROLE_KEY","WHATSAPP_CLINIC_ID"].filter(name=>!process.env[name]?.trim());}
export async function GET(){
 try{
  const client=await createSupabaseServerClient();
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user)return Response.json({error:"Debes iniciar sesión."},{status:401,headers});
  return Response.json({missing:configuration(),notificationConfigured:Boolean(process.env.WHATSAPP_ACCESS_TOKEN&&process.env.WHATSAPP_PHONE_NUMBER_ID&&process.env.WHATSAPP_GRAPH_VERSION)},{headers});
 }catch{return Response.json({error:"No se pudo comprobar la configuración."},{status:503,headers});}
}
export async function POST(request:Request){
 const origin=request.headers.get("origin");
 // Codespaces y Vercel pueden reconstruir request.url con un host interno.
 const host=request.headers.get("host");
 const forwardedHost=request.headers.get("x-forwarded-host");
 let sameOrigin=false;
 try { const source=new URL(origin??""); sameOrigin=[host,forwardedHost].filter(Boolean).some(value=>value===source.host)&&["https:","http:"].includes(source.protocol); } catch {}
 if(!sameOrigin)return Response.json({error:"Origen no permitido."},{status:403,headers});
 try{
  const client=await createSupabaseServerClient();
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)return Response.json({error:"Debes iniciar sesión nuevamente."},{status:401,headers});
  const missing=configuration();
  if(missing.length)return Response.json({error:`Antes de gestionar pagos, configura en el servidor: ${missing.join(", ")}.`},{status:503,headers});
  const clinic=process.env.WHATSAPP_CLINIC_ID!.trim();
  if(!uuid.test(clinic))return Response.json({error:"El identificador del consultorio no es válido."},{status:503,headers});
  const db=whatsappDb();
  const {data:admin,error:adminError}=await db.from("whatsapp_bot_admins").select("user_id").eq("user_id",user.id).eq("clinic_id",clinic).maybeSingle();
  if(adminError||!admin)return Response.json({error:"Tu usuario no tiene permiso para gestionar pagos de este consultorio."},{status:403,headers});
  const body=await request.json().catch(()=>null) as {paymentId?:string;action?:string}|null;
  if(!body||!uuid.test(body.paymentId??"")||!["approve","reject","notify"].includes(body.action??""))return Response.json({error:"Solicitud de pago inválida."},{status:400,headers});
  const paymentId=body.paymentId!;
  const {data:payment,error:paymentError}=await db.from("payments").select("id,status,receipt_path").eq("id",paymentId).eq("clinic_id",clinic).maybeSingle();
  if(paymentError) return Response.json({error:"No se pudo consultar el pago. Actualiza antes de intentarlo nuevamente."},{status:503,headers});
  if(!payment)return Response.json({error:"Pago no encontrado en este consultorio."},{status:404,headers});
  let approved=["paid","approved","verified"].includes(payment.status);
  if(body.action!=="notify"){
   if(payment.status!=="pending")return Response.json({error:"Este pago ya cambió de estado. Actualiza el panel antes de continuar."},{status:409,headers});
   if(body.action==="approve"&&!payment.receipt_path)return Response.json({error:"Este pago aún no tiene un comprobante registrado."},{status:400,headers});
   const {data,error}=await client.rpc("verify_payment",{p_payment_id:paymentId,p_approved:body.action==="approve"});
   if(error||!data)return Response.json({error:"No se pudo guardar la decisión. Actualiza el panel para comprobar el estado antes de repetirla."},{status:400,headers});
   approved=body.action==="approve";
  }else if(!approved&&payment.status!=="rejected")return Response.json({error:"Solo puedes reenviar avisos de pagos aprobados o rechazados."},{status:409,headers});
  try{
   const notification=approved?await notifyApprovedPayment(paymentId):await notifyRejectedPayment(paymentId);
   return Response.json({saved:true,approved,notification},{headers});
  }catch{
   return Response.json({saved:true,approved,warning:"La decisión del pago está guardada, pero no se pudo completar el aviso de WhatsApp. Puedes reintentar solo el aviso. Revisa la configuración de Meta y si necesita una plantilla aprobada."},{headers});
  }
 }catch{return Response.json({error:"No se pudo completar la solicitud. Actualiza el panel para comprobar el estado del pago antes de repetirla."},{status:503,headers});}
}
