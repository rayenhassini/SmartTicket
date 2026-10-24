"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getMyTicket, saveMyTicketSolution, setMyTicketStatus } from "@/lib/api/my";
import { ApiError } from "@/lib/api-client";
import { errorMessage, formatDate, fullName, STATUS_LABELS } from "@/lib/format";
import { LEADER_STATUSES, type Ticket, type TicketStatus } from "@/lib/types";
import { ErrorBanner, PageHeader, Spinner, StatusBadge, SuccessBanner } from "@/components/ui";

export default function MyTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusDraft, setStatusDraft] = useState<TicketStatus>("In Progress");
  const [solutionDraft, setSolutionDraft] = useState("");

  const apply = useCallback((res: { isLeader: boolean; ticket: Ticket }) => {
    setTicket(res.ticket);
    setIsLeader(res.isLeader);
    setSolutionDraft(res.ticket.solution?.solutionText ?? "");
    setStatusDraft(LEADER_STATUSES.includes(res.ticket.status) ? res.ticket.status : "In Progress");
  }, []);

  const load = useCallback(() => {
    setLoadError(null);
    getMyTicket(id).then(apply).catch((e) => setLoadError(e instanceof ApiError && e.status === 404 ? "Ticket introuvable dans le périmètre de votre équipe." : errorMessage(e)));
  }, [id, apply]);
  useEffect(load, [load]);

  async function run(action: () => Promise<{ isLeader: boolean; ticket: Ticket }>, success: string, leaveAfter = false) {
    setActionError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await action();
      if (leaveAfter) {
        router.push("/my/tickets");
        return;
      }
      apply(res);
      setNotice(success);
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={loadError} onRetry={load} />
        <Link href="/my/tickets" className="btn-secondary">Retour à mes tickets</Link>
      </div>
    );
  }
  if (!ticket) return <Spinner label="Chargement du ticket…" />;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={`${ticket.number} — ${ticket.title}`} actions={<Link href="/my/tickets" className="btn-secondary">Retour</Link>} />
      {actionError && <ErrorBanner message={actionError} />}
      {notice && <SuccessBanner message={notice} />}

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={ticket.status} />
          {ticket.team && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">Équipe : {ticket.team.name}</span>}
        </div>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Info label="Client" value={fullName(ticket.client)} />
          <Info label="Site" value={ticket.site ? ticket.site.nomSite : "—"} />
          <Info label="Équipement (matériel)" value={ticket.equipment ? `${ticket.equipment.sn} — ${ticket.equipment.nomPiece}` : "—"} />
          <Info label="Équipement (logiciel)" value={ticket.equipmentSoft ? [ticket.equipmentSoft.equipmentName, ticket.equipmentSoft.version].filter(Boolean).join(" ") : "—"} />
          <Info label="Créé le" value={formatDate(ticket.creationDate)} />
          <Info label="Résolu le" value={formatDate(ticket.resolvedDate)} />
        </dl>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-900">Solution</h2>
        {isLeader ? (
          <>
            <textarea className="input min-h-[8rem]" value={solutionDraft} onChange={(e) => setSolutionDraft(e.target.value)} placeholder="Décrivez la solution apportée…" maxLength={10000} aria-label="Solution" />
            <button
              className="btn-primary"
              disabled={busy || !solutionDraft.trim() || solutionDraft.trim() === (ticket.solution?.solutionText ?? "")}
              onClick={() => run(() => saveMyTicketSolution(id, solutionDraft.trim()), "Solution enregistrée.")}
            >
              {ticket.solution ? "Mettre à jour la solution" : "Enregistrer la solution"}
            </button>
          </>
        ) : ticket.solution ? (
          <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-700">{ticket.solution.solutionText || "(solution sans texte)"}</p>
        ) : (
          <p className="text-sm text-slate-500">Aucune solution saisie pour le moment.</p>
        )}
      </section>

      {isLeader ? (
        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-900">Changer le statut (responsable d&apos;équipe)</h2>
          <div className="flex flex-wrap items-center gap-3">
            <select className="input max-w-xs" value={statusDraft} onChange={(e) => setStatusDraft(e.target.value as TicketStatus)} aria-label="Nouveau statut">
              {LEADER_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button
              className="btn-primary"
              disabled={busy || statusDraft === ticket.status}
              onClick={() => {
                if (statusDraft === "Deleted" && !window.confirm("Supprimer ce ticket ? Il disparaîtra de la liste de l'équipe.")) return;
                run(() => setMyTicketStatus(id, statusDraft), "Statut mis à jour.", statusDraft === "Deleted");
              }}
            >
              Changer le statut
            </button>
          </div>
        </section>
      ) : (
        <p className="text-sm text-slate-500">Consultation seule : le statut et la solution sont gérés par le responsable de l&apos;équipe.</p>
      )}
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
