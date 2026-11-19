// Phase A — API d'administration (PMO) pour Sites, Contrats, Équipements, Logiciels.
// Les listes (GET) sont déjà exposées par lookups.ts ; ici : écriture + liens de sites.
import { apiFetch } from "../api-client";
import type { Contract, Equipment, EquipmentSoft, Id, Site, Solution, TypeSupport, User } from "../types";

type Payload = Record<string, unknown>;
const crud = <T,>(base: string) => ({
  list: () => apiFetch<T[]>(base),
  create: (body: Payload) => apiFetch<T>(base, { method: "POST", body }),
  update: (id: Id, body: Payload) => apiFetch<T>(`${base}/${id}`, { method: "PATCH", body }),
  remove: (id: Id) => apiFetch<void>(`${base}/${id}`, { method: "DELETE" }),
});

export const usersApi = crud<User>("/users");
export const typeSupportsApi = crud<TypeSupport>("/type-supports");
export const solutionsApi = crud<Solution>("/solutions");
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

// Liens d'un contrat (R4b clients, R4c types de support). Les liens techniciens ne sont pas exposés (R18).
export const getContract = (id: Id) => apiFetch<Contract>(`/contracts/${id}`);
export const linkContractClient = (id: Id, clientId: number) =>
  apiFetch<Contract>(`/contracts/${id}/clients`, { method: "POST", body: { clientId } });
export const unlinkContractClient = (id: Id, clientId: Id) =>
  apiFetch<Contract>(`/contracts/${id}/clients/${clientId}`, { method: "DELETE" });
export const linkContractTypeSupport = (id: Id, typeSupportId: number, supportId: string) =>
  apiFetch<unknown>(`/contracts/${id}/type-supports`, { method: "POST", body: { typeSupportId, supportId } });
export const unlinkContractTypeSupport = (id: Id, linkId: Id) =>
  apiFetch<void>(`/contracts/${id}/type-supports/${linkId}`, { method: "DELETE" });
