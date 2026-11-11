"use client";

import { useEffect, useState } from "react";
import { CrudPage, ValidBadge, formatDay, dateOnly, endBeforeStart, type CrudConfig } from "@/components/crud";
import { contractsApi } from "@/lib/api/admin";
import { listUsers } from "@/lib/api/lookups";
import { ticketUsageWarning } from "@/lib/api/usage";
import { Spinner } from "@/components/ui";
import type { Contract } from "@/lib/types";

// Valeurs EXACTES des ENUM MySQL (backend/src/common/enums/contract-*.enum.ts).
const TYPES = [
  "SUPPORT AND MAINTENANCE SOFT",
  "SUPPORT AND MAINTENANCE HARD",
  "SUPPORT AND MAINTENANCE SOFT AND HARD",
  "INFOGERANCE",
];
const NATURES = ["DEVELOPMENT", "SYSTEME", "RESEAUX", "CYBER-SECURITY", "SUPPORT"];
const opt = (v: string) => ({ value: v, label: v });

export default function ContractsPage() {
  const [commerciaux, setCommerciaux] = useState<{ value: string; label: string }[] | null>(null);
  useEffect(() => {
    listUsers()
      .then((us) => setCommerciaux(us.filter((u) => u.authority === "commercial" && u.valid).map((u) => ({ value: String(u.id), label: `${u.firstName} ${u.lastName}` }))))
      .catch(() => setCommerciaux([])); // le commercial est optionnel : la page reste utilisable
  }, []);
  if (!commerciaux) return <Spinner label="Chargement…" />;

  const cfg: CrudConfig<Contract> = {
    title: "Contrats",
    noun: "contrat",
    fields: [
      { name: "businessId", label: "Identifiant contrat", type: "text", required: true, maxLength: 100, hint: "Unique." },
      { name: "type", label: "Type", type: "select", required: true, options: TYPES.map(opt) },
      { name: "nature", label: "Nature", type: "select", required: true, options: NATURES.map(opt) },
      { name: "sla", label: "SLA", type: "text", required: true, maxLength: 255 },
      { name: "startDate", label: "Début", type: "date", required: true },
      { name: "endDate", label: "Fin", type: "date", required: true },
      { name: "dueDate", label: "Échéance", type: "date" },
      { name: "jourInfogerance", label: "Jour d'infogérance", type: "text", maxLength: 50 },
      { name: "montant", label: "Montant", type: "number", placeholder: "1500.000", hint: "Nombre (ex. 1500.000)." },
      { name: "commercialId", label: "Commercial", type: "select", asNumber: true, options: commerciaux },
      { name: "valid", label: "Contrat actif", type: "checkbox" },
    ],
    columns: [
      { header: "Contrat", render: (c) => <span className="font-medium text-slate-900">{c.businessId}</span> },
      { header: "Type", render: (c) => c.type },
      { header: "Nature", render: (c) => c.nature },
      { header: "Période", render: (c) => `${formatDay(c.startDate)} → ${formatDay(c.endDate)}` },
      { header: "Commercial", render: (c) => (c.commercial ? `${c.commercial.firstName} ${c.commercial.lastName}` : "—") },
      { header: "État", render: (c) => <ValidBadge valid={c.valid} /> },
    ],
    searchText: (c) => `${c.businessId} ${c.type} ${c.nature} ${c.sla ?? ""}`,
    searchPlaceholder: "Rechercher un contrat (identifiant, type, nature)…",
    rowLabel: (c) => `« ${c.businessId} »`,
    ...contractsApi,
    toForm: (c) => ({
      businessId: c.businessId, type: c.type, nature: c.nature, sla: c.sla ?? "",
      startDate: dateOnly(c.startDate), endDate: dateOnly(c.endDate), dueDate: dateOnly(c.dueDate),
      jourInfogerance: c.jourInfogerance ?? "", montant: c.montant ?? "",
      commercialId: c.commercial ? String(c.commercial.id) : "", valid: c.valid !== false,
    }),
    defaults: {
      businessId: "", type: "", nature: "", sla: "", startDate: "", endDate: "", dueDate: "",
      jourInfogerance: "", montant: "", commercialId: "", valid: true,
    },
    validate: (v) => {
      if (endBeforeStart(v.startDate, v.endDate)) return "La date de fin doit être postérieure ou égale à la date de début.";
      if (typeof v.montant === "string" && v.montant.trim() && !/^-?\d+(\.\d+)?$/.test(v.montant.trim())) return "Le montant doit être un nombre (ex. 1500.000).";
      return null;
    },
    deleteWarning: (c) => ticketUsageWarning("contract", c.id),
  };
  return <CrudPage cfg={cfg} />;
}
