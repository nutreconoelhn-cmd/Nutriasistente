const normalize = (input: string) => input.trim().toLocaleLowerCase("es-HN")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[\uFE0F\u20E3]/g, "").replace(/\s+/g, " ");

export function choiceNumber(input: string, max: number): number | null {
  const value = normalize(input).replace(/[.,!?]+$/, "");
  const match = /^(?:(?:quiero|elijo|prefiero|escojo|selecciono|respondo|la opcion|opcion|numero|la|el|servicio|cita)\s+)*(\d{1,2}|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)$/.exec(value);
  if (!match) return null;
  const words = ["uno", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];
  const number = /^\d+$/.test(match[1]) ? Number(match[1]) : words.indexOf(match[1]) <= 1 ? 1 : words.indexOf(match[1]);
  return number >= 1 && number <= max ? number : null;
}

export function binaryAnswer(input: string): "yes" | "no" | null {
  const value = normalize(input).replace(/[.,!¡¿?]+/g, " ").replace(/\s+/g, " ").trim();
  if (/^(si|si por favor|si esta bien|si correcto|si confirmo|claro|claro que si|correcto|esta bien|de acuerdo|confirmo|acepto|continuar|adelante|todo correcto|los datos estan correctos|quiero confirmar)$/.test(value)) return "yes";
  if (/^(no|no gracias|no esta bien|para nada|corregir|quiero corregir|cambiar|quiero cambiar|hacer un cambio|volver)$/.test(value)) return "no";
  return null;
}

export function menuIntent(input: string): number | null {
  const value = normalize(input);
  const number = choiceNumber(value, 7);
  if (number !== null) return number;
  if (/\b(reprogramar|cambiar (la )?(fecha|hora|cita)|mover (la )?cita)\b/.test(value)) return 4;
  if (/\b(cancelar (mi |la |una )?(cita|consulta|reserva)|anular (mi |la )?(cita|reserva))\b/.test(value)) return 5;
  if (/\b(hablar|escribir(le)?|llamar|licenciado|nutricionista|noel|asesor)\b/.test(value)) return 6;
  if (/\b(consultar|ver) (mi |la )?(cita|reserva|pago)\b/.test(value)) return 3;
  if (/\b(que incluye|que hacen en la consulta|informacion sobre la consulta|informacion de la consulta|en que consiste|como es la consulta)\b/.test(value)) return 7;
  if (/\b(precio|precios|servicio|servicios|cuanto cuesta)\b/.test(value)) return 2;
  if (/\b(agendar|reservar|hacer una cita|quiero (una )?cita|pedir (una )?cita)\b/.test(value)) return 1;
  return null;
}

export function modalityIntent(input: string): "presencial" | "online" | null {
  const value = normalize(input);
  if (/\b(no quiero|sin)\b/.test(value)) return null;
  const number = choiceNumber(value, 2);
  if (number === 1 || /\b(presencial|en consultorio|en persona|en la clinica)\b/.test(value)) return "presencial";
  if (number === 2 || /\b(virtual|en linea|online|por internet|videollamada)\b/.test(value)) return "online";
  return null;
}

export function serviceIndex(input: string, names: string[]): number | null {
  const number = choiceNumber(input, names.length);
  if (number !== null) return number - 1;
  const value = normalize(input);
  const clues = ["peso", "cronica", "metabolica", "gastrointestinal", "digestiv", "pediatr", "embarazo", "general"];
  const matches = names.map((name, index) => ({ name: normalize(name), index }))
    .filter((item) => item.name === value || item.name.includes(value) && value.length >= 5
      || clues.some((clue) => value.includes(clue) && item.name.includes(clue)));
  return matches.length === 1 ? matches[0].index : null;
}

const clockWords = new Map(Object.entries({
  una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
}));

export function appointmentTime(input: string): string | null {
  let value = normalize(input);
  value = value.replace(/^(?:a\s+)?las?\s+/, "").replace(/\s+en punto$/, "");
  const word = /^(una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/.exec(value);
  if (word) value = `${clockWords.get(word[1])}${value.slice(word[1].length)}`;
  value = value.replace(/\s+y media\b/, ":30").replace(/\s+y cuarto\b/, ":15");
  const match = /^(\d{1,2})(?::(\d{1,2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|de la manana|de la tarde|de la noche|en la manana|en la tarde)?\s*$/.exec(value);
  if (!match) return null;
  let hour = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (minutes > 59 || hour > 23 || match[3] && (hour < 1 || hour > 12)) return null;
  const period = match[3]?.replace(/[.\s]/g, "") ?? "";
  if (/^(pm|delatarde|delanoche|enlatarde)$/.test(period)) hour = hour % 12 + 12;
  else if (/^(am|delamanana|enlamanana)$/.test(period)) hour %= 12;
  else if (hour >= 1 && hour <= 7) hour += 12; // 1, 2 y 3 se entienden como horas de la tarde en el horario del consultorio.
  return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function appointmentDate(input: string, today: string): string | null {
  const value = normalize(input).replace(/[.,!]+$/, "").replace(/^(?:(?:quisiera|quiero|prefiero|para|el|otra fecha|otra fecha para|fecha)\s+)+/, "");
  let result: string | null = null;
  const dmy = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/.exec(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    result = value;
  } else if (dmy) {
    const day = Number(dmy[1]), month = Number(dmy[2]);
    let year = Number(dmy[3] ?? today.slice(0, 4));
    if (!dmy[3] && `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` < today) year++;
    result = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  } else {
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const words = /^(?:el\s+)?(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?$/.exec(value);
    const monthIndex = words ? months.indexOf(words[2]) : -1;
    if (words && monthIndex >= 0) {
      const day = Number(words[1]), month = monthIndex + 1;
      let year = Number(words[3] ?? today.slice(0, 4));
      if (!words[3] && `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` < today) year++;
      result = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    const anchor = new Date(`${today}T12:00:00Z`);
    if (!result && /^(hoy|manana|pasado manana)$/.test(value)) {
      anchor.setUTCDate(anchor.getUTCDate() + (value === "hoy" ? 0 : value === "manana" ? 1 : 2));
      result = anchor.toISOString().slice(0, 10);
    } else if (!result) {
      const days = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
      const weekday = /^(?:(?:el|este|proximo|el proximo)\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)$/.exec(value);
      if (weekday) {
        const offset = (days.indexOf(weekday[1]) - anchor.getUTCDay() + 7) % 7;
        anchor.setUTCDate(anchor.getUTCDate() + (weekday[0].includes("proximo") && offset === 0 ? 7 : offset));
        result = anchor.toISOString().slice(0, 10);
      }
    }
  }
  if (!result || result < today) return null;
  const [year, month, day] = result.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? result : null;
}
