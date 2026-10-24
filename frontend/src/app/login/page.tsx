"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api-client";
import { errorMessage } from "@/lib/format";
import { ErrorBanner, SuccessBanner } from "@/components/ui";
import { homeFor } from "@/lib/home";

// Arrivée depuis la création de compte (?invited=1) ou la réinitialisation (?reset=1).
function fromFlow() {
  const q = new URLSearchParams(window.location.search);
  return q.get("invited") === "1" || q.get("reset") === "1";
}

export default function LoginPage() {
  const router = useRouter();
  const { ready, token, user, startSession, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Redirection depuis /invite/accept (?invited=1) : lu côté client, sans useSearchParams (pas de Suspense requis).
  const [invited, setInvited] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setInvited(q.get("invited") === "1");
    setResetDone(q.get("reset") === "1");
  }, []);

  // Arrivée après création de compte (?invited=1) : on repart toujours d'une session vide, puis
  // l'espace est choisi d'après l'authority renvoyée par l'API au login (jamais d'après une session antérieure).
  const cleared = useRef(false); // une seule fois : ne doit jamais fermer la session ouverte par le formulaire
  useEffect(() => {
    if (!ready || cleared.current) return;
    cleared.current = true;
    if (token && fromFlow()) logout();
  }, [ready, token, logout]);

  // Déjà connecté (hors arrivée d'invitation) -> directement l'espace correspondant au rôle.
  useEffect(() => {
    // Arrivée d'invitation / de réinitialisation : pas de redirection automatique (le formulaire redirige lui-même).
    if (ready && token && !fromFlow()) router.replace(homeFor(user));
  }, [ready, token, user, router]);

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
      router.replace(homeFor(res.user));
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
          {invited && !error && <SuccessBanner message="Compte créé : connectez-vous avec votre email et votre mot de passe." />}
          {resetDone && !error && <SuccessBanner message="Mot de passe mis à jour : connectez-vous avec votre nouveau mot de passe." />}
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
          <p className="text-center text-sm"><Link href="/forgot-password" className="font-medium text-brand-600 underline">Mot de passe oublié ?</Link></p>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Premier démarrage ? <Link href="/setup" className="font-medium text-brand-600 underline">Créer le premier compte</Link>
        </p>
      </div>
    </div>
  );
}
