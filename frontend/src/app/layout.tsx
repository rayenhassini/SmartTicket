import type { Metadata } from "next";
// Bootstrap 5 modulaire (SCSS : variables, boutons, badges, alertes ; sans JS) AVANT globals.css : Tailwind gère layout/utilitaires.
import "./bootstrap.scss";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";

export const metadata: Metadata = {
  title: "SmartTicket",
  description: "SmartTicket — gestion des tickets de support IT",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
