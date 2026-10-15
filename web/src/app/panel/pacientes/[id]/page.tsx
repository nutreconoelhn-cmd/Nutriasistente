"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { browserDb } from "@/lib/supabase-browser";
import PatientRecord from "../../patient-record";
export default function Page(){return <Suspense fallback={<p className="p-8">Cargando expediente…</p>}><PatientPage/></Suspense>;}
function PatientPage(){
 const params=useParams<{id:string}>(); const router=useRouter();
 const [ready,setReady]=useState(false); const [error,setError]=useState("");
 useEffect(()=>{let active=true;setReady(false);setError("");
 async function verify(){try{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id))throw new Error("El identificador del paciente no es válido.");
  const {data:{user},error}=await browserDb().auth.getUser();
  if(error)throw new Error("No se pudo verificar tu sesión. Vuelve a iniciar sesión.");
  if(!user){router.replace("/");return;} if(active)setReady(true);
 }catch(e){if(active)setError(e instanceof Error?e.message:"No se pudo abrir el expediente.");}}
 void verify();return()=>{active=false;};},[params.id,router]);
 return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-6xl">{ready?<PatientRecord key={params.id} patientId={params.id}/>:<section className="rounded-2xl border border-slate-200 bg-white p-6"><p role="status">{error||"Comprobando tu sesión…"}</p><Link href="/panel?seccion=pacientes" className="mt-4 inline-block text-emerald-700">← Volver a pacientes</Link></section>}</div></main>;
}
