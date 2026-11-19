"use client";

// R2 — Cadre CRUD d'administration réutilisable (Phase A) : tableau + recherche locale,
// formulaire créer/modifier en fenêtre modale, confirmation de suppression, affichage des
// messages d'erreur de l'API (dont les 409 « doublon » / « encore utilisé »).
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { errorMessage } from "@/lib/format";
import type { Id } from "@/lib/types";
import { EmptyState, ErrorBanner, PageHeader, Spinner, SuccessBanner } from "@/components/ui";
import { peek, track } from "@/lib/swr";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 !m-0 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-lg"} rounded-lg bg-white p-5 shadow-xl`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Fermer">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// `createOnly` : champ affiché et envoyé uniquement à la création (ex. mot de passe).
export type FieldDef =
  | { name: string; label: string; type: "text" | "date" | "number" | "password" | "email" | "textarea"; required?: boolean; maxLength?: number; placeholder?: string; hint?: string; createOnly?: boolean }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; required?: boolean; asNumber?: boolean; hint?: string; createOnly?: boolean }
  | { name: string; label: string; type: "checkbox"; hint?: string; createOnly?: boolean };

export type FormValues = Record<string, string | boolean>;

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
}

export interface CrudConfig<T extends { id: Id }> {
  title: string;
  /** false => pas de bouton de création (ex. utilisateurs : création uniquement par invitation). */
  allowCreate?: boolean;
  /** Nom singulier (« site ») pour les libellés. */
  noun: string;
  /** Genre grammatical pour « Nouveau / Nouvelle » et « créé / créée ». */
  feminine?: boolean;
  fields: FieldDef[];
  columns: Column<T>[];
  searchText: (row: T) => string;
  searchPlaceholder?: string;
  rowLabel: (row: T) => string;
  list: () => Promise<T[]>;
  create: (payload: Record<string, unknown>) => Promise<unknown>;
  update: (id: Id, payload: Record<string, unknown>) => Promise<unknown>;
  remove: (id: Id) => Promise<unknown>;
  toForm: (row: T) => FormValues;
  defaults: FormValues;
  /** Validation côté client supplémentaire (renvoie un message ou null). */
  validate?: (values: FormValues, mode: "create" | "update") => string | null;
  /** Filtres déroulants (en plus de la recherche), ex. rôle / statut. */
  filters?: { label: string; options: { value: string; label: string }[]; test: (row: T, value: string) => boolean }[];
  /** false => bouton « Supprimer » désactivé pour cette ligne (ex. son propre compte). */
  canDelete?: (row: T) => { ok: boolean; reason?: string };
  /** Avertissement affiché dans la confirmation de suppression (ex. tickets détachés). */
  deleteWarning?: (row: T) => Promise<string | null> | string | null;
  /** Action de ligne supplémentaire (ex. « Liens »). */
  rowActions?: (row: T, reload: () => void, ctx: { setError: (m: string | null) => void; setNotice: (m: string | null) => void }) => ReactNode;
  /** Chargement de données annexes pour le formulaire (ex. liste des commerciaux). */
  children?: ReactNode;
}

// Construit le payload API : chaînes vides -> omises à la création, null à la modification
// (permet d'effacer un champ optionnel via PATCH).
export function buildPayload(fields: FieldDef[], values: FormValues, mode: "create" | "update"): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === "checkbox") {
      out[f.name] = Boolean(v);
      continue;
    }
    const s = typeof v === "string" ? v.trim() : "";
    if (s === "") {
      if (mode === "update" && !f.required) out[f.name] = null;
      continue;
    }
    out[f.name] = f.type === "select" && f.asNumber ? Number(s) : s;
  }
  return out;
}

// « Nouveau / Nouvel / Nouvelle » selon le genre et la première lettre du nom.
function newWord(cfg: { noun: string; feminine?: boolean }) {
  return cfg.feminine ? "Nouvelle" : /^[aeiouyhéèêàâîôû]/i.test(cfg.noun) ? "Nouvel" : "Nouveau";
}

