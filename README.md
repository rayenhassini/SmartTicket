# SmartTicket

Support IT / ticketing : backend NestJS + MySQL 8, frontend Next.js.

```
SmartTicket/
├─ backend/    NestJS 9 + TypeORM (port 3001)
├─ database/   smartticket_schema_v1.sql (base smartticket_v1, 16 tables) + migrations/ (scripts additifs manuels)
└─ frontend/   Next.js 14 (port 3000) — phase F1
```

## Démarrage rapide
1. **Base** : `mysql -u root -p < database/smartticket_schema_v1.sql`, puis les migrations dans l'ordre :
   `mysql -u root -p smartticket_v1 < database/migrations/001_phase2_teams.sql`
   `mysql -u root -p smartticket_v1 < database/migrations/002_phase3_invitations.sql`
   `mysql -u root -p smartticket_v1 < database/migrations/003_ticket_team.sql`
   `mysql -u root -p smartticket_v1 < database/migrations/004_password_reset.sql`
2. **Backend** : `cd backend && cp .env.example .env` (renseigner DB + JWT), `npm install`, `npm run start:dev` → http://localhost:3001
3. **Frontend** : `cd frontend && cp .env.example .env.local`, `npm install`, `npm run dev` → http://localhost:3000
4. Ouvrir http://localhost:3000/setup pour créer le premier utilisateur, puis se connecter.

`.env.example` du frontend : `NEXT_PUBLIC_API_URL=http://localhost:3001`

Détails : `backend/README.md`, `frontend/README.md`, `README-GLOBAL.md`.

## Sécurité (Phase 1)
Le backend refuse tout par défaut ; seul le rôle **PMO** accède aux routes en Phase 1 (les comptes
technicien et client peuvent se connecter mais ne voient aucune donnée tant que les phases suivantes
ne sont pas livrées). Détails, variables (`CORS_ORIGINS`, `NODE_ENV`, `LOGIN_RATE_*`) et tests :
`backend/README.md`. Créez le premier compte en **PMO** via `/setup`.

## Phase 2 — Équipes
Équipes, responsable et règles d'effectif (PMO) : voir **`PHASE2.md`** (SQL, routes, règles, tests, limites).

## Phase 3 — Invitations technicien
Le PMO invite un technicien par email (Gmail/SMTP ou mode log en dev) ; l'invité crée son compte via un lien : voir **`PHASE3.md`** (SQL, configuration mail, routes, tests, nettoyage).

Ticket ↔ équipe et espace technicien (responsable : statuts + solution ; technicien simple : lecture) : voir **`PHASE3B.md`**.

Mot de passe oublié (jeton par email, usage unique, message neutre) : voir **`PHASE3C.md`**.
