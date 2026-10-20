"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTicket, updateTicket } from "@/lib/api/tickets";
import { ApiError } from "@/lib/api-client";
import { errorMessage } from "@/lib/format";
import type { Ticket } from "@/lib/types";
import { ErrorBanner, PageHeader, Spinner } from "@/components/ui";
import TicketForm from "@/components/TicketForm";

export default function EditTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getTicket(id)
      .then(setTicket)
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? "Ticket introuvable." : errorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  return (
    <div className="max-w-3xl">
      <PageHeader title={ticket ? `Modifier ${ticket.number}` : "Modifier le ticket"} />
      {error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : !ticket ? (
        <Spinner label="Chargement…" />
      ) : (
        <TicketForm
          mode="edit"
          initial={ticket}
          submitLabel="Enregistrer"
          onCancel={() => router.push(`/tickets/${id}`)}
          onSubmit={async (payload) => {
            await updateTicket(id, payload);
            router.push(`/tickets/${id}`);
          }}
        />
      )}
    </div>
  );
}
