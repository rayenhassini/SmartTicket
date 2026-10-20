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
