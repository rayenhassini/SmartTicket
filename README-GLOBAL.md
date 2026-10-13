# SmartTicket  — Package complet (MySQL + NestJS)

## Présentation

SmartTicket  est un sous-ensemble du cœur fonctionnel de support de l’application OPM. Il constitue la base d’une nouvelle application dédiée à la gestion des tickets de support, des équipements, des contrats et des utilisateurs.

Ce projet ne constitue pas une copie complète de l’application OPM existante. Seules les fonctionnalités prévues dans le périmètre de la V1 sont concernées.

## Contenu du package

```text
SmartTicket/
|-- database/
|   `-- smartticket_schema_v1.sql
|-- backend/
|   `-- README.md
|-- README.md
`-- README-GLOBAL.md
```

- `database/` : schéma SQL de la base de données MySQL.
- `backend/` : API développée avec NestJS 9 et TypeORM.
- `backend/README.md` : documentation détaillée de l’installation, de la configuration et de l’utilisation du backend.
- `README.md` : présentation générale du projet.
- `README-GLOBAL.md` : guide global de mise en route du package.

## Prérequis

Avant de commencer, assurez-vous de disposer des outils suivants :

- Node.js dans une version compatible avec le projet.
- npm, généralement installé avec Node.js.
- MySQL 8, ou une version compatible avec le schéma fourni.
- Git, pour récupérer et gérer le code source.
- Un client MySQL pour importer et vérifier le schéma de la base de données.

Les versions exactes requises doivent être confirmées à partir des fichiers de configuration du projet.

## Installation et démarrage

### 1. Préparer la base de données

Depuis la racine du projet, importez le schéma SQL avec un client MySQL :

```bash
mysql -u root -p < database/smartticket_schema_v1.sql
```

Saisissez le mot de passe MySQL lorsque cela est demandé.

Cette commande exécute le fichier SQL fourni. La création de la base `smartticket_v1` dépend du contenu réel de ce fichier.

**Important :** vérifiez le script SQL avant son exécution et assurez-vous que vous utilisez le bon serveur et la bonne base de données.

### 2. Installer et configurer le backend

Depuis la racine du projet, accédez au dossier du backend :

```bash
cd backend
```

Installez les dépendances :

```bash
npm install
```

Créez ensuite votre fichier de configuration local à partir du modèle fourni.

Sous Windows CMD :

```cmd
copy .env.example .env
```

Sous Linux ou macOS :

```bash
cp .env.example .env
```

Ouvrez le fichier `.env` et configurez les variables nécessaires, notamment :

- Les paramètres de connexion à MySQL (`DB_*`).
- Le secret d’authentification JWT (`JWT_SECRET`).
- Le port de l’API (`PORT`), si cette variable est utilisée par le projet.

Les noms exacts des variables et leurs valeurs par défaut doivent être vérifiés dans la configuration du backend.

**Sécurité :** le fichier `.env` contient une configuration locale et peut contenir des informations sensibles. Ne le publiez jamais sur GitHub. Utilisez un secret JWT long, aléatoire et différent pour chaque environnement.

### 3. Démarrer l’API

Depuis le dossier `backend`, lancez le serveur de développement :

```bash
npm run start:dev
```

Si le démarrage réussit, consultez la configuration du backend pour connaître le port réellement utilisé. Si le port configuré est `3001`, l’API sera accessible localement à l’adresse suivante :

`http://localhost:3001`

Pour connaître les routes disponibles, les paramètres attendus et les exemples de requêtes, consultez `backend/README.md`.

### 4. Créer le premier compte et se connecter

La route prévue pour l’initialisation du premier compte est :

`POST /auth/bootstrap`

Selon le fonctionnement attendu, cette route permet de créer le premier compte lorsque la table `users` est vide. Le comportement réel doit être confirmé dans le code source.

Une fois le compte créé, utilisez la route suivante pour vous connecter :

`POST /auth/login`

Si l’authentification réussit, la réponse doit fournir un jeton JWT permettant d’accéder aux routes protégées, conformément à l’implémentation.

Les comptes suivants peuvent éventuellement être créés via `POST /users`, selon les règles d’authentification et d’autorisation configurées.

Consultez `backend/README.md` pour les détails et les exemples d’utilisation.

## Périmètre fonctionnel de la V1

Le périmètre prévu comprend les domaines suivants, sous réserve de validation dans le code source et le schéma SQL :

- **Users et rôles** : gestion des utilisateurs et des rôles selon l’implémentation STI.
- **Authentification** : connexion avec JWT et initialisation du premier compte.
- **Tickets** : gestion des tickets, de leurs statuts, des techniciens associés et du superviseur.
- **Relations métier** : liens entre tickets, clients, contrats, sites, équipements et solutions.
- **Solutions** : gestion des solutions liées au support.
- **Equipment** : gestion des équipements matériels.
- **EquipmentSoft** : gestion des logiciels associés aux équipements, si elle est implémentée.
- **Contracts** : gestion des contrats, des clients, des techniciens et des types de support.
- **Sites** : gestion des sites.
- **TypeSupport** : gestion du référentiel des types de support.

La présence d’un domaine dans cette liste ne garantit pas que toutes ses fonctionnalités sont terminées. Le périmètre définitif doit être validé à partir du code livré et des tests disponibles.

## Hors périmètre de la V1

Les fonctionnalités suivantes sont considérées comme exclues du périmètre actuel, sauf indication contraire dans l’implémentation :

- Chat et ChatMessage.
- Notifications.
- Stockage d’un jeton JWT dans une table métier.
- File et Folder (GED).
- HealthCheck.
- Problem.
- Administration séparée.
- HelpDesk et HelpdeskClient.
- Spare.
- Rapports.
- VisiteInfogerance.
- Vistepreventive.
- Interventions.
- Requests.
- Chatbot OPM-AI.
- MongoDB et Mongoose.

Certains de ces éléments peuvent être mentionnés dans la documentation ou dans le schéma SQL pour préparer de futures évolutions. Leur présence dans ces documents ne signifie pas qu’ils sont implémentés dans la V1.

## Évolutions envisagées

Après validation de la V1, les évolutions possibles comprennent :

- Développement d’un frontend avec Next.js consommant l’API.
- Intégration du chatbot OPM-AI.
- Développement des modules P2 : interventions, requests et administration.
- Développement des modules P3 : spares, rapports, visites et helpdesk clients.
- Renforcement des tests fonctionnels, techniques et de sécurité avant toute mise en production.

Ces évolutions ne font pas partie du livrable actuel tant qu’elles n’ont pas été développées et validées.

## Sécurité et bonnes pratiques

Avant de partager le projet ou de le déployer :

- Ne publiez aucun mot de passe, jeton d’accès ou secret réel.
- Gardez le fichier `.env` local et vérifiez qu’il est ignoré par Git.
- Utilisez un secret JWT robuste, unique et adapté à l’environnement.
- Vérifiez les mécanismes d’authentification et d’autorisation de chaque route sensible.
- Évitez d’exposer des données personnelles ou des informations confidentielles.
- Testez le backend avant de le considérer comme prêt pour la production.
- N’effectuez des tests que sur les systèmes et les données pour lesquels vous disposez des autorisations nécessaires.

## Documentation complémentaire

Pour approfondir le projet, consultez :

- `README.md` : présentation générale du projet.
- `backend/README.md` : installation, configuration, routes et utilisation de l’API.
- `database/smartticket_schema_v1.sql` : structure SQL de la base de données.

---

**SmartTicket  — Base MySQL et backend NestJS pour la gestion du support technique.**