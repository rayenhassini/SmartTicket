# SmartTicket V1 — Package complet (base MySQL + backend NestJS)

Sous-ensemble du cœur support de l'application OPM, construit pour la nouvelle
application **SmartTicket**. Ce n'est pas un clone de l'app OPM existante : seul le
cœur ticket + équipement + contrat + user est repris.

## Contenu du package

```
SmartTicket-v1/
├── database/
│   └── smartticket_schema_v1.sql     # schéma MySQL 8 complet, prêt à exécuter
├── backend/                      # API NestJS 9 + TypeORM
│   └── README.md                 # installation / lancement détaillés
└── README-GLOBAL.md              # ce fichier
```

## Ordre de mise en route

1. **Base de données**
   ```bash
   mysql -u root -p < database/smartticket_schema_v1.sql
   ```
   Crée la base `smartticket_v1` et toutes les tables P1 (cœur) + jonctions.

2. **Backend** (Node.js 16.20+ ou 18 LTS)
   ```bash
   cd backend
   npm install
   cp .env.example .env   # renseigner DB_* et JWT_SECRET (PORT=3001 par défaut)
   npm run start:dev
   ```
   API sur `http://localhost:3001`.

3. **Créer le tout premier compte** via `POST /auth/bootstrap` (sans JWT,
   fonctionne une seule fois tant que `users` est vide — 409 sinon), puis se
   connecter via `POST /auth/login` pour obtenir un token JWT. Les comptes
   suivants se créent via `POST /users`, qui reste protégé par JWT en
   permanence. Détails et exemples `curl` dans `backend/README.md`.

## Scope fonctionnel V1

Users/rôles (STI) · Auth JWT (+ bootstrap du premier compte) · Tickets (statuts, multi-techniciens, superviseur,
liens client/contrat/site/équipement/solution) · Solutions · Equipment (hardware) ·
EquipmentSoft · Contracts (clients, techniciens, types de support) · Sites ·
TypeSupport (référentiel).

## Hors scope V1 (volontairement absent, base comme backend)

Chat/ChatMessage, Notifications, Token/JWT en table métier, File/Folder (GED),
HealthCheck, Problem, Admin séparé, HelpDesk/HelpdeskClient, Spare, Rapport,
VisiteInfogerance, Vistepreventive, Interventions, Requests, Chatbot OPM-AI,
Mongo/Mongoose. Ces éléments sont listés en détail en bas de
`database/smartticket_schema_v1.sql`.

## Prochaines étapes (hors scope de ce livrable)

- Frontend Next.js consommant cette API
- Intégration du chatbot OPM-AI
- Modules P2 (interventions, requests, admins) et P3 (spares, rapports,
  visites, helpdesk clients) une fois le P1 validé en conditions réelles
