\# SmartTicket V1



API de gestion du support technique développée avec \*\*NestJS\*\*, \*\*TypeScript\*\* et \*\*MySQL\*\*.



\## Présentation



SmartTicket V1 est un projet logiciel destiné à organiser la gestion des demandes de support technique. Le backend fournit une API pour gérer les tickets et plusieurs ressources métier associées.



\## Fonctionnalités et modules



Le code source comprend des modules dédiés notamment à :



\- L'authentification.

\- La gestion des utilisateurs.

\- La gestion des tickets de support.

\- La gestion des équipements et des logiciels.

\- La gestion des sites.

\- La gestion des solutions.

\- La gestion des contrats et des types de support.



Les fonctionnalités exactes disponibles dépendent de l'implémentation actuelle du backend.



\## Technologies



\- \*\*NestJS\*\*

\- \*\*Node.js\*\*

\- \*\*TypeScript\*\*

\- \*\*TypeORM\*\*

\- \*\*MySQL\*\*

\- \*\*JWT\*\* pour l'authentification, selon la configuration de l'application.



\## Structure du projet



```text

SmartTicket-v1/

├── backend/

│   ├── src/

│   ├── .env.example

│   ├── package.json

│   └── README.md

├── database/

│   └── smartticket\_schema\_v1.sql

├── docs/

│   └── 01-conception.md

├── .gitignore

└── README.md

```



\## Prérequis



\- Node.js et npm, dans des versions compatibles avec le projet.

\- MySQL.

\- Git.



\## Installation et lancement



\### 1. Préparer la base de données



Vérifiez le contenu du fichier SQL avant son exécution. Puis, si nécessaire, importez le schéma dans votre serveur MySQL :



```bash

mysql -u root -p < database/smartticket\_schema\_v1.sql

```



Adaptez la commande à votre installation MySQL et à votre méthode d'authentification.



\### 2. Configurer le backend



Depuis la racine du projet :



```bash

cd backend

```



Installez les dépendances :



```bash

npm install

```



Copiez le fichier de configuration d'exemple vers un fichier local `.env`, puis renseignez les valeurs adaptées à votre environnement. Sous Windows CMD :



```cmd

copy .env.example .env

```



Configurez notamment les paramètres de connexion à MySQL et un secret JWT robuste. Ne publiez jamais votre fichier `.env`.



\### 3. Démarrer l'API



```bash

npm run start:dev

```



Par défaut, l'API est accessible à l'adresse suivante, si cette configuration est conservée :



`http://localhost:3001`



\## Documentation



\- \[Document de conception](docs/01-conception.md)

\- \[Documentation du backend](backend/README.md)

\- \[Schéma SQL](database/smartticket\_schema\_v1.sql)



\## Sécurité



\- Ne publiez aucun mot de passe, jeton d'accès ou secret.

\- N'incluez pas de données personnelles ou confidentielles dans les exemples.

\- Utilisez uniquement des environnements et systèmes pour lesquels vous disposez des autorisations nécessaires.

\- Avant un déploiement, vérifiez les contrôles d'accès, la configuration des secrets et les paramètres de production.



\## État du projet



Cette documentation présente la structure générale du backend. Les fonctionnalités détaillées et les instructions peuvent évoluer avec le code source.



\## Licence



Aucune licence n'est définie dans ce dépôt pour le moment.

