-- =====================================================================
-- SmartTicket — Migration 006 (Phase 4) : users.location (localisation du client)
-- ADDITIVE : ajoute 1 colonne NULLable à `users`. Aucune donnée, aucun ENUM modifié.
-- À exécuter MANUELLEMENT, une fois, sur la base smartticket_v1 :
--     mysql -u root -p smartticket_v1 < database/migrations/006_user_location.sql
-- Rejouable sans effet (test information_schema), compatible MySQL 8 et MariaDB.
-- =====================================================================

USE smartticket_v1;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'location'
);
SET @ddl := IF(@has_col = 0,
  'ALTER TABLE users ADD COLUMN location VARCHAR(255) NULL AFTER phone_number',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
