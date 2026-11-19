-- Phase B+ : succession PMO (démission + invitation d'un successeur) et configuration mail en base.
-- Additive et rejouable.

CREATE TABLE IF NOT EXISTS pmo_resignations (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  successor_email    VARCHAR(190)    NOT NULL,
  token              CHAR(64)        NOT NULL,                  -- SHA-256 du jeton (le jeton clair n'est que dans l'email)
  status             ENUM('pending','completed','cancelled','expired') NOT NULL DEFAULT 'pending',
  resigning_user_id  BIGINT UNSIGNED NULL,
  successor_user_id  BIGINT UNSIGNED NULL,
  expires_at         DATETIME(3)     NOT NULL,
  completed_at       DATETIME(3)     NULL,
  created_at         DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at         DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  -- Une seule démission « pending » à la fois, dans toute l'application (NULL pour les autres statuts).
  pending_flag       TINYINT AS (CASE WHEN status = 'pending' THEN 1 ELSE NULL END) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pmo_resignations_token (token),
  UNIQUE KEY uq_pmo_resignations_one_pending (pending_flag),
  CONSTRAINT fk_pmo_resignations_resigning FOREIGN KEY (resigning_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_pmo_resignations_successor FOREIGN KEY (successor_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Configuration d'envoi (une seule ligne, id = 1). Le mot de passe d'application est chiffré (AES-256-GCM) :
-- jamais en clair en base, jamais renvoyé par l'API.
CREATE TABLE IF NOT EXISTS mail_settings (
  id            TINYINT UNSIGNED NOT NULL,
  gmail         VARCHAR(190)     NOT NULL,
  app_name      VARCHAR(100)     NOT NULL,
  password_enc  TEXT             NOT NULL,
  updated_by    BIGINT UNSIGNED  NULL,
  updated_at    DATETIME(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_mail_settings_user FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
