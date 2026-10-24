"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

// Rôle sans espace dédié (client, assistant…) : aucun écran métier n'est disponible pour l'instant.
export default function NoAccessPage() {
  const { logout } = useAuth();
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-bold text-brand-700">SmartTicket</h1>
        <p className="text-sm text-slate-600">Aucun espace n&apos;est disponible pour votre rôle pour le moment.</p>
        <button className="btn-secondary" onClick={() => { logout(); router.replace("/login"); }}>Déconnexion</button>
      </div>
    </div>
  );
}
