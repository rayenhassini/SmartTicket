import { apiFetch } from "../api-client";
import type { LoginResponse } from "../types";

export function login(email: string, password: string) {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    skipAuthRedirect: true,
  });
}

export interface BootstrapPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  authority?: "pmo" | "assistant";
}

export function bootstrap(payload: BootstrapPayload) {
  return apiFetch<LoginResponse>("/auth/bootstrap", {
    method: "POST",
    body: payload,
    skipAuthRedirect: true,
  });
}

export function forgotPassword(email: string) {
  return apiFetch<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email }, skipAuthRedirect: true });
}

export function resetPassword(payload: { token: string; password: string; passwordConfirm: string }) {
  return apiFetch<{ message: string }>("/auth/reset-password", { method: "POST", body: payload, skipAuthRedirect: true });
}
