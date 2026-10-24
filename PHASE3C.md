# Phase 3C — Mot de passe oublié

## Fonctionnement
1. `/login` → lien « Mot de passe oublié ? » → `/forgot-password` (email).
2. `POST /auth/forgot-password {email}` répond **toujours** le même message 200 (« Si un compte existe pour cet email… »), que le compte existe ou non. Si le compte existe et est actif : un jeton est créé (hash SHA-256 en base, TTL 1 h par défaut) et un email part avec `{FRONTEND_URL}/reset-password?token=…` (même `MailService` / `MAIL_*` que les invitations). L'envoi n'est pas attendu (temps de réponse identique) ; une erreur d'envoi est seulement journalisée.
3. `/reset-password?token=…` : nouveau mot de passe + confirmation. **Aucun champ de rôle, de nom ou d'email** ; l'API refuse tout champ en trop (400) et ne modifie que `users.password_hash`.
4. `POST /auth/reset-password {token, password, passwordConfirm}` : succès → `/login?reset=1` avec « Mot de passe mis à jour ». Le login redirige ensuite d'après l'`authority` en base (technicien → `/my/tickets`, PMO → `/tickets`). Aucun sélecteur de rôle sur `/login`.

## Règles de sécurité
- Jeton à usage unique, expirant (`PASSWORD_RESET_TTL_MINUTES`, défaut 60), stocké haché ; un seul jeton actif par compte (une nouvelle demande invalide l'ancien) ; verrou de ligne en transaction (deux usages simultanés impossibles).
- Erreurs claires : 404 `RESET_TOKEN_INVALID`, 410 `RESET_TOKEN_USED` (utilisé ou remplacé), 410 `RESET_TOKEN_EXPIRED`, 400 `PASSWORD_MISMATCH`.
- Anti-abus : rate limit par IP (même `ThrottlerGuard` que le login : `LOGIN_RATE_LIMIT` / `LOGIN_RATE_TTL`, 10/min par défaut) + au plus un email par compte toutes les 60 s.
- Comptes désactivés (`valid = false`) : aucun email, aucun reset possible.
- Côté navigateur, une session déjà ouverte est fermée à la fin du reset (comme pour l'invitation).
- En mode mail `log` (dev), le lien n'est **pas** renvoyé par l'API (ce serait une fuite d'existence du compte) : il est écrit dans la console du backend (`[MAIL-LOG] … Lien de réinitialisation : …`).

## Migration (manuelle, additive, rejouable)
```
mysql -u root -p smartticket_v1 < database/migrations/004_password_reset.sql
```
Nouvelle variable facultative : `PASSWORD_RESET_TTL_MINUTES` (5 à 1440, défaut 60).

## Fichiers
**Créés** — `database/migrations/004_password_reset.sql`, `backend/src/password-reset/{entities/password-reset-token.entity.ts, dto/password-reset.dto.ts, password-reset.service.ts, password-reset.controller.ts, password-reset.module.ts}`, `backend/scripts/password-reset-smoke.js`, `frontend/src/app/forgot-password/page.tsx`, `frontend/src/app/reset-password/page.tsx`.
**Modifiés** — `backend/src/mail/mail.service.ts` (`sendPasswordReset`), `app.module.ts`, `config/configuration.ts`, `config/validation.schema.ts`, `.env.example`, `package.json` (`smoke:reset`), `test/mail.spec.ts`, `frontend/src/lib/api/auth.ts`, `frontend/src/app/login/page.tsx` (lien + message `?reset=1`).

## Retester
```
BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... \
BACKEND_LOG=/chemin/vers/journal-backend.log \
DB_CMD="mysql -u root -pXXX smartticket_v1" npm run smoke:reset
```
(`BACKEND_LOG` : sortie console du backend en mode log ; `DB_CMD` facultatif : active les tests d'expiration, de remplacement et d'anti-spam.)
Manuel : `/login` → « Mot de passe oublié ? » → saisir l'email → copier le lien depuis l'email (ou la console en mode log) → nouveau mot de passe → connexion.

## Résultats (MariaDB 10.11)
Smoke reset 25/25 · navigateur 17/17 (technicien et PMO, lien réutilisé, session ouverte dans le même navigateur) · Jest 51/51 · non-régression : Phase 1 59/59, Phase 2 50/50, Phase 3 47/47, espace technicien 52/52, flux invitation en navigateur OK.

## Nettoyage des données de test
```
DELETE FROM users WHERE email LIKE 'smoke5-%@example.com' OR email LIKE 'rs-%@example.com';  -- les jetons partent en cascade
```

## Limites
- Les JWT déjà émis restent valides jusqu'à leur expiration après un reset (pas de révocation de session en base) ; à traiter avec une « version de session » si besoin.
- Pas de « changer mon mot de passe » une fois connecté (hors périmètre).
- Rate limit par IP en mémoire (une instance) comme le login.
