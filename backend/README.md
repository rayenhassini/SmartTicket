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
   Toutes les routes métier (`/users`, `/tickets`, `/contracts`, ...) restent
   protégées par `JwtAuthGuard` — `POST /users` reste donc protégé en permanence
   après le bootstrap initial ; créer les comptes suivants via `POST /users`
   avec un token valide.

## CORS

`enableCors()` est activé sans restriction pour le développement V1. Pour un
futur frontend Next.js tournant sur `http://localhost:3000`, restreindre
`origin` à cette URL avant mise en production.

## Structure

Voir `README-GLOBAL.md` à la racine du package pour le plan d'architecture complet
(modules, endpoints, ordre d'implémentation).

## Ce que ce backend ne couvre pas (volontairement)

Chat, notifications, GED (files/folders), interventions, requests, spares,
rapports, visites (infogérance/préventive), helpdesk clients, admin séparé,
chatbot OPM-AI, Mongo/Mongoose. Voir le script SQL pour la liste complète des
tables exclues.
