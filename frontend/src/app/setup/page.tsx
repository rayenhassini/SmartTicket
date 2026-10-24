"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { homeFor } from "@/lib/home";
import { useAuth } from "@/context/auth-context";
import { bootstrap } from "@/lib/api/auth";
import { ApiError } from "@/lib/api-client";
import { errorMessage } from "@/lib/format";
import { ErrorBanner } from "@/components/ui";

export default function SetupPage() {
  const router = useRouter();
  const { startSession } = useAuth();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    authority: "pmo" as "pmo" | "assistant",
  });
  const [error, setError] = useState<string | null>(null);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError("Prénom, nom et email sont obligatoires.");
      return;
    }
    if (form.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setLoading(true);
    try {
      const res = await bootstrap({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        authority: form.authority,
      });
      startSession(res);
      router.replace(homeFor(res.user));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAlreadyDone(true);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-center text-3xl font-bold text-brand-700">SmartTicket</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Création du premier compte</p>

        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cette page sert une seule fois, tant qu&apos;aucun utilisateur n&apos;existe. Ensuite elle est refusée par le serveur.
        </div>

        {alreadyDone ? (
          <div className="card space-y-3 text-sm">
            <p>Un compte existe déjà : la création initiale n&apos;est plus possible.</p>
            <Link href="/login" className="btn-primary w-full">Aller à la connexion</Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="card space-y-4" noValidate>
            {error && <ErrorBanner message={error} />}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="label">Prénom</label>
                <input id="firstName" className="input" value={form.firstName} onChange={set("firstName")} />
              </div>
              <div>
                <label htmlFor="lastName" className="label">Nom</label>
                <input id="lastName" className="input" value={form.lastName} onChange={set("lastName")} />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" type="email" autoComplete="username" className="input" value={form.email} onChange={set("email")} />
            </div>
            <div>
              <label htmlFor="password" className="label">Mot de passe (8 caractères min.)</label>
              <input id="password" type="password" autoComplete="new-password" className="input" value={form.password} onChange={set("password")} />
            </div>
            <div>
              <label htmlFor="authority" className="label">Rôle</label>
              <select id="authority" className="input" value={form.authority} onChange={set("authority")}>
                <option value="pmo">PMO</option>
                <option value="assistant">Assistant</option>
              </select>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Création…" : "Créer le compte et se connecter"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-slate-500">
          <Link href="/login" className="underline">Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
