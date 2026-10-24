"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  assignTeam,
  deleteTicket,
  getTicket,
  linkSolution,
  setSupervisor,
  updateTicketStatus,
} from "@/lib/api/tickets";
import { listTeams } from "@/lib/api/teams";
import { listSolutions, listUsers, solutionLabel, userLabel } from "@/lib/api/lookups";
import { ApiError } from "@/lib/api-client";
import { errorMessage, formatDate, fullName, STATUS_LABELS } from "@/lib/format";
import { TICKET_STATUSES, type Solution, type TeamSummary, type Ticket, type TicketStatus, type User } from "@/lib/types";
import { ErrorBanner, PageHeader, Spinner, StatusBadge, SuccessBanner } from "@/components/ui";

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [statusDraft, setStatusDraft] = useState<TicketStatus>("Not Assigned");
  const [teamDraft, setTeamDraft] = useState("");
  const [supervisorDraft, setSupervisorDraft] = useState("");
  const [solutionDraft, setSolutionDraft] = useState("");

  const load = useCallback(() => {
    setLoadError(null);
    getTicket(id)
      .then((t) => {
        setTicket(t);
        setStatusDraft(t.status);
      })
      .catch((e) => setLoadError(e instanceof ApiError && e.status === 404 ? "Ticket introuvable." : errorMessage(e)));
    // Les listes de choix sont secondaires : leur échec n'empêche pas d'afficher le ticket.
    listUsers().then(setUsers).catch(() => setUsers([]));
    listSolutions().then(setSolutions).catch(() => setSolutions([]));
    listTeams().then(setTeams).catch(() => setTeams([]));
  }, [id]);
  useEffect(load, [load]);

  // Exécute une action puis rafraîchit l'état local avec le ticket renvoyé (ou recharge).
  async function run(action: () => Promise<unknown>, success: string) {
    setActionError(null);
    setNotice(null);
    setBusy(true);
    try {
      await action();
      const fresh = await getTicket(id);
      setTicket(fresh);
      setStatusDraft(fresh.status);
      setNotice(success);
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!ticket || !window.confirm(`Supprimer définitivement le ticket ${ticket.number} ?`)) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteTicket(id);
      router.push("/tickets");
    } catch (e) {
      setActionError(errorMessage(e));
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={loadError} onRetry={load} />
        <Link href="/tickets" className="btn-secondary">Retour à la liste</Link>
      </div>
    );
  }
  if (!ticket) return <Spinner label="Chargement du ticket…" />;

  const technicians = users.filter((u) => u.authority === "technician");
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={`${ticket.number} — ${ticket.title}`}
        actions={
          <>
            <Link href="/tickets" className="btn-secondary">Retour</Link>
            <Link href={`/tickets/${ticket.id}/edit`} className="btn-secondary">Modifier</Link>
            <button onClick={handleDelete} className="btn-danger" disabled={busy}>Supprimer</button>
          </>
        }
      />

      {actionError && <ErrorBanner message={actionError} />}
      {notice && <SuccessBanner message={notice} />}

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={ticket.status} />
          {ticket.isHelpdesk && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">Helpdesk</span>}
          {ticket.internalTask && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">Tâche interne</span>}
        </div>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Info label="Client" value={fullName(ticket.client)} />
          <Info label="Contrat" value={ticket.contract ? `${ticket.contract.businessId} — ${ticket.contract.type}` : "—"} />
          <Info label="Site" value={ticket.site ? ticket.site.nomSite : "—"} />
          <Info label="Équipement (matériel)" value={ticket.equipment ? `${ticket.equipment.sn} — ${ticket.equipment.nomPiece}` : "—"} />
          <Info label="Équipement (logiciel)" value={ticket.equipmentSoft ? [ticket.equipmentSoft.equipmentName, ticket.equipmentSoft.version].filter(Boolean).join(" ") : "—"} />
          <Info label="Référence externe" value={ticket.caseId || "—"} />
          <Info label="Créé le" value={formatDate(ticket.creationDate)} />
          <Info label="Résolu le" value={formatDate(ticket.resolvedDate)} />
        </dl>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-900">Statut</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select className="input max-w-xs" value={statusDraft} onChange={(e) => setStatusDraft(e.target.value as TicketStatus)} aria-label="Nouveau statut">
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <button
            className="btn-primary"
            disabled={busy || statusDraft === ticket.status}
            onClick={() => run(() => updateTicketStatus(id, statusDraft), "Statut mis à jour.")}
          >
            Changer le statut
          </button>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-900">Équipe assignée</h2>
        <p className="text-sm text-slate-700">
          {ticket.team ? <>Ce ticket est assigné à l&apos;équipe <b>{ticket.team.name}</b> : tous ses membres le voient dans leur espace technicien.</> : "Aucune équipe assignée : le ticket n'est visible d'aucun technicien."}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select className="input max-w-sm" value={teamDraft} onChange={(e) => setTeamDraft(e.target.value)} aria-label="Équipe à assigner">
            <option value="">— Choisir une équipe —</option>
            {teams.filter((t) => String(t.id) !== String(ticket.team?.id ?? "")).map((t) => (
              <option key={String(t.id)} value={String(t.id)}>{t.name} ({t.memberCount} membre{t.memberCount > 1 ? "s" : ""})</option>
            ))}
          </select>
          <button
            className="btn-secondary"
            disabled={busy || !teamDraft}
            onClick={() => run(async () => { await assignTeam(id, teamDraft); setTeamDraft(""); }, "Équipe assignée (statut « Assigné » si le ticket n'était pas assigné).")}
          >
            {ticket.team ? "Changer d'équipe" : "Assigner l'équipe"}
          </button>
        </div>
        {teams.length === 0 && <p className="text-xs text-slate-500">Aucune équipe : créez-en une dans « Équipes ».</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-900">Superviseur</h2>
        <p className="text-sm text-slate-700">{fullName(ticket.supervisor)}</p>
        <div className="flex flex-wrap items-center gap-3">
          <select className="input max-w-sm" value={supervisorDraft} onChange={(e) => setSupervisorDraft(e.target.value)} aria-label="Nouveau superviseur">
            <option value="">— Choisir un superviseur —</option>
            {technicians.map((u) => (
              <option key={String(u.id)} value={String(u.id)}>{userLabel(u)}</option>
            ))}
          </select>
          <button
            className="btn-secondary"
            disabled={busy || !supervisorDraft}
            onClick={() => run(async () => { await setSupervisor(id, Number(supervisorDraft)); setSupervisorDraft(""); }, "Superviseur mis à jour.")}
          >
            Définir
          </button>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-900">Solution</h2>
        {ticket.solution ? (
          <div className="rounded-md bg-slate-50 p-3 text-sm">
            <p className="whitespace-pre-wrap text-slate-700">{ticket.solution.solutionText || "(solution sans texte)"}</p>
            <p className="mt-2 text-xs text-slate-500">
              Solution #{ticket.solution.id} · {ticket.solution.valid ? "validée" : "non validée"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Aucune solution liée.</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <select className="input max-w-lg" value={solutionDraft} onChange={(e) => setSolutionDraft(e.target.value)} aria-label="Solution à lier">
            <option value="">— Choisir une solution existante —</option>
            {solutions.map((s) => (
              <option key={String(s.id)} value={String(s.id)}>{solutionLabel(s)}</option>
            ))}
          </select>
          <button
            className="btn-secondary"
            disabled={busy || !solutionDraft}
            onClick={() => run(async () => { await linkSolution(id, Number(solutionDraft)); setSolutionDraft(""); }, "Solution liée au ticket.")}
          >
            Lier
          </button>
        </div>
        {solutions.length === 0 && (
          <p className="text-xs text-slate-500">Aucune solution disponible : la gestion des solutions arrive en phase F2.</p>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{value}</dd>
    </div>
  );
}
