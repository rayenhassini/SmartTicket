
-- =====================================================================
-- SmartTicket Migration 001 (Phase 2): Teams and Team Leader
-- TEST DATABASE ONLY: smartticket_v1_smoketest
-- Additive migration: creates 3 tables without deleting existing data.
-- Safe to rerun because it uses CREATE TABLE IF NOT EXISTS.
-- =====================================================================

USE smartticket_v1_smoketest;

-- ---------------------------------------------------------------------
-- teams: a team can have at most one leader.
-- leader_id is NULL when the team has no leader.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    leader_id   BIGINT UNSIGNED NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                            ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_teams_name (name),
    KEY idx_teams_leader (leader_id),

    CONSTRAINT fk_teams_leader
        FOREIGN KEY (leader_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- team_members: each user can belong to only one team.
-- joined_at is used to determine seniority for leader succession.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_id     BIGINT UNSIGNED NOT NULL,
    user_id     BIGINT UNSIGNED NOT NULL,
    joined_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE KEY uq_team_members_user (user_id),
    KEY idx_team_members_team_joined (team_id, joined_at, user_id),

    CONSTRAINT fk_team_members_team
        FOREIGN KEY (team_id)
        REFERENCES teams(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_team_members_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- team_leader_events: history of team leader changes.
-- reason: manual, first_member, or auto_succession.
-- User references become NULL if the referenced user is deleted.
-- Events are deleted when their team is deleted.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_leader_events (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_id             BIGINT UNSIGNED NOT NULL,
    previous_leader_id  BIGINT UNSIGNED NULL,
    new_leader_id       BIGINT UNSIGNED NULL,
    reason              ENUM(
                            'manual',
                            'first_member',
                            'auto_succession'
                        ) NOT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at     TIMESTAMP NULL,

    KEY idx_tle_team_created (team_id, created_at),

    CONSTRAINT fk_tle_team
        FOREIGN KEY (team_id)
        REFERENCES teams(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_tle_prev
        FOREIGN KEY (previous_leader_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_tle_new
        FOREIGN KEY (new_leader_id)
        REFERENCES users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
