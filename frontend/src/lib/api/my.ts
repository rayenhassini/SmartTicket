// Espace technicien. Le périmètre (équipe) et le droit d'écriture (responsable) sont contrôlés par l'API.
import { apiFetch } from "../api-client";
import type { Id, MyTicketResponse, MyTicketsResponse, TicketStatus } from "../types";

export const listMyTickets = () => apiFetch<MyTicketsResponse>("/me/tickets");

export const getMyTicket = (id: Id) => apiFetch<MyTicketResponse>(`/me/tickets/${id}`);

export const setMyTicketStatus = (id: Id, status: TicketStatus) =>
  apiFetch<MyTicketResponse>(`/me/tickets/${id}/status`, { method: "PATCH", body: { status } });

export const saveMyTicketSolution = (id: Id, solutionText: string) =>
  apiFetch<MyTicketResponse>(`/me/tickets/${id}/solution`, { method: "PUT", body: { solutionText } });

export interface MyTeam {
  id: number;
  name: string;
  leader: { id: number; firstName: string; lastName: string } | null;
  memberCount: number;
  members: { userId: number; firstName: string; lastName: string; joinedAt: string; isLeader: boolean }[];
}
export const getMyTeam = () => apiFetch<MyTeam>("/teams/mine");
