"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api-client";
import { errorMessage } from "@/lib/format";
import { ErrorBanner } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { ready, token, startSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Déjà connecté -> directement la liste des tickets.
  useEffect(() => {
    if (ready && token) router.replace("/tickets");
  }, [ready, token, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Renseignez l'email et le mot de passe.");
      return;
    }
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      startSession(res);
      router.replace("/tickets");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Identifiants invalides ou compte désactivé." : errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-3xl font-bold text-brand-700">SmartTicket</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Connectez-vous pour accéder à vos tickets</p>

        <form onSubmit={onSubmit} className="card space-y-4" noValidate>
          {error && <ErrorBanner message={error} />}
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="password" className="label">Mot de passe</label>
            <input id="password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Premier démarrage ? <Link href="/setup" className="font-medium text-brand-600 underline">Créer le premier compte</Link>
        </p>
      </div>
    </div>
  );
}
