import {clinicAccess,sameRequestOrigin} from "@/lib/clinic-access";
import {attendanceChange} from "@/lib/attendance";
const headers={"Cache-Control":"no-store"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:Request){
 if(!sameRequestOrigin(request))return Response.json({error:"Origen no permitido."},{status:403,headers});
 try{
  const auth=await clinicAccess();if(auth.response)return auth.response;
  const body=await request.json().catch(()=>null) as {appointmentId?:string;action?:string}|null;
  if(!body||!uuid.test(body.appointmentId??""))return Response.json({error:"Cita no válida."},{status:400,headers});
  const {data:appointment,error}=await auth.db!.from("appointments").select("id,status,starts_at,ends_at").eq("id",body.appointmentId!).eq("clinic_id",auth.clinic!).maybeSingle();
  if(error)return Response.json({error:"No se pudo consultar la cita. Actualiza antes de reintentar."},{status:503,headers});
  if(!appointment)return Response.json({error:"No encontré esa cita en este consultorio."},{status:404,headers});
  let change;
  try{change=attendanceChange(body.action,appointment.status,appointment.starts_at,appointment.ends_at,Date.now());}catch(e){return Response.json({error:e instanceof Error?e.message:"No se pudo registrar asistencia."},{status:400,headers});}
  if(!change.changed)return Response.json({message:"La cita ya tiene ese estado de asistencia."},{headers});
  const {data:updated,error:updateError}=await auth.db!.from("appointments").update({status:change.status,updated_at:new Date().toISOString()})
   .eq("id",appointment.id).eq("clinic_id",auth.clinic!).eq("status",appointment.status).eq("starts_at",appointment.starts_at).eq("ends_at",appointment.ends_at).select("id").maybeSingle();
  if(updateError)return Response.json({error:"No se pudo guardar la asistencia. Actualiza el panel para comprobar el estado."},{status:503,headers});
  if(!updated)return Response.json({error:"La cita cambió mientras la revisabas. Actualiza antes de continuar."},{status:409,headers});
  return Response.json({message:change.status==="completed"?"✅ Consulta marcada como atendida.":"📋 Registraste que el paciente no asistió."},{headers});
 }catch{return Response.json({error:"No se pudo confirmar el resultado. Actualiza antes de repetir la acción."},{status:503,headers});}
}
