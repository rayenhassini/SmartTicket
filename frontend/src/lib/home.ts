import type { SessionUser } from "./types";

// Page d'accueil selon le rôle (l'API reste la vraie barrière : ceci n'est que la navigation).
export function homeFor(user: Pick<SessionUser, "authority"> | null | undefined): string {
  if (!user) return "/login";
  if (user.authority === "technician") return "/my/tickets";
  if (user.authority === "pmo") return "/tickets";
  return "/no-access";
}
