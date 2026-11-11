"use client";

import { CrudPage, ValidBadge, formatDay, dateOnly, endBeforeStart, type CrudConfig } from "@/components/crud";
import { equipmentApi } from "@/lib/api/admin";
import { ticketUsageWarning } from "@/lib/api/usage";
import type { Equipment } from "@/lib/types";

const cfg: CrudConfig<Equipment> = {
  title: "Équipements",
  noun: "équipement",
  fields: [
    { name: "sn", label: "Numéro de série", type: "text", required: true, maxLength: 150, hint: "Unique." },
    { name: "nomPiece", label: "Nom de la pièce", type: "text", required: true, maxLength: 150 },
    { name: "startDateContract", label: "Début du contrat", type: "date", required: true },
    { name: "endDateContract", label: "Fin du contrat", type: "date", required: true },
    { name: "valid", label: "Équipement actif", type: "checkbox" },
  ],
  columns: [
    { header: "N° de série", render: (e) => <span className="font-medium text-slate-900">{e.sn}</span> },
    { header: "Pièce", render: (e) => e.nomPiece },
    { header: "Contrat", render: (e) => `${formatDay(e.startDateContract)} → ${formatDay(e.endDateContract)}` },
    { header: "État", render: (e) => <ValidBadge valid={e.valid} /> },
  ],
  searchText: (e) => `${e.sn} ${e.nomPiece}`,
  searchPlaceholder: "Rechercher (n° de série, pièce)…",
  rowLabel: (e) => `« ${e.sn} »`,
  ...equipmentApi,
  toForm: (e) => ({
    sn: e.sn, nomPiece: e.nomPiece,
    startDateContract: dateOnly(e.startDateContract), endDateContract: dateOnly(e.endDateContract),
    valid: e.valid !== false,
  }),
  defaults: { sn: "", nomPiece: "", startDateContract: "", endDateContract: "", valid: true },
  validate: (v) => (endBeforeStart(v.startDateContract, v.endDateContract) ? "La fin du contrat doit être postérieure ou égale au début." : null),
  deleteWarning: (e) => ticketUsageWarning("equipment", e.id),
};

export default function EquipmentPage() {
  return <CrudPage cfg={cfg} />;
}
