"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { resetPassword } from "@/lib/api/auth";
import { errorMessage } from "@/lib/format";
import { ErrorBanner, Spinner } from "@/components/ui";

// Page PUBLIQUE : le jeton est dans l'URL (?token=…). Seul le mot de passe peut changer :
// aucun champ de rôle, de nom ou d'email.
function ResetForm() {
  const router = useRouter();
  const { logout } = useAuth();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirm) return setError("Les deux mots de passe ne correspondent pas.");
    setSaving(true);
    try {
      await resetPassword({ token, password, passwordConfirm: confirm });
      logout(); // une éventuelle session ouverte dans ce navigateur ne doit pas survivre
      router.replace("/login?reset=1");
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  if (!token) {
    return (
      <div className="card space-y-4">
        <ErrorBanner message="Lien incomplet : aucun jeton." />
        <Link href="/forgot-password" className="btn-primary inline-block text-center">Refaire une demande</Link>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="card space-y-4" noValidate>
      {error && (
        <>
          <ErrorBanner message={error} />
          <Link href="/forgot-password" className="block text-sm font-medium text-brand-600 underline">Refaire une demande de réinitialisation</Link>
        </>
      )}
      <div>
        <label htmlFor="password" className="label">Nouveau mot de passe (8 caractères minimum)</label>
        <input id="password" type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label htmlFor="confirm" className="label">Confirmer le mot de passe</label>
        <input id="confirm" type="password" autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={saving}>{saving ? "Enregistrement…" : "Mettre à jour le mot de passe"}</button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-3xl font-bold text-brand-700">SmartTicket</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Nouveau mot de passe</p>
        <Suspense fallback={<Spinner label="Chargement…" />}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
