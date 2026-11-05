"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getClientTicket } from "@/lib/api/client";
import { ApiError } from "@/lib/api-client";
import { errorMessage, formatDate } from "@/lib/format";
import type { ClientTicket } from "@/lib/types";
import { ErrorBanner, PageHeader, Spinner, StatusBadge } from "@/components/ui";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

// Détail d'un ticket pour son client : LECTURE SEULE (aucun bouton d'action).
export default function ClientTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<ClientTicket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getClientTicket(id).then(setTicket).catch((e) => setError(e instanceof ApiError && e.status === 404 ? "Ticket introuvable." : errorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error} onRetry={load} />
        <Link href="/client/tickets" className="btn-secondary">Retour à mes tickets</Link>
      </div>
    );
  }
  if (!ticket) return <Spinner label="Chargement du ticket…" />;

  return (
    <div className="space-y-6">
      <PageHeader title={`${ticket.number} — ${ticket.title}`} actions={<Link href="/client/tickets" className="btn-secondary">Retour</Link>} />

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
        </div>
        <p className="whitespace-pre-wrap text-sm text-slate-800">{ticket.description}</p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Responsable">
            {ticket.responsibleEmail ? <a className="text-brand-700 underline" href={`mailto:${ticket.responsibleEmail}`}>{ticket.responsibleEmail}</a> : "Non assigné"}
          </Field>
          <Field label="Site">{ticket.siteName ?? "—"}</Field>
          <Field label="Créé le">{formatDate(ticket.creationDate)}</Field>
          {ticket.resolvedDate && <Field label="Résolu le">{formatDate(ticket.resolvedDate)}</Field>}
          {ticket.closedDate && <Field label="Clôturé le">{formatDate(ticket.closedDate)}</Field>}
        </dl>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold text-slate-900">Solution</h2>
        {ticket.solutionText ? (
          <p className="whitespace-pre-wrap text-sm text-slate-800">{ticket.solutionText}</p>
        ) : (
          <p className="text-sm text-slate-500">Aucune solution n&apos;a encore été renseignée.</p>
        )}
      </section>
    </div>
  );
}
