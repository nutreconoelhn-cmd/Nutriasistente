"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { browserDb } from "../../lib/supabase-browser";
import Payments, { type Payment } from "./payments";
import Appointments, {type Appointment} from "./appointments";

type Patient = {patient_id:string;patient_name:string;patient_phone:string|null;patient_email:string|null;birth_date:string|null;total_appointments:number};
type Tab = "resumen"|"citas"|"pagos"|"pacientes";
const tabs: {id:Tab;label:string}[] = [{id:"resumen",label:"🏠 Mi consultorio"},{id:"citas",label:"📅 Citas"},{id:"pagos",label:"💳 Pagos pendientes"},{id:"pacientes",label:"👥 Pacientes"}];
function dateText(value:string, time=false){const date = new Date(value);if(!Number.isFinite(date.getTime()))return "Fecha no disponible";return new Intl.DateTimeFormat("es-HN",{timeZone:"America/Tegucigalpa",...(time?{hour:"numeric" as const,minute:"2-digit" as const,hour12:true}:{weekday:"long" as const,day:"numeric" as const,month:"long" as const,year:"numeric" as const})}).format(date);}
function localDay(value:string){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Tegucigalpa",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));}
const statuses:Record<string,string> = {pending:"Pendiente",confirmed:"Confirmada",cancelled:"Cancelada",canceled:"Cancelada",completed:"Atendida",no_show:"No asistió",approved:"Aprobado",rejected:"Rechazado",paid:"Pagado",verified:"Verificado"};
function Badge({status}:{status:string}){return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${["confirmed","approved","paid","verified"].includes(status)?"bg-emerald-50 text-emerald-800":["cancelled","canceled","rejected"].includes(status)?"bg-rose-50 text-rose-800":"bg-amber-50 text-amber-900"}`}>{statuses[status]??status}</span>;}
export default function Panel(){
 const router=useRouter();
 const [authorized,setAuthorized]=useState(false);
 const [email,setEmail]=useState("");
 const [tab,setTab]=useState<Tab>("resumen");
 const [search,setSearch]=useState("");
 const [busy,setBusy]=useState(true);
 const [error,setError]=useState("");
 const [errors,setErrors]=useState<Record<string,string>>({});
 const [appointments,setAppointments]=useState<Appointment[]>([]);
 const [payments,setPayments]=useState<Payment[]>([]);
 const [patients,setPatients]=useState<Patient[]>([]);
 const [updated,setUpdated]=useState("");
 const [currentTime,setCurrentTime]=useState("");
 const loading=useRef(false);
 const load=useCallback(async()=>{
  if(loading.current)return;
  loading.current=true;setBusy(true);setError("");setCurrentTime(new Date().toISOString());
  try{
   const db=browserDb();
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError)throw new Error("La sesión no pudo verificarse. Vuelve a iniciar sesión o comprueba tu conexión.");
   if(!user){router.replace("/");return;}
   setAuthorized(true);setEmail(user.email??"");
   const results=await Promise.allSettled([db.rpc("get_admin_appointments"),db.rpc("get_pending_payments"),db.rpc("get_admin_patients")]);
   const names=["citas","pagos","pacientes"];
   const setters=[(data:unknown[])=>setAppointments(data as Appointment[]),(data:unknown[])=>setPayments(data as Payment[]),(data:unknown[])=>setPatients(data as Patient[])];
   const problems:Record<string,string>={};
   results.forEach((result,index)=>{
    if(result.status==="rejected"||result.value.error){problems[names[index]]=`No se pudieron cargar ${names[index]}. Revisa tu conexión y los permisos del usuario en Supabase.`;setters[index]([]);}
    else setters[index](Array.isArray(result.value.data)?result.value.data:[]);
   });
   setErrors(problems);setUpdated(new Date().toISOString());
  }catch(e){setError(e instanceof Error?e.message:"No se pudieron cargar los datos.");}
  finally{loading.current=false;setBusy(false);}
 },[router]);
 useEffect(()=>{if(new URLSearchParams(window.location.search).get("seccion")==="pacientes")setTab("pacientes");void load();},[load]);
 async function logout(){setError("");try{const {error}=await browserDb().auth.signOut();if(error)throw error;setAuthorized(false);setAppointments([]);setPatients([]);setPayments([]);router.replace("/");}catch{setError("No se pudo cerrar la sesión. Inténtalo de nuevo.");}}
 const query=search.trim().toLocaleLowerCase("es");
 const today=currentTime?localDay(currentTime):"";
 const todayAppointments=appointments.filter(a=>localDay(a.appointment_date)===today&&!['cancelled','canceled'].includes(a.appointment_status)).sort((a,b)=>Date.parse(a.appointment_date)-Date.parse(b.appointment_date));
 const visibleAppointments=appointments.filter(a=>[a.patient_name,a.patient_phone,a.service_name].some(v=>v?.toLocaleLowerCase("es").includes(query))).sort((a,b)=>Date.parse(b.appointment_date)-Date.parse(a.appointment_date));
 const visiblePatients=patients.filter(p=>[p.patient_name,p.patient_phone,p.patient_email].some(v=>v?.toLocaleLowerCase("es").includes(query))).sort((a,b)=>a.patient_name.localeCompare(b.patient_name,"es"));
 const visiblePayments=payments.filter(p=>[p.patient_name,p.service_name].some(v=>v?.toLocaleLowerCase("es").includes(query)));
 function appointmentList(items:Appointment[]){return <div className="space-y-3">{items.length===0?<p className="py-8 text-center text-slate-500">No hay citas para mostrar.</p>:items.map(a=><article key={a.appointment_id} className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 p-5 sm:flex-row"><div><h3 className="font-semibold">{a.patient_name}</h3><p className="mt-1 text-sm text-slate-600">{a.service_name}</p><p className="mt-2 text-sm capitalize text-slate-500">{dateText(a.appointment_date)} · {dateText(a.appointment_date,true)}</p><p className="mt-1 text-sm text-slate-500">{a.modality==="online"?"💻 En línea":"🏥 Presencial"}</p></div><div><Badge status={a.appointment_status}/></div></article>)}</div>;}
 if(!authorized)return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8"><h1 className="text-xl font-semibold">🥗 Nutriasistente</h1><p role="status" className="mt-4 text-slate-600">{busy?"Comprobando tu sesión…":error||"Abriendo inicio de sesión…"}</p>{!busy&&<a href="/" className="mt-5 inline-block font-semibold text-emerald-700">Volver a iniciar sesión →</a>}</section></main>;
 return <div className="min-h-screen bg-slate-50 text-slate-900">
 <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:w-64 lg:border-r"><div className="px-6 py-7"><p className="text-xl font-bold text-emerald-800">🥗 Nutriasistente</p><p className="mt-1 text-xs text-slate-500">NUTRE CON NOEL</p></div><nav aria-label="Consultorio" className="flex gap-2 overflow-x-auto px-3 pb-4 lg:flex-col">{tabs.map(item=><button key={item.id} onClick={()=>{setTab(item.id);setSearch("");}} aria-current={tab===item.id?"page":undefined} className={`whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-semibold ${tab===item.id?"bg-emerald-50 text-emerald-800":"text-slate-500 hover:bg-slate-50"}`}>{item.label}</button>)}<Link href="/panel/agenda" className="whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-500 hover:bg-slate-50">📍 Días y ciudades</Link><Link href="/panel/whatsapp" className="whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-500 hover:bg-slate-50">💬 Control de WhatsApp</Link></nav><div className="hidden px-7 py-6 text-xs leading-6 text-slate-400 lg:block">Lic. Noel Márquez<br/>Hospital del Valle<br/>Condominio 2 · Consultorio 303</div></aside>
 <main className="px-5 py-8 lg:ml-64 lg:px-10"><div className="mx-auto max-w-6xl"><header className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm capitalize text-emerald-700">{currentTime?dateText(currentTime):""}</p><h1 className="mt-2 text-3xl font-bold">{tab==="resumen"?"Tu consultorio, en un solo lugar":tabs.find(t=>t.id===tab)?.label}</h1><p className="mt-2 text-sm text-slate-500">{email}</p></div><div className="flex gap-2"><button onClick={()=>void load()} disabled={busy} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold disabled:opacity-50">{busy?"Actualizando…":"↻ Actualizar"}</button><button onClick={()=>void logout()} className="rounded-xl px-4 py-3 text-sm text-slate-500">Salir</button></div></header>
 <div aria-live="polite">{error&&<p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}{Object.entries(errors).map(([key,value])=><p key={key} role="alert" className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{value}</p>)}</div>
 {tab==="resumen"?<><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{title:"Citas para hoy",value:errors.citas?"—":todayAppointments.length,icon:"📅",target:"citas" as Tab},{title:"Pagos pendientes",value:errors.pagos?"—":payments.length,icon:"💳",target:"pagos" as Tab},{title:"Citas confirmadas",value:errors.citas?"—":appointments.filter(a=>a.appointment_status==="confirmed").length,icon:"✓",target:"citas" as Tab},{title:"Pacientes registrados",value:errors.pacientes?"—":patients.length,icon:"👥",target:"pacientes" as Tab}].map(card=><button key={card.title} onClick={()=>{setTab(card.target);setSearch("");}} className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm hover:border-emerald-400"><p className="text-sm text-slate-500">{card.icon} {card.title}</p><p className="mt-3 text-3xl font-bold">{busy?"…":card.value}</p></button>)}</div><section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="mb-5 text-lg font-semibold">📅 Hoy en el consultorio</h2>{busy?<p className="text-slate-500">Cargando citas…</p>:errors.citas?<p className="text-slate-500">Los datos de citas no están disponibles.</p>:appointmentList(todayAppointments)}</section><section className="mt-6 rounded-2xl bg-emerald-900 p-6 text-white"><h2 className="font-semibold">Tu nueva base de trabajo</h2><p className="mt-2 text-sm leading-6 text-emerald-100">Esta primera etapa consulta tus datos reales. Puedes revisar comprobantes y gestionar pagos desde su pestaña. Organiza tus jornadas desde Días y ciudades. El chatbot aún funciona desde el proyecto anterior y consulta la misma agenda. Tu aplicación anterior conserva esas funciones.</p></section></>:<section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6"><label className="block text-sm font-medium">Buscar por nombre{tab!=="pagos"?" o teléfono":" o servicio"}<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Escribe para buscar…" className="mb-6 mt-2 block w-full rounded-xl border border-slate-200 p-3 sm:max-w-md"/></label>{busy&&tab!=="pagos"&&tab!=="citas"?<p role="status">Cargando…</p>:errors[tab]?<p className="text-slate-500">No hay datos disponibles. Usa Actualizar para reintentar.</p>:tab==="citas"?<Appointments items={visibleAppointments} nowIso={currentTime} onChanged={load}/>:tab==="pagos"?<Payments items={visiblePayments} onChanged={load}/>:<div className="space-y-3">{visiblePatients.length===0?<p className="py-8 text-center text-slate-500">No hay pacientes para mostrar.</p>:visiblePatients.map(p=><article key={p.patient_id} className="rounded-2xl border border-slate-200 p-5"><h3 className="font-semibold">{p.patient_name}</h3><p className="mt-2 text-sm text-slate-500">📞 {p.patient_phone||"Sin teléfono"}</p><p className="mt-1 text-sm text-slate-500">{p.patient_email||"Sin correo electrónico"}</p><p className="mt-3 text-xs font-medium text-emerald-800">{p.total_appointments} citas registradas</p><Link href={`/panel/pacientes/${p.patient_id}`} className="mt-4 inline-block rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">📋 Abrir expediente</Link></article>)}</div>}</section>}
 {updated&&<p className="mt-6 text-xs text-slate-400">Última revisión: {dateText(updated,true)} · Hora de Honduras. Actualiza para ver nuevos cambios.</p>}
 </div></main></div>;
}
