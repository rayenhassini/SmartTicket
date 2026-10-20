# SmartTicket backend — V1

Backend NestJS 9 + TypeORM + MySQL 8 pour le cœur support de l'application **SmartTicket**.
Périmètre V1 : users (STI), auth JWT (+ bootstrap du premier compte), tickets, solutions,
equipment, equipmentsofts, contracts, sites, type-supports. Rien d'autre (voir
`README-GLOBAL.md` à la racine du package pour la liste des modules hors scope).

## Prérequis

- **Node.js 16.20+ ou 18 LTS**
- MySQL 8 (serveur accessible)
- Le script `../database/smartticket_schema_v1.sql` déjà exécuté une fois sur ce serveur

## Installation

```bash
cd backend
npm install
cp .env.example .env
# éditer .env : DB_HOST / DB_USERNAME / DB_PASSWORD / DB_NAME / JWT_SECRET
```

## Base de données

Le schéma SQL fait foi. TypeORM tourne avec `synchronize: false` et ne modifie
jamais les tables. Pour (re)créer la base :

```bash
mysql -u root -p < ../database/smartticket_schema_v1.sql
```

## Lancer le backend

```bash
npm run start:dev
```

API disponible sur `http://localhost:3001` (port configurable via `PORT` dans `.env`
— `3001` par défaut pour laisser le `3000` au futur frontend Next.js).

## Authentification — démarrage à froid

La base vient d'être créée, la table `users` est vide : `POST /users` est protégé
par JWT, donc impossible de créer un compte sans token. La route de **bootstrap**
résout ce problème à froid, une seule fois.

1. **Exécuter le SQL** (ci-dessus).
2. **Créer le tout premier compte** :
   ```bash
   curl -X POST http://localhost:3001/auth/bootstrap \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@smartticket.local",
       "password": "ChangeMe123!",
       "firstName": "Admin",
       "lastName": "SmartTicket",
       "authority": "pmo"
     }'
   ```
   - Accessible **sans JWT**.
   - Ne fonctionne **que si** la table `users` est **vide** (0 ligne). Si un
     compte existe déjà, renvoie **409 Conflict**.
   - `authority` optionnelle, bornée à `pmo` ou `assistant` (défaut : `pmo`).
   - Mot de passe hashé en **bcrypt** dans `users.password_hash`.
   - Renvoie directement `{ access_token, user }`, comme `/auth/login`.
3. **Se connecter** pour les sessions suivantes :
   ```bash
   curl -X POST http://localhost:3001/auth/login \
     -H "Content-Type: application/json" \
     -d '{ "email": "admin@smartticket.local", "password": "ChangeMe123!" }'
   ```
4. **Appeler le reste de l'API** avec le token obtenu :
   ```
   Authorization: Bearer <access_token>
   ```
   Toutes les routes sont protégées par un guard **global** (voir « Sécurité —
   Phase 1 » ci-dessous). `POST /users` reste réservé au PMO connecté ; créer les
   comptes suivants avec un token PMO.
   **Créez le premier compte en `pmo`** : en Phase 1, le rôle `assistant` n'a
   aucun droit (reporté), un premier compte `assistant` ne pourrait rien administrer.

## Sécurité — Phase 1

Socle de sécurité avant l'arrivée des équipes (phases suivantes). Aucune
fonctionnalité métier n'a été ajoutée.

**Guards globaux, refus par défaut** (`AuthModule`, `APP_GUARD`) :
1. `JwtAuthGuard` : tout exige un JWT valide, sauf les routes marquées `@Public()`
   (uniquement `POST /auth/login` et `POST /auth/bootstrap`).
2. `RolesGuard` : une route sans `@Roles(...)` est **refusée (403)**, même pour un PMO.

**Relecture du compte à chaque requête** (`JwtStrategy`) : le JWT n'identifie que
l'utilisateur. Le compte est relu en base ; supprimé ou `valid = false` → **401**
immédiat ; le rôle appliqué est celui de la base, pas celui du token.

**Rôles autorisés en Phase 1** :

| Routes | pmo | technician | client | assistant et autres |
|---|---|---|---|---|
| `/auth/login`, `/auth/bootstrap` | public | public | public | public |
| `/users`, `/tickets`, `/solutions`, `/contracts`, `/sites`, `/equipment`, `/equipment-softs`, `/type-supports`, `/teams` (lectures et écritures) | oui | **403** | **403** | **403** |
| `GET /teams/mine` (Phase 2 : sa propre équipe) | non | oui | **403** | **403** |

Les comptes `technician` et `client` peuvent se connecter mais n'accèdent à aucune
donnée tant que les phases suivantes (équipes, périmètres) ne sont pas livrées.
Pour ouvrir une route à un autre rôle plus tard : ajouter ce rôle dans le
`@Roles(...)` du contrôleur ou de la route concernée.

**Autres protections :**
- `PATCH /users`, `DELETE /users`, `POST /users` : PMO uniquement. `DELETE /tickets/:id` : PMO uniquement (suppression physique, confinée en attendant l'archivage).
- **Secret JWT** : `JWT_SECRET` obligatoire, sans valeur par défaut dans le code. En production (`NODE_ENV=production`) : 32 caractères minimum, valeurs d'exemple refusées.
- **CORS** : limité à `CORS_ORIGINS` (virgules, défaut `http://localhost:3000`). En production : obligatoire, sans `*`.
- **Rate limit** sur `POST /auth/login` et `POST /auth/bootstrap` : `LOGIN_RATE_LIMIT` requêtes (défaut 10) par fenêtre de `LOGIN_RATE_TTL` secondes (défaut 60), par IP, réponse **429**. Stockage en mémoire (une seule instance). Derrière un reverse proxy, activer `trust proxy` pour que l'IP réelle soit prise en compte.
- **Correctif** : `DELETE /tickets/:id/technicians/:userId` retire désormais bien le technicien (les ids BIGINT arrivent en string depuis MySQL).

### Tests

```bash
npm test                  # tests unitaires (guards, régression removeTechnician, effectif) ; + intégration équipes si TEST_DB_NAME (voir ../PHASE2.md)
# Avec le backend lancé sur une base réelle :
BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... npm run smoke:phase1
BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... npm run smoke:phase2   # équipes (migration 001 requise)
CHECK_RATE_LIMIT=1 ...    # ajoute le test 429 (bloque ensuite l'IP quelques secondes)
```
Le smoke test crée des comptes `smoke-…@example.com` et supprime ses tickets. Sans
`PMO_EMAIL`, il tente le bootstrap (base vide uniquement).

## Structure

Voir `README-GLOBAL.md` à la racine du package pour le plan d'architecture complet
(modules, endpoints, ordre d'implémentation).

## Ce que ce backend ne couvre pas (volontairement)

Chat, notifications, GED (files/folders), interventions, requests, spares,
rapports, visites (infogérance/préventive), helpdesk clients, admin séparé,
chatbot OPM-AI, Mongo/Mongoose. Voir le script SQL pour la liste complète des
tables exclues.
