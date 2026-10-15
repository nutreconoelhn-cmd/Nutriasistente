"use client";
import Link from "next/link";
import {useCallback,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
type Details={name?:string;appointmentTitle?:string;dateLabel?:string;timeLabel?:string;date?:string;requestedDate?:string;requestedTime?:string;city?:string;address?:string;modality?:string;altType?:string;noticePending?:boolean;resolvedAt?:string;resolution?:string;message?:string};
type RequestItem={id:string;phone:string;details:Details;status:string;created_at:string};
type ResponseData={error?:string;warning?:string;message?:string;saved?:boolean;enabled?:boolean;requests?:RequestItem[]};
function Card({request,busy,onAction}:{request:RequestItem;busy:boolean;onAction:(request:RequestItem,action:"accept"|"reject"|"notify",city:string,address:string,note:string)=>Promise<void>}){
 const d=request.details;
 const [city,setCity]=useState(d.city||"San Pedro Sula");
 const [address,setAddress]=useState(d.address||((d.city||"San Pedro Sula")==="San Pedro Sula"?"Hospital del Valle, Condominio 2, Consultorio 303":""));
 const [note,setNote]=useState("");
 const resolved=Boolean(d.resolvedAt)||request.status==="resolved";
 const field="mt-2 w-full rounded-xl border border-slate-300 p-3";
 return <article className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap justify-between gap-3"><h3 className="text-lg font-semibold">{d.altType==="reprogramacion"?"🔄 Reprogramación solicitada":"📅 Nueva fecha solicitada"}</h3><span className={`rounded-full px-3 py-1 text-xs font-semibold ${resolved?"bg-amber-50 text-amber-900":"bg-emerald-50 text-emerald-800"}`}>{resolved?"Decisión guardada · aviso pendiente":"Pendiente de tu decisión"}</span></div><p className="mt-3 font-medium">{d.name||d.appointmentTitle||"Paciente de WhatsApp"}</p><p className="mt-1 text-sm text-slate-500">WhatsApp: +{request.phone}</p><div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-7"><p className="capitalize">📅 {d.dateLabel||d.date||d.requestedDate||"Consulta los detalles"}</p><p>🕐 {d.timeLabel||d.requestedTime||"Hora solicitada"}</p><p>📍 Ciudad solicitada: {d.city||"Sin indicar"}</p><p>{d.modality==="online"?"💻 En línea":"🏥 Presencial"}</p></div>
 {!resolved?<><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Ciudad que confirmarás<input value={city} maxLength={100} disabled={busy} onChange={e=>{setCity(e.target.value);setAddress("");}} className={field}/></label><label className="text-sm font-medium">Lugar exacto que confirmarás<input value={address} maxLength={240} disabled={busy} onChange={e=>setAddress(e.target.value)} placeholder={d.modality==="online"?"No es necesario para consulta en línea":"Escribe la dirección"} className={field}/></label></div><label className="mt-4 block text-sm font-medium">Mensaje para el paciente (opcional)<textarea value={note} maxLength={1000} disabled={busy} onChange={e=>setNote(e.target.value)} rows={3} placeholder="Si no hay cupo, puedes proponer otra opción aquí." className={field}/></label><p className="mt-3 text-xs leading-6 text-slate-500">Se vuelve a comprobar el cupo al aceptar. Una nueva reserva queda pendiente del anticipo. Una reprogramación conserva la cita original hasta que aceptes y respeta la política de 24 horas. No se abre ese horario para otros pacientes. Para confirmar otra ciudad, configúrala primero en Días y ciudades para esa fecha.</p><div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} onClick={()=>void onAction(request,"accept",city,address,note)} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{d.altType==="reprogramacion"?"Aceptar cambio de cita":"Aceptar horario"}</button><button disabled={busy} onClick={()=>void onAction(request,"reject",city,address,note)} className="rounded-xl border border-rose-200 px-5 py-3 text-sm font-semibold text-rose-700 disabled:opacity-50">No hay cupo · Notificar</button></div></>:<div className="mt-4"><p className="text-sm text-slate-600">{d.resolution==="accept"?"La aceptación ya se guardó. No vuelvas a crear la reserva.":"La solicitud ya fue rechazada."} Si el mensaje acaba de fallar, espera dos minutos para reenviarlo.</p><button disabled={busy} onClick={()=>void onAction(request,"notify",city,address,note)} className="mt-4 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold disabled:opacity-50">Reintentar solo el aviso</button></div>}
 </article>;
}
export default function WhatsappControl(){
 const router=useRouter();const lock=useRef(false);
 const [enabled,setEnabled]=useState<boolean|null>(null);
 const [items,setItems]=useState<RequestItem[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  setBusy(true);setError("");
  try{const response=await fetch("/api/whatsapp-control",{cache:"no-store"});const data=await response.json() as ResponseData;
   if(response.status===401){router.replace("/");return;}
   if(!response.ok)throw new Error(data.error||"No se pudo cargar WhatsApp.");
   setEnabled(data.enabled??true);setItems(data.requests??[]);
  }catch(e){setEnabled(null);setError(e instanceof Error?e.message:"No se pudo cargar WhatsApp.");}finally{setBusy(false);}
 },[router]);
 useEffect(()=>{void load();},[load]);
 async function post(body:Record<string,unknown>){
  if(lock.current)return;lock.current=true;setBusy(true);setError("");setNotice("");
  try{const response=await fetch("/api/whatsapp-control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await response.json() as ResponseData;
   if(response.status===401){router.replace("/");return;}
   if(!response.ok)throw new Error(data.error||"No se pudo confirmar el cambio. Actualiza antes de reintentar.");
   setNotice(data.warning||data.message||"Cambio guardado.");await load();
  }catch(e){setError(e instanceof Error?e.message:"No se pudo confirmar el resultado. Actualiza antes de repetir.");}finally{lock.current=false;setBusy(false);}
 }
 async function action(request:RequestItem,action:"accept"|"reject"|"notify",city:string,address:string,note:string){
  if(action==="accept"&&(city.trim().length<2||request.details.modality!=="online"&&address.trim().length<5)){setError("Completa la ciudad y la dirección que confirmarás al paciente.");return;}
  const question=action==="accept"?"¿Aceptar esta propuesta? Se comprobará el cupo y se creará o actualizará la reserva; después se intentará notificar al paciente.":action==="reject"?"¿Informar que no hay cupo? No se modificará ninguna cita anterior.":"¿Reintentar únicamente el aviso por WhatsApp?";
  if(window.confirm(question))await post({requestId:request.id,action,city,address,note});
 }
 return <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900"><div className="mx-auto max-w-4xl"><Link href="/panel" className="font-medium text-emerald-700">← Volver a mi consultorio</Link><header className="mt-6 flex flex-wrap justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-700">NUTRIASISTENTE</p><h1 className="mt-2 text-3xl font-bold">💬 Control de WhatsApp</h1></div><button disabled={busy} onClick={()=>void load()} className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold disabled:opacity-50">{busy?"Actualizando…":"↻ Actualizar"}</button></header><div aria-live="polite">{error&&<p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{error}</p>}{notice&&<p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">{notice}</p>}</div>
 <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-5"><div><h2 className="text-xl font-semibold">Asistente automático de mi cuenta</h2><p className="mt-2 text-sm text-slate-500">{enabled===null?"Comprobando estado…":enabled?"🟢 Activo · El bot responde a los pacientes.":"⏸️ Pausado · El bot no responderá a los nuevos mensajes."}</p></div><button role="switch" aria-label="Chatbot de la cuenta" aria-checked={enabled===true} disabled={busy||enabled===null} onClick={()=>void post({action:"toggle",enabled:!enabled})} className={`rounded-full px-6 py-3 font-semibold disabled:opacity-50 ${enabled?"bg-emerald-700 text-white":"bg-slate-200 text-slate-800"}`}>{enabled?"Pausar chatbot":"Activar chatbot"}</button></div><p className="mt-5 text-xs leading-6 text-slate-500">Pausar no desconecta WhatsApp. Los mensajes siguen llegando a la bandeja del proyecto anterior, pero no avanzan reservas ni registran comprobantes automáticamente. Podrás atenderlos allí personalmente. Las confirmaciones de pago y recordatorios funcionan por separado. Un mensaje que ya esté procesándose podría terminar de responder.</p></section>
 <section className="mt-8"><h2 className="text-xl font-semibold">Solicitudes de otra fecha y horario</h2><p className="mt-2 text-sm text-slate-500">Actualiza para ver nuevas propuestas y avisos pendientes. No son reservas hasta que las aceptes.</p><div className="mt-5 space-y-5">{!busy&&enabled!==null&&items.length===0?<p className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">No hay solicitudes pendientes.</p>:items.map(item=><Card key={item.id} request={item} busy={busy} onAction={action}/>)}</div></section>
 </div></main>;
}
