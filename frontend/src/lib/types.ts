// Types alignés sur les réponses réelles du backend SmartTicket (NestJS + TypeORM).
// NB : les colonnes BIGINT sont renvoyées en string par mysql2/TypeORM, d'où Id = string | number.

export type Id = string | number;

export const USER_AUTHORITIES = [
  "client",
  "technician",
  "commercial",
  "assistant",
  "pmo",
  "helpdeskUser",
] as const;
export type UserAuthority = (typeof USER_AUTHORITIES)[number];

export const TICKET_STATUSES = [
  "Not Assigned",
  "Assigned",
  "In Progress",
  "On Hold",
  "Resolved",
  "Closed",
  "Deleted",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export interface User {
  id: Id;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  authority: UserAuthority;
  valid: boolean;
  teamLeader: boolean;
  company?: string | null;
}

export interface SessionUser {
  id: Id;
  email: string;
  firstName: string;
  lastName: string;
  authority: UserAuthority;
}

export interface LoginResponse {
  access_token: string;
  user: SessionUser;
}

export interface Solution {
  id: Id;
  creationDate: string;
  solutionText?: string | null;
  valid: boolean;
  proposedPar?: User | null;
}

export interface Contract {
  id: Id;
  businessId: string;
  type: string;
  nature: string;
}

export interface Site {
  id: Id;
  nomSite: string;
  adresse: string;
}

export interface Equipment {
  id: Id;
  sn: string;
  nomPiece: string;
}

export interface EquipmentSoft {
  id: Id;
  equipmentName: string;
  version?: string | null;
  constructure?: string | null;
}

export interface Ticket {
  id: Id;
  number: string;
  title: string;
  description: string;
  status: TicketStatus;
  isExpired: boolean;
  isHelpdesk: boolean;
  hasActiveIntervention: boolean;
  internalTask: boolean;
  reminderSent: boolean;
  creationDate: string;
  resolvedDate?: string | null;
  assignedDate?: string | null;
  takenDate?: string | null;
  closedDate?: string | null;
  caseId?: string | null;
  solution?: Solution | null;
  client?: User | null;
  contract?: Contract | null;
  site?: Site | null;
  equipment?: Equipment | null;
  equipmentSoft?: EquipmentSoft | null;
  supervisor?: User | null;
  technicians: User[];
}

// Payload de création — miroir exact de CreateTicketDto (backend, forbidNonWhitelisted).
export interface TicketPayload {
  number: string;
  title: string;
  description: string;
  status?: TicketStatus;
  isHelpdesk?: boolean;
  internalTask?: boolean;
  caseId?: string;
  clientId?: number;
  contractId?: number;
  siteId?: number;
  equipmentId?: number;
  equipmentSoftId?: number;
  supervisorId?: number;
  solutionId?: number;
  technicianIds?: number[];
}

// ---------------------------------------------------------------------------
// Phase 2 — Équipes (réponses de GET /teams, GET /teams/:id, GET /teams/technicians)
// ---------------------------------------------------------------------------
export type StaffingLevel = "empty" | "critical" | "warning" | "normal";
export type LeaderEventReason = "manual" | "first_member" | "auto_succession";

export interface TeamSummary {
  id: number;
  name: string;
  leaderId: number | null;
  leader: { id: number; firstName: string; lastName: string } | null;
  memberCount: number;
  staffing: StaffingLevel;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberView {
  userId: number;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string | null;
  joinedAt: string;
  isLeader: boolean;
}

export interface TeamLeaderEventView {
  id: number;
  reason: LeaderEventReason;
  previousLeader: string | null;
  newLeader: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
}

export interface TeamDetail extends TeamSummary {
  members: TeamMemberView[];
  leaderEvents: TeamLeaderEventView[];
}

export interface TeamTechnician {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  teamId: number | null;
  teamName: string | null;
}
