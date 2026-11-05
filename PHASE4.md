# Phase 4 — Espace client (lecture seule)

## Règles implémentées
- **Lien ticket ↔ client** : `tickets.client_id` (existant). L'API vérifie que `clientId` est un utilisateur **actif d'authority `client`** (400 `INVALID_CLIENT` sinon), à la création et à la mise à jour.
- **Interne / externe** (champ existant `internal_task`) : un ticket **externe** (non interne, Helpdesk compris) exige un client → **409 `CLIENT_REQUIRED`** à la création, à la mise à jour et à l'assignation d'équipe. Un ticket **interne** peut n'avoir aucun client, et le PMO peut lui assigner une équipe. Les tickets externes historiques sans client ne sont pas modifiés : seule l'**assignation d'équipe** est bloquée tant qu'aucun client n'est défini (un changement de statut PMO ou une modification sans rapport avec le client/interne n'est pas bloqué).
- **Espace client** (`@Roles(CLIENT)`, **GET uniquement**) : `GET /client/tickets?status=&q=` et `GET /client/tickets/:id`. Périmètre côté serveur : `client_id` = utilisateur connecté, `internal_task = 0`, statut ≠ `Deleted`. Hors périmètre → **404**.
  - Détail (liste blanche, jamais l'entité) : `id, number, title, description, status, creationDate, resolvedDate, closedDate, siteName, solutionText, responsibleEmail`. Rien d'autre (ni superviseur, techniciens, caseId, contrat, équipement, indicateurs internes, métadonnées de la solution).
  - `responsibleEmail` = email du leader de l'équipe assignée ; `null` (affiché « **Non assigné** ») si pas d'équipe **ou** équipe sans leader.
  - Solution visible dès qu'elle est saisie (même « En cours »).
  - Filtre `status` validé (jamais `Deleted`), recherche `q` sur **numéro + titre** uniquement, jokers `%` `_` `\` échappés, 100 caractères max. Pas de pagination (comme le reste de l'app).
- **Invitations clients** (table dédiée `client_invitations`, `user_invitations` inchangée) : PMO seul crée / liste / annule ; email seul, **aucune équipe**. Jeton haché SHA-256, TTL `INVITATION_TTL_HOURS`, une seule invitation « pending » par email (contrainte en base), annulation, acceptation transactionnelle. Validate/accept publics, limités en débit par IP.
  - À l'acceptation, **obligatoires** : prénom, nom, mot de passe (≥ 8), téléphone, localisation (texte libre, longueurs max). **Facultatif** : société. Rôle `client` et `client_role = clientUser` **forcés côté serveur** (tout champ `authority`, `clientRole` ou `email` dans le corps → 400).
- **Navigation** : `homeFor(client) → /client/tickets`. `AuthGuard` : un client est confiné à `/client/*` ; le PMO et le technicien n'utilisent jamais `/client/*` (la page PMO `/client-invitations` n'en fait pas partie). Menu client : « Mes tickets » seulement.
- **Mot de passe oublié** : flux de la Phase 3C inchangé (fonctionne pour un client).
- **Formulaire ticket PMO** : champ Client **obligatoire** (marqué *) tant que « Tâche interne » est décochée ; l'API applique la même règle.
- Aucune URL en dur : liens d'invitation via `FRONTEND_URL`, CORS via `CORS_ORIGINS` (inchangés).

## Migrations (manuelles, additives, rejouables)
```
mysql -u root -p smartticket_v1 < database/migrations/005_client_invitations.sql   # table client_invitations
mysql -u root -p smartticket_v1 < database/migrations/006_user_location.sql        # users.location VARCHAR(255) NULL
mysql -u root -p smartticket_v1 < database/migrations/007_client_invitations_pending_unique.sql   # FACULTATIVE : 1 seule invitation « pending » par email, garantie par la base
```
Aucun ENUM modifié, aucune donnée touchée. Prérequis : 001 → 004 déjà appliquées. Schéma de `client_invitations` : `id CHAR(36)` (UUID généré par l'application), `email`, `token_hash`, `invited_by_user_id` et `created_user_id` en `BIGINT UNSIGNED` (comme `users.id`), `status VARCHAR(32)`, dates `DATETIME(6)`. Le code (entité, service, contrôleur, frontend) est aligné sur ce schéma.

## Routes
| Route | Rôle | Effet |
|---|---|---|
| `GET /client/tickets` (`status`, `q`) | client | ses tickets (vue restreinte) |
| `GET /client/tickets/:id` | client | détail, 404 hors périmètre |
| `POST /client-invitations` `{email}` | PMO | invite un client |
| `GET /client-invitations` (`status`) | PMO | liste |
| `POST /client-invitations/:id/cancel` | PMO | annule |
| `GET /client-invitations/validate?token=` | public | email + expiration |
| `POST /client-invitations/accept` | public | crée le compte client |
Pages : `/client/tickets`, `/client/tickets/[id]`, `/client-invitations` (PMO), `/invite/client` (public).

## Fichiers
**Créés** — `database/migrations/005_client_invitations.sql`, `006_user_location.sql` ; `backend/src/client-invitations/*` (entité, DTO, service, contrôleur, module), `backend/src/client-tickets/*`, `backend/scripts/client-smoke.js` ; frontend : `lib/api/client.ts`, `lib/api/client-invitations.ts`, `app/(app)/client/tickets/page.tsx`, `app/(app)/client/tickets/[id]/page.tsx`, `app/(app)/client-invitations/page.tsx`, `app/invite/client/page.tsx` ; `PHASE4.md`.
**Modifiés** — backend : `tickets/tickets.service.ts` (règle client/interne, validation du client), `users/entities/user.entity.ts` (`location`), `mail/mail.service.ts` (`sendClientInvitation`), `app.module.ts`, `package.json` (`smoke:client`), `test/tickets.service.spec.ts` (+5 tests), `scripts/phase1-smoke.js` et `scripts/tech-space-smoke.js` (le ticket de test sans client devient « interne »). Frontend : `lib/home.ts`, `components/AuthGuard.tsx`, `components/Shell.tsx`, `lib/types.ts`, `components/TicketForm.tsx`. READMEs.

## Retester
```
npm run build && npm start         # backend (après les migrations 005 et 006) ; frontend : npm run build && npm start
BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... \
BACKEND_LOG=/chemin/journal-backend.log \
DB_CMD="mysql -u root -pXXX smartticket_v1" npm run smoke:client      # 121 contrôles
```
(`BACKEND_LOG` : étape mot de passe oublié, mode mail « log » ; `DB_CMD` : cas d'expiration d'invitation et « ticket externe historique ». Sans eux, ces étapes sont ignorées.)
Non-régression : `npm test` (56), `smoke:phase1` (59), `smoke:phase2` (50), `smoke:phase3` (47), `smoke:tech` (52), `smoke:reset` (25).
Manuel : PMO → « Invitations clients » → email → lien (console/devLink en mode log, email en smtp) → créer le compte → se connecter → `/client/tickets`. Côté PMO, créer un ticket externe avec ce client, assigner une équipe ; le responsable saisit une solution ; le client la voit.

## Résultats (MariaDB 10.11)
Smoke client 121/121 · navigateur client 29/29 · Jest 56/56 · Phase 1 59/59 · Phase 2 50/50 · Phase 3 47/47 · espace technicien 52/52 (API) et 12/12 (navigateur) · reset 25/25 (API) et 17/17 (navigateur) · invitation technicien en navigateur OK (aussi avec session PMO ouverte).

## Nettoyage des données de test
```
DELETE FROM tickets WHERE number LIKE 'smoke6-%' OR number LIKE 'c4-%';
DELETE FROM teams WHERE name LIKE 'smoke6-%' OR name LIKE 'c4-%';             -- après les tickets
DELETE FROM users WHERE email LIKE 'smoke6-%@example.com' OR email LIKE 'c4-%@example.com';
DELETE FROM client_invitations WHERE email LIKE 'smoke6-%@example.com' OR email LIKE 'c4-%@example.com';
```

## Suivis non bloquants
- Une invitation technicien et une invitation client en attente pour le même email ne se voient pas entre elles ; la clé unique sur `users.email` garantit qu'une seule aboutit (l'autre reçoit 409 `EMAIL_ALREADY_REGISTERED`).
- Pas de pagination de la liste client ; pas de page « mon profil » ; `client_role` figé à `clientUser` (pas de clientManager).
- Les JWT déjà émis restent valides jusqu'à expiration après un changement de mot de passe (une désactivation de compte, elle, est relue en base à chaque requête).
- Un ticket externe créé avant la Phase 4 sans client reste tel quel : le PMO choisit un client via « Modifier » avant de pouvoir l'assigner à une équipe.

## Correctif — « Invitations clients : Internal server error »
**Cause** : la table `client_invitations` créée dans la base n'avait pas les colonnes attendues par le code de la première livraison (`token`, `invited_by`, `accepted_user_id`, id numérique) : `Unknown column 'ClientInvitation.invited_by'` à la lecture, `Unknown column 'token'` à l'insertion → HTTP 500 sur la liste et la création. `CREATE TABLE IF NOT EXISTS` de l'ancienne 005 ne remplaçait pas une table déjà présente.
**Correction** : le code est aligné sur la table réelle (id UUID `CHAR(36)`, `token_hash`, `invited_by_user_id`, `created_user_id`, `status` en VARCHAR, dates `DATETIME(6)`). Les relations vers `users` restent en `BIGINT UNSIGNED`. La règle « une seule invitation en attente par email » est vérifiée dans le code ; la migration 007 (facultative) la garantit aussi en base. `users.location` est conservée. Id d'invitation côté API et frontend : chaîne UUID (`POST /client-invitations/:id/cancel` valide l'UUID).
**Aucune autre modification** de l'authentification, des invitations techniciens (`user_invitations`), des tickets ou des équipes.
