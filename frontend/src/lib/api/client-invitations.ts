// Phase 4 — Invitations CLIENT (sans équipe). Création / liste / annulation : PMO. validate / accept : publics.
import { apiFetch } from "../api-client";
import type { ClientInvitationPreview, ClientInvitationView, CreatedClientInvitation, InvitationStatus } from "../types";

export const listClientInvitations = (status?: InvitationStatus) =>
  apiFetch<ClientInvitationView[]>(`/client-invitations${status ? `?status=${status}` : ""}`);

export const createClientInvitation = (email: string) =>
  apiFetch<CreatedClientInvitation>("/client-invitations", { method: "POST", body: { email } });

export const cancelClientInvitation = (id: string) =>
  apiFetch<ClientInvitationView>(`/client-invitations/${id}/cancel`, { method: "POST" });

// Routes publiques : pas de redirection vers /login sur 401.
export const validateClientInvitation = (token: string) =>
  apiFetch<ClientInvitationPreview>(`/client-invitations/validate?token=${encodeURIComponent(token)}`, { skipAuthRedirect: true });

export interface AcceptClientPayload {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
  phoneNumber: string;
  location: string;
  company?: string;
}
export const acceptClientInvitation = (payload: AcceptClientPayload) =>
  apiFetch<{ email: string; message: string }>("/client-invitations/accept", { method: "POST", body: payload, skipAuthRedirect: true });
