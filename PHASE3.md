# Phase 3 — Invitations technicien + email

Périmètre : le PMO invite un **technicien** par email en le rattachant à une **équipe** ; l'invité crée son
compte via un lien. Phase 1 (sécurité) et Phase 2 (équipes, effectif, succession) sont inchangées.
**Hors périmètre** (non touché) : invitation Client, règles « Strict », archivage, `tickets.team_id`,
Assistant, mot de passe oublié (OTP), alerte email d'effectif de la Phase 2 (reste un stub `[MAIL-STUB]`).

## 1. Changements
| Zone | Fichiers |
|---|---|
| SQL (additif) | `database/migrations/002_phase3_invitations.sql` → table `user_invitations` |
| Mail | `backend/src/mail/` (`MailService` : mode `smtp` via nodemailer, ou mode `log`) |
| Invitations | `backend/src/invitations/` (entité, DTOs, service, contrôleur, module) |
| Phase 2 (refactor minimal) | `teams/teams.service.ts` : le cœur de `addMember` est extrait en `addMemberWithin(manager, teamId, userId)` — **mêmes règles**, réutilisées par l'acceptation dans sa transaction |
| Config | `config/configuration.ts`, `validation.schema.ts`, `.env.example`, `auth.module.ts` (exporte `ThrottlerModule`), `app.module.ts`, `package.json` (nodemailer ; `smtp-server` en dev) |
| Tests | `test/mail.spec.ts`, `test/invitations.integration.spec.ts`, `scripts/phase3-smoke.js`, `scripts/fake-smtp.js` |
| Frontend | `/invitations` (PMO), `/invite/accept?token=…` (publique), entrée de menu « Invitations » (PMO), bandeau sur `/login` après création |

## 2. Appliquer le SQL (manuellement, une fois)
Prérequis : migration 001 (table `teams`).
```bash
mysql -u root -p smartticket_v1 < database/migrations/002_phase3_invitations.sql
```
Additif : crée une table, ne modifie aucune donnée ni table existante, rejouable (`IF NOT EXISTS`). Aucun `synchronize`.

