// Phase A — API d'administration (PMO) pour Sites, Contrats, Équipements, Logiciels.
// Les listes (GET) sont déjà exposées par lookups.ts ; ici : écriture + liens de sites.
import { apiFetch } from "../api-client";
import type { Contract, Equipment, EquipmentSoft, Id, Site } from "../types";

type Payload = Record<string, unknown>;
const crud = <T,>(base: string) => ({
  list: () => apiFetch<T[]>(base),
  create: (body: Payload) => apiFetch<T>(base, { method: "POST", body }),
  update: (id: Id, body: Payload) => apiFetch<T>(`${base}/${id}`, { method: "PATCH", body }),
  remove: (id: Id) => apiFetch<void>(`${base}/${id}`, { method: "DELETE" }),
});

export const sitesApi = crud<Site>("/sites");
export const contractsApi = crud<Contract>("/contracts");
export const equipmentApi = crud<Equipment>("/equipment");
export const equipmentSoftsApi = crud<EquipmentSoft>("/equipment-softs");

export const linkSiteEquipment = (siteId: Id, equipmentId: number) =>
  apiFetch<Site>(`/sites/${siteId}/equipment`, { method: "POST", body: { equipmentId } });
export const unlinkSiteEquipment = (siteId: Id, equipmentId: Id) =>
  apiFetch<Site>(`/sites/${siteId}/equipment/${equipmentId}`, { method: "DELETE" });
export const linkSiteSoft = (siteId: Id, equipmentSoftId: number) =>
  apiFetch<Site>(`/sites/${siteId}/equipment-softs`, { method: "POST", body: { equipmentSoftId } });
export const unlinkSiteSoft = (siteId: Id, equipmentSoftId: Id) =>
  apiFetch<Site>(`/sites/${siteId}/equipment-softs/${equipmentSoftId}`, { method: "DELETE" });
