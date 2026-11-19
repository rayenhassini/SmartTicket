"use client";

import { CrudPage, formatDay, type CrudConfig } from "@/components/crud";
import { typeSupportsApi } from "@/lib/api/admin";
import type { TypeSupport } from "@/lib/types";

// Un « type de support » = un fournisseur/niveau de support (nom, email, logo). Ce n'est PAS une catégorie
// de ticket (les catégories sont la « nature » des contrats).
const cfg: CrudConfig<TypeSupport> = {
  title: "Types de support",
  noun: "type de support",
  fields: [
    { name: "supportName", label: "Nom", type: "text", required: true, maxLength: 150 },
    { name: "supportEmail", label: "Email du support", type: "email", required: true, maxLength: 190 },
    { name: "logoPath", label: "Logo (chemin ou URL)", type: "text", maxLength: 500, hint: "Texte libre : l'envoi de fichier n'est pas encore disponible." },
  ],
  columns: [
    { header: "Nom", render: (t) => <span className="font-medium text-slate-900">{t.supportName}</span> },
    { header: "Email", render: (t) => t.supportEmail },
    { header: "Logo", render: (t) => t.logoPath || "—" },
    { header: "Créé le", render: (t) => formatDay(t.creationDate) },
  ],
  searchText: (t) => `${t.supportName} ${t.supportEmail}`,
  searchPlaceholder: "Rechercher (nom, email)…",
  rowLabel: (t) => `« ${t.supportName} »`,
  ...typeSupportsApi,
  toForm: (t) => ({ supportName: t.supportName, supportEmail: t.supportEmail, logoPath: t.logoPath ?? "" }),
  defaults: { supportName: "", supportEmail: "", logoPath: "" },
  validate: (v) => (/^\S+@\S+\.\S+$/.test(String(v.supportEmail ?? "").trim()) ? null : "Adresse email invalide."),
  deleteWarning: () => "Si ce type est encore lié à un contrat, un équipement ou un logiciel, la suppression sera refusée : détachez-le d'abord.",
};

export default function TypeSupportsPage() {
  return <CrudPage cfg={cfg} />;
}
