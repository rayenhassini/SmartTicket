-- =====================================================================
-- SmartTicket — Migration 002 (Phase 3) : invitations technicien
-- ADDITIVE UNIQUEMENT : crée 1 table. Ne modifie, ne supprime et ne
-- déplace aucune donnée ni aucune table existante (ENUM inchangés).
-- À exécuter MANUELLEMENT, une fois, sur la base smartticket_v1 :
--     mysql -u root -p smartticket_v1 < database/migrations/002_phase3_invitations.sql
-- Rejouable sans effet (CREATE TABLE IF NOT EXISTS).
-- Prérequis : migration 001 (table teams).
-- =====================================================================

USE smartticket_v1;

CREATE TABLE IF NOT EXISTS user_invitations (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email            VARCHAR(190)    NOT NULL,
  -- SHA-256 (hex) du jeton : le jeton en clair n'existe que dans le lien envoyé par mail.
  token            CHAR(64)        NOT NULL,
  -- Phase 3 : technicien uniquement (l'invitation Client arrive en phase 4).
  authority        ENUM('technician') NOT NULL DEFAULT 'technician',
  team_id          BIGINT UNSIGNED NOT NULL,
  status           ENUM('pending','accepted','expired','cancelled') NOT NULL DEFAULT 'pending',
  invited_by       BIGINT UNSIGNED NULL,
  accepted_user_id BIGINT UNSIGNED NULL,
  expires_at       DATETIME(3)     NOT NULL,
  accepted_at      DATETIME(3)     NULL,
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

  -- Pas deux invitations « pending » pour un même email : garanti par la base
  -- (colonne générée NULL hors pending ; les NULL multiples sont permis par UNIQUE).
  pending_email    VARCHAR(190) AS (IF(status = 'pending', email, NULL)) STORED,

  UNIQUE KEY uq_invitations_token (token),
  UNIQUE KEY uq_invitations_pending_email (pending_email),
  KEY idx_invitations_email (email),
  KEY idx_invitations_status (status),
  KEY idx_invitations_team (team_id),
  CONSTRAINT fk_invitations_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_invitations_invited_by
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_invitations_accepted_user
    FOREIGN KEY (accepted_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