`user_invitations` : `email`, `token` (**hash SHA-256**, unique — le jeton en clair n'existe que dans le lien du mail),
`authority` (`technician` seulement), `team_id` (FK `teams`, obligatoire), `status` (`pending/accepted/expired/cancelled`),
`invited_by` (FK `users`), `accepted_user_id`, `expires_at`, `accepted_at`, `created_at`, `updated_at`.
Une colonne générée + index UNIQUE interdit **au niveau de la base** deux invitations `pending` pour un même email.
FK : `team_id` ON DELETE CASCADE (supprimer une équipe vide supprime ses invitations) ; `invited_by` et `accepted_user_id` ON DELETE SET NULL.

## 3. Configuration email (`backend/.env`)
| Variable | Rôle | Défaut |
|---|---|---|
| `FRONTEND_URL` | base du lien `…/invite/accept?token=…` (obligatoire en production) | `http://localhost:3000` |
| `INVITATION_TTL_HOURS` | validité d'une invitation | `72` |
| `MAIL_MODE` | `smtp` (envoi réel) ou `log` (lien affiché dans la console). Absent : `smtp` si `MAIL_USER` et `MAIL_PASSWORD` sont renseignés, sinon `log`. **Production : `smtp` obligatoire** (démarrage refusé sinon) | auto |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_SECURE` | serveur SMTP (secure = TLS implicite, défaut vrai si port 465 ; 587 = STARTTLS) | `smtp.gmail.com` / `465` |
| `MAIL_USER` / `MAIL_PASSWORD` | identifiants SMTP | vides |
| `MAIL_FROM` | expéditeur ; doit être une adresse valide (défaut : `SmartTicket <MAIL_USER>`) | — |

**Gmail** : activer la validation en 2 étapes, créer un *mot de passe d'application* (https://myaccount.google.com/apppasswords),
puis `MAIL_USER=vous@gmail.com`, `MAIL_PASSWORD=<mot de passe d'application>` (jamais le mot de passe du compte). Ne commitez jamais `.env`.

**Mode log (dev)** : sans identifiants, le backend écrit `[MAIL-LOG] … Lien d'invitation : http://…` dans la console et la réponse de
`POST /invitations` contient `devLink` (affiché dans l'écran PMO). `devLink` n'est **jamais** renvoyé en mode `smtp`.
Si l'envoi SMTP échoue : 502 `MAIL_SEND_FAILED` et l'invitation créée est supprimée (pas de lien « pending » que personne n'a reçu).

## 4. API
| Route | Accès | Rôle |
|---|---|---|
| `POST /invitations` `{email, teamId}` | **PMO** | crée + envoie ; 404 équipe, 409 `EMAIL_ALREADY_REGISTERED`, 409 `INVITATION_ALREADY_PENDING`, 502 `MAIL_SEND_FAILED` |
| `GET /invitations?status=` | **PMO** | liste (une `pending` échue est affichée `expired`) |
| `POST /invitations/:id/cancel` | **PMO** | annule ; 409 `INVITATION_NOT_PENDING` si déjà acceptée/annulée/expirée |
| `GET /invitations/validate?token=` | **public** (rate limit) | renvoie `{email, teamName, expiresAt}` uniquement |
| `POST /invitations/accept` `{token, firstName, lastName, password(≥8), phoneNumber?}` | **public** (rate limit) | crée le compte |

Refus de jeton : 404 `INVITATION_INVALID` (inconnu) ; 410 `INVITATION_USED`, `INVITATION_CANCELLED`, `INVITATION_EXPIRED`.
Le rate limit est celui du login (`LOGIN_RATE_LIMIT` / `LOGIN_RATE_TTL`, par IP). Email, rôle et équipe viennent de l'invitation, jamais du corps de la requête (`authority` dans le corps → 400).

## 5. Règles implémentées
1. Seul le PMO crée, liste et annule (guards globaux Phase 1 : technicien/client → 403, sans token → 401).
2. L'équipe est obligatoire et doit exister.
3. À l'acceptation, **dans une seule transaction** (invitation verrouillée) : création du compte `technician` `valid=true` (bcrypt), ajout à `team_members`
   via `TeamsService.addMemberWithin` (verrou d'équipe, `UNIQUE(user_id)`, **équipe vide → premier membre = responsable**, événement `first_member`),
   invitation marquée `accepted`. Deux clics simultanés sur le lien : un seul réussit.
4. Les règles d'effectif de la Phase 2 sont celles de `TeamsService` (aucune copie, aucun contournement).
5. Jeton inconnu / expiré / utilisé / annulé : refus clair (voir §4). L'expiration est évaluée à la lecture (un ancien « pending » échu libère l'email).
6. Email déjà inscrit : 409, à la création **et** à l'acceptation (compte créé entre-temps ; aucune écriture n'est faite).
7. Le nouveau technicien n'a **aucun accès aux tickets** (deny-by-default de la Phase 1 inchangé) ; il peut voir `GET /teams/mine`.

## 6. Tester
### Automatiques
```bash
cd backend && npm test                      # unitaires + mail.spec (vrai envoi SMTP vers un serveur local factice)
# + intégration sur base de TEST (migrations 001 et 002 appliquées sur cette base) :
sed 's/smartticket_v1/smartticket_test/g' ../database/migrations/002_phase3_invitations.sql | mysql -u root -p
TEST_DB_NAME=smartticket_test DB_HOST=127.0.0.1 DB_USERNAME=root DB_PASSWORD=... npm test
```
### Smoke HTTP (backend lancé, migrations 001 + 002 appliquées)
```bash
# Mode log (défaut dev) — aucun Gmail nécessaire
BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... npm run smoke:phase3
# avec l'étape « jeton expiré » : ajouter DB_HOST DB_PORT DB_USERNAME DB_PASSWORD DB_NAME (sinon elle est ignorée)
```
Les routes publiques sont limitées en débit (10 requêtes/min/IP par défaut) : attendre une minute entre deux exécutions ou relever `LOGIN_RATE_LIMIT`.

**Chemin d'envoi réel sans Gmail** (serveur SMTP local factice) :
```bash
FAKE_SMTP_OUT=/tmp/mails.jsonl node scripts/fake-smtp.js &       # écoute sur 127.0.0.1:2525
MAIL_MODE=smtp MAIL_HOST=127.0.0.1 MAIL_PORT=2525 MAIL_SECURE=false MAIL_USER=dev MAIL_PASSWORD=dev MAIL_FROM='SmartTicket <dev@example.com>' npm run start:dev
FAKE_SMTP_OUT=/tmp/mails.jsonl npm run smoke:phase3              # le lien est lu dans le mail reçu
```
### Interface (à la main)
1. Connecté en PMO : menu **Invitations** → saisir un email, **choisir une équipe**, « Inviter ». En mode log, le lien s'affiche dans le bandeau vert.
2. Ouvrir le lien dans une fenêtre privée : formulaire (email en lecture seule) → créer le compte → redirection vers `/login` avec le bandeau « Compte créé ».
3. Se connecter avec le nouveau compte : pas d'entrée « Équipes » ni « Invitations ». Côté PMO, `/teams/<id>` : le technicien est membre (★ responsable si l'équipe était vide) ; l'invitation passe à « Acceptée ».
4. Réouvrir le lien : « Cette invitation a déjà été utilisée ». Annuler une invitation en attente : son lien affiche « annulée ».

### Nettoyage des données de smoke
```sql
DELETE FROM user_invitations WHERE email LIKE 'smoke3-%@example.com' OR team_id IN (SELECT id FROM teams WHERE name LIKE 'smoke3-%');
DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE name LIKE 'smoke3-%');
DELETE FROM teams WHERE name LIKE 'smoke3-%';
DELETE FROM users WHERE email LIKE 'smoke3-%@example.com';
```

## 7. Limites et points à décider
- Pas de route « renvoyer l'invitation » : annuler puis ré-inviter (un nouveau lien est généré).
- Un seul rôle invitable (technicien) : l'invitation Client est la Phase 4.
- Les invitations suivent leur équipe : supprimer une équipe supprime ses invitations (CASCADE).
- L'état **pending échu** est évalué à la lecture ; il n'y a pas de tâche de fond qui le fige en `expired` (sans effet fonctionnel).
- Validé sur **MariaDB 10.11** ; la colonne générée `STORED` est aussi supportée par MySQL 8, mais non testée ici.
- Non testé : l'envoi réel vers Gmail (pas d'accès réseau SMTP ici). Le même code est exercé contre un serveur SMTP local ; seuls l'hôte et les identifiants changent.
- Point Phase 2 toujours en attente de décision : une équipe ayant eu un membre ne peut pas être supprimée (voir `PHASE2.md` §6).
