# Phase A — Administration des données de référence (Sites, Contrats, Équipements, Logiciels)

Aucune migration SQL. Aucune règle métier modifiée : le backend gagne seulement un **mapping d'erreurs SQL**.

## Backend (R10 / R11)
- `src/common/filters/db-conflict.filter.ts` — filtre global (`APP_FILTER`) limité aux `QueryFailedError` :
  - `ER_DUP_ENTRY` → **409** `DUPLICATE_ENTRY` (« Ce numéro de série (« X ») existe déjà… », idem identifiant de contrat, email) ;
  - `ER_ROW_IS_REFERENCED_2` → **409** `REFERENCED_BY_OTHER_RECORDS` (« …encore utilisé par … ») ;
  - `ER_NO_REFERENCED_ROW_2` → **400** `REFERENCE_NOT_FOUND` (ex. `commercialId` inexistant, avant : 500) ;
  - toute autre erreur SQL → 500 inchangé.
- `src/app.module.ts` — enregistre le filtre.

## Frontend
- `components/crud.tsx` (R2) — `CrudPage` configurable : tableau + recherche, formulaire modal créer/modifier, confirmation de suppression avec avertissement, affichage des messages d'erreur API (409 inclus).
- `lib/api/admin.ts` — appels CRUD + liens site↔équipement/logiciel. `lib/api/usage.ts` — nombre de tickets rattachés (avertissement de suppression).
- Pages PMO : `/sites` (avec panneau « Liens »), `/contracts` (champs de base, ENUM type/nature, commercial), `/equipment`, `/equipment-softs`.
- `components/Shell.tsx` — 4 entrées activées ; Utilisateurs, Solutions, Types de support restent « bientôt ».
- `lib/types.ts` — champs complets (optionnels) des 4 entités.

## Comportements à connaître
- Les FK des tickets vers site/contrat/équipement/logiciel sont `ON DELETE SET NULL` : **supprimer ne bloque jamais**, les tickets sont conservés mais détachés. La confirmation affiche « N ticket(s) seront détachés ».
- Une suppression bloquée par FK (409) n'est reproductible que sur les types de support (hors Phase A) ; le mapping est testé en unitaire.
- Liaison site↔équipement en double : 409 propre (ou ignorée), jamais 500.
- Effacer le commercial d'un contrat n'est pas possible via l'API actuelle (hors périmètre : on ne change pas la règle métier).

## Tests
- `npm run smoke:admin` (25 contrôles API) ; `test/db-conflict.spec.ts` (5 tests unitaires).
- Non-régression : smoke phase1 (59), phase2 (50), tech (52), client (112 sans options), Jest 31 passés.

## Correctif email (invitations « Mode développement »)
- Cause : le backend n'est en mode `log` que si `mail.mode !== 'smtp'` (`src/mail/mail.service.ts`, getter `mode`, alimenté par `src/config/configuration.ts` : `process.env.MAIL_MODE ?? …`). Avec `MAIL_MODE=smtp` lu, l'envoi SMTP réel est utilisé (vérifié). Le message de l'interface n'apparaît que si l'API renvoie `mailMode: "log"`. Causes réelles possibles : une variable d'environnement système `MAIL_MODE=log` (dotenv n'écrase jamais l'environnement), un backend non redémarré après modification du `.env`, ou un `.env` introuvable (serveur lancé hors de `backend/`).
- Ajouts : `.env` aussi cherché à côté de `backend/` (`app.module.ts`) ; journal de démarrage « Mode email : SMTP actif / LOG » avec avertissement explicite si l'environnement écrase le `.env` ; échec SMTP → 502 `MAIL_SEND_FAILED` avec la cause (ex. `EAUTH`), sans invitation créée.
