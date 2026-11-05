-- =====================================================================
-- SmartTicket — Migration 007 (Phase 4, FACULTATIVE) : une seule invitation client « pending » par email
-- ADDITIVE : ajoute 1 colonne générée + 1 clé unique à `client_invitations`. Aucune donnée modifiée.
-- Le code vérifie déjà cette règle ; cette migration la garantit aussi au niveau de la base (accès concurrents).
-- Prérequis : migration 005. S'il existe déjà deux invitations « pending » pour un même email, l'index échouera :
-- annulez-en une (UPDATE client_invitations SET status='cancelled' WHERE id='…') puis rejouez.
-- Rejouable sans effet (test information_schema), compatible MySQL 8 et MariaDB.
--     mysql -u root -p smartticket_v1 < database/migrations/007_client_invitations_pending_unique.sql
-- =====================================================================

USE smartticket_v1;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'client_invitations' AND COLUMN_NAME = 'pending_email'
);
SET @ddl := IF(@has_col = 0,
  'ALTER TABLE client_invitations ADD COLUMN pending_email VARCHAR(255) AS (IF(status = ''pending'', email, NULL)) STORED, ADD UNIQUE KEY UQ_client_invitations_pending_email (pending_email)',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
