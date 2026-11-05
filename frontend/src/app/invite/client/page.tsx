"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { acceptClientInvitation, validateClientInvitation } from "@/lib/api/client-invitations";
import { errorMessage, formatDate } from "@/lib/format";
import type { ClientInvitationPreview } from "@/lib/types";
import { ErrorBanner, Spinner } from "@/components/ui";
import { useAuth } from "@/context/auth-context";

// Page PUBLIQUE (hors AuthGuard) : le jeton est dans l'URL (?token=…). Le rôle (client) est imposé par le serveur.
function AcceptForm() {
  const router = useRouter();
  const { logout } = useAuth();
  const token = useSearchParams().get("token") ?? "";
  const [preview, setPreview] = useState<ClientInvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError("Lien d'invitation incomplet : aucun jeton.");
      return;
    }
    validateClientInvitation(token).then(setPreview).catch((e) => setLoadError(errorMessage(e)));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) return setError("Le prénom et le nom sont obligatoires.");
    if (!phone.trim()) return setError("Le numéro de téléphone est obligatoire.");
    if (!location.trim()) return setError("La localisation est obligatoire.");
    if (password.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirm) return setError("Les deux mots de passe ne correspondent pas.");
    setSaving(true);
    try {
      await acceptClientInvitation({
        token,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
        phoneNumber: phone.trim(),
        location: location.trim(),
        ...(company.trim() ? { company: company.trim() } : {}),
      });
      // Une session déjà ouverte dans ce navigateur (ex. le PMO qui teste le lien) ne doit jamais servir au client.
      logout();
      router.replace("/login?invited=1");
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="card space-y-4">
        <ErrorBanner message={loadError} />
        <p className="text-sm text-slate-600">Demandez une nouvelle invitation à votre contact SmartTicket.</p>
        <Link href="/login" className="btn-primary inline-block text-center">Aller à la connexion</Link>
      </div>
    );
  }
  if (!preview) return <Spinner label="Vérification de l'invitation…" />;

  return (
    <form onSubmit={onSubmit} className="card space-y-4" noValidate>
      <p className="text-sm text-slate-600">
        Vous êtes invité(e) à créer votre espace client pour suivre vos tickets. Invitation valable jusqu&apos;au {formatDate(preview.expiresAt)}.
      </p>
      {error && <ErrorBanner message={error} />}
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" className="input bg-slate-50" value={preview.email} readOnly />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="firstName" className="label">Prénom *</label>
          <input id="firstName" className="input" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={100} />
        </div>
        <div>
          <label htmlFor="lastName" className="label">Nom *</label>
          <input id="lastName" className="input" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={100} />
        </div>
      </div>
      <div>
        <label htmlFor="phone" className="label">Téléphone *</label>
        <input id="phone" className="input" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
      </div>
      <div>
        <label htmlFor="location" className="label">Localisation *</label>
        <input id="location" className="input" autoComplete="address-level2" placeholder="Ville, pays" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={255} />
      </div>
      <div>
        <label htmlFor="company" className="label">Société (facultatif)</label>
        <input id="company" className="input" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={150} />
      </div>
      <div>
        <label htmlFor="password" className="label">Mot de passe * (8 caractères minimum)</label>
        <input id="password" type="password" className="input" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label htmlFor="confirm" className="label">Confirmer le mot de passe *</label>
        <input id="confirm" type="password" className="input" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={saving}>{saving ? "Création…" : "Créer mon compte"}</button>
    </form>
  );
}

export default function AcceptClientInvitationPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-center text-3xl font-bold text-brand-700">SmartTicket</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Création de votre espace client</p>
        <Suspense fallback={<Spinner label="Chargement…" />}>
          <AcceptForm />
        </Suspense>
      </div>
    </div>
  );
}
