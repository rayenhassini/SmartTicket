// Reflète exactement l'ENUM `authority` de la table `users` (smartticket_schema_v1.sql)
export enum UserAuthority {
  CLIENT = 'client',
  TECHNICIAN = 'technician',
  COMMERCIAL = 'commercial',
  ASSISTANT = 'assistant',
  PMO = 'pmo',
  HELPDESK_USER = 'helpdeskUser',
}
