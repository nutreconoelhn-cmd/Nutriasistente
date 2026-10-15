export function attendanceChange(action:unknown,current:string,startsAt:string,endsAt:string,now:number){
 if(action!=="attended"&&action!=="no_show")throw new Error("Acción de asistencia inválida.");
 if(!["confirmed","completed","no_show"].includes(current))throw new Error("Solo puedes registrar asistencia en citas confirmadas. Las pendientes requieren revisar el pago.");
 const start=Date.parse(startsAt),end=Date.parse(endsAt);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new Error("La fecha de la cita no es válida.");
 if(action==="attended"&&start>now)throw new Error("No puedes marcar como atendida una cita que todavía no ha comenzado.");
 if(action==="no_show"&&end>now)throw new Error("Espera a que termine el horario de la cita antes de marcar que no asistió.");
 const status=action==="attended"?"completed":"no_show";
 return {status,changed:status!==current};
}
