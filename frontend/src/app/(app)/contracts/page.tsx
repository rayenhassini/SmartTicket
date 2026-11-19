"use client";

import { useCallback, useEffect, useState } from "react";
import { CrudPage, Modal, ValidBadge, formatDay, dateOnly, endBeforeStart, type CrudConfig } from "@/components/crud";
import {
  contractsApi, getContract, linkContractClient, linkContractTypeSupport, typeSupportsApi,
  unlinkContractClient, unlinkContractTypeSupport,
} from "@/lib/api/admin";
import { listUsers } from "@/lib/api/lookups";
import { ticketUsageWarning } from "@/lib/api/usage";
import { ErrorBanner, Spinner } from "@/components/ui";
import { errorMessage } from "@/lib/format";
import type { Contract, TypeSupport, User } from "@/lib/types";

// Valeurs EXACTES des ENUM MySQL (backend/src/common/enums/contract-*.enum.ts).
const TYPES = [
  "SUPPORT AND MAINTENANCE SOFT",
  "SUPPORT AND MAINTENANCE HARD",
  "SUPPORT AND MAINTENANCE SOFT AND HARD",
  "INFOGERANCE",
];
const NATURES = ["DEVELOPMENT", "SYSTEME", "RESEAUX", "CYBER-SECURITY", "SUPPORT"];
const opt = (v: string) => ({ value: v, label: v });

// R4b / R4c : clients et types de support d'un contrat (API existante). Les techniciens ne sont pas exposés (R18).
function ContractLinks({ contractId, onClose }: { contractId: Contract["id"]; onClose: () => void }) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [clients, setClients] = useState<User[]>([]);
  const [supports, setSupports] = useState<TypeSupport[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [clientSel, setClientSel] = useState("");
  const [tsSel, setTsSel] = useState("");
  const [supportId, setSupportId] = useState("");

  const load = useCallback(async () => {
    try {
      const [c, us, ts] = await Promise.all([getContract(contractId), listUsers(), typeSupportsApi.list()]);
      setContract(c);
      setClients(us.filter((u) => u.authority === "client" && u.valid));
      setSupports(ts);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [contractId]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setErr(null);
    try { await fn(); await load(); } catch (e) { setErr(errorMessage(e)); }
  }
  const linked = new Set((contract?.clients ?? []).map((c) => String(c.id)));

  return (
    <Modal title={`Clients et supports — ${contract?.businessId ?? ""}`} onClose={onClose} wide>
      {err && <ErrorBanner message={err} />}
      {!contract ? <p className="text-sm text-slate-500">Chargement…</p> : (
        <div className="space-y-6 text-sm">
          <section>
            <h3 className="mb-2 font-medium">Clients</h3>
            <ul className="mb-2 space-y-1">
              {(contract.clients ?? []).length === 0 && <li className="text-slate-400">Aucun client lié.</li>}
              {(contract.clients ?? []).map((c) => (
                <li key={String(c.id)} className="flex justify-between gap-2">
                  {c.firstName} {c.lastName} ({c.email})
                  <button className="text-red-700 underline" onClick={() => run(() => unlinkContractClient(contract.id, c.id))}>Retirer</button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <select className="input" value={clientSel} onChange={(e) => setClientSel(e.target.value)} aria-label="Client à ajouter">
                <option value="">— ajouter un client —</option>
                {clients.filter((c) => !linked.has(String(c.id))).map((c) => <option key={String(c.id)} value={String(c.id)}>{c.firstName} {c.lastName} ({c.email})</option>)}
              </select>
              <button className="btn btn-outline-secondary" disabled={!clientSel} onClick={() => run(async () => { await linkContractClient(contract.id, Number(clientSel)); setClientSel(""); })}>Ajouter</button>
            </div>
          </section>
          <section>
            <h3 className="mb-2 font-medium">Types de support</h3>
            <ul className="mb-2 space-y-1">
              {(contract.typeSupportLinks ?? []).length === 0 && <li className="text-slate-400">Aucun type de support lié.</li>}
              {(contract.typeSupportLinks ?? []).map((l) => (
                <li key={String(l.id)} className="flex justify-between gap-2">
                  {l.typeSupport?.supportName ?? "?"} — identifiant : {l.supportId}
                  <button className="text-red-700 underline" onClick={() => run(() => unlinkContractTypeSupport(contract.id, l.id))}>Retirer</button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <select className="input max-w-[16rem]" value={tsSel} onChange={(e) => setTsSel(e.target.value)} aria-label="Type de support à ajouter">
                <option value="">— type de support —</option>
                {supports.map((t) => <option key={String(t.id)} value={String(t.id)}>{t.supportName}</option>)}
              </select>
              <input className="input max-w-[14rem]" placeholder="Identifiant chez le support" maxLength={150} value={supportId} onChange={(e) => setSupportId(e.target.value)} aria-label="Identifiant chez le support" />
              <button className="btn btn-outline-secondary" disabled={!tsSel || !supportId.trim()} onClick={() => run(async () => { await linkContractTypeSupport(contract.id, Number(tsSel), supportId.trim()); setTsSel(""); setSupportId(""); })}>Ajouter</button>
            </div>
          </section>
          <div className="flex justify-end"><button className="btn btn-primary" onClick={onClose}>Fermer</button></div>
        </div>
      )}
    </Modal>
  );
}

function LinksButton({ contract, reload }: { contract: Contract; reload: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-outline-secondary !px-3 !py-1" onClick={() => setOpen(true)}>Liens</button>
      {open && <ContractLinks contractId={contract.id} onClose={() => { setOpen(false); reload(); }} />}
    </>
  );
}

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
      { header: "Clients", render: (c) => c.clients?.length ?? 0 },
      { header: "Supports", render: (c) => c.typeSupportLinks?.length ?? 0 },
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
    rowActions: (c, reload) => <LinksButton contract={c} reload={reload} />,
  };
  return <CrudPage cfg={cfg} />;
}
