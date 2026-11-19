import { peekSnapshot, saveSnapshot } from "./api-cache";

/** Contenu déjà connu de `fn` (null au tout premier chargement) : sert d'état initial pour éviter le spinner. */
export function peek<T>(fn: () => Promise<T>): T | null {
  return peekSnapshot<T>(fn);
}

/** Appelle `fn` (qui passe par le cache GET) et mémorise le résultat pour le prochain affichage instantané. */
export function track<T>(fn: () => Promise<T>): Promise<T> {
  return fn().then((data) => {
    saveSnapshot(fn, data);
    return data;
  });
}
