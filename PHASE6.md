# Phase B — Utilisateurs, Types de support, Solutions, liens de contrat, validations

Aucune migration SQL. PMO uniquement (backend `@Roles(PMO)` déjà en place + menu PMO).

| Item | Ce qui est livré |
|---|---|
| R7 Utilisateurs | Page `/users` : liste + recherche + filtres rôle/état, création (PMO, assistant, commercial, helpdesk ; techniciens et clients restent **par invitation**), modification de profil (sans mot de passe), bouton **Désactiver/Activer**, suppression avec confirmation. Garde-fou serveur : on ne peut ni se supprimer, ni se désactiver, ni changer son propre rôle (409 `SELF_ACTION_FORBIDDEN`). Les règles d'équipe (Phase 2) s'appliquent et leur 409 est affiché. |
| R8 Types de support | Page `/type-supports` (nom, email, logo en texte). Suppression d'un type lié → 409 « encore utilisé par contrat(s) ». |
| R9 Solutions | Page `/solutions` (texte, auteur, validée) ; avertissement « N ticket(s) utilisent cette solution » avant suppression. |
| R4b / R4c | Bouton **Liens** sur les contrats : clients (rôle `client` actifs) et types de support (+ identifiant chez le support). Techniciens non exposés (R18). |
| R12 | Contrat/équipement/logiciel : fin < début → 400 (création **et** PATCH, en tenant compte des valeurs déjà stockées) ; montant négatif → 400. Aussi contrôlé dans les formulaires. |
| R14 | Le formulaire ticket masque les contrats, équipements et logiciels inactifs (`valid=false`), sauf celui déjà choisi en édition. |
| R19 | `npm run smoke:admin-b` (55 contrôles) ; `smoke:admin` étendu (retrait de liens de site). |

## Corrections trouvées en route
- **Retrait de liens sans effet** : `unlinkClient` (contrats) et `unlinkEquipment` / `unlinkEquipmentSoft` (sites) comparaient `id` (chaîne, BIGINT mysql2) à un nombre avec `!==` → rien n'était retiré, y compris le bouton « Retirer » des sites livré en Phase A. Comparaison par `String()`.
- **`POST /users` renvoyait `passwordHash`** dans sa réponse : la création relit maintenant l'utilisateur (colonne `select:false`).

## Fichiers
Backend : `users/{users.controller,users.service}.ts`, `contracts/contracts.service.ts`, `sites/sites.service.ts`, `equipment/equipment.service.ts`, `equipment-softs/equipment-softs.service.ts`, `common/validators/date-range.ts` (nouveau), `scripts/admin-b-smoke.js` (nouveau), `scripts/admin-smoke.js`, `test/db-conflict.spec.ts`, `package.json`.
Frontend : `components/crud.tsx` (filtres, `canDelete`, champs `createOnly`/`password`/`email`/`textarea`, validation selon le mode), `components/Shell.tsx`, `components/TicketForm.tsx`, `lib/api/{admin,usage}.ts`, `lib/types.ts`, pages `users`, `type-supports`, `solutions`, `contracts` (liens).

## Tests
`smoke:admin-b` 55, `smoke:admin` 29, phase1 59, phase2 50, phase3 43, tech 52, client 112, Jest 31 (+30 intégration ignorés sans base dédiée) ; parcours navigateur de chaque page.
