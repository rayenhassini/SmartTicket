"use client";

import { CrudPage, ValidBadge, formatDay, dateOnly, endBeforeStart, type CrudConfig } from "@/components/crud";
import { equipmentSoftsApi } from "@/lib/api/admin";
import { ticketUsageWarning } from "@/lib/api/usage";
import type { EquipmentSoft } from "@/lib/types";

const cfg: CrudConfig<EquipmentSoft> = {
  title: "Logiciels",
  noun: "logiciel",
  fields: [
    { name: "equipmentName", label: "Nom du logiciel", type: "text", required: true, maxLength: 150 },
    { name: "version", label: "Version", type: "text", maxLength: 100 },
    { name: "constructure", label: "Constructeur / éditeur", type: "text", maxLength: 150 },
    { name: "startDateContract", label: "Début du contrat", type: "date", required: true },
    { name: "endDateContract", label: "Fin du contrat", type: "date", required: true },
    { name: "valid", label: "Logiciel actif", type: "checkbox" },
  ],
  columns: [
    { header: "Logiciel", render: (e) => <span className="font-medium text-slate-900">{e.equipmentName}</span> },
    { header: "Version", render: (e) => e.version || "—" },
    { header: "Constructeur", render: (e) => e.constructure || "—" },
    { header: "Contrat", render: (e) => `${formatDay(e.startDateContract)} → ${formatDay(e.endDateContract)}` },
    { header: "État", render: (e) => <ValidBadge valid={e.valid} /> },
  ],
  searchText: (e) => `${e.equipmentName} ${e.version ?? ""} ${e.constructure ?? ""}`,
  searchPlaceholder: "Rechercher (nom, version, constructeur)…",
  rowLabel: (e) => `« ${e.equipmentName}${e.version ? " " + e.version : ""} »`,
  ...equipmentSoftsApi,
  toForm: (e) => ({
    equipmentName: e.equipmentName, version: e.version ?? "", constructure: e.constructure ?? "",
    startDateContract: dateOnly(e.startDateContract), endDateContract: dateOnly(e.endDateContract),
    valid: e.valid !== false,
  }),
  defaults: { equipmentName: "", version: "", constructure: "", startDateContract: "", endDateContract: "", valid: true },
  validate: (v) => (endBeforeStart(v.startDateContract, v.endDateContract) ? "La fin du contrat doit être postérieure ou égale au début." : null),
  deleteWarning: (e) => ticketUsageWarning("equipmentSoft", e.id),
};

export default function EquipmentSoftsPage() {
  return <CrudPage cfg={cfg} />;
}
