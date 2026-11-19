// Petit cache mémoire des GET (durée de vie courte) : dédoublonne les requêtes en vol et évite de
// re-télécharger les mêmes listes à chaque clic de menu. Vidé à chaque écriture (POST/PUT/PATCH/DELETE)
// et à chaque connexion/déconnexion. Les erreurs ne sont jamais mises en cache.
const TTL_MS = 15_000;

interface Entry {
  at: number;
  promise: Promise<unknown>;
}

const store = new Map<string, Entry>();

// « Stale-while-revalidate » : dernier résultat connu d'une fonction de chargement (clé = la fonction elle-même).
// Permet à une page de s'afficher IMMÉDIATEMENT avec l'ancien contenu pendant qu'elle se rafraîchit en silence.
// Péremption max 5 min ; vidé avec le cache (écriture, connexion, déconnexion) → jamais de donnée connue obsolète.
const SNAPSHOT_MAX_AGE_MS = 5 * 60_000;
let snapshots = new WeakMap<object, { at: number; data: unknown }>();

export function peekSnapshot<T>(fn: object): T | null {
  const s = snapshots.get(fn);
  return s && Date.now() - s.at < SNAPSHOT_MAX_AGE_MS ? (s.data as T) : null;
}

export function saveSnapshot(fn: object, data: unknown): void {
  snapshots.set(fn, { at: Date.now(), data });
}

// Copie défensive : une page qui trie/modifie sa liste en place ne doit pas altérer le cache.
const copy = <T>(v: T): T => {
  if (v === undefined || v === null || typeof v !== "object") return v;
  return typeof structuredClone === "function" ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T);
};

export function cachedGet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return (hit.promise as Promise<T>).then(copy);
  const promise = fetcher();
  const entry: Entry = { at: Date.now(), promise };
  store.set(key, entry);
  promise.catch(() => {
    if (store.get(key) === entry) store.delete(key);
  });
  return promise.then(copy);
}

export function clearApiCache(): void {
  store.clear();
  snapshots = new WeakMap();
}
