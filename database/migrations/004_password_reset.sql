-- =====================================================================
-- SmartTicket — Migration 004 : réinitialisation de mot de passe
-- ADDITIVE UNIQUEMENT : crée 1 table. Aucune table / donnée / ENUM existant n'est modifié.
-- À exécuter MANUELLEMENT, une fois, sur la base smartticket_v1 :
--     mysql -u root -p smartticket_v1 < database/migrations/004_password_reset.sql
-- Rejouable sans effet (CREATE TABLE IF NOT EXISTS). Prérequis : table users.
-- =====================================================================

USE smartticket_v1;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  -- SHA-256 (hex) du jeton : le jeton en clair n'existe que dans le lien envoyé par mail.
  token      CHAR(64)        NOT NULL,
  expires_at DATETIME(3)     NOT NULL,
  used_at    DATETIME(3)     NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_pwreset_token (token),
  KEY idx_pwreset_user (user_id),
  CONSTRAINT fk_pwreset_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
