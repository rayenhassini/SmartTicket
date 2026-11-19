"use client";

// Succession PMO : « Démissionner » (inviter un successeur par email), état de la démission en cours, annulation.
// Le PMO actuel reste PMO jusqu'à ce que le successeur ait créé son compte (le serveur bascule alors en une transaction).
import { FormEvent, useCallback, useEffect, useState } from "react";
import { cancelResignation, getResignation, startResignation, type Resignation } from "@/lib/api/pmo";
import { errorMessage, formatDate } from "@/lib/format";
import { Modal } from "@/components/crud";
import { ErrorBanner, Spinner, SuccessBanner } from "@/components/ui";

export function ResignationCard() {
  const [state, setState] = useState<Resignation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoadError(null);
    getResignation().then(setState).catch((e) => setLoadError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Adresse email invalide.");
    setBusy(true);
    try {
      const r = await startResignation(email.trim());
      setState(r);
      setOpen(false);
      setEmail("");
      setNotice(
        r.mailMode === "smtp"
          ? `Invitation envoyée à ${r.successorEmail}. Vous restez PMO jusqu'à ce qu'il/elle ait créé son compte.`
          : `Mode développement (MAIL_MODE=log) : aucun email envoyé. Transmettez ce lien à ${r.successorEmail} : ${r.devLink ?? ""}`,
      );
    } catch (err) {
      setError(errorMessage(err)); // 409 : démission déjà en cours / email déjà inscrit ; 502 : envoi impossible
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await cancelResignation();
      setNotice("Démission annulée : le lien envoyé est désormais invalide.");
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mb-6 space-y-3 text-sm" aria-label="Succession PMO">
      <h2 className="text-base font-semibold text-slate-900">Succession PMO</h2>
      {loadError && <ErrorBanner message={loadError} onRetry={load} />}
      {!state && !loadError && <Spinner label="Chargement…" />}
      {notice && <SuccessBanner message={notice} />}
      {error && !open && <ErrorBanner message={error} />}
      {state?.status === "none" && (
        <>
          <p className="text-slate-600">
            Vous êtes le PMO (un seul PMO actif est possible). Pour passer la main, invitez votre successeur par email : vous restez PMO jusqu&apos;à ce qu&apos;il/elle ait créé son compte.
          </p>
          <button className="btn btn-outline-secondary" onClick={() => { setError(null); setNotice(null); setOpen(true); }}>Démissionner…</button>
        </>
      )}
      {state?.status === "pending" && (
        <>
          <p className="text-slate-700">
            <strong>Démission en cours.</strong> Invitation envoyée à <strong>{state.successorEmail}</strong>, valable jusqu&apos;au {formatDate(state.expiresAt!)}.
            Vous restez PMO tant que le compte du successeur n&apos;est pas créé.
          </p>
          <button className="btn btn-outline-secondary" disabled={busy} onClick={cancel}>Annuler la démission</button>
        </>
      )}

      {open && (
        <Modal title="Démissionner du rôle de PMO" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <ul className="list-disc space-y-1 pl-5 text-slate-600">
              <li>Le successeur reçoit un lien personnel (usage unique, 72 h par défaut) pour créer son compte PMO.</li>
              <li>Vous restez PMO jusqu&apos;à la fin de son inscription ; vous pouvez annuler à tout moment avant.</li>
              <li>Ensuite votre compte est <strong>désactivé</strong> (rôle technicien) : vous serez déconnecté(e) et ne pourrez plus vous connecter.</li>
              <li>Son adresse ne doit pas déjà avoir de compte.</li>
            </ul>
            <div>
              <label htmlFor="successor" className="label">Email du futur PMO *</label>
              <input id="successor" type="email" className="input" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={190} />
            </div>
            {error && <ErrorBanner message={error} />}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Annuler</button>
              <button type="submit" className="btn btn-danger" disabled={busy}>{busy ? "Envoi…" : "Confirmer la démission"}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
