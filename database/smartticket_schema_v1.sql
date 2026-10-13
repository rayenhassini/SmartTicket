-- =====================================================================
-- smartticket_schema_v1.sql
-- =====================================================================
-- OBJECTIF
--   Sous-base MySQL V1 pour la nouvelle application "SmartTicket".
--   Ce n'est PAS un clone de l'application OPM existante : on extrait
--   uniquement le cœur métier support (users/rôles, tickets, solutions,
--   equipment hardware, equipmentsofts, contracts, sites, type_supports)
--   à partir des models Mongoose de MongoDB OPMnew déjà analysés.
--
-- SCOPE V1 (inclus dans ce script)
--   1. users (STI)        : client, technician, commercial, assistant,
--                            pmo, helpdeskUser
--   2. tickets             : création, statuts, multi-techniciens,
--                            superviseur, liens client/contrat/site/
--                            équipement
--   3. solutions            : texte, validité, proposée par technicien
--   4. equipment            : hardware (SN, nom, validité, dates, types
--                            de support)
--   5. equipmentsofts       : logiciels/licences (nom, version,
--                            constructeur, dates, types de support)
--   6. contracts            : type, nature, dates, SLA, montant,
--                            clients, techniciens, types de support
--   7. sites                : nom, adresse, GPS, équipements/logiciels
--                            liés
--   8. type_supports        : référentiel transverse
--
-- HORS SCOPE V1 (volontairement absents de ce script)
--   - Chat / ChatMessage
--   - Notifications
--   - Token / auth JWT en table métier
--   - File / Folder (GED) -> remplacés par de simples colonnes
--     VARCHAR path/url
--   - HealthCheck, Problem
--   - Admin séparé (authentification via `users` uniquement)
--   - HelpDesk / HelpdeskClient dédiés
--   - Spare, Rapport, VisiteInfogerance, Vistepreventive (P3, reportés)
--   - Interventions, Requests (P2, à créer dans un script séparé après
--     stabilisation du P1)
--   - Chatbot OPM-AI (hors scope de cette étape, intégré plus tard)
--
-- Source  : models Mongoose MongoDB OPMnew (collections vides en local,
--           schéma déduit exclusivement du code)
-- Cible   : MySQL 8 / InnoDB / utf8mb4
-- Usage   : script exécutable de haut en bas, en une seule fois
-- =====================================================================

CREATE DATABASE IF NOT EXISTS smartticket_v1
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smartticket_v1;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
-- 1. TABLES DE RÉFÉRENCE
-- =====================================================================

