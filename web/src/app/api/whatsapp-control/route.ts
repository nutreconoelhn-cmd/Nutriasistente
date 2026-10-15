import {clinicAccess,sameRequestOrigin} from "@/lib/clinic-access";
import {sendWhatsappText} from "@/lib/whatsapp-notifications";
const headers={"Cache-Control":"no-store"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(){
 try{
  const auth=await clinicAccess();if(auth.response)return auth.response;
  const [settings,requests]=await Promise.all([
   auth.db!.from("whatsapp_bot_settings").select("bot_enabled,updated_at").eq("clinic_id",auth.clinic!).maybeSingle(),
   auth.db!.from("whatsapp_bot_requests").select("id,phone,kind,details,status,created_at").eq("clinic_id",auth.clinic!).eq("kind","fecha_alternativa").or("status.eq.pending,details->>noticePending.eq.true").order("created_at",{ascending:false}).limit(100)
  ]);
  if(settings.error||requests.error)return Response.json({error:"No se pudo leer el control de WhatsApp. Comprueba que ejecutaste supabase/nutriasistente_solicitudes_bot.sql."},{status:503,headers});
  return Response.json({enabled:settings.data?.bot_enabled!==false,requests:requests.data??[]},{headers});
 }catch{return Response.json({error:"No se pudo cargar el control de WhatsApp."},{status:503,headers});}
}
export async function POST(request:Request){
 if(!sameRequestOrigin(request))return Response.json({error:"Origen no permitido."},{status:403,headers});
 try{
  const auth=await clinicAccess();if(auth.response)return auth.response;
  const body=await request.json().catch(()=>null) as {action?:string;enabled?:boolean;requestId?:string;city?:string;address?:string;note?:string}|null;
  if(!body)return Response.json({error:"Solicitud inválida."},{status:400,headers});
  if(body.action==="toggle"){
   if(typeof body.enabled!=="boolean")return Response.json({error:"Estado no válido."},{status:400,headers});
   const {error}=await auth.db!.from("whatsapp_bot_settings").upsert({clinic_id:auth.clinic!,bot_enabled:body.enabled,updated_at:new Date().toISOString()},{onConflict:"clinic_id"});
   if(error)return Response.json({error:"No se pudo cambiar el estado del chatbot."},{status:503,headers});
   return Response.json({message:body.enabled?"Chatbot activado para los siguientes mensajes.":"Chatbot pausado. Los siguientes mensajes se guardarán en la bandeja sin respuesta automática.",enabled:body.enabled},{headers});
  }
  if(!uuid.test(body.requestId??"")||!["accept","reject","notify"].includes(body.action??""))return Response.json({error:"Acción inválida."},{status:400,headers});
  const note=typeof body.note==="string"?body.note.trim():"";
  const city=typeof body.city==="string"?body.city.trim():"San Pedro Sula";
  const address=typeof body.address==="string"?body.address.trim():"";
  if(note.length>1000||city.length>100||address.length>240)return Response.json({error:"Revisa la longitud del mensaje o de la dirección."},{status:400,headers});
  let details:Record<string,unknown>;
  if(body.action!=="notify"){
   const {data,error}=await auth.db!.rpc("nutriasistente_resolve_alternate",{p_clinic_id:auth.clinic!,p_request_id:body.requestId,p_action:body.action,p_city:city,p_address:address,p_note:note});
   if(error)return Response.json({error:error.code==="P0001"?error.message:"No se pudo procesar la solicitud. Actualiza para comprobar su estado."},{status:409,headers});
   details=data as Record<string,unknown>;
  }else{
   const {data,error}=await auth.db!.from("whatsapp_bot_requests").select("details").eq("id",body.requestId!).eq("clinic_id",auth.clinic!).eq("kind","fecha_alternativa").single();
   if(error||!data)return Response.json({error:"Solicitud no encontrada."},{status:404,headers});
   details=data.details as Record<string,unknown>;
  }
  // Desde aquí la decisión ya está guardada; no se vuelve a reservar al reenviar.
  try{
   const {data:claimed,error:claimError}=await auth.db!.rpc("nutriasistente_claim_request_notice",{p_clinic_id:auth.clinic!,p_request_id:body.requestId});
   if(claimError||!claimed)return Response.json({saved:true,warning:"La decisión está guardada. El aviso ya fue enviado o está en proceso; actualiza el panel. Si acaba de fallar, espera dos minutos antes de reenviarlo."},{headers});
   const {data:row,error:rowError}=await auth.db!.from("whatsapp_bot_requests").select("phone").eq("id",body.requestId!).eq("clinic_id",auth.clinic!).single();
   if(rowError||!row||typeof details.noticeText!=="string")throw new Error("Aviso no disponible");
   let text=details.noticeText;
   if(details.paymentId&&details.resolution==="accept"){
    const {data:accounts,error:accountsError}=await auth.db!.from("payment_accounts").select("bank_name,account_type,account_number,account_holder").eq("clinic_id",auth.clinic!).eq("active",true).order("display_order");
    if(accountsError)throw new Error("No se pudieron consultar las cuentas de pago");
    text+=accounts?.length?"\n\n🏦 *Datos para el depósito*\n"+accounts.map(a=>`${a.bank_name} · ${a.account_type}\nCuenta: ${a.account_number}\nTitular: ${a.account_holder}`).join("\n\n"):"\n\n💬 Solicita al consultorio los datos bancarios antes de depositar.";
   }
   await sendWhatsappText(row.phone,text);
   const {error}=await auth.db!.from("whatsapp_bot_requests").update({details:{...details,noticePending:false,noticeSendingAt:null}}).eq("id",body.requestId!).eq("clinic_id",auth.clinic!);
   if(error)return Response.json({saved:true,warning:"Meta aceptó el mensaje, pero no se pudo registrar el envío. Actualiza y verifica WhatsApp antes de reenviarlo."},{headers});
   return Response.json({saved:true,message:"Decisión guardada. Meta aceptó el aviso; comprueba su recepción en WhatsApp."},{headers});
  }catch{return Response.json({saved:true,warning:"La decisión quedó guardada, pero no se completó el aviso de WhatsApp. Aparecerá como aviso pendiente. Revisa la conexión y reintenta después de dos minutos; no vuelvas a aceptar la reserva."},{headers});}
 }catch{return Response.json({error:"No se pudo confirmar el resultado. Actualiza el panel antes de repetir la acción."},{status:503,headers});}
}
