# Phase B+ — Utilisateurs métier, succession PMO, configuration mail

Migration à appliquer : `database/migrations/008_pmo_succession_mail_settings.sql` (additive, rejouable : tables `pmo_resignations`, `mail_settings`).

## Règles métier appliquées (backend = source de vérité)
- **Un seul PMO actif.** Refusé en 409 `PMO_ALREADY_EXISTS` : `POST /users` avec `authority=pmo`, promotion en PMO par `PATCH /users`, réactivation d'un ancien compte PMO. Seule la succession crée un nouveau PMO.
- **Techniciens et clients : par invitation uniquement** (`/invitations`, `/client-invitations`). `POST /users` répond 403 `DIRECT_USER_CREATION_DISABLED` sauf si `ALLOW_DIRECT_USER_CREATION=true` (jeux de données des smokes ; refusé en production par la validation de config).
- **Le PMO ne peut ni se supprimer, ni se désactiver, ni changer son rôle** (409 `SELF_ACTION_FORBIDDEN`).

## Page `/users`
Liste, recherche, filtres (rôle : PMO / Technicien / Client / Anciens rôles ; état), modification du profil (prénom, nom, email, téléphone, société, actif), Activer/Désactiver, Supprimer (confirmation). **Plus de bouton « Nouvel utilisateur », aucun mot de passe, rôle non modifiable ici** (il vient du canal de création). Les anciens rôles (assistant, commercial, helpdesk) ne sont plus proposés ; les comptes existants restent affichés (« … (ancien) ») et modifiables sans changement de rôle.
Carte **Succession PMO** (PMO uniquement) : « Démissionner… », état de la démission en cours, « Annuler la démission ».

## Succession PMO — états : none → pending → completed | cancelled | expired
1. `POST /pmo/resignation {successorEmail}` : une seule démission `pending` à la fois (index unique en base) ; email du successeur sans compte existant ; jeton aléatoire, **seul le hash SHA-256 est stocké** ; durée `PMO_SUCCESSION_TTL_HOURS` (**72 h** par défaut) ; email envoyé par le service mail existant (échec d'envoi → 502 et aucune démission enregistrée). Le PMO reste PMO.
2. `GET /pmo/resignation` (état), `POST /pmo/resignation/cancel` (invalide le lien, permet une nouvelle démission). Une démission expirée libère la place automatiquement.
3. Lien `{FRONTEND_URL}/pmo/accept?token=…` : page publique, **email imposé par l'invitation** (le corps n'accepte ni `email` ni `authority` : 400), mot de passe + profil.
4. `POST /pmo/succession/accept` — **une seule transaction**, verrous sur la démission et l'ancien PMO : création du nouveau compte `pmo` actif, ancien PMO → **rôle `technician` + compte désactivé**, démission `completed`. Rejeu → 410 `SUCCESSION_USED`.
- **Sort de l'ancien PMO (choix simple et sûr)** : désactivé et rétrogradé. Aucun privilège conservé ; ses jetons sont refusés immédiatement (le JWT est relu en base à chaque requête). Un nouveau PMO peut le réactiver comme technicien (jamais comme PMO).
- **Premier PMO** : `/setup` inchangé (uniquement si la base est vide), sans choix de rôle.

## Configuration mail (sans toucher au `.env`)
- Page **Paramètres mail** (PMO) ; ouverte automatiquement après `/setup` et après l'acceptation d'une succession (`?welcome=1`, « Passer pour l'instant » possible).
- Champs : Gmail d'envoi, nom de l'application, mot de passe d'application (16 caractères, espaces ignorés) ; lien `https://myaccount.google.com/apppasswords` en nouvel onglet ; bouton « Envoyer un email de test » (à l'adresse du PMO connecté).
- **Stockage en base** (table `mail_settings`, une ligne) : mot de passe chiffré **AES-256-GCM** (clé dérivée de `SETTINGS_ENCRYPTION_KEY`, sinon `JWT_SECRET` ; si elle change, ressaisir la config). **Jamais renvoyé** par l'API (`hasPassword` seulement), jamais journalisé, champ vidé après enregistrement.
- Le successeur **remplace** la configuration précédente par la sienne.
- Priorité du mailer : configuration en base → variables `MAIL_*` du `.env` → mode log. Hôte/port SMTP : `MAIL_HOST`/`MAIL_PORT`/`MAIL_SECURE` (défaut Gmail 465/SSL). Le journal de démarrage indique la source active. Échec d'envoi : erreur 502 claire (`MAIL_SEND_FAILED` + cause), jamais de faux succès.

## Tester
Backend lancé avec `ALLOW_DIRECT_USER_CREATION=true`, et `MAIL_MODE=log` (lien renvoyé par l'API) ou un SMTP factice (`node scripts/fake-smtp.js`, `FAKE_SMTP_OUT=fichier`, backend avec `MAIL_HOST=127.0.0.1 MAIL_PORT=2525 MAIL_SECURE=false`).
```
npm run smoke:phase1        # 61 (second PMO refusé)
npm run smoke:pmo           # 48 — DB_CMD="mariadb … smartticket_v1" requis pour l'expiration et la restauration du PMO de test
npm run smoke:mail-settings # 20 — secret jamais renvoyé, chiffré en base, envoi réel via config en base
```
Checklist navigateur :
1. `/users` : aucun « Nouvel utilisateur » ; édition sans mot de passe ni rôle ; votre ligne sans Désactiver, Supprimer grisé.
2. Carte « Succession PMO » → Démissionner (email d'un autre) → « Démission en cours » ; « Annuler la démission » → retour à l'état initial ; relancer.
3. Ouvrir le lien reçu dans un autre navigateur : email verrouillé ; créer le compte → connexion automatique → « Paramètres mail ». Dans `/users` : un seul PMO actif ; l'ancien est Technicien + Inactif ; l'ancien navigateur est renvoyé au login.
4. Paramètres mail : enregistrer, puis « Envoyer un email de test » (avec un vrai Gmail : mot de passe d'application généré sur le lien Google).

## Limites
- L'envoi vers le vrai Gmail n'a pas pu être vérifié ici (testé contre un SMTP local) : le test réel se fait avec « Envoyer un email de test ».
- Si le PMO d'origine n'est jamais remplacé, rien ne change : la démission est optionnelle.
