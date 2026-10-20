\# SmartTicket V1 — Document de conception



\## 1. Présentation du projet



SmartTicket V1 est un projet de gestion du support technique. Il vise à centraliser le suivi des tickets, la gestion des utilisateurs et les informations nécessaires au traitement des demandes de support.



Le projet comprend un backend développé avec NestJS et une base de données MySQL.



\## 2. Objectifs



Les principaux objectifs du projet sont :



\- Centraliser les demandes de support technique.

\- Permettre la création et le suivi des tickets.

\- Organiser les informations relatives aux utilisateurs.

\- Gérer les équipements, les logiciels et les autres ressources métier.

\- Structurer le code afin de faciliter la maintenance et les évolutions futures.

\- Protéger les accès à l'API grâce à un mécanisme d'authentification.



\## 3. Architecture technique



\### Backend



Le backend utilise les technologies suivantes :



\- \*\*NestJS\*\* : framework Node.js pour organiser l'API.

\- \*\*TypeScript\*\* : langage utilisé pour le développement.

\- \*\*TypeORM\*\* : outil de gestion des interactions avec la base de données.

\- \*\*MySQL\*\* : système de gestion de base de données.

\- \*\*JWT\*\* : mécanisme utilisé pour l'authentification par jetons, selon la configuration de l'application.



\### Organisation du code



Le backend est organisé en modules fonctionnels. Les dossiers du code source comprennent notamment :



\- `auth` : fonctionnalités liées à l'authentification.

\- `users` : gestion des utilisateurs.

\- `tickets` : gestion des tickets de support.

\- `equipment` et `equipment-softs` : gestion des équipements et logiciels.

\- `sites` : gestion des sites.

\- `solutions` : gestion des solutions.

\- `contracts` : fonctionnalités liées aux contrats.

\- `type-supports` : types de support.

\- `common` : composants partagés.

\- `config` : configuration de l'application.

\- `database` : éléments liés à la base de données.



Cette description correspond à l'organisation observée dans le projet ; les fonctionnalités précises de chaque module doivent être confirmées à partir du code.



\## 4. Base de données



Le projet utilise MySQL. Le fichier `database/smartticket\_schema\_v1.sql` contient le schéma SQL destiné à initialiser la structure de la base de données.



Avant toute utilisation, il faut vérifier la configuration MySQL et s'assurer que le script est exécuté sur une base appropriée. Les données réelles ou confidentielles ne doivent pas être publiées dans le dépôt Git.



\## 5. Configuration et lancement



La configuration locale du backend est définie à l'aide de variables d'environnement. Le fichier `backend/.env.example` sert de modèle.



Le fichier `backend/.env` est réservé à l'environnement local et ne doit jamais être publié.



Les étapes générales de lancement sont :



1\. Installer une version compatible de Node.js et npm.

2\. Installer et démarrer MySQL.

3\. Préparer la base de données à partir du schéma SQL.

4\. Copier `.env.example` vers `.env` et renseigner les paramètres locaux.

5\. Installer les dépendances du backend avec `npm install`.

6\. Démarrer l'application avec `npm run start:dev`.

7\. Vérifier que l'API répond sur `http://localhost:3001`, selon la configuration locale.



Les commandes exactes et les variables requises doivent être confirmées dans le `package.json`, le fichier `.env.example` et le code source.



\## 6. Sécurité



Les mesures de sécurité à respecter comprennent :



\- Ne jamais publier les mots de passe, les jetons ou les clés secrètes.

\- Utiliser des secrets robustes en dehors de l'environnement de développement.

\- Ne pas intégrer de données personnelles ou confidentielles dans les exemples publics.

\- Vérifier les autorisations avant de réaliser des tests sur un système partagé.

\- Séparer les environnements de développement, de test et de production.

\- Vérifier les contrôles d'accès et la validation des données avant tout déploiement.



\## 7. État et limites du document



Ce document présente la conception générale de SmartTicket V1 à partir de la structure connue du projet.



Les règles métier détaillées, les relations complètes entre les tables, les diagrammes UML, les exigences fonctionnelles et les résultats des tests devront être ajoutés après vérification du code et du schéma SQL.



\## 8. Conclusion



SmartTicket V1 repose sur une architecture backend modulaire avec NestJS, TypeScript et MySQL. Cette organisation constitue une base pour le développement et la maintenance d'une API de gestion du support technique. La documentation sera enrichie au fur et à mesure de la validation des fonctionnalités.

