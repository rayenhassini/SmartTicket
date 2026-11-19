"use client";

import { CrudPage, ValidBadge, type CrudConfig } from "@/components/crud";
import { usersApi } from "@/lib/api/admin";
import { useAuth } from "@/context/auth-context";
import { ResignationCard } from "@/components/ResignationCard";
import type { User } from "@/lib/types";

// Rôles métier : un seul PMO, techniciens et clients (créés UNIQUEMENT par invitation). Les anciens rôles
// (assistant, commercial, helpdeskUser) ne sont plus proposés mais restent affichés pour les comptes existants.
const ROLES: { value: string; label: string }[] = [
  { value: "pmo", label: "PMO" },
  { value: "technician", label: "Technicien" },
  { value: "client", label: "Client" },
];
const LEGACY_LABELS: Record<string, string> = { assistant: "Assistant (ancien)", commercial: "Commercial (ancien)", helpdeskUser: "Helpdesk (ancien)" };
const roleLabel = (v: string) => ROLES.find((r) => r.value === v)?.label ?? LEGACY_LABELS[v] ?? v;

export default function UsersPage() {
  const { user: me } = useAuth();
  const isMe = (u: User) => me != null && String(u.id) === String(me.id);

  const cfg: CrudConfig<User> = {
    title: "Utilisateurs",
    noun: "utilisateur",
    // Pas de création ici : techniciens et clients par invitation, PMO par succession (« Démissionner »).
    allowCreate: false,
    fields: [
      { name: "firstName", label: "Prénom", type: "text", required: true, maxLength: 100 },
      { name: "lastName", label: "Nom", type: "text", required: true, maxLength: 100 },
      { name: "email", label: "Email", type: "email", required: true, maxLength: 190 },
      { name: "phoneNumber", label: "Téléphone", type: "text", maxLength: 30 },
      { name: "company", label: "Société", type: "text", maxLength: 150 },
      { name: "valid", label: "Compte actif", type: "checkbox" },
    ],
    columns: [
      { header: "Nom", render: (u) => <span className="font-medium text-slate-900">{u.firstName} {u.lastName}{isMe(u) && <span className="ml-2 text-xs text-slate-400">(vous)</span>}</span> },
      { header: "Email", render: (u) => u.email },
      { header: "Rôle", render: (u) => roleLabel(u.authority) },
      { header: "Société", render: (u) => u.company || "—" },
      { header: "État", render: (u) => <ValidBadge valid={u.valid} /> },
    ],
    searchText: (u) => `${u.firstName} ${u.lastName} ${u.email} ${u.company ?? ""}`,
    searchPlaceholder: "Rechercher (nom, email, société)…",
    rowLabel: (u) => `« ${u.firstName} ${u.lastName} »`,
    filters: [
      { label: "Rôle", options: [...ROLES, { value: "legacy", label: "Anciens rôles" }], test: (u, v) => (v === "legacy" ? !ROLES.some((r) => r.value === u.authority) : u.authority === v) },
      { label: "État", options: [{ value: "1", label: "Actifs" }, { value: "0", label: "Inactifs" }], test: (u, v) => (v === "1") === (u.valid !== false) },
    ],
    ...usersApi,
    toForm: (u) => ({
      firstName: u.firstName, lastName: u.lastName, email: u.email, phoneNumber: u.phoneNumber ?? "",
      company: u.company ?? "", valid: u.valid !== false,
    }),
    defaults: { firstName: "", lastName: "", email: "", phoneNumber: "", company: "", valid: true },
    validate: (v) => (/^\S+@\S+\.\S+$/.test(String(v.email ?? "").trim()) ? null : "Adresse email invalide."),
    canDelete: (u) => (isMe(u) ? { ok: false, reason: "Vous ne pouvez pas supprimer votre propre compte." } : { ok: true }),
    deleteWarning: () => "La suppression est définitive. Pour simplement bloquer l'accès, préférez « Désactiver ».",
    rowActions: (u, reload, ctx) =>
      isMe(u) ? null : (
        <button
          className="btn btn-outline-secondary !px-3 !py-1"
          onClick={async () => {
            ctx.setError(null);
            ctx.setNotice(null);
            try {
              await usersApi.update(u.id, { valid: u.valid === false });
              ctx.setNotice(`${u.firstName} ${u.lastName} ${u.valid === false ? "activé" : "désactivé"}.`);
              reload();
            } catch (e) {
              ctx.setError(e instanceof Error ? e.message : "Erreur inattendue.");
            }
          }}
        >
          {u.valid === false ? "Activer" : "Désactiver"}
        </button>
      ),
  };
  return (
    <>
      {me?.authority === "pmo" && <ResignationCard />}
      <CrudPage cfg={cfg} />
    </>
  );
}
