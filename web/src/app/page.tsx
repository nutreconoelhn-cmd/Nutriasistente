"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { browserDb } from "../lib/supabase-browser";

export default function Home() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      const { error } = await browserDb().auth.signInWithPassword({email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? "")});
      if (error) { setMessage(error.code === "invalid_credentials" ? "Revisa tu correo y contraseña." : error.message); return; }
      router.replace("/panel");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo iniciar sesión."); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><p className="font-semibold text-emerald-700">🥗 Nutriasistente</p><h1 className="mt-5 text-3xl font-bold">Bienvenido, Noel</h1><p className="mt-2 text-slate-500">Tu consultorio, en un solo lugar.</p><form onSubmit={login} className="mt-8 space-y-5"><label className="block text-sm font-medium">Correo electrónico<input name="email" type="email" autoComplete="username" required disabled={busy} className="mt-2 w-full rounded-xl border border-slate-300 p-3"/></label><label className="block text-sm font-medium">Contraseña<input name="password" type="password" autoComplete="current-password" required disabled={busy} className="mt-2 w-full rounded-xl border border-slate-300 p-3"/></label><button disabled={busy} className="w-full rounded-xl bg-emerald-700 p-3 font-semibold text-white disabled:opacity-50">{busy ? "Ingresando…" : "Entrar al consultorio"}</button></form>{message && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{message}</p>}</section></main>;
}
