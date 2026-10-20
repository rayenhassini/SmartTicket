# SmartTicket — Frontend (F1)

Next.js 14 (App Router) + TypeScript + Tailwind. Node 18.17+.

## Lancer
```bash
cd frontend
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev                    # http://localhost:3000
```
Le backend doit tourner sur http://localhost:3001 (voir `../backend/README.md`).

## Contenu F1
- `/setup` : création du premier utilisateur (`POST /auth/bootstrap`, une seule fois)
- `/login` : connexion JWT (token + user dans localStorage)
- `/tickets`, `/tickets/new`, `/tickets/[id]` (statut, techniciens, superviseur, solution), `/tickets/[id]/edit`
- `src/lib/api-client.ts` : Bearer JWT ; sur 401, session purgée et redirection vers `/login`

## Limites connues
- Le backend ne permet pas de vider une relation : le formulaire d'édition omet les champs vides.
- Les autres entrées du menu sont désactivées (F2/F3). Pas de dashboard.
