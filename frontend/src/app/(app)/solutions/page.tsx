"use client";

import { useEffect, useState } from "react";
import { CrudPage, formatDay, type CrudConfig } from "@/components/crud";
import { solutionsApi } from "@/lib/api/admin";
import { listUsers } from "@/lib/api/lookups";
import { solutionUsageWarning } from "@/lib/api/usage";
import { Spinner } from "@/components/ui";
import type { Solution } from "@/lib/types";

const excerpt = (t?: string | null, n = 90) => {
  const s = (t ?? "").replace(/\s+/g, " ").trim();
  return s ? (s.length > n ? s.slice(0, n) + "…" : s) : "(sans texte)";
};

export default function SolutionsPage() {
  const [authors, setAuthors] = useState<{ value: string; label: string }[] | null>(null);
  useEffect(() => {
    listUsers()
      .then((us) => setAuthors(us.filter((u) => u.valid && ["technician", "pmo", "assistant"].includes(u.authority)).map((u) => ({ value: String(u.id), label: `${u.firstName} ${u.lastName}` }))))
      .catch(() => setAuthors([])); // l'auteur est optionnel
  }, []);
  if (!authors) return <Spinner label="Chargement…" />;

  const cfg: CrudConfig<Solution> = {
    title: "Solutions",
    noun: "solution",
    feminine: true,
    fields: [
      { name: "solutionText", label: "Texte de la solution", type: "textarea", required: true, hint: "Visible par les clients des tickets liés à cette solution." },
      { name: "proposedParId", label: "Proposée par", type: "select", asNumber: true, options: authors },
      { name: "valid", label: "Solution validée", type: "checkbox" },
    ],
    columns: [
      { header: "N°", render: (s) => `#${s.id}` },
      { header: "Solution", render: (s) => excerpt(s.solutionText) },
      { header: "Proposée par", render: (s) => (s.proposedPar ? `${s.proposedPar.firstName} ${s.proposedPar.lastName}` : "—") },
      { header: "Créée le", render: (s) => formatDay(s.creationDate) },
      { header: "État", render: (s) => (s.valid ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Validée</span> : <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">Non validée</span>) },
    ],
    searchText: (s) => `${s.id} ${s.solutionText ?? ""} ${s.proposedPar ? s.proposedPar.firstName + " " + s.proposedPar.lastName : ""}`,
    searchPlaceholder: "Rechercher dans les solutions…",
    rowLabel: (s) => `#${s.id}`,
    filters: [{ label: "État", options: [{ value: "1", label: "Validées" }, { value: "0", label: "Non validées" }], test: (s, v) => (v === "1") === Boolean(s.valid) }],
    ...solutionsApi,
    toForm: (s) => ({ solutionText: s.solutionText ?? "", proposedParId: s.proposedPar ? String(s.proposedPar.id) : "", valid: Boolean(s.valid) }),
    defaults: { solutionText: "", proposedParId: "", valid: true },
    deleteWarning: (s) => solutionUsageWarning(s.id),
  };
  return <CrudPage cfg={cfg} />;
}
