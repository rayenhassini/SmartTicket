"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listTickets } from "@/lib/api/tickets";
import { errorMessage, formatDate, fullName, STATUS_LABELS } from "@/lib/format";
import { TICKET_STATUSES, type Ticket } from "@/lib/types";
import { EmptyState, ErrorBanner, PageHeader, Spinner, StatusBadge } from "@/components/ui";

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
      setError(null);
      setTickets(null);
    listTickets().then(setTickets).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  // Filtrage/tri côté client : le backend n'expose pas de paramètres de filtre en V1.
  const visible = useMemo(() => {
      if (!tickets) return [];
      const q = search.trim().toLowerCase();
      return tickets
        .filter((t) => !statusFilter || t.status === statusFilter)
        .filter((t) => !q || t.number.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))
        .sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
  }, [tickets, statusFilter, search]);

  return (
  <div>
      <PageHeader
        title="Tickets"
        actions={<Link href="/tickets/new" className="btn-primary">Nouveau ticket</Link>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Rechercher (numéro, titre)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher"
        />
        <select className="input max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>
      {/* fixed height */}

      {error ? (
        <ErrorBanner message={`Impossible de charger les tickets : ${error}`} onRetry={load} />
      ) : !tickets ? (
        <Spinner label="Chargement des tickets…" />
      ) : tickets.length === 0 ? (
         <EmptyState title="Aucun ticket pour le moment">
          <Link href="/tickets/new" className="font-medium text-brand-600 underline">Créer le premier ticket</Link>
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState title="Aucun ticket ne correspond aux filtres" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Numéro</th>
                <th className="px-4 py-3">Titre</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Superviseur</th>
                <th className="px-4 py-3">Créé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((t) => (
                <tr
                  key={String(t.id)}
                  onClick={() => router.push(`/tickets/${t.id}`)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-brand-700">
                    <Link href={`/tickets/${t.id}`} onClick={(e) => e.stopPropagation()}>{t.number}</Link>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3">{t.title}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3">{fullName(t.client)}</td>
                  <td className="px-4 py-3">{fullName(t.supervisor)}</td>
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
