// Reflète exactement l'ENUM `status` de la table `tickets` (smartticket_schema_v1.sql)
export enum TicketStatus {
  NOT_ASSIGNED = 'Not Assigned',
  ASSIGNED = 'Assigned',
  RESOLVED = 'Resolved',
  IN_PROGRESS = 'In Progress',
  DELETED = 'Deleted',
  CLOSED = 'Closed',
  ON_HOLD = 'On Hold',
}
