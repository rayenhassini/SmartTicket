# Vitesse & fluidité — passe 2 (stale-while-revalidate)

## Diagnostic
Le cache GET (15 s) évitait les requêtes, mais chaque page repartait d'un état `null` → **spinner/vide au montage** (au moins une image) et, après 15 s, un vrai rechargement bloquant. Les rechargements après action gardaient déjà l'ancien contenu (sauf Tickets / Mes tickets qui se remettaient à `null`).

## P1 appliqué
- `lib/api-cache.ts` : « instantané » du dernier résultat de chaque chargeur de liste (clé = la fonction `list`, péremption 5 min), vidé avec le cache à toute écriture / connexion / déconnexion → jamais d'ancien contenu après une modification.
- `lib/swr.ts` (nouveau) : `peek(fn)` = état initial immédiat ; `track(fn)` = chargement qui mémorise le résultat.
- Pages branchées (changement : état initial + `track`, rien d'autre) : `components/crud.tsx` (Utilisateurs, Sites, Contrats, Équipements, Logiciels, Types de support, Solutions), Tickets, Équipes, Invitations, Invitations clients, Mes tickets (technicien). Tickets et Mes tickets ne se vident plus au rechargement.
- Résultat : pages déjà visitées affichées **à la première image**, rafraîchies en silence ; le spinner n'apparaît qu'à la toute première visite à froid.
- `components/Shell.tsx` : au survol/focus d'un lien du menu, le GET de la page est lancé d'avance (cache + déduplication).

## Mesuré (build prod, PMO)
Clic menu Tickets→Équipes→Utilisateurs→Invitations→Sites→Tickets : 0 spinner, 2e tour 0 requête. Après modification d'un site puis retour : nouvelle valeur affichée, ancienne absente. Navigateur succession PMO 31/31, `tsc` + build OK.

## P2 (non appliqué)
- `GET /tickets` : 9 relations jointes (dont techniciens) → DTO de liste allégé / pagination si la base grossit (changement d'API ; à mesurer sur données réelles).
- Pages détail (`tickets/[id]`, équipes/[id]) et filtres serveur du client : encore un spinner à la 1re ouverture (chargement par identifiant) ; même mécanisme applicable si besoin.
- Mémoïsation des lignes de tableau : inutile aux volumes actuels, à ajouter si > ~500 lignes.

## Checklist
1. Connexion. 2. Tickets → Équipes → Utilisateurs → Invitations → Paramètres mail → Tickets : 2e tour sans spinner. 3. Créer/modifier une entité (ex. un site), changer de page et revenir : données à jour. 4. Connexion avec un autre rôle : aucune donnée de la session précédente. 5. Design inchangé.
