-- =====================================================================
-- SmartTicket — Migration 005 (Phase 4) : invitations CLIENT
-- ADDITIVE UNIQUEMENT : crée 1 table. `user_invitations` (technicien) n'est pas modifiée.
-- Schéma aligné sur la table réelle de l'environnement (users.id = BIGINT UNSIGNED) :
--   id CHAR(36) = UUID généré par l'application ; status VARCHAR(32) ; dates DATETIME(6).
-- À exécuter MANUELLEMENT (phpMyAdmin ou ligne de commande) sur la base smartticket_v1 :
--     mysql -u root -p smartticket_v1 < database/migrations/005_client_invitations.sql
-- Rejouable sans effet (CREATE TABLE IF NOT EXISTS) : si la table existe déjà avec ce schéma, rien ne change.
-- Prérequis : table users.
-- =====================================================================

USE smartticket_v1;

CREATE TABLE IF NOT EXISTS client_invitations (
  id                 CHAR(36)        NOT NULL,
  email              VARCHAR(255)    NOT NULL,
  -- SHA-256 (hex) du jeton : le jeton en clair n'existe que dans le lien envoyé par mail.
  token_hash         VARCHAR(64)     NOT NULL,
  invited_by_user_id BIGINT(20) UNSIGNED NOT NULL,
  -- pending | accepted | expired | cancelled
  status             VARCHAR(32)     NOT NULL DEFAULT 'pending',
  expires_at         DATETIME(6)     NOT NULL,
  accepted_at        DATETIME(6)     NULL,
  created_user_id    BIGINT(20) UNSIGNED NULL,
  created_at         DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at         DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY UQ_client_invitations_token_hash (token_hash),
  KEY IDX_client_invitations_email (email),
  KEY IDX_client_invitations_status (status),
  KEY IDX_client_invitations_invited_by (invited_by_user_id),
  CONSTRAINT FK_client_invitations_invited_by
    FOREIGN KEY (invited_by_user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT FK_client_invitations_created_user
    FOREIGN KEY (created_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
