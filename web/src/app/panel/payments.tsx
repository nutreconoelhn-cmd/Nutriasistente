"use client";
import {useEffect,useRef,useState} from "react";
import {browserDb} from "../../lib/supabase-browser";
export type Payment={payment_id:string;patient_name:string;service_name:string;appointment_date:string;payment_amount:number;payment_currency:string;receipt_path:string|null};
type Result={error?:string;saved?:boolean;approved?:boolean;warning?:string;notification?:{sent?:boolean;skipped?:boolean;reason?:string}};
export default function Payments({items,onChanged}:{items:Payment[];onChanged:()=>Promise<void>}){
 const [busy,setBusy]=useState("");
 const [message,setMessage]=useState("");
 const [retry,setRetry]=useState<{id:string;name:string}|null>(null);
 const [configuration,setConfiguration]=useState("");
 const lock=useRef(false);
 useEffect(()=>{
  let live=true;
  fetch("/api/payments",{cache:"no-store"}).then(async response=>{
   const data=await response.json();
   if(!live)return;
   if(!response.ok){setConfiguration(data.error??"No se pudo comprobar la configuración.");return;}
   if(data.missing?.length)setConfiguration(`Para habilitar las decisiones de pago faltan: ${data.missing.join(", ")}. Se configuran únicamente en el servidor.`);
   else if(!data.notificationConfigured)setConfiguration("Puedes gestionar los pagos. Los avisos de WhatsApp necesitan configurar el token, el identificador del número y la versión de Meta en el servidor.");
  }).catch(()=>{if(live)setConfiguration("No se pudo comprobar la configuración de pagos. Actualiza la página para reintentar.");});
  return()=>{live=false;};
 },[]);
 async function receipt(payment:Payment){
  if(lock.current||!payment.receipt_path)return;
  lock.current=true;setBusy(payment.payment_id);setMessage("");
  const tab=window.open("about:blank","_blank");
  if(tab)tab.opener=null;
  try{
   if(!tab)throw new Error("Permite abrir ventanas emergentes para ver el comprobante y vuelve a intentarlo.");
   const {data,error}=await browserDb().storage.from("payment-receipts").createSignedUrl(payment.receipt_path,60);
   if(error||!data?.signedUrl)throw new Error("No se pudo abrir el comprobante. Comprueba los permisos del archivo en Supabase.");
   tab.location.href=data.signedUrl;
  }catch(error){tab?.close();setMessage(error instanceof Error?error.message:"No se pudo abrir el comprobante.");}
  finally{setBusy("");lock.current=false;}
 }
 async function decide(payment:{payment_id:string;patient_name:string},action:"approve"|"reject"|"notify"){
  if(lock.current)return;
  const text=action==="approve"?`¿Aprobar el anticipo de ${payment.patient_name}? Se verificará el pago y se intentará notificar al paciente.`:action==="reject"?`¿Rechazar el comprobante de ${payment.patient_name}? Se intentará solicitar uno nuevo por WhatsApp; no se le pedirá pagar otra vez.`:`¿Reintentar únicamente el aviso para ${payment.patient_name}?`;
  if(!window.confirm(text))return;
  lock.current=true;setBusy(payment.payment_id);setMessage("");
  try{
   const response=await fetch("/api/payments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({paymentId:payment.payment_id,action})});
   const result=await response.json() as Result;
   if(!response.ok){setMessage(result.error??"No se pudo guardar la decisión. Actualiza antes de reintentar.");return;}
   if(result.saved){
    const summary=result.approved?"✅ Pago aprobado.":"📎 Comprobante rechazado.";
    setMessage(result.warning??(result.notification?.sent?`${summary} Meta aceptó el aviso para enviarlo por WhatsApp; esto todavía no confirma su entrega.`:`${summary} ${result.notification?.reason??"No se envió el aviso automático."}`));
    setRetry(result.warning?{id:payment.payment_id,name:payment.patient_name}:null);
    await onChanged();
   }
  }catch{setMessage("No se pudo confirmar el resultado. Actualiza el panel y revisa el pago antes de repetir la acción.");}
  finally{setBusy("");lock.current=false;}
 }
 return <div>
  {configuration&&<p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{configuration}</p>}
  <div aria-live="polite">{message&&<p className="mb-4 rounded-xl bg-slate-100 p-4 text-sm leading-6">{message}</p>}</div>
  {retry&&<div className="mb-5 rounded-xl border border-amber-200 p-4"><p className="text-sm">Aviso pendiente para {retry.name}. La decisión del pago ya se guardó.</p><button disabled={Boolean(busy)} onClick={()=>void decide({payment_id:retry.id,patient_name:retry.name},"notify")} className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Reintentar solo el aviso</button></div>}
  <div className="space-y-3">{items.length===0?<p className="py-8 text-center text-slate-500">No hay pagos pendientes para mostrar.</p>:items.map(p=><article key={p.payment_id} className="rounded-2xl border border-slate-200 p-5"><div className="flex flex-wrap justify-between gap-3"><h3 className="font-semibold">{p.patient_name}</h3><p className="font-bold text-emerald-800">{new Intl.NumberFormat("es-HN",{style:"currency",currency:p.payment_currency||"HNL"}).format(p.payment_amount)}</p></div><p className="mt-2 text-sm text-slate-500">{p.service_name} · {new Intl.DateTimeFormat("es-HN",{timeZone:"America/Tegucigalpa",day:"numeric",month:"long",year:"numeric"}).format(new Date(p.appointment_date))}</p><p className="mt-3 text-sm text-amber-800">{p.receipt_path?"📎 Comprobante listo para revisar":"⏳ El paciente aún no ha enviado su comprobante"}</p>{p.receipt_path&&<div className="mt-4 flex flex-wrap gap-2"><button disabled={Boolean(busy)} onClick={()=>void receipt(p)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Ver comprobante ↗</button><button disabled={Boolean(busy)} onClick={()=>void decide(p,"approve")} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Aprobar pago</button><button disabled={Boolean(busy)} onClick={()=>void decide(p,"reject")} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">Solicitar otro comprobante</button></div>}{busy===p.payment_id&&<p role="status" className="mt-3 text-sm text-slate-500">Procesando…</p>}</article>)}</div>
 </div>;
}
