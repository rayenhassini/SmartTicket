"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listMyTickets } from "@/lib/api/my";
import { errorMessage, formatDate, fullName, STATUS_LABELS } from "@/lib/format";
import { TICKET_STATUSES, type MyTicketsResponse } from "@/lib/types";
import { EmptyState, ErrorBanner, LeaderMark, PageHeader, Spinner, StatusBadge } from "@/components/ui";

// Espace technicien : tickets assignés à MON équipe (filtrés par l'API).
export default function MyTicketsPage() {
  const router = useRouter();
  const [data, setData] = useState<MyTicketsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(() => {
    setError(null);
    setData(null);
    listMyTickets().then(setData).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  const visible = useMemo(
    () => (data?.tickets ?? []).filter((t) => !statusFilter || t.status === statusFilter),
    [data, statusFilter],
  );

  return (
    <div>
      <PageHeader title="Tickets de mon équipe" />
      {data?.isLeader && (
        <p className="mb-4 inline-flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <LeaderMark /> Vous êtes responsable de l&apos;équipe : vous pouvez changer le statut des tickets et saisir leur solution.
        </p>
      )}
      {data && !data.isLeader && data.teamId !== null && (
        <p className="mb-4 text-sm text-slate-500">Consultation : seul le responsable de l&apos;équipe modifie le statut et la solution.</p>
      )}

      <div className="mb-4">
        <select className="input max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          {TICKET_STATUSES.filter((s) => s !== "Deleted").map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {error ? (
        <ErrorBanner message={`Impossible de charger les tickets : ${error}`} onRetry={load} />
      ) : !data ? (
        <Spinner label="Chargement des tickets…" />
      ) : data.teamId === null ? (
        <EmptyState title="Vous n'appartenez à aucune équipe">Contactez le PMO : les tickets sont assignés aux équipes.</EmptyState>
      ) : data.tickets.length === 0 ? (
        <EmptyState title="Aucun ticket pour votre équipe">Le PMO n&apos;a pas encore assigné de ticket à votre équipe.</EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState title="Aucun ticket ne correspond au filtre" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Numéro</th>
                <th className="px-4 py-3">Titre</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Créé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((t) => (
                <tr key={String(t.id)} onClick={() => router.push(`/my/tickets/${t.id}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-brand-700">
                    <Link href={`/my/tickets/${t.id}`} onClick={(e) => e.stopPropagation()}>{t.number}</Link>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3">{t.title}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3">{fullName(t.client)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(t.creationDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
