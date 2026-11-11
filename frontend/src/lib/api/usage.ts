// Avertissement de suppression : les tickets sont en ON DELETE SET NULL — supprimer un site/contrat/
// équipement/logiciel ne échoue pas, il DÉTACHE les tickets. On compte les tickets concernés côté client.
import { listTickets } from "./tickets";
import type { Id, Ticket } from "../types";

type Kind = "site" | "contract" | "equipment" | "equipmentSoft";

export async function ticketUsageWarning(kind: Kind, id: Id): Promise<string | null> {
  const tickets: Ticket[] = await listTickets();
  const n = tickets.filter((t) => String(t[kind]?.id) === String(id)).length;
  return n > 0
    ? `${n} ticket(s) sont rattachés à cet élément : ils seront conservés mais perdront ce rattachement.`
    : null;
}
