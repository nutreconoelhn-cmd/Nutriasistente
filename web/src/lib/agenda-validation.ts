export type AgendaInput={date:string;action:"open"|"closed"|"restore";city?:string;address?:string;start?:string;end?:string;slots?:string[];modality?:string};
export function validateAgenda(input:unknown,today:string):AgendaInput{
 if(!input||typeof input!=="object")throw new Error("Solicitud inválida.");
 const b=input as Record<string,unknown>;
 const date=typeof b.date==="string"?b.date:"";
 const parsed=new Date(`${date}T12:00:00Z`);
 const maxDate=new Date(`${today}T12:00:00Z`);maxDate.setUTCDate(maxDate.getUTCDate()+730);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||date<today||date>maxDate.toISOString().slice(0,10))throw new Error("Elige una fecha válida desde hoy y hasta dos años adelante.");
 if(!["open","closed","restore"].includes(String(b.action)))throw new Error("Acción no válida.");
 const action=b.action as AgendaInput["action"];
 if(action!=="open")return {date,action};
 const city=typeof b.city==="string"?b.city.trim():"";
 let address=typeof b.address==="string"?b.address.trim():"";
 const slots=Array.isArray(b.slots)?[...new Set(b.slots.filter((v):v is string=>typeof v==="string"))].sort():[];
 if(!slots.length||slots.length>15||slots.length!==(Array.isArray(b.slots)?b.slots.length:0)||slots.some(time=>!/^(?:0[89]|1[0-5]):(?:00|30)$/.test(time)||time>"15:00"))throw new Error("Marca al menos un horario de inicio válido, de 8:00 a. m. a 3:00 p. m.");
 const start=slots[0];const [lastHour,lastMinute]=slots[slots.length-1].split(":").map(Number);
 const end=`${String(lastHour+1).padStart(2,"0")}:${String(lastMinute).padStart(2,"0")}`;
 const modality=typeof b.modality==="string"?b.modality:"";
 if(city.toLocaleLowerCase("es-HN")==="san pedro sula"&&!address)address="Hospital del Valle, Condominio 2, Consultorio 303";
 const time=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
 if(parsed.getUTCDay()===6)throw new Error("Los sábados no están disponibles. Elige de domingo a viernes.");
 if(city.length<2||city.length>100||address.length>240||!["presencial","online","ambas"].includes(modality)||(modality!=="online"&&address.length<5))throw new Error("Completa la ciudad, dirección y modalidad de atención.");
 if(!time.test(start)||!time.test(end)||start>=end||start<"08:00"||end>"16:00")throw new Error("El horario debe estar entre 8:00 a. m. y 4:00 p. m., con la hora final después de la inicial.");
 return {date,action,city,address,start,end,modality,slots};
}
