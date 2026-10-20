"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createTeam, listTeams } from "@/lib/api/teams";
import { errorMessage, formatDate } from "@/lib/format";
import type { TeamSummary } from "@/lib/types";
import { EmptyState, ErrorBanner, LeaderMark, PageHeader, Spinner, StaffingBadge, SuccessBanner } from "@/components/ui";

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    listTeams().then(setTeams).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);
    if (!name.trim()) {
      setFormError("Le nom de l'équipe est obligatoire.");
      return;
    }
    setSaving(true);
    try {
      const created = await createTeam(name.trim());
      setNotice(`Équipe « ${created.name} » créée (vide). Ajoutez-lui un premier membre : il en deviendra le responsable.`);
      setName("");
      load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Équipes" />

      <form onSubmit={handleCreate} className="card flex flex-wrap items-end gap-3" noValidate>
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="team-name" className="label">Nouvelle équipe</label>
          <input id="team-name" className="input" placeholder="Nom de l'équipe (ex. Réseau)" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Création…" : "Créer l'équipe"}</button>
      </form>
      {formError && <ErrorBanner message={formError} />}
      {notice && <SuccessBanner message={notice} />}

      <p className="text-xs text-slate-500">
        Couleur de l'effectif : gris = vide · rouge = 1 membre · orange = 2 à 3 membres · vert = 4 membres ou plus.
        Le responsable est repéré par l'étoile ★.
      </p>

      {error ? (
        <ErrorBanner message={`Impossible de charger les équipes : ${error}`} onRetry={load} />
      ) : !teams ? (
        <Spinner label="Chargement des équipes…" />
      ) : teams.length === 0 ? (
        <EmptyState title="Aucune équipe pour le moment">Créez la première équipe avec le formulaire ci-dessus.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Équipe</th>
                <th className="px-4 py-3">Effectif</th>
                <th className="px-4 py-3">Responsable</th>
                <th className="px-4 py-3">Créée le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teams.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-brand-700">
                    <Link href={`/teams/${t.id}`}>{t.name}</Link>
                  </td>
                  <td className="px-4 py-3"><StaffingBadge level={t.staffing} count={t.memberCount} /></td>
                  <td className="px-4 py-3">
                    {t.leader ? (
                      <span className="inline-flex items-center gap-2"><LeaderMark /> {t.leader.firstName} {t.leader.lastName}</span>
                    ) : (
                      <span className="text-slate-400">— aucun —</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
