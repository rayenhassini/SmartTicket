// Succession PMO (démission + invitation du successeur) et paramètres mail. PMO sauf validate/accept (publics).
import { apiFetch } from "../api-client";

export interface Resignation {
  status: "none" | "pending";
  id?: number;
  successorEmail?: string;
  expiresAt?: string;
  mailMode?: "smtp" | "log";
  devLink?: string;
}

export const getResignation = () => apiFetch<Resignation>("/pmo/resignation");
export const startResignation = (successorEmail: string) =>
  apiFetch<Resignation>("/pmo/resignation", { method: "POST", body: { successorEmail } });
export const cancelResignation = () => apiFetch<unknown>("/pmo/resignation/cancel", { method: "POST" });

export const validateSuccession = (token: string) =>
  apiFetch<{ email: string; expiresAt: string }>(`/pmo/succession/validate?token=${encodeURIComponent(token)}`, { skipAuthRedirect: true });

export interface AcceptSuccessionPayload {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
  phoneNumber?: string;
}
export const acceptSuccession = (payload: AcceptSuccessionPayload) =>
  apiFetch<{ email: string; message: string }>("/pmo/succession/accept", { method: "POST", body: payload, skipAuthRedirect: true });

export interface MailSettingsStatus {
  configured: boolean;
  source: "database" | "env" | "none";
  gmail: string | null;
  appName: string | null;
  hasPassword: boolean;
  updatedAt: string | null;
}
export const getMailSettings = () => apiFetch<MailSettingsStatus>("/settings/mail");
export const saveMailSettings = (body: { gmail: string; appName: string; appPassword: string }) =>
  apiFetch<MailSettingsStatus>("/settings/mail", { method: "PUT", body });
export const sendMailTest = () => apiFetch<{ sent: boolean; to: string; message: string }>("/settings/mail/test", { method: "POST" });
