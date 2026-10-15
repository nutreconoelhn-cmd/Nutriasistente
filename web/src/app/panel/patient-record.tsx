"use client";

import { useEffect, useState } from "react";
import { browserDb } from "@/lib/supabase-browser";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type PatientRecord = {
  patient_id: string;
  patient_name: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  is_pediatric: boolean;
  patient_status: string;
  record_id: string | null;
  allergies: string | null;
  medical_history: string | null;
  family_history: string | null;
  medications: string | null;
  supplements: string | null;
  diagnoses: string | null;
  dietary_restrictions: string | null;
  relevant_notes: string | null;
};

type Anthropometry = {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  body_fat_percent: number | null;
  muscle_mass_kg: number | null;
  notes: string | null;
};

type PatientRecordProps = {
  patientId: string;
};

export default function PatientRecord({
  patientId,
}: PatientRecordProps) {
  const [record, setRecord] =
    useState<PatientRecord | null>(null);

  const [anthropometry, setAnthropometry] =
    useState<Anthropometry[]>([]);
    const [anthropometryHistory, setAnthropometryHistory] =
  useState<Anthropometry[]>([]);
  const [anthropometryEvolution, setAnthropometryEvolution] =
  useState<
    {
      measured_at: string;
      weight_kg: number | null;
      bmi: number | null;
      waist_cm: number | null;
      body_fat_percent: number | null;
      muscle_mass_kg: number | null;
    }[]
  >([]);

const [clinicalNotes, setClinicalNotes] = useState<
  {
    id: string;
    appointment_id: string | null;
    author_id: string | null;
    note_type: string;
    content: string;
    created_at: string;
    updated_at: string;
  }[]
>([]);
const [assessments, setAssessments] = useState<
  {
    id: string;
    appointment_id: string | null;
    assessment_date: string;
    reason_for_consultation: string | null;
    nutritional_diagnosis: string | null;
    clinical_diagnosis: string | null;
    goals: string | null;
    assessment_notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  }[]
>([]);
const [savingNutritionPlan, setSavingNutritionPlan] =
  useState(false);
  type NutritionPlanFood = {
  id: string;
  food: string;
  quantity: string;
  unit: string;
  equivalent: string;
};

type NutritionPlanMeal = {
  id: string;
  name: string;
  time: string;
  instructions: string;
  foods: NutritionPlanFood[];
};

type NutritionPlanContent = {
  meals: NutritionPlanMeal[];
  substitutions: {
  id: string;
  mealId: string;
  food: string;
  alternatives: string;
}[];
  supplements: {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  instructions: string;
}[];

  hydration: string;
  general_recommendations: string[];
};
  const [nutritionPlans, setNutritionPlans] = useState<
  {
    id: string;
    assessment_id: string | null;
    title: string | null;
    calories: number | null;
    protein_g: number | null;
    carbohydrates_g: number | null;
    fat_g: number | null;
    instructions: string | null;
    plan_content: NutritionPlanContent | null;
    status: string;
    start_date: string | null;
    end_date: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  }[]
>([]);

const [nutritionPlanMessage, setNutritionPlanMessage] =
  useState("");

const [newNutritionPlan, setNewNutritionPlan] = useState({
  assessment_id: "",
  title: "",
  calories: "",
  protein_g: "",
  carbohydrates_g: "",
  fat_g: "",
  instructions: "",
  status: "draft",
  start_date: "",
  end_date: "",
});
const [planMeals, setPlanMeals] = useState<
  {
    id: string;
    name: string;
    time: string;
    instructions: string;
    foods: {
      id: string;
      food: string;
      quantity: string;
      unit: string;
      equivalent: string;
    }[];
  }[]
>([]);
const [planSubstitutions, setPlanSubstitutions] = useState<
  {
    id: string;
    mealId: string;
    food: string;
    alternatives: string;
  }[]
>([]);
const [planSupplements, setPlanSupplements] = useState<
  {
    id: string;
    name: string;
    dose: string;
    frequency: string;
    instructions: string;
  }[]
>([]);
const [planHydration, setPlanHydration] = useState("");
const [planRecommendations, setPlanRecommendations] = useState("");
const [savingAssessment, setSavingAssessment] =
  useState(false);

const [assessmentMessage, setAssessmentMessage] =
  useState("");

const [newAssessment, setNewAssessment] = useState({
  assessment_date: new Date().toISOString().slice(0, 16),
  reason_for_consultation: "",
  nutritional_diagnosis: "",
  clinical_diagnosis: "",
  goals: "",
  assessment_notes: "",
});

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [savingClinicalRecord, setSavingClinicalRecord] =
  useState(false);

const [clinicalRecordMessage, setClinicalRecordMessage] =
  useState("");
  const [savingAnthropometry, setSavingAnthropometry] =
  useState(false);

const [anthropometryMessage, setAnthropometryMessage] =
  useState("");
  const [savingClinicalNote, setSavingClinicalNote] =
  useState(false);

const [clinicalNoteMessage, setClinicalNoteMessage] =
  useState("");

const [newClinicalNote, setNewClinicalNote] = useState({
  note_date: new Date().toISOString().slice(0, 16),
  reason: "",
  subjective: "",
  objective: "",
  intervention: "",
  education: "",
  agreements: "",
  follow_up: "",
  next_appointment: "",
});

const [newAnthropometry, setNewAnthropometry] = useState({
  measured_at: new Date().toISOString().slice(0, 16),
  weight_kg: "",
  height_cm: "",
  waist_cm: "",
  hip_cm: "",
  body_fat_percent: "",
  muscle_mass_kg: "",
  notes: "",
});
async function saveClinicalRecord() {
  if (!record) return;

  setSavingClinicalRecord(true);
  setClinicalRecordMessage("");

  const { error } = await browserDb().rpc(
    "save_patient_clinical_record",
    {
      p_patient_id: record.patient_id,
      p_allergies: record.allergies || null,
      p_medical_history: record.medical_history || null,
      p_family_history: record.family_history || null,
      p_medications: record.medications || null,
      p_supplements: record.supplements || null,
      p_diagnoses: record.diagnoses || null,
      p_dietary_restrictions:
        record.dietary_restrictions || null,
      p_relevant_notes: record.relevant_notes || null,
    }
  );

  if (error) {
    console.error(error);
    setClinicalRecordMessage(
      "No pudimos guardar la historia clínica."
    );
    setSavingClinicalRecord(false);
    return;
  }

  setClinicalRecordMessage(
    "Historia clínica guardada correctamente."
  );

  setSavingClinicalRecord(false);
}
async function saveAnthropometry() {
  if (!record) return;

  setSavingAnthropometry(true);
  setAnthropometryMessage("");

  const weight =
    newAnthropometry.weight_kg.trim() !== ""
      ? Number(newAnthropometry.weight_kg)
      : null;

  const height =
    newAnthropometry.height_cm.trim() !== ""
      ? Number(newAnthropometry.height_cm)
      : null;

  const waist =
    newAnthropometry.waist_cm.trim() !== ""
      ? Number(newAnthropometry.waist_cm)
      : null;

  const hip =
    newAnthropometry.hip_cm.trim() !== ""
      ? Number(newAnthropometry.hip_cm)
      : null;

  const bodyFat =
    newAnthropometry.body_fat_percent.trim() !== ""
      ? Number(newAnthropometry.body_fat_percent)
      : null;

  const muscleMass =
    newAnthropometry.muscle_mass_kg.trim() !== ""
      ? Number(newAnthropometry.muscle_mass_kg)
      : null;

  if (
    (weight !== null && (isNaN(weight) || weight <= 0)) ||
    (height !== null && (isNaN(height) || height <= 0))
  ) {
    setAnthropometryMessage(
      "Ingresa valores válidos para peso y talla."
    );
    setSavingAnthropometry(false);
    return;
  }

  const { data, error } = await browserDb().rpc(
    "save_patient_anthropometry",
    {
      p_patient_id: record.patient_id,
      p_measured_at: new Date(
        newAnthropometry.measured_at
      ).toISOString(),
      p_weight_kg: weight,
      p_height_cm: height,
      p_waist_cm: waist,
      p_hip_cm: hip,
      p_body_fat_percent: bodyFat,
      p_muscle_mass_kg: muscleMass,
      p_notes: newAnthropometry.notes || null,
    }
  );

  if (error || !data) {
    console.error(error);
    setAnthropometryMessage(
      "No pudimos guardar la evaluación antropométrica."
    );
    setSavingAnthropometry(false);
    return;
  }

  setAnthropometryMessage(
    "Evaluación antropométrica guardada correctamente."
  );

  setNewAnthropometry({
    measured_at: new Date().toISOString().slice(0, 16),
    weight_kg: "",
    height_cm: "",
    waist_cm: "",
    hip_cm: "",
    body_fat_percent: "",
    muscle_mass_kg: "",
    notes: "",
  });

  await loadRecord();

  setSavingAnthropometry(false);
}
async function saveClinicalNote() {
  if (!record) return;

  setSavingClinicalNote(true);
  setClinicalNoteMessage("");

  const { data, error } = await browserDb().rpc(
    "save_patient_clinical_note",
    {
      p_patient_id: record.patient_id,
      p_note_date: new Date(
        newClinicalNote.note_date
      ).toISOString(),
      p_reason: newClinicalNote.reason || null,
      p_subjective: newClinicalNote.subjective || null,
      p_objective: newClinicalNote.objective || null,
      p_intervention:
        newClinicalNote.intervention || null,
      p_education:
        newClinicalNote.education || null,
      p_agreements:
        newClinicalNote.agreements || null,
      p_follow_up:
        newClinicalNote.follow_up || null,
      p_next_appointment:
        newClinicalNote.next_appointment
          ? new Date(
              newClinicalNote.next_appointment
            ).toISOString()
          : null,
    }
  );

  if (error || !data) {
    console.error(error);

    setClinicalNoteMessage(
      "No pudimos guardar la nota de consulta."
    );

    setSavingClinicalNote(false);
    return;
  }

  setClinicalNoteMessage(
    "Nota de consulta guardada correctamente."
  );

  setNewClinicalNote({
    note_date: new Date()
      .toISOString()
      .slice(0, 16),
    reason: "",
    subjective: "",
    objective: "",
    intervention: "",
    education: "",
    agreements: "",
    follow_up: "",
    next_appointment: "",
  });

  setSavingClinicalNote(false);
}
async function saveAssessment() {
  if (!record) return;

  setSavingAssessment(true);
  setAssessmentMessage("");

  const { data, error } = await browserDb().rpc(
    "save_patient_assessment",
    {
      p_patient_id: record.patient_id,
      p_assessment_date: new Date(
        newAssessment.assessment_date
      ).toISOString(),
      p_reason_for_consultation:
        newAssessment.reason_for_consultation || null,
      p_nutritional_diagnosis:
        newAssessment.nutritional_diagnosis || null,
      p_clinical_diagnosis:
        newAssessment.clinical_diagnosis || null,
      p_goals: newAssessment.goals || null,
      p_assessment_notes:
        newAssessment.assessment_notes || null,
    }
  );

  if (error || !data) {
    console.error(error);

    setAssessmentMessage(
      "No pudimos guardar la evaluación nutricional."
    );

    setSavingAssessment(false);
    return;
  }

  setAssessmentMessage(
    "Evaluación nutricional guardada correctamente."
  );

  setNewAssessment({
    assessment_date: new Date()
      .toISOString()
      .slice(0, 16),
    reason_for_consultation: "",
    nutritional_diagnosis: "",
    clinical_diagnosis: "",
    goals: "",
    assessment_notes: "",
  });

  setSavingAssessment(false);
}
function addPlanMeal() {
  setPlanMeals((currentMeals) => [
    ...currentMeals,
    {
      id: crypto.randomUUID(),
      name: "",
      time: "",
      instructions: "",
      foods: [],
    },
  ]);
}

function addMealFood(mealId: string) {
  setPlanMeals((currentMeals) =>
    currentMeals.map((meal) =>
      meal.id === mealId
        ? {
            ...meal,
            foods: [
              ...meal.foods,
              {
                id: crypto.randomUUID(),
                food: "",
                quantity: "",
                unit: "",
                equivalent: "",
              },
            ],
          }
        : meal
    )
  );
}
function usePlanAsTemplate(plan: (typeof nutritionPlans)[number]) {
  const content = plan.plan_content;
  const mealIds = new Map<string, string>();
  const meals = (Array.isArray(content?.meals) ? content.meals : []).map((meal) => {
    const id = crypto.randomUUID();
    mealIds.set(meal.id, id);
    return {
      id,
      name: meal.name ?? "",
      time: meal.time ?? "",
      instructions: meal.instructions ?? "",
      foods: (Array.isArray(meal.foods) ? meal.foods : []).map((food) => ({
        id: crypto.randomUUID(),
        food: food.food ?? "",
        quantity: food.quantity ?? "",
        unit: food.unit ?? "",
        equivalent: food.equivalent ?? "",
      })),
    };
  });

  setNewNutritionPlan({
    assessment_id: plan.assessment_id && assessments.some((item) => item.id === plan.assessment_id)
      ? plan.assessment_id : "",
    title: plan.title ?? "",
    calories: plan.calories?.toString() ?? "",
    protein_g: plan.protein_g?.toString() ?? "",
    carbohydrates_g: plan.carbohydrates_g?.toString() ?? "",
    fat_g: plan.fat_g?.toString() ?? "",
    instructions: plan.instructions ?? "",
    status: "draft",
    start_date: "",
    end_date: "",
  });
  setPlanMeals(meals);
  setPlanSubstitutions(
    (Array.isArray(content?.substitutions) ? content.substitutions : [])
      .filter((item) => mealIds.has(item.mealId))
      .map((item) => ({
        id: crypto.randomUUID(),
        mealId: mealIds.get(item.mealId)!,
        food: item.food ?? "",
        alternatives: item.alternatives ?? "",
      }))
  );
  setPlanSupplements(
    (Array.isArray(content?.supplements) ? content.supplements : []).map((item) => ({
      id: crypto.randomUUID(),
      name: item.name ?? "",
      dose: item.dose ?? "",
      frequency: item.frequency ?? "",
      instructions: item.instructions ?? "",
    }))
  );
  setPlanHydration(content?.hydration ?? "");
  setPlanRecommendations(
    (Array.isArray(content?.general_recommendations) ? content.general_recommendations : []).join("\n")
  );
  setNutritionPlanMessage("Plan cargado en el formulario. Revísalo y guárdalo como un plan nuevo.");
  document.getElementById("nutrition-plan-editor")?.scrollIntoView({ behavior: "smooth" });
}
function printNutritionPlan(plan: (typeof nutritionPlans)[number]) {
  const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
  const content = plan.plan_content;
  const meals = Array.isArray(content?.meals) ? content.meals : [];
  const substitutions = Array.isArray(content?.substitutions) ? content.substitutions : [];
  const supplements = Array.isArray(content?.supplements) ? content.supplements : [];
  const recommendations = Array.isArray(content?.general_recommendations) ? content.general_recommendations : [];
  const line = (value: unknown) => escapeHtml(value).replace(/\r?\n/g, "<br>");
  const date = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-HN") : "—";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(plan.title || "Plan nutricional")}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      body { font: 14px/1.5 Arial, sans-serif; color: #1f2937; max-width: 780px; margin: 28px auto; }
      h1 { color: #047857; font-size: 25px; margin-bottom: 4px; }
      h2 { color: #065f46; font-size: 17px; border-bottom: 1px solid #a7f3d0; padding-bottom: 5px; margin-top: 26px; }
      h3 { font-size: 15px; margin: 15px 0 4px; }
      p { margin: 5px 0; } .muted { color: #6b7280; } .summary { background: #ecfdf5; padding: 12px; border-radius: 8px; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0; } th,td { text-align: left; padding: 6px; border-bottom: 1px solid #e5e7eb; }
      th { background: #f3f4f6; } .meal { break-inside: avoid; } .screen { margin-bottom: 18px; }
      @media print { body { margin: 0; max-width: none; } .screen { display: none; } }
    </style></head><body>
    <div class="screen"><button onclick="window.print()">Imprimir o guardar como PDF</button></div>
    <h1>${escapeHtml(plan.title || "Plan nutricional")}</h1>
    <p><strong>Paciente:</strong> ${escapeHtml(record?.patient_name || "—")}</p>
    <p class="muted">Fecha: ${date(plan.created_at.slice(0, 10))} · Vigencia: ${date(plan.start_date)} a ${date(plan.end_date)}</p>
    <div class="summary"><strong>Objetivos diarios:</strong> ${escapeHtml(plan.calories ?? "—")} kcal · Proteína ${escapeHtml(plan.protein_g ?? "—")} g · Carbohidratos ${escapeHtml(plan.carbohydrates_g ?? "—")} g · Grasas ${escapeHtml(plan.fat_g ?? "—")} g</div>
    ${plan.instructions ? `<h2>Indicaciones generales</h2><p>${line(plan.instructions)}</p>` : ""}
    ${meals.length ? `<h2>Plan de alimentación</h2>${meals.map((meal) => `<div class="meal"><h3>${escapeHtml(meal.name || "Comida")} ${meal.time ? `· ${escapeHtml(meal.time)}` : ""}</h3>
      ${Array.isArray(meal.foods) && meal.foods.length ? `<table><thead><tr><th>Alimento</th><th>Cantidad</th><th>Unidad</th><th>Equivalente</th></tr></thead><tbody>${meal.foods.map((food) => `<tr><td>${escapeHtml(food.food)}</td><td>${escapeHtml(food.quantity)}</td><td>${escapeHtml(food.unit)}</td><td>${escapeHtml(food.equivalent)}</td></tr>`).join("")}</tbody></table>` : ""}
      ${meal.instructions ? `<p>${line(meal.instructions)}</p>` : ""}</div>`).join("")}` : ""}
    ${substitutions.length ? `<h2>Sustituciones</h2><ul>${substitutions.map((item) => `<li><strong>${escapeHtml(item.food)}:</strong> ${line(item.alternatives)}</li>`).join("")}</ul>` : ""}
    ${supplements.length ? `<h2>Suplementación</h2><ul>${supplements.map((item) => `<li><strong>${escapeHtml(item.name)}</strong> · ${escapeHtml(item.dose)} · ${escapeHtml(item.frequency)}${item.instructions ? ` — ${line(item.instructions)}` : ""}</li>`).join("")}</ul>` : ""}
    ${content?.hydration ? `<h2>Hidratación</h2><p>${line(content.hydration)}</p>` : ""}
    ${recommendations.length ? `<h2>Recomendaciones generales</h2><ul>${recommendations.map((item) => `<li>${line(item)}</li>`).join("")}</ul>` : ""}
    </body></html>`;
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    setNutritionPlanMessage("Permite las ventanas emergentes para abrir el plan imprimible.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
async function saveNutritionPlan() {
  if (!record) return;

  setSavingNutritionPlan(true);
  setNutritionPlanMessage("");

  const calories = newNutritionPlan.calories
    ? Number(newNutritionPlan.calories)
    : null;

  const protein = newNutritionPlan.protein_g
    ? Number(newNutritionPlan.protein_g)
    : null;

  const carbohydrates =
    newNutritionPlan.carbohydrates_g
      ? Number(newNutritionPlan.carbohydrates_g)
      : null;

  const fat = newNutritionPlan.fat_g
    ? Number(newNutritionPlan.fat_g)
    : null;

  if (!newNutritionPlan.title.trim()) {
    setNutritionPlanMessage("Escribe un título para el plan nutricional.");
    setSavingNutritionPlan(false);
    return;
  }

  const { data, error } = await browserDb().rpc(
    "save_patient_nutrition_plan",
    {
      p_patient_id: record.patient_id,
      p_assessment_id:
        newNutritionPlan.assessment_id || null,
      p_title: newNutritionPlan.title,
      p_calories: calories,
      p_protein_g: protein,
      p_carbohydrates_g: carbohydrates,
      p_fat_g: fat,
      p_instructions:
        newNutritionPlan.instructions || null,
      p_plan_content: {
  meals: planMeals,
 substitutions: planSubstitutions,
  supplements: planSupplements,
  hydration: planHydration,
  general_recommendations: planRecommendations
    .split("\n")
    .map((recommendation) => recommendation.trim())
    .filter(Boolean),
},
      p_status: newNutritionPlan.status,
      p_start_date:
        newNutritionPlan.start_date || null,
      p_end_date:
        newNutritionPlan.end_date || null,
    }
  );

  if (error || !data) {
    console.error(error);

    setNutritionPlanMessage(
      "No pudimos guardar el plan nutricional."
    );

    setSavingNutritionPlan(false);
    return;
  }

  setNutritionPlanMessage(
    "Plan nutricional guardado correctamente."
  );

await loadRecord();

  setNewNutritionPlan({
    assessment_id: "",
    title: "",
    calories: "",
    protein_g: "",
    carbohydrates_g: "",
    fat_g: "",
    instructions: "",
    status: "draft",
    start_date: "",
    end_date: "",
  });
  setPlanMeals([]);
  setPlanSubstitutions([]);
  setPlanSupplements([]);
  setPlanHydration("");
  setPlanRecommendations("");

  setSavingNutritionPlan(false);
}
  async function loadRecord() {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await browserDb().rpc(
      "get_patient_clinical_record",
      {
        p_patient_id: patientId,
      }
    );

    if (error) {
      console.error(error);
      setErrorMessage(
        "No pudimos cargar el expediente clínico."
      );
      setLoading(false);
      return;
    }

    setRecord(data?.[0] ?? null);

    const {
      data: anthropometryData,
      error: anthropometryError,
    } = await browserDb().rpc(
      "get_patient_anthropometry",
      {
        p_patient_id: patientId,
      }
    );

    if (anthropometryError) {
      console.error(anthropometryError);
      setErrorMessage(
        "No pudimos cargar las mediciones antropométricas."
      );
      setLoading(false);
      return;
    }

    setAnthropometry(anthropometryData ?? []);

const {
  data: anthropometryHistoryData,
  error: anthropometryHistoryError,
} = await browserDb().rpc(
  "get_patient_anthropometry_history",
  {
    p_patient_id: patientId,
  }
);

if (anthropometryHistoryError) {
  console.error(anthropometryHistoryError);
  setErrorMessage(
    "No pudimos cargar el historial antropométrico."
  );
  setLoading(false);
  return;
}

setAnthropometryHistory(
  anthropometryHistoryData ?? []
);
const {
  data: anthropometryEvolutionData,
  error: anthropometryEvolutionError,
} = await browserDb().rpc(
  "get_patient_anthropometry_evolution",
  {
    p_patient_id: patientId,
  }
);
const { data: notesData, error: notesError } =
  await browserDb().rpc(
    "get_patient_clinical_notes",
    {
      p_patient_id: patientId,
    }
  );

if (notesError) {
  console.error(notesError);
  setErrorMessage("No pudimos cargar las notas clínicas.");
  setLoading(false);
  return;
}

setClinicalNotes(notesData ?? []);
const { data: assessmentsData, error: assessmentsError } =
  await browserDb().rpc(
    "get_patient_assessments",
    {
      p_patient_id: patientId,
    }
  );

if (assessmentsError) {
  console.error(assessmentsError);
  setErrorMessage("No pudimos cargar las evaluaciones nutricionales.");
  setLoading(false);
  return;
}

setAssessments(assessmentsData ?? []);
const { data: nutritionPlansData, error: nutritionPlansError } =
  await browserDb().rpc(
    "get_patient_nutrition_plans",
    {
      p_patient_id: patientId,
    }
  );

if (nutritionPlansError) {
  console.error(nutritionPlansError);
  setErrorMessage("No pudimos cargar los planes nutricionales.");
  setLoading(false);
  return;
}

setNutritionPlans(nutritionPlansData ?? []);
if (anthropometryEvolutionError) {
  console.error(anthropometryEvolutionError);
  setErrorMessage(
    "No pudimos cargar la evolución antropométrica."
  );
  setLoading(false);
  return;
}

setAnthropometryEvolution(
  anthropometryEvolutionData ?? []
);

setLoading(false);
  }
  useEffect(() => {
    loadRecord();
  }, [patientId]);

  if (loading) {
    return (
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">
          Cargando expediente...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">
          {errorMessage}
        </p>
      </section>
    );
  }

  if (!record) {
    return (
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">
          No se encontró el expediente.
        </p>
      </section>
    );
  }

  const latestAnthropometry =
    anthropometry[0] ?? null;

  return (
    <>
      <div className="mb-4">
        <a
          href="/panel?seccion=pacientes"
          className="inline-flex items-center text-sm font-semibold text-slate-500 transition hover:text-emerald-700"
        >
          ← Volver a pacientes
        </a>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* ENCABEZADO DEL PACIENTE */}
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Expediente clínico
            </p>

            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              {record.patient_name}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {record.is_pediatric
                ? "Paciente pediátrico"
                : "Paciente adulto"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[420px]">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Teléfono
              </p>

              <p className="mt-1 text-sm font-medium text-slate-700">
                {record.phone || "No registrado"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Correo
              </p>

              <p className="mt-1 text-sm font-medium text-slate-700">
                {record.email || "No registrado"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Fecha de nacimiento
              </p>

              <p className="mt-1 text-sm font-medium text-slate-700">
                {record.birth_date || "No registrada"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Estado
              </p>

              <p className="mt-1 text-sm font-medium text-emerald-700">
                {record.patient_status === "active"
                  ? "Activo"
                  : record.patient_status}
              </p>
            </div>
          </div>
        </div>

        {/* HISTORIA CLÍNICA */}
<div className="mt-10 border-t border-slate-100 pt-8">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
        Historia clínica
      </p>

      <h3 className="mt-1 text-xl font-semibold text-slate-900">
        Antecedentes y situación clínica
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Registra la información clínica relevante del paciente.
      </p>
    </div>

    <button
      type="button"
      onClick={saveClinicalRecord}
      disabled={savingClinicalRecord}
      className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {savingClinicalRecord
        ? "Guardando..."
        : "Guardar historia clínica"}
    </button>
  </div>

  {clinicalRecordMessage && (
    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
      <p className="text-sm font-medium text-emerald-700">
        {clinicalRecordMessage}
      </p>
    </div>
  )}

  <div className="mt-5 grid gap-5 sm:grid-cols-2">
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Alergias
      </label>

      <textarea
        value={record.allergies ?? ""}
        onChange={(event) =>
          setRecord({
            ...record,
            allergies: event.target.value,
          })
        }
        rows={4}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        placeholder="Alergias conocidas..."
      />
    </div>

    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Antecedentes médicos
      </label>

      <textarea
        value={record.medical_history ?? ""}
        onChange={(event) =>
          setRecord({
            ...record,
            medical_history: event.target.value,
          })
        }
        rows={4}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        placeholder="Antecedentes personales relevantes..."
      />
    </div>

    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Antecedentes familiares
      </label>

      <textarea
        value={record.family_history ?? ""}
        onChange={(event) =>
          setRecord({
            ...record,
            family_history: event.target.value,
          })
        }
        rows={4}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        placeholder="Antecedentes familiares relevantes..."
      />
    </div>

    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Medicamentos
      </label>

      <textarea
        value={record.medications ?? ""}
        onChange={(event) =>
          setRecord({
            ...record,
            medications: event.target.value,
          })
        }
        rows={4}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        placeholder="Medicamentos actuales..."
      />
    </div>

    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Suplementos
      </label>

      <textarea
        value={record.supplements ?? ""}
        onChange={(event) =>
          setRecord({
            ...record,
            supplements: event.target.value,
          })
        }
        rows={4}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        placeholder="Suplementos utilizados..."
      />
    </div>

    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Diagnósticos
      </label>

      <textarea
        value={record.diagnoses ?? ""}
        onChange={(event) =>
          setRecord({
            ...record,
            diagnoses: event.target.value,
          })
        }
        rows={4}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        placeholder="Diagnósticos médicos o nutricionales..."
      />
    </div>

    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Restricciones alimentarias
      </label>

      <textarea
        value={record.dietary_restrictions ?? ""}
        onChange={(event) =>
          setRecord({
            ...record,
            dietary_restrictions: event.target.value,
          })
        }
        rows={4}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        placeholder="Alergias, intolerancias, restricciones o preferencias..."
      />
    </div>

    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Notas relevantes
      </label>

      <textarea
        value={record.relevant_notes ?? ""}
        onChange={(event) =>
          setRecord({
            ...record,
            relevant_notes: event.target.value,
          })
        }
        rows={4}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        placeholder="Información clínica adicional..."
      />
    </div>
  </div>
</div>

       {/* EVALUACIÓN NUTRICIONAL */}
<div className="mt-10 border-t border-slate-100 pt-8">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
        Evaluación nutricional
      </p>

      <h3 className="mt-1 text-xl font-semibold text-slate-900">
        Evaluación antropométrica
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Registra una nueva evaluación y conserva el historial del paciente.
      </p>
    </div>
  </div>
<section id="nutrition-plan-editor" className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
  <div className="mb-6">
    <h2 className="text-xl font-semibold text-slate-900">
      Nuevo plan nutricional
    </h2>

    <p className="mt-1 text-sm text-slate-500">
      Crea un plan nutricional asociado a una evaluación del paciente.
    </p>
  </div>

  <div className="space-y-5">
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Evaluación nutricional relacionada
      </label>
      <select
        value={newNutritionPlan.assessment_id}
        onChange={(e) =>
          setNewNutritionPlan({
            ...newNutritionPlan,
            assessment_id: e.target.value,
          })
        }
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
      >
        <option value="">
          Sin evaluación relacionada
        </option>
        {assessments.map((assessment) => (
          <option
            key={assessment.id}
            value={assessment.id}
          >
            {new Date(
              assessment.assessment_date
            ).toLocaleDateString("es-HN")}{" "}
            —{" "}
            {assessment.nutritional_diagnosis ||
              "Sin diagnóstico PES"}
          </option>
        ))}
      </select>
    </div>
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Nombre del plan
      </label>
      <input
        type="text"
        value={newNutritionPlan.title}
        onChange={(e) =>
          setNewNutritionPlan({
            ...newNutritionPlan,
            title: e.target.value,
          })
        }
        placeholder="Ej. Plan nutricional para control de peso"
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>
    <div className="grid gap-5 md:grid-cols-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Energía (kcal)
        </label>
        <input
          type="number"
          min="0"
          step="1"
          value={newNutritionPlan.calories}
          onChange={(e) =>
            setNewNutritionPlan({
              ...newNutritionPlan,
              calories: e.target.value,
            })
          }
          placeholder="2000"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Proteína (g)
        </label>
        <input
          type="number"
          min="0"
          step="0.1"
          value={newNutritionPlan.protein_g}
          onChange={(e) =>
            setNewNutritionPlan({
              ...newNutritionPlan,
              protein_g: e.target.value,
            })
          }
          placeholder="100"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Carbohidratos (g)
        </label>

        <input
          type="number"
          min="0"
          step="0.1"
          value={newNutritionPlan.carbohydrates_g}
          onChange={(e) =>
            setNewNutritionPlan({
              ...newNutritionPlan,
              carbohydrates_g: e.target.value,
            })
          }
          placeholder="250"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Grasas (g)
        </label>
        <input
          type="number"
          min="0"
          step="0.1"
          value={newNutritionPlan.fat_g}
          onChange={(e) =>
            setNewNutritionPlan({
              ...newNutritionPlan,
              fat_g: e.target.value,
            })
          }
          placeholder="65"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
        />
      </div>
    </div>
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Fecha de inicio
        </label>
        <input
          type="date"
          value={newNutritionPlan.start_date}
          onChange={(e) =>
            setNewNutritionPlan({
              ...newNutritionPlan,
              start_date: e.target.value,
            })
          }
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Fecha de finalización
        </label>
        <input
          type="date"
          value={newNutritionPlan.end_date}
          onChange={(e) =>
            setNewNutritionPlan({
              ...newNutritionPlan,
              end_date: e.target.value,
            })
          }
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
        />
      </div>
    </div>
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Estado
      </label>
      <select
        value={newNutritionPlan.status}
        onChange={(e) =>
          setNewNutritionPlan({
            ...newNutritionPlan,
            status: e.target.value,
          })
        }
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
      >
        <option value="draft">Borrador</option>
        <option value="active">Activo</option>
        <option value="completed">Finalizado</option>
        <option value="cancelled">Cancelado</option>
      </select>
    </div>
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
  Instrucciones generales
</label>

<textarea
  value={newNutritionPlan.instructions}
  onChange={(e) =>
    setNewNutritionPlan({
      ...newNutritionPlan,
      instructions: e.target.value,
    })
  }
  rows={6}
  placeholder="Indicaciones generales del plan nutricional..."
  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
/>
    </div>
  </div>
<div className="mt-5">
  <label className="mb-2 block text-sm font-medium text-slate-700">
    Hidratación
  </label>

  <textarea
    value={planHydration}
    onChange={(e) => setPlanHydration(e.target.value)}
    rows={3}
    placeholder="Ej. Tomar 2–2.5 L de agua al día, distribuidos durante la jornada."
    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
  />

  <p className="mt-1 text-xs text-slate-500">
    Registra la recomendación de hidratación individual del paciente.
  </p>
</div>
<div className="mt-5">
  <label className="mb-2 block text-sm font-medium text-slate-700">
    Recomendaciones generales
  </label>
  <textarea
    value={planRecommendations}
    onChange={(e) => setPlanRecommendations(e.target.value)}
    rows={5}
    placeholder={"Escribe una recomendación por línea.\nEj. Incluir verduras en el almuerzo y la cena."}
    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
  />
  <p className="mt-1 text-xs text-slate-500">
    Cada línea se guardará como una recomendación independiente.
  </p>
</div>
  {nutritionPlanMessage && (
    <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {nutritionPlanMessage}
    </div>
  )}
{planMeals.length > 0 && (
  <div className="mt-6 space-y-4">
    <h3 className="text-sm font-semibold text-gray-900">
      Comidas del plan
    </h3>

    {planMeals.map((meal, mealIndex) => (
      <div
        key={meal.id}
        className="rounded-xl border border-gray-200 bg-gray-50 p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-semibold text-gray-900">
            Comida {mealIndex + 1}
          </h4>

          <button
            type="button"
            onClick={() => {
              setPlanMeals((currentMeals) =>
                currentMeals.filter(
                  (item) => item.id !== meal.id
                )
              );
            }}
            className="text-sm font-medium text-red-600 hover:text-red-700"
          >
            Eliminar
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nombre de la comida
            </label>

            <input
              type="text"
              value={meal.name}
              onChange={(e) => {
                const value = e.target.value;

                setPlanMeals((currentMeals) =>
                  currentMeals.map((item) =>
                    item.id === meal.id
                      ? { ...item, name: value }
                      : item
                  )
                );
              }}
              placeholder="Ej. Desayuno"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Horario
            </label>

            <input
              type="time"
              value={meal.time}
              onChange={(e) => {
                const value = e.target.value;

                setPlanMeals((currentMeals) =>
                  currentMeals.map((item) =>
                    item.id === meal.id
                      ? { ...item, time: value }
                      : item
                  )
                );
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
{meal.foods.length > 0 && (
  <div className="mt-4 space-y-3">
    {meal.foods.map((food) => (
      <div
        key={food.id}
        className="rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Alimento
            </label>

            <input
              type="text"
              value={food.food}
              onChange={(e) => {
                const value = e.target.value;

                setPlanMeals((currentMeals) =>
                  currentMeals.map((item) =>
                    item.id === meal.id
                      ? {
                          ...item,
                          foods: item.foods.map((itemFood) =>
                            itemFood.id === food.id
                              ? { ...itemFood, food: value }
                              : itemFood
                          ),
                        }
                      : item
                  )
                );
              }}
              placeholder="Ej. Avena"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Cantidad
            </label>

            <input
              type="text"
              value={food.quantity}
              onChange={(e) => {
                const value = e.target.value;

                setPlanMeals((currentMeals) =>
                  currentMeals.map((item) =>
                    item.id === meal.id
                      ? {
                          ...item,
                          foods: item.foods.map((itemFood) =>
                            itemFood.id === food.id
                              ? {
                                  ...itemFood,
                                  quantity: value,
                                }
                              : itemFood
                          ),
                        }
                      : item
                  )
                );
              }}
              placeholder="40"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Unidad
            </label>

            <input
              type="text"
              value={food.unit}
              onChange={(e) => {
                const value = e.target.value;

                setPlanMeals((currentMeals) =>
                  currentMeals.map((item) =>
                    item.id === meal.id
                      ? {
                          ...item,
                          foods: item.foods.map((itemFood) =>
                            itemFood.id === food.id
                              ? {
                                  ...itemFood,
                                  unit: value,
                                }
                              : itemFood
                          ),
                        }
                      : item
                  )
                );
              }}
              placeholder="g, ml, unidad..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Equivalente
            </label>

            <input
              type="text"
              value={food.equivalent}
              onChange={(e) => {
                const value = e.target.value;

                setPlanMeals((currentMeals) =>
                  currentMeals.map((item) =>
                    item.id === meal.id
                      ? {
                          ...item,
                          foods: item.foods.map((itemFood) =>
                            itemFood.id === food.id
                              ? {
                                  ...itemFood,
                                  equivalent: value,
                                }
                              : itemFood
                          ),
                        }
                      : item
                  )
                );
              }}
              placeholder="Cereal"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setPlanMeals((currentMeals) =>
                currentMeals.map((item) =>
                  item.id === meal.id
                    ? {
                        ...item,
                        foods: item.foods.filter(
                          (itemFood) => itemFood.id !== food.id
                        ),
                      }
                    : item
                )
              );
            }}
            className="text-xs font-medium text-red-600 hover:text-red-700"
          >
            Eliminar alimento
          </button>
        </div>
      </div>
    ))}
  </div>
)}
<div className="mt-6 border-t border-gray-200 pt-6">
  <div className="flex items-center justify-between">
    <div>
      <h3 className="text-sm font-semibold text-gray-900">
        Suplementación
      </h3>

      <p className="mt-1 text-xs text-gray-500">
        Registra los suplementos indicados para este plan.
      </p>
    </div>

    <button
      type="button"
      onClick={() => {
        setPlanSupplements((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            name: "",
            dose: "",
            frequency: "",
            instructions: "",
          },
        ]);
      }}
      className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-white"
    >
      + Agregar suplemento
    </button>
  </div>

  {planSupplements.length > 0 && (
    <div className="mt-4 space-y-3">
      {planSupplements.map((supplement) => (
        <div
          key={supplement.id}
          className="rounded-lg border border-gray-200 bg-gray-50 p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Suplemento
              </label>

              <input
                type="text"
                value={supplement.name}
                onChange={(e) => {
                  const value = e.target.value;

                  setPlanSupplements((current) =>
                    current.map((item) =>
                      item.id === supplement.id
                        ? { ...item, name: value }
                        : item
                    )
                  );
                }}
                placeholder="Ej. Vitamina D"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Dosis
              </label>

              <input
                type="text"
                value={supplement.dose}
                onChange={(e) => {
                  const value = e.target.value;

                  setPlanSupplements((current) =>
                    current.map((item) =>
                      item.id === supplement.id
                        ? { ...item, dose: value }
                        : item
                    )
                  );
                }}
                placeholder="Ej. 1000 UI"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Frecuencia
              </label>

              <input
                type="text"
                value={supplement.frequency}
                onChange={(e) => {
                  const value = e.target.value;

                  setPlanSupplements((current) =>
                    current.map((item) =>
                      item.id === supplement.id
                        ? {
                            ...item,
                            frequency: value,
                          }
                        : item
                    )
                  );
                }}
                placeholder="Ej. 1 vez al día"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Indicaciones
              </label>

              <input
                type="text"
                value={supplement.instructions}
                onChange={(e) => {
                  const value = e.target.value;

                  setPlanSupplements((current) =>
                    current.map((item) =>
                      item.id === supplement.id
                        ? {
                            ...item,
                            instructions: value,
                          }
                        : item
                    )
                  );
                }}
                placeholder="Ej. Tomar con el desayuno"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setPlanSupplements((current) =>
                  current.filter(
                    (item) => item.id !== supplement.id
                  )
                );
              }}
              className="text-xs font-medium text-red-600 hover:text-red-700"
            >
              Eliminar suplemento
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Indicaciones de esta comida
          </label>

          <textarea
            value={meal.instructions}
            onChange={(e) => {
              const value = e.target.value;

              setPlanMeals((currentMeals) =>
                currentMeals.map((item) =>
                  item.id === meal.id
                    ? { ...item, instructions: value }
                    : item
                )
              );
            }}
            rows={2}
            placeholder="Ej. Preferir preparación sin frituras."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4">
  <button
    type="button"
    onClick={() => addMealFood(meal.id)}
    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white"
  >
    + Agregar alimento
  </button>
</div>
<div className="mt-5 border-t border-gray-200 pt-5">
  <div className="flex items-center justify-between">
    <div>
      <h5 className="text-sm font-semibold text-gray-900">
        Sustituciones
      </h5>

      <p className="mt-1 text-xs text-gray-500">
        Agrega alternativas para los alimentos de esta comida.
      </p>
    </div>

    <button
      type="button"
      onClick={() => {
        setPlanSubstitutions((current) => [
          ...current,
          {
  id: crypto.randomUUID(),
  mealId: meal.id,
  food: "",
  alternatives: "",
},
        ]);
      }}
      className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-white"
    >
      + Agregar sustitución
    </button>
  </div>
  {planSubstitutions
  .filter((substitution) => substitution.mealId === meal.id)
  .map((substitution) => (
    <div
      key={substitution.id}
      className="mt-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Alimento
          </label>

          <input
            type="text"
            value={substitution.food}
            onChange={(e) => {
              const value = e.target.value;

              setPlanSubstitutions((current) =>
                current.map((item) =>
                  item.id === substitution.id
                    ? { ...item, food: value }
                    : item
                )
              );
            }}
            placeholder="Ej. Avena"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Alternativas
          </label>

          <input
            type="text"
            value={substitution.alternatives}
            onChange={(e) => {
              const value = e.target.value;

              setPlanSubstitutions((current) =>
                current.map((item) =>
                  item.id === substitution.id
                    ? {
                        ...item,
                        alternatives: value,
                      }
                    : item
                )
              );
            }}
            placeholder="Ej. 2 tortillas de maíz, 1 rebanada de pan integral"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setPlanSubstitutions((current) =>
              current.filter(
                (item) => item.id !== substitution.id
              )
            );
          }}
          className="text-xs font-medium text-red-600 hover:text-red-700"
        >
          Eliminar sustitución
        </button>
      </div>
    </div>
  ))}
</div>
      </div>
    ))}
  </div>
)}
  <div className="mt-6 flex justify-end gap-3">
  <button
    type="button"
    onClick={addPlanMeal}
    className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
  >
    + Agregar comida
  </button>

  <button
    type="button"
    onClick={saveNutritionPlan}
    disabled={savingNutritionPlan}
    className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {savingNutritionPlan
      ? "Guardando..."
      : "Guardar plan nutricional"}
  </button>
</div>
</section>
<div className="mt-8">
  <h3 className="text-lg font-semibold text-gray-900">
    Historial de planes nutricionales
  </h3>

  {nutritionPlans.length === 0 ? (
    <p className="mt-3 text-sm text-gray-500">
      Aún no hay planes nutricionales registrados.
    </p>
  ) : (
    <div className="mt-4 space-y-4">
      {nutritionPlans.map((plan) => (
        <div
          key={plan.id}
          className="rounded-xl border border-gray-200 bg-white p-5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="font-semibold text-gray-900">
                {plan.title || "Plan nutricional"}
              </h4>

              <p className="text-sm text-gray-500">
                Creado el{" "}
                {new Date(plan.created_at).toLocaleDateString("es-HN")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {plan.status}
              </span>
              <button
                type="button"
                onClick={() => usePlanAsTemplate(plan)}
                className="rounded-lg border border-emerald-600 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
              >
                Usar como base
              </button>
              <button
                type="button"
                onClick={() => printNutritionPlan(plan)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Imprimir / PDF
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Calorías</p>
              <p className="font-semibold text-gray-900">
                {plan.calories ?? "—"} kcal
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Proteína</p>
              <p className="font-semibold text-gray-900">
                {plan.protein_g ?? "—"} g
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Carbohidratos</p>
              <p className="font-semibold text-gray-900">
                {plan.carbohydrates_g ?? "—"} g
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Grasas</p>
              <p className="font-semibold text-gray-900">
                {plan.fat_g ?? "—"} g
              </p>
            </div>
          </div>

          {(plan.start_date || plan.end_date) && (
            <p className="mt-4 text-sm text-gray-600">
              Vigencia:{" "}
              {plan.start_date
                ? new Date(plan.start_date).toLocaleDateString("es-HN")
                : "—"}{" "}
              →{" "}
              {plan.end_date
                ? new Date(plan.end_date).toLocaleDateString("es-HN")
                : "Sin fecha de finalización"}
            </p>
          )}

          {plan.plan_content?.hydration && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Hidratación</p>
              <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{plan.plan_content.hydration}</p>
            </div>
          )}

          {Array.isArray(plan.plan_content?.general_recommendations) &&
            plan.plan_content.general_recommendations.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Recomendaciones generales
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {plan.plan_content.general_recommendations.map((recommendation, index) => (
                    <li key={index}>{recommendation}</li>
                  ))}
                </ul>
              </div>
            )}

          {plan.instructions && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Indicaciones
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-gray-700">
                {plan.instructions}
              </p>
            </div>
          )}
          {plan.plan_content &&
  Array.isArray(plan.plan_content.meals) &&
  plan.plan_content.meals.length > 0 && (
    <div className="mt-5 border-t border-gray-200 pt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Plan de alimentación
      </p>

      <div className="mt-3 space-y-4">
        {plan.plan_content.meals.map((meal) => (
          <div
            key={meal.id}
            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h5 className="font-semibold text-gray-900">
                {meal.name || "Comida"}
              </h5>

              {meal.time && (
                <span className="text-sm text-gray-500">
                  {meal.time}
                </span>
              )}
            </div>

            {Array.isArray(meal.foods) &&
              meal.foods.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-xs text-gray-500">
                        <th className="pb-2 pr-4 font-medium">
                          Alimento
                        </th>
                        <th className="pb-2 pr-4 font-medium">
                          Cantidad
                        </th>
                        <th className="pb-2 pr-4 font-medium">
                          Unidad
                        </th>
                        <th className="pb-2 font-medium">
                          Equivalente
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {meal.foods.map((food) => (
                        <tr
                          key={food.id}
                          className="border-b border-gray-100 last:border-0"
                        >
                          <td className="py-2 pr-4 font-medium text-gray-800">
                            {food.food || "—"}
                          </td>

                          <td className="py-2 pr-4 text-gray-600">
                            {food.quantity || "—"}
                          </td>

                          <td className="py-2 pr-4 text-gray-600">
                            {food.unit || "—"}
                          </td>

                          <td className="py-2 text-gray-600">
                            {food.equivalent || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            {meal.instructions && (
              <div className="mt-3 rounded-lg bg-white p-3">
                <p className="text-xs font-medium text-gray-500">
                  Indicaciones
                </p>

                <p className="mt-1 whitespace-pre-line text-sm text-gray-700">
                  {meal.instructions}
                </p>
              </div>
            )}
          </div>
        ))}
        {plan.plan_content &&
  Array.isArray(plan.plan_content.substitutions) &&
  plan.plan_content.substitutions.length > 0 && (
    <div className="mt-5 border-t border-gray-200 pt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Sustituciones
      </p>

      <div className="mt-3 space-y-2">
        {plan.plan_content.substitutions.map((substitution) => (
          <div
            key={substitution.id}
            className="rounded-lg border border-gray-200 bg-gray-50 p-3"
          >
            <p className="text-sm font-semibold text-gray-800">
              {substitution.food || "Alimento"}
            </p>

            {substitution.alternatives && (
              <p className="mt-1 text-sm text-gray-600">
                <span className="font-medium">
                  Alternativas:
                </span>{" "}
                {substitution.alternatives}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )}
  {plan.plan_content &&
  Array.isArray(plan.plan_content.supplements) &&
  plan.plan_content.supplements.length > 0 && (
    <div className="mt-5 border-t border-gray-200 pt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Suplementación
      </p>

      <div className="mt-3 space-y-3">
        {plan.plan_content.supplements.map((supplement) => (
          <div
            key={supplement.id}
            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-gray-500">
                  Suplemento
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-800">
                  {supplement.name || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">
                  Dosis
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  {supplement.dose || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">
                  Frecuencia
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  {supplement.frequency || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">
                  Indicaciones
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  {supplement.instructions || "—"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )}
      </div>
    </div>
  )}
        </div>
      ))}
    </div>
  )}
</div>
  {/* NUEVA EVALUACIÓN */}
  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h4 className="text-base font-semibold text-slate-900">
          Nueva evaluación
        </h4>

        <p className="mt-1 text-sm text-slate-500">
          El IMC se calculará automáticamente con el peso y la talla.
        </p>
      </div>
    </div>

    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Fecha y hora
        </label>

        <input
          type="datetime-local"
          value={newAnthropometry.measured_at}
          onChange={(event) =>
            setNewAnthropometry({
              ...newAnthropometry,
              measured_at: event.target.value,
            })
          }
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Peso (kg)
        </label>

        <input
          type="number"
          step="0.01"
          min="0"
          value={newAnthropometry.weight_kg}
          onChange={(event) =>
            setNewAnthropometry({
              ...newAnthropometry,
              weight_kg: event.target.value,
            })
          }
          placeholder="Ej. 68.50"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Talla (cm)
        </label>

        <input
          type="number"
          step="0.1"
          min="0"
          value={newAnthropometry.height_cm}
          onChange={(event) =>
            setNewAnthropometry({
              ...newAnthropometry,
              height_cm: event.target.value,
            })
          }
          placeholder="Ej. 165"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Cintura (cm)
        </label>

        <input
          type="number"
          step="0.1"
          min="0"
          value={newAnthropometry.waist_cm}
          onChange={(event) =>
            setNewAnthropometry({
              ...newAnthropometry,
              waist_cm: event.target.value,
            })
          }
          placeholder="Ej. 82"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Cadera (cm)
        </label>

        <input
          type="number"
          step="0.1"
          min="0"
          value={newAnthropometry.hip_cm}
          onChange={(event) =>
            setNewAnthropometry({
              ...newAnthropometry,
              hip_cm: event.target.value,
            })
          }
          placeholder="Ej. 98"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Grasa corporal (%)
        </label>

        <input
          type="number"
          step="0.1"
          min="0"
          value={newAnthropometry.body_fat_percent}
          onChange={(event) =>
            setNewAnthropometry({
              ...newAnthropometry,
              body_fat_percent: event.target.value,
            })
          }
          placeholder="Ej. 24.5"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Masa muscular (kg)
        </label>

        <input
          type="number"
          step="0.01"
          min="0"
          value={newAnthropometry.muscle_mass_kg}
          onChange={(event) =>
            setNewAnthropometry({
              ...newAnthropometry,
              muscle_mass_kg: event.target.value,
            })
          }
          placeholder="Ej. 32.50"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <div className="sm:col-span-2 lg:col-span-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Notas
        </label>

        <input
          type="text"
          value={newAnthropometry.notes}
          onChange={(event) =>
            setNewAnthropometry({
              ...newAnthropometry,
              notes: event.target.value,
            })
          }
          placeholder="Observaciones de la evaluación..."
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>
    </div>

    {anthropometryMessage && (
      <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
        <p className="text-sm font-medium text-emerald-700">
          {anthropometryMessage}
        </p>
      </div>
    )}

    <div className="mt-5 flex justify-end">
      <button
        type="button"
        onClick={saveAnthropometry}
        disabled={savingAnthropometry}
        className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {savingAnthropometry
          ? "Guardando..."
          : "Guardar evaluación"}
      </button>
    </div>
  </div>

  {/* ÚLTIMA EVALUACIÓN */}
  <div className="mt-8">
    <div className="mb-4">
      <p className="text-sm font-semibold text-slate-900">
        Última evaluación
      </p>

      <p className="mt-1 text-xs text-slate-500">
        Datos antropométricos registrados más recientemente.
      </p>
    </div>

    {!latestAnthropometry ? (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6">
        <p className="text-sm font-medium text-slate-700">
          No hay evaluaciones antropométricas registradas.
        </p>

        <p className="mt-1 text-sm text-slate-500">
          La primera evaluación aparecerá aquí después de guardarla.
        </p>
      </div>
    ) : (
      <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Peso
            </p>

            <p className="mt-2 text-xl font-semibold text-slate-900">
              {latestAnthropometry.weight_kg !== null
                ? `${latestAnthropometry.weight_kg} kg`
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Talla
            </p>

            <p className="mt-2 text-xl font-semibold text-slate-900">
              {latestAnthropometry.height_cm !== null
                ? `${latestAnthropometry.height_cm} cm`
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              IMC
            </p>

            <p className="mt-2 text-xl font-semibold text-slate-900">
              {latestAnthropometry.bmi !== null
                ? latestAnthropometry.bmi
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Grasa corporal
            </p>

            <p className="mt-2 text-xl font-semibold text-slate-900">
              {latestAnthropometry.body_fat_percent !== null
                ? `${latestAnthropometry.body_fat_percent}%`
                : "—"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Cintura
            </p>

            <p className="mt-2 text-sm font-semibold text-slate-800">
              {latestAnthropometry.waist_cm !== null
                ? `${latestAnthropometry.waist_cm} cm`
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Cadera
            </p>

            <p className="mt-2 text-sm font-semibold text-slate-800">
              {latestAnthropometry.hip_cm !== null
                ? `${latestAnthropometry.hip_cm} cm`
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Masa muscular
            </p>

            <p className="mt-2 text-sm font-semibold text-slate-800">
              {latestAnthropometry.muscle_mass_kg !== null
                ? `${latestAnthropometry.muscle_mass_kg} kg`
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Fecha
            </p>

            <p className="mt-2 text-sm font-semibold text-slate-800">
              {new Date(
                latestAnthropometry.measured_at
              ).toLocaleDateString("es-HN")}
            </p>
          </div>
        </div>

        {latestAnthropometry.notes && (
          <div className="mt-4 rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Notas
            </p>

            <p className="mt-2 text-sm text-slate-700">
              {latestAnthropometry.notes}
            </p>
          </div>
        )}
      </>
    )}
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
  <div className="mb-6">
    <h2 className="text-xl font-semibold text-slate-900">
      Nueva nota de consulta
    </h2>
    <p className="mt-1 text-sm text-slate-500">
      Registra la evolución clínica y nutricional de esta consulta.
    </p>
  </div>

  <div className="grid gap-5 md:grid-cols-2">
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Fecha de consulta
      </label>
      <input
        type="datetime-local"
        value={newClinicalNote.note_date}
        onChange={(e) =>
          setNewClinicalNote({
            ...newClinicalNote,
            note_date: e.target.value,
          })
        }
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Próxima cita
      </label>
      <input
        type="datetime-local"
        value={newClinicalNote.next_appointment}
        onChange={(e) =>
          setNewClinicalNote({
            ...newClinicalNote,
            next_appointment: e.target.value,
          })
        }
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>

    <div className="md:col-span-2">
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Motivo de consulta
      </label>
      <textarea
        value={newClinicalNote.reason}
        onChange={(e) =>
          setNewClinicalNote({
            ...newClinicalNote,
            reason: e.target.value,
          })
        }
        rows={3}
        placeholder="¿Por qué consulta el paciente?"
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Subjetivo
      </label>
      <textarea
        value={newClinicalNote.subjective}
        onChange={(e) =>
          setNewClinicalNote({
            ...newClinicalNote,
            subjective: e.target.value,
          })
        }
        rows={5}
        placeholder="Lo que refiere el paciente o cuidador."
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Objetivo
      </label>
      <textarea
        value={newClinicalNote.objective}
        onChange={(e) =>
          setNewClinicalNote({
            ...newClinicalNote,
            objective: e.target.value,
          })
        }
        rows={5}
        placeholder="Datos clínicos, antropometría, laboratorios, signos relevantes..."
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Intervención nutricional
      </label>
      <textarea
        value={newClinicalNote.intervention}
        onChange={(e) =>
          setNewClinicalNote({
            ...newClinicalNote,
            intervention: e.target.value,
          })
        }
        rows={5}
        placeholder="Plan de alimentación, ajustes, suplementación, indicaciones..."
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Educación nutricional
      </label>
      <textarea
        value={newClinicalNote.education}
        onChange={(e) =>
          setNewClinicalNote({
            ...newClinicalNote,
            education: e.target.value,
          })
        }
        rows={5}
        placeholder="Temas explicados al paciente o cuidador."
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Acuerdos
      </label>
      <textarea
        value={newClinicalNote.agreements}
        onChange={(e) =>
          setNewClinicalNote({
            ...newClinicalNote,
            agreements: e.target.value,
          })
        }
        rows={4}
        placeholder="Compromisos establecidos con el paciente o cuidador."
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Seguimiento
      </label>
      <textarea
        value={newClinicalNote.follow_up}
        onChange={(e) =>
          setNewClinicalNote({
            ...newClinicalNote,
            follow_up: e.target.value,
          })
        }
        rows={4}
        placeholder="Qué se dará seguimiento en la próxima consulta."
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>
  </div>

  {clinicalNoteMessage && (
    <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {clinicalNoteMessage}
    </div>
  )}

  <div className="mt-6 flex justify-end">
    <button
      type="button"
      onClick={saveClinicalNote}
      disabled={savingClinicalNote}
      className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {savingClinicalNote
        ? "Guardando..."
        : "Guardar nota de consulta"}
    </button>
  </div>
</section>
<section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
  <div className="mb-6">
    <h2 className="text-xl font-semibold text-slate-900">
      Historial de notas de consulta
    </h2>
    <p className="mt-1 text-sm text-slate-500">
      Evolución y seguimiento de las consultas nutricionales.
    </p>
  </div>

  {clinicalNotes.length === 0 ? (
    <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      No hay notas de consulta registradas.
    </div>
  ) : (
    <div className="space-y-4">
      {clinicalNotes.map((note) => (
        <article
          key={note.id}
          className="rounded-xl border border-slate-200 p-5"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">
                Consulta nutricional
              </p>
              <p className="text-sm text-slate-500">
                {new Date(note.created_at).toLocaleString(
                  "es-HN",
                  {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }
                )}
              </p>
            </div>

            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {note.note_type}
            </span>
          </div>

          {(() => {
            let content: {
              reason?: string;
              subjective?: string;
              objective?: string;
              intervention?: string;
              education?: string;
              agreements?: string;
              follow_up?: string;
              next_appointment?: string | null;
            } = {};

            try {
              content = JSON.parse(note.content);
            } catch {
              content = {};
            }

            return (
              <div className="grid gap-4 md:grid-cols-2">
                {content.reason && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Motivo de consulta
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                      {content.reason}
                    </p>
                  </div>
                )}

                {content.subjective && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Subjetivo
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                      {content.subjective}
                    </p>
                  </div>
                )}

                {content.objective && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Objetivo
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                      {content.objective}
                    </p>
                  </div>
                )}

                {content.intervention && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Intervención nutricional
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                      {content.intervention}
                    </p>
                  </div>
                )}

                {content.education && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Educación nutricional
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                      {content.education}
                    </p>
                  </div>
                )}

                {content.agreements && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Acuerdos
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                      {content.agreements}
                    </p>
                  </div>
                )}

                {content.follow_up && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Seguimiento
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                      {content.follow_up}
                    </p>
                  </div>
                )}

                {content.next_appointment && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Próxima cita
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {new Date(
                        content.next_appointment
                      ).toLocaleString("es-HN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </article>
      ))}
    </div>
  )}
</section>
<section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
  <div className="mb-6">
    <h2 className="text-xl font-semibold text-slate-900">
      Historial de evaluaciones nutricionales
    </h2>

    <p className="mt-1 text-sm text-slate-500">
      Registro de las evaluaciones, diagnósticos nutricionales y objetivos.
    </p>
  </div>

  {assessments.length === 0 ? (
    <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      No hay evaluaciones nutricionales registradas.
    </div>
  ) : (
    <div className="space-y-5">
      {assessments.map((assessment) => (
        <article
          key={assessment.id}
          className="rounded-2xl border border-slate-200 p-5"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">
                Evaluación nutricional
              </h3>

              <p className="text-sm text-slate-500">
                {new Date(
                  assessment.assessment_date
                ).toLocaleString("es-HN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>

            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              Evaluación
            </span>
          </div>

          <div className="space-y-5">
            {assessment.reason_for_consultation && (
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Motivo de consulta
                </p>

                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                  {assessment.reason_for_consultation}
                </p>
              </div>
            )}

            {assessment.nutritional_diagnosis && (
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800">
                  Diagnóstico nutricional — PES
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900">
                  {assessment.nutritional_diagnosis}
                </p>
              </div>
            )}

            {assessment.clinical_diagnosis && (
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Diagnóstico clínico
                </p>

                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                  {assessment.clinical_diagnosis}
                </p>
              </div>
            )}

            {assessment.goals && (
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Objetivos nutricionales
                </p>

                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                  {assessment.goals}
                </p>
              </div>
            )}

            {assessment.assessment_notes && (
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Análisis y notas de evaluación
                </p>

                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                  {assessment.assessment_notes}
                </p>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  )}
</section>
<section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
  <div className="mb-6">
    <h2 className="text-xl font-semibold text-slate-900">
      Evaluación nutricional
    </h2>

    <p className="mt-1 text-sm text-slate-500">
      Registra el análisis nutricional, diagnóstico PES y objetivos
      de la intervención.
    </p>
  </div>

  <div className="space-y-5">
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Fecha de evaluación
      </label>

      <input
        type="datetime-local"
        value={newAssessment.assessment_date}
        onChange={(e) =>
          setNewAssessment({
            ...newAssessment,
            assessment_date: e.target.value,
          })
        }
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Motivo de consulta
      </label>

      <textarea
        value={newAssessment.reason_for_consultation}
        onChange={(e) =>
          setNewAssessment({
            ...newAssessment,
            reason_for_consultation: e.target.value,
          })
        }
        rows={3}
        placeholder="Motivo principal por el que consulta el paciente."
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Diagnóstico nutricional — PES
      </label>

      <textarea
        value={newAssessment.nutritional_diagnosis}
        onChange={(e) =>
          setNewAssessment({
            ...newAssessment,
            nutritional_diagnosis: e.target.value,
          })
        }
        rows={5}
        placeholder="Problema relacionado con la nutrición, etiología y signos/síntomas que lo sustentan."
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />

      <p className="mt-2 text-xs text-slate-500">
        Ejemplo de estructura: Problema relacionado con Etiología
        evidenciado por Signos/Síntomas.
      </p>
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Diagnóstico clínico
      </label>

      <textarea
        value={newAssessment.clinical_diagnosis}
        onChange={(e) =>
          setNewAssessment({
            ...newAssessment,
            clinical_diagnosis: e.target.value,
          })
        }
        rows={3}
        placeholder="Diagnóstico médico o condición clínica relevante."
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Objetivos nutricionales
      </label>

      <textarea
        value={newAssessment.goals}
        onChange={(e) =>
          setNewAssessment({
            ...newAssessment,
            goals: e.target.value,
          })
        }
        rows={5}
        placeholder="Objetivos generales y específicos de la intervención nutricional."
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Análisis y notas de evaluación
      </label>

      <textarea
        value={newAssessment.assessment_notes}
        onChange={(e) =>
          setNewAssessment({
            ...newAssessment,
            assessment_notes: e.target.value,
          })
        }
        rows={6}
        placeholder="Interpretación de antropometría, alimentación, antecedentes, laboratorios y demás hallazgos relevantes."
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>
  </div>

  {assessmentMessage && (
    <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {assessmentMessage}
    </div>
  )}

  <div className="mt-6 flex justify-end">
    <button
      type="button"
      onClick={saveAssessment}
      disabled={savingAssessment}
      className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {savingAssessment
        ? "Guardando..."
        : "Guardar evaluación"}
    </button>
  </div>
</section>
    {/* HISTORIAL ANTROPOMÉTRICO */}
<div className="mt-8">
  <div className="mb-4">
    <p className="text-sm font-semibold text-slate-900">
      Historial de evaluaciones
    </p>

    <p className="mt-1 text-xs text-slate-500">
      Evolución de las mediciones antropométricas registradas.
    </p>
  </div>

  {anthropometryHistory.length === 0 ? (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6">
      <p className="text-sm text-slate-500">
        No hay evaluaciones registradas.
      </p>
    </div>
  ) : (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Fecha
            </th>

            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Peso
            </th>

            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Talla
            </th>

            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              IMC
            </th>

            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Cintura
            </th>

            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              % grasa
            </th>

            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Masa muscular
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {anthropometryHistory.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                {new Date(
                  item.measured_at
                ).toLocaleDateString("es-HN")}
              </td>

              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-800">
                {item.weight_kg !== null
                  ? `${item.weight_kg} kg`
                  : "—"}
              </td>

              <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                {item.height_cm !== null
                  ? `${item.height_cm} cm`
                  : "—"}
              </td>

              <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-800">
                {item.bmi !== null ? item.bmi : "—"}
              </td>

              <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                {item.waist_cm !== null
                  ? `${item.waist_cm} cm`
                  : "—"}
              </td>

              <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                {item.body_fat_percent !== null
                  ? `${item.body_fat_percent}%`
                  : "—"}
              </td>

              <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                {item.muscle_mass_kg !== null
                  ? `${item.muscle_mass_kg} kg`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
{/* EVOLUCIÓN DEL PESO */}
<div className="mt-8">
  <div className="mb-4">
    <p className="text-sm font-semibold text-slate-900">
      Evolución del peso
    </p>

    <p className="mt-1 text-xs text-slate-500">
      Seguimiento del peso registrado en las evaluaciones.
    </p>
  </div>

  {anthropometryEvolution.filter(
    (item) => item.weight_kg !== null
  ).length < 2 ? (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6">
      <p className="text-sm font-medium text-slate-700">
        Se necesitan al menos dos evaluaciones con peso
        registrado.
      </p>

      <p className="mt-1 text-sm text-slate-500">
        La gráfica aparecerá cuando exista más de una
        medición.
      </p>
    </div>
  ) : (
    <div className="h-[320px] w-full rounded-xl border border-slate-200 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={anthropometryEvolution
            .filter(
              (item) => item.weight_kg !== null
            )
            .map((item) => ({
              fecha: new Date(
                item.measured_at
              ).toLocaleDateString("es-HN", {
                day: "2-digit",
                month: "short",
              }),
              peso: item.weight_kg,
            }))}
          margin={{
            top: 10,
            right: 20,
            left: 0,
            bottom: 10,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="fecha"
            tick={{ fontSize: 12 }}
          />

          <YAxis
            unit=" kg"
            tick={{ fontSize: 12 }}
          />

          <Tooltip
            formatter={(value) => [
              `${value} kg`,
              "Peso",
            ]}
          />

          <Line
            type="monotone"
            dataKey="peso"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )}
</div>
{/* EVOLUCIÓN DEL IMC */}
<div className="mt-8">
  <div className="mb-4">
    <p className="text-sm font-semibold text-slate-900">
      Evolución del IMC
    </p>

    <p className="mt-1 text-xs text-slate-500">
      Seguimiento del índice de masa corporal registrado en las evaluaciones.
    </p>
  </div>

  {anthropometryEvolution.filter(
    (item) => item.bmi !== null
  ).length < 2 ? (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6">
      <p className="text-sm font-medium text-slate-700">
        Se necesitan al menos dos evaluaciones con IMC registrado.
      </p>

      <p className="mt-1 text-sm text-slate-500">
        La gráfica aparecerá cuando exista más de una medición.
      </p>
    </div>
  ) : (
    <div className="h-[320px] w-full rounded-xl border border-slate-200 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={anthropometryEvolution
            .filter(
              (item) => item.bmi !== null
            )
            .map((item) => ({
              fecha: new Date(
                item.measured_at
              ).toLocaleDateString("es-HN", {
                day: "2-digit",
                month: "short",
              }),
              imc: item.bmi,
            }))}
          margin={{
            top: 10,
            right: 20,
            left: 0,
            bottom: 10,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="fecha"
            tick={{ fontSize: 12 }}
          />

          <YAxis
            tick={{ fontSize: 12 }}
          />

          <Tooltip
            formatter={(value) => [
              value,
              "IMC",
            ]}
          />

          <Line
            type="monotone"
            dataKey="imc"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )}
</div>
{/* EVOLUCIÓN DE CINTURA */}
<div className="mt-8">
  <div className="mb-4">
    <p className="text-sm font-semibold text-slate-900">
      Evolución de cintura
    </p>

    <p className="mt-1 text-xs text-slate-500">
      Seguimiento de la circunferencia de cintura.
    </p>
  </div>

  {anthropometryEvolution.filter(
    (item) => item.waist_cm !== null
  ).length < 2 ? (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6">
      <p className="text-sm font-medium text-slate-700">
        Se necesitan al menos dos evaluaciones con cintura registrada.
      </p>
    </div>
  ) : (
    <div className="h-[320px] w-full rounded-xl border border-slate-200 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={anthropometryEvolution
            .filter(
              (item) => item.waist_cm !== null
            )
            .map((item) => ({
              fecha: new Date(
                item.measured_at
              ).toLocaleDateString("es-HN", {
                day: "2-digit",
                month: "short",
              }),
              cintura: item.waist_cm,
            }))}
        >
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="fecha"
            tick={{ fontSize: 12 }}
          />

          <YAxis
            unit=" cm"
            tick={{ fontSize: 12 }}
          />

          <Tooltip
            formatter={(value) => [
              `${value} cm`,
              "Cintura",
            ]}
          />

          <Line
            type="monotone"
            dataKey="cintura"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )}
</div>

{/* EVOLUCIÓN DE GRASA CORPORAL */}
<div className="mt-8">
  <div className="mb-4">
    <p className="text-sm font-semibold text-slate-900">
      Evolución de grasa corporal
    </p>

    <p className="mt-1 text-xs text-slate-500">
      Seguimiento del porcentaje de grasa corporal registrado.
    </p>
  </div>

  {anthropometryEvolution.filter(
    (item) => item.body_fat_percent !== null
  ).length < 2 ? (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6">
      <p className="text-sm font-medium text-slate-700">
        Se necesitan al menos dos evaluaciones con porcentaje de grasa registrado.
      </p>
    </div>
  ) : (
    <div className="h-[320px] w-full rounded-xl border border-slate-200 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={anthropometryEvolution
            .filter(
              (item) =>
                item.body_fat_percent !== null
            )
            .map((item) => ({
              fecha: new Date(
                item.measured_at
              ).toLocaleDateString("es-HN", {
                day: "2-digit",
                month: "short",
              }),
              grasa: item.body_fat_percent,
            }))}
        >
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="fecha"
            tick={{ fontSize: 12 }}
          />

          <YAxis
            unit="%"
            tick={{ fontSize: 12 }}
          />

          <Tooltip
            formatter={(value) => [
              `${value}%`,
              "Grasa corporal",
            ]}
          />

          <Line
            type="monotone"
            dataKey="grasa"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )}
</div>
  </div>
</div>
      </section>
    </>
  );
}
