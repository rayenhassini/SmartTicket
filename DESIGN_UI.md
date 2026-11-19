# Refonte UI — Bootstrap 5 + design system léger

## Existant
Tailwind (≈600 `className`) + classes maison (`.input`, `.label`, `.btn-*`, `.card`) dans `globals.css`. Points faibles : palette bleu/gris plat, menu texte brut sans icônes ni regroupement (et **aucune navigation en dessous de 768 px**), tableaux sans relief, états vides austères.

## Stratégie (choix)
**Bootstrap limité aux composants structurels, Tailwind conservé pour le layout** — réécrire 600 classes serait une réécriture. Bootstrap est importé en **SCSS modulaire** (`src/app/bootstrap.scss` : variables `--bs-*`, boutons, badges, alertes, close ; **sans JS**) et **sans ses classes utilitaires** : elles portent `!important` et écrasent celles de Tailwind de même nom (`p-4`, `mb-3`, `gap-3`… — constaté et évité). Tailwind garde son reset. Dépendances ajoutées : `bootstrap`, `sass` (dev).

## Direction
Primaire indigo `#4f46e5` (Tailwind `brand-*` recoloré, `--bs-primary` aligné), fond `#f4f6fb`, surfaces blanches, bordures `slate-200`, ombres légères, rayon 8–12 px. Bouton primaire plein, secondaire en contour (`btn-outline-secondary`), danger rouge. Focus clavier visible (anneau indigo). Un seul endroit pour tout régler : `globals.css` (tokens `--st-*`).

## Fichiers modifiés
- `package.json`/lock : bootstrap, sass. `next.config.mjs` : silence des dépréciations Sass de Bootstrap.
- `src/app/bootstrap.scss` (nouveau), `layout.tsx` (import), `globals.css` (design system : boutons, champs, select, cartes, tableaux, nav).
- `tailwind.config.ts` : palette `brand` indigo (recolore tout le site).
- `components/Shell.tsx` : barre latérale sombre « app » (icônes SVG inline, sections Support/Accès/Référentiels/Configuration, item actif marqué, `aria-current`), en-tête avec avatar + rôle, **tiroir de navigation sous 768 px**.
- `components/ui.tsx` : états vides avec icône, bannières erreur/succès à liseré, titres.
- `components/crud.tsx` : modale avec `!m-0` (bug existant : `space-y-*` décalait l'overlay de 24 px).
- `login/page.tsx`, `setup/page.tsx` : fond dégradé, carte blanche.
- Pages : `btn-primary/secondary/danger` → classes Bootstrap (`btn btn-primary`…), remplacement mécanique, aucun changement de logique.

## Non touché
Backend, SQL, routes, guards, rôles, `api-cache` (navigation : 2e passage menu = 0 requête API, mesuré).

## Checklist
1. Login et `/setup` (base vide) : fond dégradé, connexion OK, redirection inchangée.
2. Menu PMO : Tickets → Équipes → Utilisateurs → Invitations → Paramètres mail : item actif surligné, aucune lenteur au 2e passage.
3. Écran liste (ex. Sites) : « Nouveau site » → modale centrée → Enregistrer → ligne visible ; Modifier / Supprimer.
4. Fenêtre < 768 px : bouton ☰ ouvre le menu, il se ferme au clic sur un lien ou sur le fond.
5. Technicien et client : menu limité à leur espace, pas de régression d'accès.
Vérifié ici : build prod OK, `tsc` OK, navigateur succession PMO 31/31, cache de navigation intact.
