-- =====================================================================
-- SmartTicket — Migration 003 : lien Ticket -> Équipe (tickets.team_id)
-- ADDITIVE UNIQUEMENT : ajoute 1 colonne NULLABLE, 1 index et 1 clé étrangère sur
-- `tickets`. Aucune donnée existante n'est modifiée ou supprimée (team_id = NULL
-- pour les tickets déjà présents) ; ENUM inchangés ; ticket_technicians et
-- tickets.supervisor_id restent tels quels (conservés, plus utilisés par l'espace
-- technicien).
-- À exécuter MANUELLEMENT, une fois, sur la base smartticket_v1 :
--     mysql -u root -p smartticket_v1 < database/migrations/003_ticket_team.sql
-- Rejouable sans effet (vérifie l'existence de la colonne avant d'agir ;
-- compatible MySQL 8 et MariaDB). Prérequis : migration 001 (table teams).
-- FK en RESTRICT : une équipe qui porte des tickets ne peut pas être supprimée.
-- =====================================================================

USE smartticket_v1;

SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'team_id');
SET @ddl = IF(@has_col = 0,
  'ALTER TABLE tickets
     ADD COLUMN team_id BIGINT UNSIGNED NULL,
     ADD KEY idx_tickets_team (team_id),
     ADD CONSTRAINT fk_tickets_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT',
  'SELECT ''tickets.team_id existe déjà : rien à faire'' AS info');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
