"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getMailSettings, saveMailSettings, sendMailTest, type MailSettingsStatus } from "@/lib/api/pmo";
import { errorMessage, formatDate } from "@/lib/format";
import { homeFor } from "@/lib/home";
import { useAuth } from "@/context/auth-context";
import { ErrorBanner, PageHeader, Spinner, SuccessBanner } from "@/components/ui";

// Paramètres mail (PMO) : Gmail + mot de passe d'application. Le secret est chiffré côté serveur et n'est
// JAMAIS renvoyé : le champ reste vide, il faut le ressaisir pour modifier la configuration.
function MailSettingsForm() {
  const router = useRouter();
  const { user } = useAuth();
  const welcome = useSearchParams().get("welcome") === "1";
  const [status, setStatus] = useState<MailSettingsStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gmail, setGmail] = useState("");
  const [appName, setAppName] = useState("SmartTicket");
  const [appPassword, setAppPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = () =>
    getMailSettings()
      .then((s) => {
        setStatus(s);
        if (s.gmail) setGmail(s.gmail);
        if (s.appName) setAppName(s.appName);
      })
      .catch((e) => setLoadError(errorMessage(e)));
  useEffect(() => { load(); }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(gmail.trim())) return setError("Adresse Gmail invalide.");
    if (!appName.trim()) return setError("Le nom de l'application est obligatoire.");
    if (appPassword.replace(/\s+/g, "").length !== 16) return setError("Le mot de passe d'application comporte 16 caractères (les espaces sont ignorés).");
    setSaving(true);
    try {
      const s = await saveMailSettings({ gmail: gmail.trim(), appName: appName.trim(), appPassword });
      setStatus(s);
      setAppPassword(""); // le secret ne reste jamais dans le formulaire
      setNotice("Configuration enregistrée. Utilisez « Envoyer un email de test » pour la vérifier.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setError(null);
    setNotice(null);
    setTesting(true);
    try {
      const r = await sendMailTest();
      setNotice(r.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setTesting(false);
    }
  }

  const home = user ? homeFor(user) : "/tickets";

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Paramètres mail" />
      {welcome && (
        <div className="rounded-md border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-800">
          <strong>Dernière étape.</strong> Pour que SmartTicket envoie les invitations par email, enregistrez le Gmail qui servira à l&apos;envoi.
          Vous pouvez aussi le faire plus tard depuis « Paramètres mail ».{" "}
          <button type="button" className="underline" onClick={() => router.replace(home)}>Passer pour l&apos;instant</button>
        </div>
      )}
      {loadError && <ErrorBanner message={loadError} onRetry={() => { setLoadError(null); load(); }} />}
      {!status && !loadError && <Spinner label="Chargement…" />}
      {status && (
        <>
          <div className="card text-sm">
            {status.source === "database" ? (
              <p>
                Configuration actuelle : <strong>{status.gmail}</strong> (« {status.appName} »), mot de passe d&apos;application enregistré (masqué)
                {status.updatedAt ? `, modifiée le ${formatDate(status.updatedAt)}` : ""}.
              </p>
            ) : status.source === "env" ? (
              <p>Aucune configuration enregistrée ici : le serveur utilise la configuration d&apos;environnement (<code>.env</code>). Enregistrer ci-dessous la remplace.</p>
            ) : (
              <p>Aucune configuration d&apos;envoi : les emails ne partent pas (mode développement).</p>
            )}
          </div>

          <form onSubmit={onSubmit} className="card space-y-4" noValidate autoComplete="off">
            {notice && <SuccessBanner message={notice} />}
            {error && <ErrorBanner message={error} />}
            <p className="text-sm text-slate-600">
              Gmail exige un <strong>mot de passe d&apos;application</strong> (la validation en 2 étapes doit être activée sur le compte Google).{" "}
              <a className="text-brand-700 underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">
                Créer un mot de passe d&apos;application (nouvel onglet)
              </a>
            </p>
            <div>
              <label htmlFor="gmail" className="label">Gmail d&apos;envoi *</label>
              <input id="gmail" type="email" className="input" autoComplete="off" value={gmail} onChange={(e) => setGmail(e.target.value)} maxLength={190} />
            </div>
            <div>
              <label htmlFor="appName" className="label">Nom de l&apos;application *</label>
              <input id="appName" className="input" autoComplete="off" value={appName} onChange={(e) => setAppName(e.target.value)} maxLength={100} />
              <p className="mt-1 text-xs text-slate-500">Libellé libre affiché comme expéditeur (ex. SmartTicket).</p>
            </div>
            <div>
              <label htmlFor="appPassword" className="label">Mot de passe d&apos;application * (16 caractères)</label>
              <input
                id="appPassword"
                type="password"
                className="input"
                autoComplete="new-password"
                placeholder={status.hasPassword ? "•••• •••• •••• •••• (ressaisir pour modifier)" : "xxxx xxxx xxxx xxxx"}
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                maxLength={40}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
              <button type="button" className="btn btn-outline-secondary" disabled={testing || status.source === "none"} onClick={onTest}>
                {testing ? "Envoi…" : "Envoyer un email de test"}
              </button>
              {welcome && status.source === "database" && <Link href={home} className="btn btn-outline-secondary">Continuer</Link>}
            </div>
            <p className="text-xs text-slate-500">L&apos;email de test est envoyé à votre adresse ({user?.email}).</p>
          </form>
        </>
      )}
    </div>
  );
}

export default function MailSettingsPage() {
  return (
    <Suspense fallback={<Spinner label="Chargement…" />}>
      <MailSettingsForm />
    </Suspense>
  );
}
