// Règles d'effectif d'une équipe (décision D6) — fonctions pures.
//   0 membre  → "empty"    (gris « Vide », pas d'alerte)
//   1 membre  → "critical" (rouge, email urgent à la descente)
//   2–3       → "warning"  (orange, email d'avertissement à la descente)
//   ≥ 4       → "normal"
export type StaffingLevel = 'empty' | 'critical' | 'warning' | 'normal';

export function staffingLevel(memberCount: number): StaffingLevel {
  if (memberCount <= 0) return 'empty';
  if (memberCount === 1) return 'critical';
  if (memberCount < 4) return 'warning';
  return 'normal';
}

const SEVERITY: Record<StaffingLevel, number> = { normal: 0, warning: 1, critical: 2, empty: 3 };

// Un email d'effectif n'est envoyé que lorsque l'effectif DESCEND de palier
// (normal → warning, warning → critical, normal → critical), jamais à la croissance.
export function isStaffingDescent(before: StaffingLevel, after: StaffingLevel): boolean {
  return SEVERITY[after] > SEVERITY[before] && after !== 'empty';
}
