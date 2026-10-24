// Phase 3 — Invitations technicien. Création / liste / annulation : PMO. validate / accept : publics.
import { apiFetch } from "../api-client";
import type { CreatedInvitation, Id, InvitationPreview, InvitationStatus, InvitationView } from "../types";

export const listInvitations = (status?: InvitationStatus) =>
  apiFetch<InvitationView[]>(`/invitations${status ? `?status=${status}` : ""}`);

// teamId obligatoire ; les ids DTO exigent des nombres.
export const createInvitation = (email: string, teamId: Id) =>
  apiFetch<CreatedInvitation>("/invitations", { method: "POST", body: { email, teamId: Number(teamId) } });

export const cancelInvitation = (id: Id) => apiFetch<InvitationView>(`/invitations/${id}/cancel`, { method: "POST" });

// Routes publiques : pas de redirection vers /login sur 401.
export const validateInvitation = (token: string) =>
  apiFetch<InvitationPreview>(`/invitations/validate?token=${encodeURIComponent(token)}`, { skipAuthRedirect: true });

export interface AcceptPayload {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
  phoneNumber?: string;
}
export const acceptInvitation = (payload: AcceptPayload) =>
  apiFetch<{ email: string; message: string }>("/invitations/accept", { method: "POST", body: payload, skipAuthRedirect: true });
