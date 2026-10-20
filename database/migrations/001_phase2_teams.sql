
-- =====================================================================
-- SmartTicket — Migration 001 (Phase 2) : équipes et responsable
-- ADDITIVE UNIQUEMENT : crée 3 tables. Ne modifie, ne supprime et ne
-- déplace aucune donnée ni aucune table existante (ENUM inchangés ;
-- tickets.supervisor_id, ticket_technicians et users.team_leader sont
-- conservés tels quels, dépréciés mais non supprimés).
-- À exécuter MANUELLEMENT, une fois, sur la base smartticket_v1_smoketest :
--     mysql -u root smartticket_v1_smoketest < database/migrations/001_phase2_teams_smoketest.sql
-- Rejouable sans effet (CREATE TABLE IF NOT EXISTS).
-- Non inclus volontairement : tickets.team_id (phase 5a).
-- =====================================================================

USE smartticket_v1_smoketest;

-- ---------------------------------------------------------------------
-- teams : une équipe a au plus un responsable (leader_id, NULL si vide).
-- Le fait que le responsable soit membre de l'équipe est garanti par le
-- service (transaction), pas par une contrainte SQL.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)    NOT NULL,
  leader_id   BIGINT UNSIGNED NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_teams_name (name),
  KEY idx_teams_leader (leader_id),
  CONSTRAINT fk_teams_leader
    FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- team_members : UNIQUE(user_id) = un technicien n'appartient qu'à UNE
-- équipe. joined_at (ms) sert à l'ancienneté pour la succession.
-- RESTRICT partout : un utilisateur ou une équipe ne disparaît jamais en
-- silence en contournant les règles d'effectif.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  team_id     BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  joined_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE KEY uq_team_members_user (user_id),
  KEY idx_team_members_team_joined (team_id, joined_at, user_id),
  CONSTRAINT fk_team_members_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT,
  CONSTRAINT fk_team_members_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- team_leader_events : historique des changements de responsable.
-- reason : manual (PMO), first_member (1er membre d'une équipe vide),
--          auto_succession (le responsable est parti : retrait,
--          transfert ou désactivation).
-- acknowledged_at : réservé à un futur acquittement global (bandeau PMO).
-- Les utilisateurs cités passent à NULL s'ils sont supprimés ; les
-- événements disparaissent avec leur équipe.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_leader_events (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  team_id             BIGINT UNSIGNED NOT NULL,
  previous_leader_id  BIGINT UNSIGNED NULL,
  new_leader_id       BIGINT UNSIGNED NULL,
  reason              ENUM('manual','first_member','auto_succession') NOT NULL,
  created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at     TIMESTAMP       NULL,

  KEY idx_tle_team_created (team_id, created_at),
  CONSTRAINT fk_tle_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_tle_prev
    FOREIGN KEY (previous_leader_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tle_new
    FOREIGN KEY (new_leader_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
