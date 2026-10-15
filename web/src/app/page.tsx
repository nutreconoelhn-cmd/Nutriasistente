"use client";

import { useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function Home() {
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  async function ingresar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCargando(true);
    setMensaje("");

    const datos = new FormData(event.currentTarget);

    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
      const clave =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

      if (!url || !clave) {
        throw new Error(
          "Faltan las variables de Supabase. Comprueba que .env.local esté dentro de web y reinicia el servidor."
        );
      }

      let direccion: URL;

      try {
        direccion = new URL(url);
      } catch {
        throw new Error(
          "La URL de Supabase no es válida. Copia la URL del proyecto completa, comenzando con https://."
        );
      }

      if (direccion.protocol !== "https:") {
        throw new Error(
          "La URL de Supabase debe comenzar con https://."
        );
      }

      const supabase = createBrowserClient(url, clave);

      const { error } = await supabase.auth.signInWithPassword({
        email: String(datos.get("email") ?? "").trim(),
        password: String(datos.get("password") ?? ""),
      });

      if (error) {
        if (error.code === "invalid_credentials") {
          setMensaje("Revisa tu correo y contraseña.");
        } else if (/fetch|network/i.test(error.message)) {
          setMensaje(
            "No se pudo contactar con Supabase. Revisa la URL del proyecto y confirma que el proyecto esté activo."
          );
        } else {
          setMensaje("No se pudo iniciar sesión: " + error.message);
        }

        return;
      }

      setMensaje("✅ Sesión iniciada. La conexión funciona.");
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? error.message
          : "No se pudo identificar el error."
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="font-semibold text-emerald-700">
          🥗 Nutriasistente
        </p>

        <h1 className="mt-4 text-3xl font-bold">
          Bienvenido, Noel
        </h1>

        <p className="mt-2 text-slate-500">
          Ingresa para administrar tu consultorio.
        </p>

        <form onSubmit={ingresar} className="mt-8 space-y-5">
          <label className="block text-sm font-medium">
            Correo electrónico
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              disabled={cargando}
              className="mt-2 w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="block text-sm font-medium">
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={cargando}
              className="mt-2 w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-xl bg-emerald-700 p-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {cargando ? "Ingresando…" : "Iniciar sesión"}
          </button>
        </form>

        {mensaje && (
          <p
            role="status"
            className="mt-5 rounded-xl bg-slate-100 p-4 text-sm leading-6"
          >
            {mensaje}
          </p>
        )}
      </section>
    </main>
  );
}