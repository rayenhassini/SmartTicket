"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listClientTickets } from "@/lib/api/client";
import { errorMessage, formatDate, STATUS_LABELS } from "@/lib/format";
import { TICKET_STATUSES, type ClientTicket } from "@/lib/types";
import { EmptyState, ErrorBanner, PageHeader, Spinner, StatusBadge } from "@/components/ui";

// Espace client : MES tickets (lecture seule). Le filtre de statut et la recherche sont exécutés par l'API.
export default function ClientTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<ClientTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    setError(null);
    setTickets(null);
    listClientTickets({ status, q }).then(setTickets).catch((e) => setError(errorMessage(e)));
  }, [status, q]);
  useEffect(load, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setQ(qDraft.trim());
  }
  const filtered = status !== "" || q !== "";

  return (
    <div>
      <PageHeader title="Mes tickets" />
      <form onSubmit={onSearch} className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="q" className="label">Rechercher (numéro ou titre)</label>
          <input id="q" className="input" value={qDraft} onChange={(e) => setQDraft(e.target.value)} maxLength={100} placeholder="ex. TCK-2026 ou imprimante" />
        </div>
        <div>
          <label htmlFor="status" className="label">Statut</label>
          <select id="status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            {TICKET_STATUSES.filter((s) => s !== "Deleted").map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">Rechercher</button>
        {filtered && (
          <button type="button" className="btn-secondary" onClick={() => { setQDraft(""); setQ(""); setStatus(""); }}>Réinitialiser</button>
        )}
      </form>

      {error ? (
        <ErrorBanner message={`Impossible de charger vos tickets : ${error}`} onRetry={load} />
      ) : !tickets ? (
        <Spinner label="Chargement de vos tickets…" />
      ) : tickets.length === 0 ? (
        filtered ? (
          <EmptyState title="Aucun ticket ne correspond à votre recherche" />
        ) : (
          <EmptyState title="Aucun ticket pour le moment">Vos tickets apparaîtront ici dès que le support en aura enregistré pour vous.</EmptyState>
        )
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Numéro</th>
                <th className="px-4 py-3">Titre</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Responsable</th>
                <th className="px-4 py-3">Créé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <tr key={t.id} onClick={() => router.push(`/client/tickets/${t.id}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-brand-700">
                    <Link href={`/client/tickets/${t.id}`} onClick={(e) => e.stopPropagation()}>{t.number}</Link>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3">{t.title}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{t.responsibleEmail ?? "Non assigné"}</td>
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
