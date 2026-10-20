"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  addTeamMember,
  deleteTeam,
  getTeam,
  listTeams,
  listTeamTechnicians,
  removeTeamMember,
  renameTeam,
  setTeamLeader,
  transferTeamMember,
} from "@/lib/api/teams";
import { ApiError } from "@/lib/api-client";
import { errorMessage, formatDate } from "@/lib/format";
import type { LeaderEventReason, TeamDetail, TeamSummary, TeamTechnician } from "@/lib/types";
import { ErrorBanner, LeaderMark, PageHeader, Spinner, StaffingBadge, SuccessBanner } from "@/components/ui";

const REASON_LABELS: Record<LeaderEventReason, string> = {
  manual: "Désigné par le PMO",
  first_member: "Premier membre de l'équipe",
  auto_succession: "Succession automatique (ancienneté)",
};

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [otherTeams, setOtherTeams] = useState<TeamSummary[]>([]);
  const [technicians, setTechnicians] = useState<TeamTechnician[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [addDraft, setAddDraft] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [transferDraft, setTransferDraft] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoadError(null);
    getTeam(id)
      .then((t) => {
        setTeam(t);
        setRenameDraft(t.name);
      })
      .catch((e) => setLoadError(e instanceof ApiError && e.status === 404 ? "Équipe introuvable." : errorMessage(e)));
    // Listes secondaires : leur échec n'empêche pas d'afficher l'équipe.
    listTeams().then((all) => setOtherTeams(all.filter((t) => String(t.id) !== String(id)))).catch(() => setOtherTeams([]));
    listTeamTechnicians().then(setTechnicians).catch(() => setTechnicians([]));
  }, [id]);
  useEffect(load, [load]);

  // Exécute une action, puis recharge l'équipe (et les listes) depuis l'API.
  async function run(action: () => Promise<unknown>, success: string) {
    setActionError(null);
    setNotice(null);
    setBusy(true);
    try {
      await action();
      load();
      setNotice(success);
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!team || !window.confirm(`Supprimer l'équipe « ${team.name} » ?`)) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteTeam(id);
      router.push("/teams");
    } catch (e) {
      setActionError(errorMessage(e));
      setBusy(false);
    }
  }

  function handleRename(e: FormEvent) {
    e.preventDefault();
    if (!renameDraft.trim() || renameDraft.trim() === team?.name) return;
    run(() => renameTeam(id, renameDraft.trim()), "Équipe renommée.");
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={loadError} onRetry={load} />
        <Link href="/teams" className="btn-secondary">Retour aux équipes</Link>
      </div>
    );
  }
  if (!team) return <Spinner label="Chargement de l'équipe…" />;

  const availableTechnicians = technicians.filter((t) => t.teamId === null);
  const canShrink = team.memberCount > 1;
  const shrinkHint = "Impossible : une équipe ne peut pas descendre à 0 membre. Ajoutez d'abord un second membre.";

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={team.name}
        actions={
          <>
            <Link href="/teams" className="btn-secondary">Retour</Link>
            <button
              onClick={handleDelete}
              className="btn-danger"
              disabled={busy || team.memberCount > 0}
              title={team.memberCount > 0 ? "Une équipe ne peut être supprimée que lorsqu'elle est vide." : "Supprimer l'équipe"}
            >
              Supprimer
            </button>
          </>
        }
      />

      {actionError && <ErrorBanner message={actionError} />}
      {notice && <SuccessBanner message={notice} />}

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <StaffingBadge level={team.staffing} count={team.memberCount} />
          <span className="text-sm text-slate-600">
            Responsable :{" "}
            {team.leader ? (
              <span className="inline-flex items-center gap-2"><LeaderMark /> {team.leader.firstName} {team.leader.lastName}</span>
            ) : (
              <span className="text-slate-400">aucun (équipe vide : le premier membre ajouté en deviendra le responsable)</span>
            )}
          </span>
        </div>
        <form onSubmit={handleRename} className="flex flex-wrap items-end gap-3" noValidate>
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="rename" className="label">Nom de l'équipe</label>
            <input id="rename" className="input" value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} maxLength={100} />
          </div>
          <button type="submit" className="btn-secondary" disabled={busy || !renameDraft.trim() || renameDraft.trim() === team.name}>Renommer</button>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-900">Membres</h2>
        {team.members.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun membre. Équipe vide.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Technicien</th>
                  <th className="py-2 pr-4">Rôle</th>
                  <th className="py-2 pr-4">Entré le</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {team.members.map((m) => (
                  <tr key={m.userId} data-leader={m.isLeader ? "true" : "false"} className={m.isLeader ? "border-l-4 border-indigo-500 bg-indigo-50" : ""}>
                    <td className="py-2 pr-4 pl-2">
                      <div className="font-medium text-slate-800">{m.firstName} {m.lastName}</div>
                      <div className="text-xs text-slate-500">{m.email}</div>
                    </td>
                    <td className="py-2 pr-4">{m.isLeader ? <LeaderMark /> : <span className="text-slate-500">Membre</span>}</td>
                    <td className="whitespace-nowrap py-2 pr-4 text-slate-500">{formatDate(m.joinedAt)}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {!m.isLeader && (
                          <button className="btn-secondary !px-2 !py-1 text-xs" disabled={busy} onClick={() => run(() => setTeamLeader(id, m.userId), `${m.firstName} ${m.lastName} est maintenant responsable.`)}>
                            Nommer responsable
                          </button>
                        )}
                        <button
                          className="text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={busy || !canShrink}
                          title={canShrink ? "Retirer de l'équipe" : shrinkHint}
                          onClick={() => run(() => removeTeamMember(id, m.userId), `${m.firstName} ${m.lastName} a été retiré de l'équipe.`)}
                        >
                          Retirer
                        </button>
                        <select
                          className="input !w-40 !py-1 text-xs"
                          aria-label={`Équipe cible pour ${m.firstName} ${m.lastName}`}
                          value={transferDraft[m.userId] ?? ""}
                          disabled={busy || !canShrink || otherTeams.length === 0}
                          title={canShrink ? "Transférer vers une autre équipe" : shrinkHint}
                          onChange={(e) => setTransferDraft((d) => ({ ...d, [m.userId]: e.target.value }))}
                        >
                          <option value="">Transférer vers…</option>
                          {otherTeams.map((t) => (
                            <option key={t.id} value={String(t.id)}>{t.name}</option>
                          ))}
                        </select>
                        <button
                          className="btn-secondary !px-2 !py-1 text-xs"
                          disabled={busy || !canShrink || !transferDraft[m.userId]}
                          onClick={() =>
                            run(async () => {
                              await transferTeamMember(id, m.userId, transferDraft[m.userId]);
                              setTransferDraft((d) => ({ ...d, [m.userId]: "" }));
                            }, `${m.firstName} ${m.lastName} a été transféré.`)
                          }
                        >
                          Transférer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!canShrink && team.memberCount === 1 && (
          <p className="text-xs text-red-700">Le seul membre est le responsable : il ne peut être retiré ni transféré tant qu'un second membre n'a pas été ajouté.</p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-900">Ajouter un membre</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select className="input max-w-sm" value={addDraft} onChange={(e) => setAddDraft(e.target.value)} aria-label="Technicien à ajouter">
            <option value="">— Choisir un technicien disponible —</option>
            {availableTechnicians.map((t) => (
              <option key={t.id} value={String(t.id)}>{t.firstName} {t.lastName} ({t.email})</option>
            ))}
          </select>
          <button
            className="btn-primary"
            disabled={busy || !addDraft}
            onClick={() => run(async () => { await addTeamMember(id, addDraft); setAddDraft(""); }, team.memberCount === 0 ? "Premier membre ajouté : il est le responsable de l'équipe." : "Membre ajouté.")}
          >
            Ajouter
          </button>
        </div>
        {availableTechnicians.length === 0 && (
          <p className="text-xs text-slate-500">
            Aucun technicien disponible (actif et sans équipe). Les techniciens déjà dans une équipe se déplacent avec « Transférer ».
          </p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-900">Historique du responsable</h2>
        {team.leaderEvents.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun changement de responsable enregistré.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {team.leaderEvents.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{e.newLeader ?? "—"}</span>
                  {e.previousLeader && <span className="text-slate-500"> (remplace {e.previousLeader})</span>}
                  <span className="ml-2 text-xs text-slate-500">{REASON_LABELS[e.reason]}</span>
                </span>
                <span className="text-xs text-slate-400">{formatDate(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">
          Un changement automatique est notifié aux PMO par email — en Phase 2, l'envoi est simulé (journal du serveur).
        </p>
      </section>
    </div>
  );
}
