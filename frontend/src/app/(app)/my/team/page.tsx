"use client";

import { useCallback, useEffect, useState } from "react";
import { getMyTeam, type MyTeam } from "@/lib/api/my";
import { ApiError } from "@/lib/api-client";
import { errorMessage, formatDate } from "@/lib/format";
import { EmptyState, ErrorBanner, LeaderMark, PageHeader, Spinner } from "@/components/ui";

export default function MyTeamPage() {
  const [team, setTeam] = useState<MyTeam | null>(null);
  const [noTeam, setNoTeam] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getMyTeam()
      .then(setTeam)
      .catch((e) => (e instanceof ApiError && e.status === 404 ? setNoTeam(true) : setError(errorMessage(e))));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <PageHeader title={team ? `Mon équipe — ${team.name}` : "Mon équipe"} />
      {error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : noTeam ? (
        <EmptyState title="Vous n'appartenez à aucune équipe">Contactez le PMO.</EmptyState>
      ) : !team ? (
        <Spinner label="Chargement de l'équipe…" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Membre</th>
                <th className="px-4 py-3">Rôle dans l&apos;équipe</th>
                <th className="px-4 py-3">Depuis le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {team.members.map((m) => (
                <tr key={m.userId}>
                  <td className="px-4 py-3 font-medium">{m.firstName} {m.lastName}</td>
                  <td className="px-4 py-3">{m.isLeader ? <span className="inline-flex items-center gap-2"><LeaderMark /> Responsable</span> : "Technicien"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(m.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
