"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api-client";
import { errorMessage } from "@/lib/format";
import { ErrorBanner, SuccessBanner } from "@/components/ui";

// Page PUBLIQUE. Message neutre dans tous les cas : on ne révèle jamais si l'email a un compte.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError("Renseignez votre email.");
    setLoading(true);
    try {
      const res = await forgotPassword(email.trim());
      setSent(res.message);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? "Trop de demandes : réessayez dans une minute." : errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-3xl font-bold text-brand-700">SmartTicket</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Mot de passe oublié</p>
        <div className="card space-y-4">
          {sent ? (
            <>
              <SuccessBanner message={sent} />
              <p className="text-sm text-slate-600">Le lien reçu est valable un temps limité et ne peut servir qu'une fois.</p>
            </>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <p className="text-sm text-slate-600">Saisissez l'email de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
              {error && <ErrorBanner message={error} />}
              <div>
                <label htmlFor="email" className="label">Email</label>
                <input id="email" type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? "Envoi…" : "Envoyer"}</button>
            </form>
          )}
          <Link href="/login" className="block text-center text-sm font-medium text-brand-600 underline">Retour à la connexion</Link>
        </div>
      </div>
    </div>
  );
}