export function CrudPage<T extends { id: Id }>({ cfg }: { cfg: CrudConfig<T> }) {
  const [rows, setRows] = useState<T[] | null>(() => peek(cfg.list)); // contenu connu : affiché tout de suite, rafraîchi en silence
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [fvals, setFvals] = useState<string[]>(() => (cfg.filters ?? []).map(() => ""));
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [toDelete, setToDelete] = useState<{ row: T; warning: string | null } | null>(null);

  const load = useCallback(() => {
    setError(null);
    track(cfg.list).then(setRows).catch((e) => setError(errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(load, [load]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!needle || cfg.searchText(r).toLowerCase().includes(needle)) &&
        (cfg.filters ?? []).every((f, i) => !fvals[i] || f.test(r, fvals[i])),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, fvals]);

  async function askDelete(row: T) {
    setActionError(null);
    setNotice(null);
    let warning: string | null = null;
    try {
      warning = (await cfg.deleteWarning?.(row)) ?? null;
    } catch {
      warning = null; // l'avertissement est un confort : ne bloque pas la suppression
    }
    setToDelete({ row, warning });
  }

  const nouveau = newWord(cfg);

  return (
    <div className="space-y-6">
      <PageHeader
        title={cfg.title}
        actions={cfg.allowCreate === false ? undefined : <button className="btn btn-primary" onClick={() => { setNotice(null); setActionError(null); setEditing("new"); }}>{nouveau} {cfg.noun}</button>}
      />
      {notice && <SuccessBanner message={notice} />}
      {actionError && <ErrorBanner message={actionError} />}

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-md"
          placeholder={cfg.searchPlaceholder ?? "Rechercher…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Rechercher"
        />
        {(cfg.filters ?? []).map((f, i) => (
          <select key={f.label} className="input max-w-[14rem]" aria-label={f.label} value={fvals[i]} onChange={(e) => setFvals(fvals.map((v, j) => (j === i ? e.target.value : v)))}>
            <option value="">{f.label} : tous</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
      </div>

      {error ? (
        <ErrorBanner message={`Impossible de charger la liste : ${error}`} onRetry={load} />
      ) : !filtered ? (
        <Spinner label="Chargement…" />
      ) : rows && rows.length === 0 ? (
        <EmptyState title={`Aucun(e) ${cfg.noun} pour le moment`}>{cfg.allowCreate === false ? "" : `Utilisez le bouton « ${nouveau} ${cfg.noun} » pour commencer.`}</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucun résultat pour cette recherche" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {cfg.columns.map((c) => <th key={c.header} className="px-4 py-3">{c.header}</th>)}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={String(row.id)} className="hover:bg-slate-50">
                  {cfg.columns.map((c) => <td key={c.header} className="px-4 py-3 align-top">{c.render(row)}</td>)}
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <span className="inline-flex gap-2">
                      {cfg.rowActions?.(row, load, { setError: setActionError, setNotice })}
                      <button className="btn btn-outline-secondary !px-3 !py-1" onClick={() => { setNotice(null); setActionError(null); setEditing(row); }}>Modifier</button>
                      {(() => {
                        const d = cfg.canDelete?.(row) ?? { ok: true };
                        return <button className="btn btn-outline-secondary !px-3 !py-1 !text-red-700 disabled:opacity-40" disabled={!d.ok} title={d.reason} onClick={() => askDelete(row)}>Supprimer</button>;
                      })()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <RecordForm
          cfg={cfg}
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setNotice(msg); load(); }}
        />
      )}

      {toDelete && (
        <Modal title={`Supprimer ${cfg.noun}`} onClose={() => setToDelete(null)}>
          <p className="text-sm text-slate-700">Supprimer définitivement <strong>{cfg.rowLabel(toDelete.row)}</strong> ?</p>
          {toDelete.warning && <p className="mt-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">{toDelete.warning}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-outline-secondary" onClick={() => setToDelete(null)}>Annuler</button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                const { row } = toDelete;
                setToDelete(null);
                try {
                  await cfg.remove(row.id);
                  setNotice(`${cfg.rowLabel(row)} supprimé${cfg.feminine ? "e" : ""}.`);
                  load();
                } catch (e) {
                  setActionError(errorMessage(e)); // ex. 409 « encore utilisé par … »
                }
              }}
            >
              Supprimer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RecordForm<T extends { id: Id }>({ cfg, row, onClose, onSaved }: { cfg: CrudConfig<T>; row: T | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const [values, setValues] = useState<FormValues>(row ? cfg.toForm(row) : cfg.defaults);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    for (const f of cfg.fields) {
      if (row && f.createOnly) continue;
      if (f.type !== "checkbox" && f.required && !String(values[f.name] ?? "").trim()) {
        setErr(`Le champ « ${f.label} » est obligatoire.`);
        return;
      }
    }
    const v = cfg.validate?.(values, row ? "update" : "create");
    if (v) {
      setErr(v);
      return;
    }
    setSaving(true);
    try {
      if (row) {
        await cfg.update(row.id, buildPayload(cfg.fields.filter((f) => !f.createOnly), values, "update"));
        onSaved(`${cfg.rowLabel(row)} modifié${cfg.feminine ? "e" : ""}.`);
      } else {
        await cfg.create(buildPayload(cfg.fields, values, "create"));
        onSaved(`${cfg.noun[0].toUpperCase()}${cfg.noun.slice(1)} créé${cfg.feminine ? "e" : ""}.`);
      }
    } catch (e2) {
      setErr(errorMessage(e2)); // affiche tel quel le message 409 de l'API
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={row ? `Modifier ${cfg.noun}` : `${newWord(cfg)} ${cfg.noun}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          {cfg.fields.filter((f) => !(row && f.createOnly)).map((f) => {
            const id = `f-${f.name}`;
            if (f.type === "checkbox") {
              return (
                <label key={f.name} className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                  <input type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })} />
                  {f.label}
                </label>
              );
            }
            const required = "required" in f && f.required;
            return (
              <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : undefined}>
                <label htmlFor={id} className="label">{f.label}{required && " *"}</label>
                {f.type === "textarea" ? (
                  <textarea id={id} className="input min-h-[8rem]" maxLength={f.maxLength} placeholder={f.placeholder} value={String(values[f.name] ?? "")} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
                ) : f.type === "select" ? (
                  <select id={id} className="input" value={String(values[f.name] ?? "")} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
                    <option value="">{required ? "— choisir —" : "— aucun —"}</option>
                    {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    id={id}
                    className="input"
                    type={f.type === "date" ? "date" : f.type === "password" ? "password" : f.type === "email" ? "email" : "text"}
                    autoComplete={f.type === "password" ? "new-password" : undefined}
                    inputMode={f.type === "number" ? "decimal" : undefined}
                    maxLength={f.maxLength}
                    placeholder={f.placeholder}
                    value={String(values[f.name] ?? "")}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  />
                )}
                {f.hint && <p className="mt-1 text-xs text-slate-500">{f.hint}</p>}
              </div>
            );
          })}
        </div>
        {err && <ErrorBanner message={err} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      </form>
    </Modal>
  );
}

// Utilitaires communs aux pages.
export const dateOnly = (d?: string | null) => (d ? String(d).slice(0, 10) : "");
export function endBeforeStart(start: string | boolean | undefined, end: string | boolean | undefined) {
  return typeof start === "string" && typeof end === "string" && start && end && end < start;
}
export function ValidBadge({ valid }: { valid?: boolean }) {
  return valid === false
    ? <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">Inactif</span>
    : <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Actif</span>;
}

// Date seule (YYYY-MM-DD) au format français, sans heure.
export function formatDay(d?: string | null): string {
  if (!d) return "—";
  const [y, m, day] = String(d).slice(0, 10).split("-");
  return y && m && day ? `${day}/${m}/${y}` : "—";
}
