import type { StaffingLevel, TicketStatus } from "@/lib/types";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/format";

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-medium underline">
          Réessayer
        </button>
      )}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
      {message}
    </div>
  );
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {children && <div className="mt-3 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// --- Phase 2 : effectif d'équipe -------------------------------------------------
// La COULEUR + le libellé expriment l'EFFECTIF (gris = vide, rouge = 1, orange = 2-3, vert = 4+).
// Le responsable se repère autrement (étoile + libellé « Responsable » + fond indigo) : voir LeaderMark.
const STAFFING: Record<StaffingLevel, { label: string; style: string }> = {
  empty: { label: "Vide", style: "bg-slate-200 text-slate-700" },
  critical: { label: "Effectif critique", style: "bg-red-100 text-red-800 ring-1 ring-red-300" },
  warning: { label: "Effectif réduit", style: "bg-orange-100 text-orange-800 ring-1 ring-orange-300" },
  normal: { label: "Effectif normal", style: "bg-green-100 text-green-800" },
};

export function StaffingBadge({ level, count }: { level: StaffingLevel; count: number }) {
  const s = STAFFING[level];
  return (
    <span
      data-staffing={level}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.style}`}
    >
      <span className="font-semibold">{count}</span>
      {level === "empty" ? s.label : `· ${s.label}`}
    </span>
  );
}

export function LeaderMark() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
      <span aria-hidden="true">★</span> Responsable
    </span>
  );
}
