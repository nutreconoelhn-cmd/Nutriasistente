"use client";
import Link from "next/link";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {currentBookingDates,weekday,type ScheduleDay,type WeeklyHours} from "../../../lib/schedule";
function label(date:string){return new Intl.DateTimeFormat("es-HN",{timeZone:"UTC",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(`${date}T12:00:00Z`));}
const options=Array.from({length:15},(_,i)=>`${String(8+Math.floor(i/2)).padStart(2,"0")}:${i%2?"30":"00"}`);
function hour(time:string){const [h,m]=time.slice(0,5).split(":").map(Number);return `${h%12||12}:${String(m).padStart(2,"0")} ${h<12?"a. m.":"p. m."}`;}
export default function Agenda(){
 const router=useRouter();
 const [days,setDays]=useState<ScheduleDay[]>([]);
 const [weekly,setWeekly]=useState<WeeklyHours[]>([]);
 const [today,setToday]=useState("");
 const [date,setDate]=useState("");
 const [mode,setMode]=useState<"open"|"closed">("open");
 const [city,setCity]=useState("San Pedro Sula");
 const [address,setAddress]=useState("");
 const [slots,setSlots]=useState<string[]>([]);
 const [modality,setModality]=useState("ambas");
 const [busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const lock=useRef(false);
 const load=useCallback(async()=>{
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/agenda",{cache:"no-store"});const data=await response.json();
   if(response.status===401){router.replace("/");return;}
   if(!response.ok)throw new Error(data.error??"No se pudo cargar la agenda.");
   setDays(data.days??[]);setWeekly(data.weekly??[]);setToday(data.today);setDate(previous=>previous||data.today);setLoaded(true);
  }catch(e){setLoaded(false);setError(e instanceof Error?e.message:"No se pudo cargar la agenda.");}
  finally{setBusy(false);}
 },[router]);
 useEffect(()=>{void load();},[load]);
 function edit(value:string){
  const day=days.find(d=>d.date===value);setDate(value);setMode(day?.status==="closed"?"closed":"open");setCity(day?.city||"San Pedro Sula");setAddress(day?.address||"");setSlots(!day?[]:day.slot_times!=null?day.slot_times.map(t=>t.slice(0,5)):options.filter(t=>t.endsWith(":00")&&t>=(day?.start_time?.slice(0,5)||"08:00")&&t<=(day?.end_time?`${String(Number(day.end_time.slice(0,2))-1).padStart(2,"0")}:${day.end_time.slice(3,5)}`:"15:00")));setModality(day?.modality||"ambas");document.getElementById("day-form")?.scrollIntoView({behavior:"smooth"});
 }
 async function save(action:"open"|"closed"|"restore",target=date){
  if(lock.current||busy||!loaded)return;
  if(!target){setError("Selecciona una fecha.");return;}
  if(action==="open"&&!slots.length){setError("Marca al menos un horario disponible.");return;}
  const question=action==="restore"?`¿Restaurar el horario habitual para ${label(target)}?`:action==="closed"?`¿Cerrar ${label(target)} para nuevas reservas?`:`¿Guardar la jornada de ${label(target)} en ${city}? Sustituirá la atención habitual en San Pedro Sula ese día.`;
  if(!window.confirm(question))return;
  lock.current=true;setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch("/api/agenda",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:target,action,city,address,slots,modality})});
   const data=await response.json();
   if(response.status===401){router.replace("/");return;}
   if(!response.ok)throw new Error(data.error??"No se pudo guardar la jornada.");
   setNotice(data.message);await load();
  }catch(e){setError(e instanceof Error?e.message:"No se pudo confirmar el cambio. Actualiza antes de reintentar.");}
  finally{lock.current=false;setBusy(false);}
 }
 function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();void save(mode);}
 const button="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold disabled:opacity-50";
 return <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900"><div className="mx-auto max-w-5xl"><Link href="/panel" className="font-medium text-emerald-700">← Volver a mi consultorio</Link><header className="mt-6 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-700">NUTRIASISTENTE</p><h1 className="mt-2 text-3xl font-bold">📍 Días y ciudades</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">La sede habitual es San Pedro Sula. Una jornada especial sustituye la atención de esa fecha. Los cambios se comparten con el chatbot que utiliza tu misma base de datos.</p></div><button className={button+" bg-white"} disabled={busy} onClick={()=>void load()}>{busy?"Cargando…":"↻ Actualizar"}</button></header>
 <div aria-live="polite">{error&&<p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{error}</p>}{notice&&<p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}</div>
 {loaded&&<><section className="mt-8"><h2 className="text-lg font-semibold">Próximas fechas de la semana</h2><p className="mt-1 text-sm text-slate-500">Domingo a viernes · Los horarios muestran jornadas de atención; no descuentan los cupos ocupados.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{currentBookingDates(today).map(d=>{
  const special=days.find(x=>x.date===d);const rows=weekly.filter(x=>x.day_of_week===(weekday(d)||7));const open=special?special.status==="open":weekday(d)!==0&&weekday(d)!==6&&rows.length>0;
  return <button key={d} disabled={busy} onClick={()=>edit(d)} className={`rounded-2xl border p-5 text-left disabled:opacity-50 ${open?"border-emerald-100 bg-white":"border-slate-200 bg-slate-100"}`}><p className="text-sm font-semibold capitalize">{label(d)}</p><p className={`mt-2 text-sm ${open?"text-emerald-800":"text-slate-500"}`}>{open?(special?.city||"San Pedro Sula"):"Sin atención configurada"}</p>{open&&<p className="mt-2 text-xs text-slate-500">{special?.slot_times!=null?special.slot_times.map(hour).join(" · "):special?.start_time&&special?.end_time?`${hour(special.start_time)} – ${hour(special.end_time)}`:rows.map(row=>`${hour(row.start_time)} – ${hour(row.end_time)}`).join(" · ")}</p>}<p className="mt-3 text-xs font-semibold text-emerald-700">Configurar día →</p></button>;
 })}</div></section>
 <form id="day-form" onSubmit={submit} className="mt-8 rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-semibold">Configurar una jornada</h2><fieldset disabled={busy} className="mt-5 grid gap-5 sm:grid-cols-2"><legend className="sr-only">Datos del día de atención</legend><label className="block text-sm font-medium">Fecha<input type="date" required min={today} value={date} onChange={e=>edit(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3"/></label><div><p className="text-sm font-medium">¿Atenderás ese día?</p><div className="mt-2 flex gap-2"><button type="button" aria-pressed={mode==="open"} onClick={()=>setMode("open")} className={button+(mode==="open"?" bg-emerald-700 text-white":" bg-white")}>Sí atiendo</button><button type="button" aria-pressed={mode==="closed"} onClick={()=>setMode("closed")} className={button+(mode==="closed"?" bg-slate-800 text-white":" bg-white")}>No atiendo</button></div></div>
 {mode==="open"&&<><label className="block text-sm font-medium">Ciudad<input list="cities" required minLength={2} maxLength={100} value={city} onChange={e=>{setCity(e.target.value);setAddress("");}} className="mt-2 w-full rounded-xl border border-slate-300 p-3"/><datalist id="cities"><option value="San Pedro Sula"/><option value="Santa Bárbara"/></datalist></label><label className="block text-sm font-medium">Lugar o dirección<input value={address} maxLength={240} required={city.trim().toLocaleLowerCase("es-HN")!=="san pedro sula"&&modality!=="online"} onChange={e=>setAddress(e.target.value)} placeholder={city.trim().toLocaleLowerCase("es-HN")==="san pedro sula"?"Hospital del Valle, Condominio 2, Consultorio 303":"Escribe el lugar exacto"} className="mt-2 w-full rounded-xl border border-slate-300 p-3"/></label><div className="sm:col-span-2"><p className="text-sm font-medium">Marca los horarios de inicio que deseas ofrecer</p><p className="mt-2 text-xs leading-6 text-slate-500">Cada consulta dura 60 minutos. Puedes dejar espacios sin atención; el último inicio es a las 3:00 p. m. Si marcas horas que se superponen, el bot retirará los cupos ocupados al reservar.</p><div className="mt-3 flex flex-wrap gap-2">{options.map(time=><button key={time} type="button" aria-pressed={slots.includes(time)} onClick={()=>setSlots(previous=>previous.includes(time)?previous.filter(t=>t!==time):[...previous,time].sort())} className={button+(slots.includes(time)?" border-emerald-700 bg-emerald-700 text-white":" bg-white text-slate-600")}>{slots.includes(time)?"✓ ":""}{hour(time)}</button>)}</div><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={()=>setSlots(options.filter(t=>t.endsWith(":00")))} className="text-sm font-semibold text-emerald-700">Marcar horas completas</button><button type="button" onClick={()=>setSlots([])} className="text-sm text-slate-500">Quitar selección</button></div><p className="mt-3 text-sm font-medium text-emerald-800">{slots.length} horarios seleccionados</p></div><label className="block text-sm font-medium">Modalidad<select value={modality} onChange={e=>setModality(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3"><option value="ambas">Presencial y en línea</option><option value="presencial">Solo presencial</option><option value="online">Solo en línea</option></select></label></>}
 <div className="self-end"><button type="submit" className={button+" w-full bg-emerald-700 text-white"}>{busy?"Guardando…":mode==="closed"?"Cerrar ese día":"Guardar jornada"}</button></div></fieldset><p className="mt-5 text-xs leading-6 text-slate-500">Horario de 8:00 a. m. a 4:00 p. m. · Sábados sin atención. Puedes abrir un domingo de forma expresa. Si ya existen citas pendientes o confirmadas, el cambio se bloquea para que las revises primero; no se cancelan ni se trasladan automáticamente.</p></form>
 <section className="mt-8"><h2 className="text-xl font-semibold">Cambios programados</h2>{days.length===0?<p className="mt-4 rounded-2xl bg-white p-6 text-sm text-slate-500">No hay cambios especiales. Se aplica la disponibilidad semanal de San Pedro Sula.</p>:<div className="mt-4 space-y-3">{days.map(d=><article key={d.date} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><p className="font-semibold capitalize">{label(d.date)}</p><span className={`rounded-full px-3 py-1 text-xs font-semibold ${d.status==="open"?"bg-emerald-50 text-emerald-800":"bg-slate-100 text-slate-600"}`}>{d.status==="open"?"Jornada abierta":"Día cerrado"}</span></div>{d.status==="open"&&<p className="mt-3 text-sm leading-6 text-slate-500">📍 {d.city} · {d.address||"Consulta en línea"}<br/>{d.slot_times!=null?d.slot_times.map(hour).join(" · "):d.start_time&&d.end_time?`${hour(d.start_time)} – ${hour(d.end_time)}`:""} · {d.modality==="ambas"?"Presencial y en línea":d.modality==="online"?"En línea":"Presencial"}</p>}<div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>edit(d.date)} disabled={busy} className={button}>Editar día</button><button onClick={()=>void save("restore",d.date)} disabled={busy} className={button+" text-emerald-700"}>Restaurar horario habitual</button></div></article>)}</div>}</section>
 </>}
 </div></main>;
}
