-- SmartTicket — remise à zéro des DONNÉES (schéma, migrations et code inchangés).
-- Rejouable. Vide toutes les tables (users compris) et remet les AUTO_INCREMENT à 1.
-- Après exécution : base vide -> /setup permet de recréer le premier PMO.
-- ATTENTION : irréversible. Faire une sauvegarde avant si nécessaire.
SET @OLD_FK = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE pmo_resignations;
TRUNCATE TABLE mail_settings;
TRUNCATE TABLE password_reset_tokens;
TRUNCATE TABLE client_invitations;
TRUNCATE TABLE user_invitations;
TRUNCATE TABLE ticket_technicians;
TRUNCATE TABLE tickets;
TRUNCATE TABLE team_leader_events;
TRUNCATE TABLE team_members;
TRUNCATE TABLE teams;
TRUNCATE TABLE contract_clients;
TRUNCATE TABLE contract_technicians;
TRUNCATE TABLE contract_type_supports;
TRUNCATE TABLE contracts;
TRUNCATE TABLE site_equipment;
TRUNCATE TABLE site_equipmentsoft;
TRUNCATE TABLE equipment_type_supports;
TRUNCATE TABLE equipmentsoft_type_supports;
TRUNCATE TABLE equipmentsofts;
TRUNCATE TABLE equipment;
TRUNCATE TABLE sites;
TRUNCATE TABLE solutions;
TRUNCATE TABLE type_supports;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = @OLD_FK;

-- Vérification : toutes les valeurs doivent être 0.
SELECT 'users' t, COUNT(*) n FROM users UNION ALL SELECT 'tickets', COUNT(*) FROM tickets
UNION ALL SELECT 'teams', COUNT(*) FROM teams UNION ALL SELECT 'contracts', COUNT(*) FROM contracts
UNION ALL SELECT 'sites', COUNT(*) FROM sites UNION ALL SELECT 'invitations', COUNT(*) FROM user_invitations
UNION ALL SELECT 'client_invitations', COUNT(*) FROM client_invitations
UNION ALL SELECT 'mail_settings', COUNT(*) FROM mail_settings UNION ALL SELECT 'pmo_resignations', COUNT(*) FROM pmo_resignations;
