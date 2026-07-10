import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

import { AuthProvider } from "@/components/providers/AuthProvider";
import AppLayoutClient from "@/components/layout/AppLayoutClient";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SIVID - ERP & Negoce",
  description: "Système intégré de gestion commerciale et comptable",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="antialiased">
      <body className={`${inter.className} flex min-h-screen w-full bg-[#FAFAFA] text-slate-900 selection:bg-blue-100 selection:text-blue-900`}>
        <AuthProvider>
          <NotificationProvider>
            <AppLayoutClient>
              {children}
            </AppLayoutClient>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
