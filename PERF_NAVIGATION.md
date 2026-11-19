# Navigation plus rapide — diagnostic et correctifs

## Diagnostic (code inspecté)
- Next 14 App Router. Le shell (en-tête + menu) est dans `src/app/(app)/layout.tsx` : il **reste monté** entre pages, le menu utilise déjà `next/link` (préchargement automatique en production). L'utilisateur courant vient du contexte/localStorage : **aucun appel API** de session à chaque clic. Rien à corriger de ce côté.
- **Cause principale** : chaque page refait ses `GET` à chaque montage (`useEffect` + `useState(null)` → spinner), sans aucun cache. Revenir sur Tickets / Utilisateurs / Équipes re-télécharge tout, et les mêmes listes (`/users`, `/contracts`, `/sites`, `/equipment`…) sont redemandées par plusieurs pages et formulaires.
- Les chargements multiples sont déjà parallélisés (`Promise.all`), pas de waterfall trouvé.
- À savoir : `next dev` compile chaque page à la première visite (lent par nature) — mesurer avec `npm run build && npm start`.

## P1 appliqué (fort impact, faible risque)
- `frontend/src/lib/api-cache.ts` (nouveau) + `api-client.ts` + `session.ts` : cache mémoire des `GET` **15 s**, déduplication des requêtes en vol, copie défensive des données, erreurs jamais mises en cache, clé liée au jeton.
  Le cache est **vidé à chaque écriture** (POST/PUT/PATCH/DELETE, avant et après) et à chaque connexion/déconnexion/401 → les données restent justes après une action.
- Mesuré (build de production, PMO, clic Équipes → Utilisateurs → Invitations → Paramètres mail → Tickets) : 1er passage 5 requêtes API, 2e passage **0 requête** (pages instantanées).
- Non-régression : navigateur succession PMO 31/31 (créations, annulation, acceptation : données rafraîchies après chaque action) ; `tsc` et `next build` OK. Aucun changement backend, SQL, auth, rôles.

## P2 (non appliqué, à décider)
- Backend `GET /tickets` : `find` avec 9 relations (dont `technicians`, many-to-many) → payload et jointures lourds sur grosse base ; envisager pagination/colonnes réduites pour la liste (changement d'API, donc à valider).
- Compression gzip (`compression`) côté Nest : utile hors réseau local (nouvelle dépendance).
- Affichage instantané « périmé puis revalidé » (SWR) et `loading.tsx` : peu utiles ici (pages 100 % client).

## Checklist manuelle
1. `npm run build && npm start` (front) ; connexion PMO.
2. Clic rapide : Tickets → Équipes → Utilisateurs → Invitations → Paramètres mail → retour Tickets : pas de spinner au 2e passage.
3. Créer une équipe / un ticket, modifier un utilisateur : la liste affiche immédiatement le changement.
4. Déconnexion puis connexion avec un autre rôle : aucune donnée de l'ancienne session ; technicien/client toujours aiguillés vers leur espace.
5. Une modification faite par un autre utilisateur apparaît au plus tard après 15 s ou au prochain clic d'écriture.
