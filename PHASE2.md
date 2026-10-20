# Phase 2 — Équipes et responsable

Socle équipes uniquement. **Non inclus** (phases suivantes) : invitations / Gmail réel, règles Strict des tickets,
archive, assignation ticket → équipe (`tickets.team_id` est reporté à la phase 5a), droits Assistant.
La Phase 1 (guards globaux, refus par défaut, relecture du compte, PMO seul…) reste intégralement active.

## 1. Changements

| Zone | Fichiers |
|---|---|
| **SQL additif** | `database/migrations/001_phase2_teams.sql` (3 tables) |
| **Backend — nouveau module** | `backend/src/teams/` : 3 entities, DTOs, `staffing.ts`, `team-notifier.service.ts` (stub), `teams.service.ts`, `teams.controller.ts`, `teams.module.ts` |
| **Backend — modifiés** | `app.module.ts` (import du module), `users/users.module.ts`, `users/users.service.ts` (voir §4) |
| **Frontend** | `lib/types.ts`, `lib/api/teams.ts`, `components/ui.tsx` (`StaffingBadge`, `LeaderMark`), `components/Shell.tsx` (entrée « Équipes », PMO seul), pages `/teams` et `/teams/[id]` |
| **Tests** | `backend/test/staffing.spec.ts`, `backend/test/teams.integration.spec.ts` (base réelle), `backend/scripts/phase2-smoke.js` |

Rien n'est supprimé : ni données, ni colonnes. ENUM existants inchangés. `supervisor_id`, `ticket_technicians` et
`users.team_leader` restent en base, dépréciés. Pas de `synchronize`.

## 2. Appliquer le SQL (manuellement, une fois)

```bash
mysql -u root -p smartticket_v1 < database/migrations/001_phase2_teams.sql
```
Le script est rejouable (`CREATE TABLE IF NOT EXISTS`). Il crée :
- `teams` (`name` unique, `leader_id` FK `users` nullable, `ON DELETE RESTRICT`)
- `team_members` (`UNIQUE(user_id)` : une seule équipe par technicien ; `joined_at DATETIME(3)` ; FK `RESTRICT`)
- `team_leader_events` (`previous_leader_id`, `new_leader_id`, `reason` ENUM `manual` / `first_member` / `auto_succession`, `acknowledged_at` réservé)

## 3. API (toutes derrière JWT + refus par défaut ; PMO sauf mention)

| Route | Effet |
|---|---|
| `POST /teams` `{name}` | Crée une équipe **vide** (`leaderId` null). 409 `TEAM_NAME_TAKEN` si le nom existe |
| `GET /teams` | Liste : `memberCount`, `staffing` (`empty`/`critical`/`warning`/`normal`), responsable |
| `GET /teams/:id` | Détail : membres (avec `isLeader`), 10 derniers événements de responsable |
| `GET /teams/technicians` | Techniciens actifs + leur équipe (`teamId` null = disponible) |
| `GET /teams/mine` | **Technicien** : sa propre équipe (sans email/téléphone des collègues, sans effectif). 404 s'il n'a pas d'équipe |
| `PATCH /teams/:id` `{name}` | Renomme |
| `DELETE /teams/:id` | Supprime, **seulement si 0 membre** (409 `TEAM_NOT_EMPTY`). Aucun lien équipe↔ticket en Phase 2 : 0 membre suffit |
| `POST /teams/:id/members` `{userId}` | Ajoute un technicien actif. 1er membre ⇒ responsable (événement `first_member`) |
| `DELETE /teams/:id/members/:userId` | Retire. Succession si c'était le responsable |
| `POST /teams/:id/members/:userId/transfer` `{targetTeamId}` | Transfère (renvoie l'équipe cible) |
| `PATCH /teams/:id/leader` `{userId}` | Désignation manuelle (le nouveau responsable doit être membre) |

Codes 409 (champ `code`) : `LAST_MEMBER`, `ALREADY_MEMBER`, `ALREADY_IN_OTHER_TEAM`, `LEADER_NOT_MEMBER`,
`TEAM_NOT_EMPTY`, `TEAM_NAME_TAKEN`, `USER_IS_TEAM_MEMBER`, `MEMBERSHIP_CHANGED`. Utilisateur non technicien ou désactivé : 400.

## 4. Règles implémentées

1. Équipe vide autorisée. 2. Premier membre (ajout ou transfert vers une équipe vide) ⇒ responsable.
3. Jamais de passage à 0 : retrait, transfert et `valid=false` refusés en **409 `LAST_MEMBER`**.
4. À 1 membre il est forcément responsable et ne peut pas être retiré tant qu'un second n'est pas ajouté.
5. Effectif : 0 gris « Vide » · 1 rouge · 2–3 orange · ≥4 normal (`staffing` dans l'API, badge dans l'UI).
6. Succession automatique : plus ancien `joined_at`, égalité → plus petit id utilisateur ; événement `auto_succession`.
7. Transfert : contrôles de la source d'abord ; `joined_at` = maintenant dans la cible ; succession dans la source si besoin ;
   cible vide ⇒ le transféré en devient responsable.
8. `valid=false` sur un membre (`PATCH /users/:id`) : retrait de `team_members` + succession + sauvegarde du compte dans la **même transaction**.
9. Suppression d'équipe : seulement à 0 membre.
10. Le responsable est toujours membre : garanti par le service, en transaction, avec verrou `SELECT … FOR UPDATE` sur les équipes concernées (ordre des ids pour éviter les deadlocks).

**Ajouts nécessaires pour tenir l'invariant (dans `users/`)** — à valider :
- `DELETE /users/:id` d'un membre → 409 `USER_IS_TEAM_MEMBER` (sinon la FK `RESTRICT` ferait une erreur 500 ou contournerait les règles d'effectif).
- `PATCH /users/:id` changeant le rôle d'un membre hors `technician` → 409 `USER_IS_TEAM_MEMBER`.

