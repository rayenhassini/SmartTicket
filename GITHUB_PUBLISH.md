# Publier / récupérer la version « phase-prete »

Dépôt : https://github.com/rayenhassini/SmartTicket — l'historique existant (branche `main`, tags `phase-2`, `phase-3`, `v0.2-backend-complete`) est **conservé** : on pousse une **nouvelle branche** `phase-prete`, jamais de force-push.

## A. Analyse (à lancer dans le dossier du projet, CMD ou Git Bash)
```bat
cd /d C:\Users\Rayen\OneDrive\Desktop\SmartTicket\SmartTicket
git --version
git status
git remote -v
git branch --show-current
git log --oneline -3
```
Lecture :
- « fatal: not a git repository » → pas un dépôt : suivre le **cas 2**.
- Un dépôt avec `origin ... rayenhassini/SmartTicket` → **cas 1**.
- Un dépôt sans `origin`, ou avec un autre remote → `git remote add origin …` / `git remote set-url origin https://github.com/rayenhassini/SmartTicket.git`.
Vérifier le `.gitignore` : il doit contenir `node_modules/`, `.next/`, `dist/`, `.env`, `.env.*` (le fichier fourni dans le ZIP convient).

## B. Étapes (copier-coller)
**0. Identité git (une fois)**
```bat
git config --global user.name "Rayen Hassini"
git config --global user.email "hassiniirayen@gmail.com"
```
**1. Sécuriser** : remplacer `.gitignore`, `README.md` et ajouter `GITHUB_PUBLISH.md` par ceux du ZIP SmartTicket.zip (même racine). Les `.env.example` (backend et frontend) ne contiennent que des valeurs factices.

**2. Contrôle avant tout commit : aucun secret suivi**
```bat
git check-ignore -v backend\.env frontend\.env.local
```
(doit afficher la règle `.gitignore` qui les exclut ; s'ils n'existent pas, tant mieux.)

### Cas 1 — le dossier est déjà un clone de rayenhassini/SmartTicket
```bat
git fetch origin --tags
git checkout -b phase-prete
git add -A
git status
```
Relire `git status` : **aucune** ligne `.env`, `node_modules`, `.next`, `dist`. Puis :
```bat
git commit -m "phase-prete: version complete (Phases A, B, B+, perf navigation, UI Bootstrap)"
git push -u origin phase-prete
```
### Cas 2 — dossier non-git (ou historique différent) : méthode sûre
On part d'un clone neuf (historique GitHub intact) et on y copie la version actuelle.
```bat
cd /d C:\Users\Rayen\OneDrive\Desktop
git clone https://github.com/rayenhassini/SmartTicket.git SmartTicket-publish
cd SmartTicket-publish
git checkout -b phase-prete
```
Copier le projet actuel **sans** les dossiers lourds ni les secrets (robocopy ne copie ni `.env`, ni node_modules, ni .next, ni dist, ni `.git`) :
```bat
robocopy "C:\Users\Rayen\OneDrive\Desktop\SmartTicket\SmartTicket" "C:\Users\Rayen\OneDrive\Desktop\SmartTicket-publish" /E /XD node_modules .next dist .git coverage /XF .env .env.local .env.development.local .env.production.local *.log *.tsbuildinfo next-env.d.ts
```
(un code retour robocopy < 8 = succès.) Remplacer ensuite `.gitignore` par celui fourni si besoin, puis :
```bat
git add -A
git status
git commit -m "phase-prete: version complete (Phases A, B, B+, perf navigation, UI Bootstrap)"
git push -u origin phase-prete
```
Les fichiers supprimés depuis `main` apparaîtront « deleted » : normal, c'est la version actuelle.

