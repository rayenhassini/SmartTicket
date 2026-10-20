import type { TicketStatus } from "./types";

export const STATUS_LABELS: Record<TicketStatus, string> = {
  "Not Assigned": "Non assigné",
  Assigned: "Assigné",
  "In Progress": "En cours",
  "On Hold": "En attente",
  Resolved: "Résolu",
  Closed: "Clôturé",
  Deleted: "Supprimé",
};

export const STATUS_STYLES: Record<TicketStatus, string> = {
  "Not Assigned": "bg-slate-100 text-slate-700",
  Assigned: "bg-blue-100 text-blue-800",
  "In Progress": "bg-amber-100 text-amber-800",
  "On Hold": "bg-orange-100 text-orange-800",
  Resolved: "bg-green-100 text-green-800",
  Closed: "bg-emerald-100 text-emerald-800",
  Deleted: "bg-red-100 text-red-800",
};

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export function fullName(u?: { firstName: string; lastName: string } | null): string {
  return u ? `${u.firstName} ${u.lastName}` : "—";
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Une erreur inattendue est survenue.";
}

// Génère un numéro de ticket proposé : TCK-YYYYMMDD-HHMMSS (modifiable par l'utilisateur).
export function suggestTicketNumber(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `TCK-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
