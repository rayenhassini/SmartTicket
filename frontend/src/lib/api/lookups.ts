// Helpers en LECTURE SEULE, uniquement pour alimenter les listes déroulantes
// des formulaires/actions de tickets (F1). Aucune page CRUD associée avant F2/F3.
import { apiFetch } from "../api-client";
import type { Contract, Equipment, EquipmentSoft, Site, Solution, User } from "../types";

export const listUsers = () => apiFetch<User[]>("/users");
export const listContracts = () => apiFetch<Contract[]>("/contracts");
export const listSites = () => apiFetch<Site[]>("/sites");
export const listEquipment = () => apiFetch<Equipment[]>("/equipment");
export const listEquipmentSofts = () => apiFetch<EquipmentSoft[]>("/equipment-softs");
export const listSolutions = () => apiFetch<Solution[]>("/solutions");

export interface Lookups {
  users: User[];
  contracts: Contract[];
  sites: Site[];
  equipment: Equipment[];
  equipmentSofts: EquipmentSoft[];
  solutions: Solution[];
}

export async function loadLookups(): Promise<Lookups> {
  const [users, contracts, sites, equipment, equipmentSofts, solutions] = await Promise.all([
    listUsers(),
    listContracts(),
    listSites(),
    listEquipment(),
    listEquipmentSofts(),
    listSolutions(),
  ]);
  return { users, contracts, sites, equipment, equipmentSofts, solutions };
}

// Libellés lisibles pour les <select>.
export const userLabel = (u: User) => `${u.firstName} ${u.lastName} (${u.email})`;
export const contractLabel = (c: Contract) => `${c.businessId} — ${c.type}`;
export const siteLabel = (s: Site) => `${s.nomSite} — ${s.adresse}`;
export const equipmentLabel = (e: Equipment) => `${e.sn} — ${e.nomPiece}`;
export const equipmentSoftLabel = (e: EquipmentSoft) =>
  [e.equipmentName, e.version].filter(Boolean).join(" ");
export const solutionLabel = (s: Solution) => {
  const t = (s.solutionText ?? "(sans texte)").replace(/\s+/g, " ").trim();
  return `#${s.id} — ${t.length > 70 ? t.slice(0, 70) + "…" : t}`;
};
