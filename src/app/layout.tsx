import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Repuestos Sotomayor - Sistema de Inventario y Cotización",
  description: "Dashboard de gestión de inventario y generador de cotizaciones para Repuestos Sotomayor.",
  icons: {
    icon: "/logo-sotomayor-icon.png",
    shortcut: "/logo-sotomayor-icon.png",
    apple: "/logo-sotomayor-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
