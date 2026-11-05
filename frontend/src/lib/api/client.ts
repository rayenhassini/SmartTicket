// Espace client : LECTURE SEULE (GET uniquement). Filtre et recherche sont appliqués par l'API.
import { apiFetch } from "../api-client";
import type { ClientTicket, Id } from "../types";

export function listClientTickets(filters: { status?: string; q?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.q && filters.q.trim()) params.set("q", filters.q.trim());
  const qs = params.toString();
  return apiFetch<ClientTicket[]>(`/client/tickets${qs ? `?${qs}` : ""}`);
}

export const getClientTicket = (id: Id) => apiFetch<ClientTicket>(`/client/tickets/${id}`);
