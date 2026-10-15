import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Nutriasistente | Nutre Con Noel", description: "Panel privado del consultorio del Lic. Noel Márquez." };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>;}
