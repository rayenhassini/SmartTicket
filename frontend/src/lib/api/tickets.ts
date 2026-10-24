import { apiFetch } from "../api-client";
import type { Id, Ticket, TicketPayload, TicketStatus } from "../types";

export const listTickets = () => apiFetch<Ticket[]>("/tickets");

export const getTicket = (id: Id) => apiFetch<Ticket>(`/tickets/${id}`);

export const createTicket = (payload: TicketPayload) =>
  apiFetch<Ticket>("/tickets", { method: "POST", body: payload });

export const updateTicket = (id: Id, payload: Partial<TicketPayload>) =>
  apiFetch<Ticket>(`/tickets/${id}`, { method: "PATCH", body: payload });

export const deleteTicket = (id: Id) => apiFetch<void>(`/tickets/${id}`, { method: "DELETE" });

export const updateTicketStatus = (id: Id, status: TicketStatus) =>
  apiFetch<Ticket>(`/tickets/${id}/status`, { method: "PATCH", body: { status } });

export const assignTechnician = (id: Id, technicianId: number) =>
  apiFetch<Ticket>(`/tickets/${id}/technicians`, { method: "POST", body: { technicianId } });

export const removeTechnician = (id: Id, userId: Id) =>
  apiFetch<Ticket>(`/tickets/${id}/technicians/${userId}`, { method: "DELETE" });

export const setSupervisor = (id: Id, supervisorId: number) =>
  apiFetch<Ticket>(`/tickets/${id}/supervisor`, { method: "PATCH", body: { supervisorId } });

export const linkSolution = (id: Id, solutionId: number) =>
  apiFetch<Ticket>(`/tickets/${id}/solution`, { method: "PATCH", body: { solutionId } });

// Phase 3b : le PMO assigne une équipe complète (Not Assigned → Assigned).
export const assignTeam = (id: Id, teamId: Id) =>
  apiFetch<Ticket>(`/tickets/${id}/team`, { method: "PATCH", body: { teamId: Number(teamId) } });
