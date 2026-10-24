"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { cancelInvitation, createInvitation, listInvitations } from "@/lib/api/invitations";
import { listTeams } from "@/lib/api/teams";
import { errorMessage, formatDate } from "@/lib/format";
import type { CreatedInvitation, InvitationStatus, InvitationView, TeamSummary } from "@/lib/types";
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

export default function InvitationsPage() {
  const [teams, setTeams] = useState<TeamSummary[] | null>(null);
  const [items, setItems] = useState<InvitationView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [email, setEmail] = useState("");
  const [teamId, setTeamId] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | InvitationStatus>("pending");

  const load = useCallback(() => {
    setError(null);
    Promise.all([listTeams(), listInvitations()])
      .then(([t, i]) => {
        setTeams(t);
        setItems(i);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setCreated(null);
    if (!email.trim()) return setFormError("L'email est obligatoire.");
    if (!teamId) return setFormError("Choisissez l'équipe du technicien (obligatoire).");
    setSaving(true);
    try {
      setCreated(await createInvitation(email.trim(), teamId));
      setEmail("");
      load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(inv: InvitationView) {
    if (!window.confirm(`Annuler l'invitation envoyée à ${inv.email} ? Son lien ne fonctionnera plus.`)) return;
    setFormError(null);
    try {
      await cancelInvitation(inv.id);
      load();
    } catch (err) {
      setFormError(errorMessage(err));
      load();
    }
  }

  const visible = (items ?? []).filter((i) => filter === "all" || i.status === filter);

  return (
    <div className="space-y-6">
      <PageHeader title="Invitations techniciens" />

      <form onSubmit={handleCreate} className="card flex flex-wrap items-end gap-3" noValidate>
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="inv-email" className="label">Email du technicien</label>
          <input id="inv-email" type="email" className="input" placeholder="prenom.nom@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={190} />
        </div>
        <div className="min-w-[12rem]">
          <label htmlFor="inv-team" className="label">Équipe</label>
          <select id="inv-team" className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={!teams}>
            <option value="">— choisir une équipe —</option>
            {(teams ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.memberCount})</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Envoi…" : "Inviter"}</button>
      </form>
      {teams && teams.length === 0 && (
        <p className="text-sm text-slate-600">Aucune équipe : créez d'abord une équipe dans « Équipes » (une invitation est toujours rattachée à une équipe).</p>
      )}
      {formError && <ErrorBanner message={formError} />}
      {created && (
        <SuccessBanner
          message={
            created.mailMode === "smtp"
              ? `Invitation envoyée par email à ${created.email} (valable jusqu'au ${formatDate(created.expiresAt)}).`
              : `Mode développement : aucun email envoyé. Transmettez ce lien à ${created.email} : ${created.devLink ?? ""}`
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
                <th className="px-4 py-3">Équipe</th>
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
                  <td className="px-4 py-3">{i.teamName ?? "—"}</td>
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