**3. Tag (recommandé)**
```bat
git tag -a v-phase-prete -m "Version phase prete"
git push origin v-phase-prete
```
**4. Vérifier sur GitHub**
- https://github.com/rayenhassini/SmartTicket/tree/phase-prete : présence de `backend/`, `frontend/`, `database/`, `docs/`, `README.md`, les `PHASE*.md`.
- Aucun `.env` : en local `git ls-files | findstr /i "\.env"` ne doit lister que `backend/.env.example` et `frontend/.env.example`. Sur GitHub, touche `t` (recherche de fichier) puis `.env` : seuls les `.example` apparaissent. Absence de `node_modules`, `.next`, `dist`.
- Si un secret a quand même été poussé : le **changer immédiatement** (mot de passe d'application Gmail, JWT_SECRET) — l'effacer du dépôt ne suffit pas.
- Option : sur GitHub, Pull Request `phase-prete` → `main` quand l'équipe valide (rien n'est fusionné automatiquement).

## C. Pour les binômes
```bat
git clone https://github.com/rayenhassini/SmartTicket.git
cd SmartTicket
git checkout phase-prete
```
1. **Base** (XAMPP : démarrer MySQL) :
```bat
cd /d C:\xampp\mysql\bin
mysql -u root -e "CREATE DATABASE IF NOT EXISTS smartticket_v1"
mysql -u root < "C:\chemin\SmartTicket\database\smartticket_schema_v1.sql"
```
puis les migrations `001` → `008` dans l'ordre (voir README ; ne pas lancer `*_smoketest.sql`).
2. **Backend** : `cd backend`, `copy .env.example .env`, renseigner `DB_PASSWORD`, `JWT_SECRET` (long, aléatoire), et pour les emails `MAIL_USER`/`MAIL_PASSWORD` (mot de passe d'application Gmail) **ou** `MAIL_MODE=log` (liens dans la console). Puis `npm install` et `npm run start:dev` (http://localhost:3001).
3. **Frontend** : `cd frontend`, `copy .env.example .env.local`, `npm install`, `npm run dev` (http://localhost:3000).
4. Ouvrir http://localhost:3000/setup : création du premier PMO (base vide). Ensuite « Paramètres mail » permet de configurer l'envoi d'emails dans l'application.
5. Rester à jour : `git pull`. Travailler sur sa propre branche : `git checkout -b feature/ma-tache`.
**Chacun a son propre `.env` : on ne le partage jamais (ni commit, ni capture d'écran, ni message).**

## D. Problèmes courants
- **`rejected … non-fast-forward`** : la branche distante a avancé. `git pull --rebase origin phase-prete` puis `git push`. Ne pas utiliser `--force` : il écrase le travail des autres. Si vous pensez en avoir vraiment besoin, demandez d'abord (et préférez `--force-with-lease` sur *votre* branche uniquement).
- **Authentification refusée / mot de passe** : GitHub n'accepte plus le mot de passe du compte. Utiliser *Git Credential Manager* (fenêtre de connexion navigateur, inclus avec Git for Windows) ou un Personal Access Token (Settings → Developer settings → Tokens, droit `repo`) saisi comme mot de passe. Pour pousser, il faut être collaborateur avec droit d'écriture (« Write »).
- **Fichier > 100 Mo refusé** : retirer le fichier de l'index (`git rm --cached fichier`), l'ajouter au `.gitignore`, refaire le commit (`git commit --amend` s'il est dans le dernier commit). Aucun gros fichier dans ce projet hors `node_modules`.
- **OneDrive** : ne pas faire `git` dans un dossier en cours de synchronisation active si des erreurs de verrouillage apparaissent (« unable to unlink », `index.lock`). Mettre OneDrive en pause, ou travailler dans un dossier hors OneDrive (ex. `C:\dev\SmartTicket`) ; `node_modules` y est aussi plus rapide. Si `index.lock` persiste : fermer les programmes qui utilisent le dossier, puis supprimer `.git\index.lock`.
- **Fin de ligne « LF will be replaced by CRLF »** : simple avertissement Windows ; `git config --global core.autocrlf true` le règle.
- **`.env` apparaît dans `git status`** : ne pas faire `git add`. Vérifier `.gitignore` ; s'il a déjà été suivi : `git rm --cached backend\.env` puis commit (et changer les secrets s'il a été poussé).