**Emails PMO : STUB.** `TeamNotifierService` écrit `[MAIL-STUB] to=… | sujet | corps` dans les logs du serveur, à destination des PMO actifs.
Un **seul message regroupé** par opération (succession + descente de palier). Envoyé **seulement à la descente de palier**
(normal→orange, orange→rouge, normal→rouge), jamais à la croissance, jamais à la création d'une équipe vide. Le remplacement par
Gmail (phase 3) ne touche que cette classe.

## 5. Tester

### Tests automatiques (base réelle)
```bash
cd backend && npm install
# Base de TEST dédiée (ces tests écrivent en base, puis nettoient leurs données) :
mysql -u root -p -e "CREATE DATABASE smartticket_test CHARACTER SET utf8mb4"
sed 's/smartticket_v1/smartticket_test/g' ../database/smartticket_schema_v1.sql | mysql -u root -p
sed 's/smartticket_v1/smartticket_test/g' ../database/migrations/001_phase2_teams.sql | mysql -u root -p
TEST_DB_NAME=smartticket_test DB_HOST=127.0.0.1 DB_USERNAME=root DB_PASSWORD=... npm test
```
Sans `TEST_DB_NAME`, les tests d'intégration sont ignorés (les tests unitaires tournent). Couvrent : équipe vide, 1er membre ⇒ responsable,
refus du passage à 0 et du retrait/transfert du seul membre, succession (ancienneté puis id), un seul message regroupé, email seulement à la descente,
transfert + `joined_at` + cible vide ⇒ responsable, `valid=false` (responsable / dernier membre), refus (non-technicien, doublon, autre équipe),
suppression d'équipe, responsable manuel, lecture « mon équipe ».

### Smoke HTTP (backend lancé, migration appliquée)
```bash
BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... npm run smoke:phase2     # 50 vérifications
BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... npm run smoke:phase1     # non-régression, 59 vérifications
```

### Interface (à la main)
`cd frontend && npm run dev`, connexion PMO → **Équipes** : créer une équipe (badge gris « Vide »), l'ouvrir, ajouter un technicien
(★ Responsable, badge rouge), en ajouter un 2e (orange) puis un 4e (vert), retirer le responsable (succession + historique),
transférer un membre vers une autre équipe. Les techniciens se créent via `POST /users` (token PMO) en attendant la page Utilisateurs (F2).
Un compte non-PMO ne voit pas l'entrée « Équipes ».

### Nettoyage des données de smoke
Une équipe non vide ne peut pas être supprimée par l'API (voir §6). Pour effacer les données créées par `smoke:phase2` :
```sql
DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE name LIKE 'smoke2-%');
DELETE FROM teams WHERE name LIKE 'smoke2-%';          -- les événements partent en cascade
DELETE FROM users WHERE email LIKE 'smoke2-%@example.com';
```

## 6. Limites et points à décider

- **Une équipe qui a eu un membre ne peut plus être supprimée via l'application.** Règle 3 (jamais 0 membre) + règle 9 (suppression à 0 membre) se bloquent :
  le dernier membre ne peut ni être retiré ni transféré. Je n'ai rien contourné (hors des règles écrites). Proposition à valider : autoriser
  `DELETE /teams/:id` sur une équipe à **1 membre**, avec confirmation explicite, ce qui libère ce technicien (« dissolution » ≠ descente à 0 d'une équipe vivante).
- **Bandeau de succession : non fait** (optionnel). L'historique est visible dans le détail de l'équipe ; la table porte déjà `acknowledged_at`
  pour un acquittement global futur (aucune route d'acquittement en Phase 2).
- **Pas d'écran « Mon équipe » pour le technicien** (la route `GET /teams/mine` existe côté API).
- **Aucune équipe n'est liée aux tickets** (phase 5a) ; techniciens existants sans équipe : à rattacher par le PMO.
- Emails : stub (voir §4). Testé sur MariaDB 10.11 ; la syntaxe SQL est standard MySQL 8.
