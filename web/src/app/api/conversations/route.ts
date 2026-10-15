import { clinicAccess, sameRequestOrigin } from "@/lib/clinic-access";
import { setConversationMode } from "@/lib/whatsapp-inbox";
import { sendWhatsappText, whatsappPhone } from "@/lib/whatsapp-notifications";
export async function POST(request:Request){
 if(!sameRequestOrigin(request))return new Response("Origen no permitido",{status:403});
 const access=await clinicAccess();if(access.response)return access.response;
 const db=access.db!;const clinic=access.clinic!;
 let phone="",notice="",failed=false;
 try{
  const form=await request.formData();phone=whatsappPhone(String(form.get("phone")??""))??"";
  if(!phone)throw new Error("Teléfono inválido.");
  const {data:current,error}=await db.from("whatsapp_inbox_conversations").select("mode,last_inbound_at").eq("clinic_id",clinic).eq("phone",phone).single();
  if(error||!current)throw new Error("Conversación no encontrada.");
  const operation=String(form.get("operation")??"");
  if(operation==="reply"){
   const body=String(form.get("message")??"").trim();
   if(!body||body.length>1500)throw new Error("Escribe un mensaje de hasta 1500 caracteres.");
   const last=Date.parse(current.last_inbound_at??"");
   if(!Number.isFinite(last)||Date.now()-last>=86400000)throw new Error("Han pasado 24 horas desde el último mensaje. Espera a que el paciente escriba nuevamente.");
   await setConversationMode(db,phone,"human");await sendWhatsappText(phone,body);
   notice="Mensaje enviado. La conversación queda en atención personal.";
  }else if(operation==="mode"){
   const mode=String(form.get("mode")??"");if(mode!=="bot"&&mode!=="human")throw new Error("Modo inválido.");
   await setConversationMode(db,phone,mode);
   if(mode==="bot"){
    const {error}=await db.from("whatsapp_bot_sessions").update({step:"menu",details:{},updated_at:new Date().toISOString()}).eq("clinic_id",clinic).eq("phone",phone);
    if(error)throw new Error("Modo cambiado, pero no se pudo reiniciar el menú.");
   }
   notice=mode==="bot"?"El bot responderá a los próximos mensajes si el control general está encendido.":"Atención personal activada; el bot dejará de responder en este chat.";
  }else throw new Error("Acción no válida.");
 }catch(e){failed=true;notice=e instanceof Error?e.message:"No se pudo completar la acción.";}
 const query=new URLSearchParams({phone,[failed?"error":"notice"]:notice});
 return new Response(null,{status:303,headers:{Location:`/panel/conversaciones?${query}`,"Cache-Control":"no-store"}});
}
