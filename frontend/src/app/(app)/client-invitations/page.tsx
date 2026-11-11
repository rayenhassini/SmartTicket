"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { cancelClientInvitation, createClientInvitation, listClientInvitations } from "@/lib/api/client-invitations";
import { errorMessage, formatDate } from "@/lib/format";
import type { ClientInvitationView, CreatedClientInvitation, InvitationStatus } from "@/lib/types";
import { EmptyState, ErrorBanner, PageHeader, Spinner, SuccessBanner } from "@/components/ui";

const STATUS_LABEL: Record<InvitationStatus, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  expired: "Expirée",
  cancelled: "Annulée",
};
const STATUS_STYLE: Record<InvitationStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  expired: "bg-slate-100 text-slate-600",
  cancelled: "bg-red-100 text-red-800",
};

// Invitations CLIENT (PMO) : page séparée de celle des techniciens, sans choix d'équipe.
export default function ClientInvitationsPage() {
  const [items, setItems] = useState<ClientInvitationView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedClientInvitation | null>(null);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | InvitationStatus>("pending");

  const load = useCallback(() => {
    setError(null);
    listClientInvitations().then(setItems).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setCreated(null);
    if (!email.trim()) return setFormError("L'email est obligatoire.");
    setSaving(true);
    try {
      setCreated(await createClientInvitation(email.trim()));
      setEmail("");
      load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(inv: ClientInvitationView) {
    if (!window.confirm(`Annuler l'invitation envoyée à ${inv.email} ? Son lien ne fonctionnera plus.`)) return;
    setFormError(null);
    try {
      await cancelClientInvitation(inv.id);
      load();
    } catch (err) {
      setFormError(errorMessage(err));
      load();
    }
  }

  const visible = (items ?? []).filter((i) => filter === "all" || i.status === filter);

  return (
    <div className="space-y-6">
      <PageHeader title="Invitations clients" />

      <form onSubmit={handleCreate} className="card flex flex-wrap items-end gap-3" noValidate>
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="cinv-email" className="label">Email du client</label>
          <input id="cinv-email" type="email" className="input" placeholder="client@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={190} />
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Envoi…" : "Inviter"}</button>
      </form>
      <p className="text-sm text-slate-500">Le client reçoit un lien pour créer son compte (nom, mot de passe, téléphone, localisation ; société facultative). Il aura accès à ses tickets en lecture seule.</p>
      {formError && <ErrorBanner message={formError} />}
      {created && (
        <SuccessBanner
          message={
            created.mailMode === "smtp"
              ? `Invitation envoyée par email à ${created.email} (valable jusqu'au ${formatDate(created.expiresAt)}).`
              : `Mode développement (le serveur est en MAIL_MODE=log — vérifiez le journal de démarrage du backend) : aucun email envoyé. Transmettez ce lien à ${created.email} : ${created.devLink ?? ""}`
          }
        />
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Afficher :</span>
        {(["pending", "all", "accepted", "expired", "cancelled"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 ${filter === f ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {f === "all" ? "Toutes" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorBanner message={`Impossible de charger les invitations : ${error}`} onRetry={load} />
      ) : !items ? (
        <Spinner label="Chargement des invitations…" />
      ) : visible.length === 0 ? (
        <EmptyState title="Aucune invitation">Aucune invitation pour ce filtre.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Invité par</th>
                <th className="px-4 py-3">Expire le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{i.email}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[i.status]}`}>{STATUS_LABEL[i.status]}</span></td>
                  <td className="px-4 py-3 text-slate-500">{i.invitedBy ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(i.expiresAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {i.status === "pending" && (
                      <button type="button" className="text-sm font-medium text-red-600 hover:underline" onClick={() => handleCancel(i)}>Annuler</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
