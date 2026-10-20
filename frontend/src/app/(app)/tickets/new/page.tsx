"use client";

import { useRouter } from "next/navigation";
import { createTicket } from "@/lib/api/tickets";
import { PageHeader } from "@/components/ui";
import TicketForm from "@/components/TicketForm";

export default function NewTicketPage() {
  const router = useRouter();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Nouveau ticket" />
      <TicketForm
        mode="create"
        submitLabel="Créer le ticket"
        onCancel={() => router.push("/tickets")}
        onSubmit={async (payload) => {
          const created = await createTicket(payload);
          router.push(`/tickets/${created.id}`);
        }}
      />
    </div>
  );
}
