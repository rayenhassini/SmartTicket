# Phase 3B — Ticket ↔ Équipe + Espace technicien

## Règles métier implémentées
- Un ticket est lié à **une équipe** (`tickets.team_id`). Le PMO assigne une équipe entière : `PATCH /tickets/:id/team {teamId}`. « Non assigné » → « Assigné » automatiquement (date d'assignation posée). Réassignation refusée (409 `TICKET_NOT_REASSIGNABLE`) si Résolu / Clôturé / Supprimé.
- Tous les membres de l'équipe voient le ticket dans **leur espace technicien** (`/my/tickets`). Un technicien hors équipe, ou sans équipe, ne le voit pas (liste filtrée côté serveur, détail → 404).
- **Responsable d'équipe** (= `teams.leader_id`), uniquement sur les tickets de son équipe : statuts `In Progress`, `On Hold`, `Resolved`, `Closed`, `Deleted` + saisie/mise à jour de la solution. Visible par l'équipe et par le PMO.
- **Technicien simple** : consultation (tickets + membres). Toute écriture → 403 `NOT_TEAM_LEADER`.
- **PMO** : inchangé (vue globale, suppression, assignation d'équipe). Un ticket « Deleted » est masqué aux techniciens, visible du PMO.
- Redirection après login : PMO → `/tickets` ; technicien (simple ou responsable) → `/my/tickets` ; autre rôle → `/no-access`. Un technicien qui ouvre une page PMO est renvoyé vers son espace (et inversement).
- Suppression d'une équipe portant des tickets : 409 `TEAM_HAS_TICKETS`.

## Migration (manuelle, rejouable, additive)
```
mysql -u root -p smartticket_v1 < database/migrations/003_ticket_team.sql
```
Les tickets existants ont `team_id = NULL` : le PMO doit leur assigner une équipe pour qu'ils apparaissent côté techniciens.

## Routes
| Route | Rôle | Effet |
|---|---|---|
| `PATCH /tickets/:id/team` | PMO | assigne l'équipe |
| `GET /me/tickets` | technicien | tickets de son équipe + `isLeader` |
| `GET /me/tickets/:id` | technicien | détail (périmètre équipe, sinon 404) |
| `PATCH /me/tickets/:id/status` | responsable | statut parmi les 5 autorisés (autre → 400) |
| `PUT /me/tickets/:id/solution` | responsable | crée/met à jour la solution liée |
| `GET /teams/mine` | technicien | membres de son équipe (existant, Phase 2) |

## Fichiers
**Créés** — `database/migrations/003_ticket_team.sql`, `backend/src/my-tickets/*` (module, controller, service, dto), `backend/src/tickets/dto/assign-team.dto.ts`, `backend/scripts/tech-space-smoke.js`, `frontend/src/lib/home.ts`, `lib/api/my.ts`, `app/no-access/page.tsx`, `app/(app)/my/{tickets,tickets/[id],team}/page.tsx`.
**Modifiés** — backend : `tickets.entity.ts`, `tickets.service.ts` (assignTeam, dates de statut), `tickets.controller.ts`, `teams.service.ts` (TEAM_HAS_TICKETS), `app.module.ts`, `main.ts` (CORS PUT), `package.json` (`smoke:tech`). Frontend : `login`, `setup`, `app/page.tsx`, `AuthGuard`, `Shell` (menu par rôle), `lib/types.ts`, `lib/api/tickets.ts`, `lib/api-client.ts` (PUT), pages PMO `tickets` (colonne Équipe), `tickets/[id]` (bloc « Équipe assignée »), `TicketForm` (plus de sélection de technicien).

## Retester
```
cd backend && npm run build && npm start      # + frontend : npm run build && npm start
BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... npm run smoke:tech      # 52 contrôles
npm test ; npm run smoke:phase1 ; npm run smoke:phase2 ; npm run smoke:phase3
```
UI : invitez un technicien (PMO → Invitations), acceptez, connectez-vous → `/my/tickets` sans menu PMO ; en PMO, ouvrez un ticket → « Assigner l'équipe » ; le responsable voit solution + « Changer le statut », le technicien simple est en lecture seule.

## Résultats (MariaDB 10.11)
Smoke tech 52/52 · Phase 1 59/59 · Phase 2 50/50 · Phase 3 47/47 · Jest 50/50 · parcours navigateur (PMO assigne, responsable, simple, hors équipe, PMO relit, invitation→login) OK.

## Nettoyage des données de smoke
```
DELETE FROM tickets WHERE number LIKE 'smoke4-%' OR number LIKE 'ui-%';
DELETE FROM teams WHERE name LIKE 'smoke4-%' OR name LIKE 'ui-%';   -- après suppression des tickets
DELETE FROM users WHERE email LIKE 'smoke4-%@example.com' OR email LIKE 'ui-%@example.com';
```

## Limites
- Pas de règles de transition entre statuts (le responsable choisit parmi les 5).
- Routes historiques `POST/DELETE /tickets/:id/technicians` et `supervisor` conservées (Phase 1) mais retirées de l'UI PMO.
- Pas de notification au PMO quand un ticket est résolu (il le voit en consultant le ticket).
- Une équipe ayant des tickets ne peut pas être supprimée ; décision Phase 2 sur la dissolution d'équipe toujours en attente.

## Correctif — redirection après invitation (session déjà ouverte dans le navigateur)
**Cause** : si une session existait déjà dans le même navigateur (typiquement le PMO qui ouvre lui-même le lien d'invitation), la session restait en mémoire après la création du compte ; la page de login redirigeait alors vers l'espace de cette session (`/tickets`, PMO). Le backend était correct (`accept` force `authority = technician`, le login renvoie l'`authority` lue en base).
**Correction (frontend uniquement)** : `app/invite/accept/page.tsx` ferme toute session existante après création du compte ; `app/login/page.tsx` repart d'une session vide quand l'URL contient `?invited=1`, ne redirige pas automatiquement dans ce cas, puis redirige d'après l'`authority` de la réponse du login (`homeFor`).
**Sécurité (vérifié dans le code)** : le login n'offre aucun choix de rôle ; le rôle vient uniquement du compte en base ; l'invitation crée toujours un technicien ; `/auth/bootstrap` est refusé dès qu'un utilisateur existe.
**Test manuel** : connecté en PMO, ouvrez le lien d'invitation dans le même navigateur → créez le compte → login avec le nouvel email → URL `/my/tickets`, menu sans Utilisateurs/Invitations/Contrats.
**Mot de passe oublié** : non implémenté (hors périmètre de ce correctif) ; à prévoir en phase suivante (jeton par email, même mécanisme que les invitations).