CREATE TABLE type_supports (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  support_name    VARCHAR(150)    NOT NULL,
  support_email   VARCHAR(190)    NOT NULL,
  creation_date   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  logo_path       VARCHAR(500)    NULL,       -- ex-ref File -> simple chemin/URL
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 2. UTILISATEURS (STI — une seule table, colonnes nullables selon authority)
-- =====================================================================

CREATE TABLE users (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Champs communs (User base)
  first_name        VARCHAR(100)    NOT NULL,
  last_name         VARCHAR(100)    NOT NULL,
  email             VARCHAR(190)    NOT NULL,
  password_hash     VARCHAR(255)    NOT NULL,
  phone_number      VARCHAR(30)     NULL,
  authority         ENUM('client','technician','commercial','assistant','pmo','helpdeskUser')
                                    NOT NULL,
  image_path        VARCHAR(500)    NULL,     -- ex-ref File -> chemin/URL
  valid             BOOLEAN         NOT NULL DEFAULT FALSE,
  team_leader       BOOLEAN         NOT NULL DEFAULT FALSE,

  -- Champs spécifiques Client (authority = 'client') — NULL sinon
  company           VARCHAR(150)    NULL,
  client_role       ENUM('clientManager','clientUser') NULL,
  about             TEXT            NULL,

  -- Champs spécifiques Technicien (authority = 'technician') — NULL sinon
  permis_conduire   BOOLEAN         NULL DEFAULT FALSE,
  passeport         BOOLEAN         NULL DEFAULT FALSE,
  birth_date        DATE            NULL,
  expired_at        DATE            NULL,
  signature_path    VARCHAR(500)    NULL,     -- ex-ref File -> chemin/URL

  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_users_email (email),
  KEY idx_users_authority (authority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- NOTE : champs Commercial (contractId) et HelpDesk (matricule, site,
-- location, service) volontairement NON inclus ici : Commercial reste
-- représenté via contracts.commercial_id, HelpDesk est reporté.

-- =====================================================================
-- 3. SITES
-- =====================================================================

CREATE TABLE sites (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom_site    VARCHAR(150)    NOT NULL,
  longitude   VARCHAR(50)     NULL,           -- type String en source Mongo, conservé tel quel
  latitude    VARCHAR(50)     NULL,
  adresse     VARCHAR(255)    NOT NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 4. ÉQUIPEMENT (hardware)
-- =====================================================================

CREATE TABLE equipment (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sn                    VARCHAR(150)    NOT NULL,
  nom_piece             VARCHAR(150)    NOT NULL,
  valid                 BOOLEAN         NOT NULL DEFAULT TRUE,
  reminder_sent_60      BOOLEAN         NOT NULL DEFAULT FALSE,
  start_date_contract   DATE            NOT NULL,
  end_date_contract     DATE            NOT NULL,
  created_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                         ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_equipment_sn (sn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 5. EQUIPMENTSOFT (logiciel / licence)
-- =====================================================================

CREATE TABLE equipmentsofts (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  equipment_name        VARCHAR(150)    NOT NULL,
  version               VARCHAR(100)    NULL,
  constructure          VARCHAR(150)    NULL,
  valid                 BOOLEAN         NOT NULL DEFAULT TRUE,
  reminder_sent_60      BOOLEAN         NOT NULL DEFAULT FALSE,
  start_date_contract   DATE            NOT NULL,
  end_date_contract     DATE            NOT NULL,
  created_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                         ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 6. CONTRATS
-- =====================================================================

CREATE TABLE contracts (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id         VARCHAR(100)    NOT NULL,   -- correspond au champ `id` Mongo (distinct de _id)
  type                ENUM(
                         'SUPPORT AND MAINTENANCE SOFT',
                         'SUPPORT AND MAINTENANCE HARD',
                         'INFOGERANCE',
                         'SUPPORT AND MAINTENANCE SOFT AND HARD'
                       )               NOT NULL,
  nature              ENUM(
                         'DEVELOPMENT',
                         'SYSTEME',
                         'RESEAUX',
                         'CYBER-SECURITY',
                         'SUPPORT'
                       )               NOT NULL,
  start_date          DATE            NOT NULL,
  end_date            DATE            NOT NULL,
  sla                 VARCHAR(255)    NOT NULL,
  due_date            DATE            NULL,
  jour_infogerance    VARCHAR(50)     NULL,       -- type exact à reconfirmer dans contractModel.js
  valid               BOOLEAN         NOT NULL DEFAULT TRUE,
  montant             DECIMAL(12,3)   NULL,       -- source Mongo = String, reconverti en DECIMAL
  commercial_id       BIGINT UNSIGNED NULL,       -- FK -> users (authority='commercial')
  created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_contracts_business_id (business_id),
  CONSTRAINT fk_contracts_commercial
    FOREIGN KEY (commercial_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 7. SOLUTIONS
-- =====================================================================

CREATE TABLE solutions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  creation_date   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  solution_text   TEXT            NULL,
  proposed_par    BIGINT UNSIGNED NULL,       -- FK -> users (authority='technician')
  valid           BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_solutions_proposed_par
    FOREIGN KEY (proposed_par) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 8. TICKETS (entité centrale)
-- =====================================================================

CREATE TABLE tickets (
  id                       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number                   VARCHAR(100)    NOT NULL,
  title                    VARCHAR(255)    NOT NULL,
  description              TEXT            NOT NULL,
  status                   ENUM(
                              'Not Assigned','Assigned','Resolved',
                              'In Progress','Deleted','Closed','On Hold'
                            )               NOT NULL DEFAULT 'Not Assigned',
  is_expired               BOOLEAN         NOT NULL DEFAULT FALSE,
  is_helpdesk              BOOLEAN         NOT NULL DEFAULT FALSE,
  has_active_intervention  BOOLEAN         NOT NULL DEFAULT FALSE,
  internal_task            BOOLEAN         NOT NULL DEFAULT FALSE,
  reminder_sent            BOOLEAN         NOT NULL DEFAULT FALSE,

  creation_date            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_date            DATETIME        NULL,
  assigned_date            DATETIME        NULL,
  taken_date               DATETIME        NULL,
  closed_date              DATETIME        NULL,
  case_id                  VARCHAR(100)    NULL,

  solution_id              BIGINT UNSIGNED NULL,
  client_id                BIGINT UNSIGNED NULL,   -- FK -> users (authority='client')
  contract_id              BIGINT UNSIGNED NULL,
  site_id                  BIGINT UNSIGNED NULL,
  equipment_soft_id        BIGINT UNSIGNED NULL,
  equipment_hard_id        BIGINT UNSIGNED NULL,
  supervisor_id            BIGINT UNSIGNED NULL,   -- FK -> users (authority='technician')

  created_at               TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                             ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_tickets_number (number),
  KEY idx_tickets_status (status),

  CONSTRAINT fk_tickets_solution
    FOREIGN KEY (solution_id) REFERENCES solutions(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tickets_client
    FOREIGN KEY (client_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tickets_contract
    FOREIGN KEY (contract_id) REFERENCES contracts(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tickets_site
    FOREIGN KEY (site_id) REFERENCES sites(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tickets_equipment_soft
    FOREIGN KEY (equipment_soft_id) REFERENCES equipmentsofts(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tickets_equipment_hard
    FOREIGN KEY (equipment_hard_id) REFERENCES equipment(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tickets_supervisor
    FOREIGN KEY (supervisor_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 9. TABLES DE JONCTION — P1
-- =====================================================================

-- Ticket <-> Technicien(s) assignés (Ticket.technicienId[])
CREATE TABLE ticket_technicians (
  ticket_id       BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (ticket_id, user_id),
  CONSTRAINT fk_tt_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_tt_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Equipment <-> TypeSupport (sous-document embarqué Equipment.TypeSupport[])
CREATE TABLE equipment_type_supports (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  equipment_id        BIGINT UNSIGNED NOT NULL,
  type_support_id     BIGINT UNSIGNED NOT NULL,
  support_id          VARCHAR(150)    NOT NULL,
  start_date_support  DATE            NULL,
  end_date_support    DATE            NULL,
  CONSTRAINT fk_ets_equipment
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
  CONSTRAINT fk_ets_type_support
    FOREIGN KEY (type_support_id) REFERENCES type_supports(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- EquipmentSoft <-> TypeSupport (sous-document embarqué EquipmentSoft.TypeSupport[])
CREATE TABLE equipmentsoft_type_supports (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  equipmentsoft_id    BIGINT UNSIGNED NOT NULL,
  type_support_id     BIGINT UNSIGNED NOT NULL,
  support_id          VARCHAR(150)    NOT NULL,
  start_date_support  DATE            NULL,
  end_date_support    DATE            NULL,
  CONSTRAINT fk_ests_equipmentsoft
    FOREIGN KEY (equipmentsoft_id) REFERENCES equipmentsofts(id) ON DELETE CASCADE,
  CONSTRAINT fk_ests_type_support
    FOREIGN KEY (type_support_id) REFERENCES type_supports(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contract <-> Clients (many-to-many, Contract.clients[])
CREATE TABLE contract_clients (
  contract_id   BIGINT UNSIGNED NOT NULL,
  client_id     BIGINT UNSIGNED NOT NULL,   -- FK -> users (authority='client')
  PRIMARY KEY (contract_id, client_id),
  CONSTRAINT fk_cc_contract
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cc_client
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contract <-> Techniciens (Contract.technicians[] = {technician, teamLeader})
CREATE TABLE contract_technicians (
  contract_id     BIGINT UNSIGNED NOT NULL,
  technician_id   BIGINT UNSIGNED NOT NULL,   -- FK -> users (authority='technician')
  team_leader     BOOLEAN         NOT NULL DEFAULT FALSE,
  PRIMARY KEY (contract_id, technician_id),
  CONSTRAINT fk_ct_contract
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  CONSTRAINT fk_ct_technician
    FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contract <-> TypeSupport (Contract.typeSupport[] = {type, supportId})
CREATE TABLE contract_type_supports (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contract_id       BIGINT UNSIGNED NOT NULL,
  type_support_id   BIGINT UNSIGNED NOT NULL,
  support_id        VARCHAR(150)    NOT NULL,
  CONSTRAINT fk_cts_contract
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cts_type_support
    FOREIGN KEY (type_support_id) REFERENCES type_supports(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Site <-> Equipment (Site.listEquipment[]) — relation portée UNIQUEMENT ici
-- (décision actée : pas de colonne site_id directe sur equipment)
CREATE TABLE site_equipment (
  site_id       BIGINT UNSIGNED NOT NULL,
  equipment_id  BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (site_id, equipment_id),
  CONSTRAINT fk_se_site
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  CONSTRAINT fk_se_equipment
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Site <-> EquipmentSoft (Site.listEquipmentSoft[])
CREATE TABLE site_equipmentsoft (
  site_id           BIGINT UNSIGNED NOT NULL,
  equipmentsoft_id  BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (site_id, equipmentsoft_id),
  CONSTRAINT fk_ses_site
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  CONSTRAINT fk_ses_equipmentsoft
    FOREIGN KEY (equipmentsoft_id) REFERENCES equipmentsofts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- EXCLUSIONS VOLONTAIRES — non créées dans ce script
-- =====================================================================
-- P2 (après stabilisation du P1, script séparé) :
--   interventions, intervention_sub_interventions, requests, admins
--
-- P3 (reporté) :
--   spares, rapports, visite_infogerances, vistepreventives,
--   vistepreventive_technicians, helpdesk_clients
--
-- Hors V1 définitif :
--   chats, chatmessages, notifications, tokens, files, folders,
--   healthchecks, problem, EquipmentHelpdesk (model introuvable dans
--   les sources fournies)
-- =====================================================================
