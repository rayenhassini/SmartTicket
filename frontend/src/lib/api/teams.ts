// Phase 2 — API Équipes (toutes les routes sont réservées au PMO côté backend).
import { apiFetch } from "../api-client";
import type { Id, TeamDetail, TeamSummary, TeamTechnician } from "../types";

export const listTeams = () => apiFetch<TeamSummary[]>("/teams");

export const getTeam = (id: Id) => apiFetch<TeamDetail>(`/teams/${id}`);

export const listTeamTechnicians = () => apiFetch<TeamTechnician[]>("/teams/technicians");

export const createTeam = (name: string) => apiFetch<TeamDetail>("/teams", { method: "POST", body: { name } });

export const renameTeam = (id: Id, name: string) => apiFetch<TeamDetail>(`/teams/${id}`, { method: "PATCH", body: { name } });

export const deleteTeam = (id: Id) => apiFetch<void>(`/teams/${id}`, { method: "DELETE" });

// Les ids DTO (@IsInt) exigent des nombres.
export const addTeamMember = (id: Id, userId: Id) =>
  apiFetch<TeamDetail>(`/teams/${id}/members`, { method: "POST", body: { userId: Number(userId) } });

export const removeTeamMember = (id: Id, userId: Id) =>
  apiFetch<TeamDetail>(`/teams/${id}/members/${userId}`, { method: "DELETE" });

// Renvoie l'équipe CIBLE ; l'écran recharge l'équipe source.
export const transferTeamMember = (id: Id, userId: Id, targetTeamId: Id) =>
  apiFetch<TeamDetail>(`/teams/${id}/members/${userId}/transfer`, { method: "POST", body: { targetTeamId: Number(targetTeamId) } });

export const setTeamLeader = (id: Id, userId: Id) =>
  apiFetch<TeamDetail>(`/teams/${id}/leader`, { method: "PATCH", body: { userId: Number(userId) } });
