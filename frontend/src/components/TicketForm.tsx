"use client";

import { FormEvent, useEffect, useState } from "react";
import { loadLookups, type Lookups, userLabel, contractLabel, siteLabel, equipmentLabel, equipmentSoftLabel, solutionLabel } from "@/lib/api/lookups";
import { errorMessage, STATUS_LABELS, suggestTicketNumber } from "@/lib/format";
import { TICKET_STATUSES, type Ticket, type TicketPayload, type TicketStatus } from "@/lib/types";
import { ErrorBanner, Spinner } from "./ui";

interface Props {
  mode: "create" | "edit";
  initial?: Ticket;
  submitLabel: string;
  onSubmit: (payload: TicketPayload) => Promise<void>;
  onCancel: () => void;
}

const idOf = (v?: { id: string | number } | null) => (v ? String(v.id) : "");
const toNum = (v: string) => (v === "" ? undefined : Number(v));

export default function TicketForm({ mode, initial, submitLabel, onSubmit, onCancel }: Props) {
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [number, setNumber] = useState(initial?.number ?? (mode === "create" ? suggestTicketNumber() : ""));
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<TicketStatus>(initial?.status ?? "Not Assigned");
  const [isHelpdesk, setIsHelpdesk] = useState(initial?.isHelpdesk ?? false);
  const [internalTask, setInternalTask] = useState(initial?.internalTask ?? false);
  const [caseId, setCaseId] = useState(initial?.caseId ?? "");
  const [clientId, setClientId] = useState(idOf(initial?.client));
  const [contractId, setContractId] = useState(idOf(initial?.contract));
  const [siteId, setSiteId] = useState(idOf(initial?.site));
  const [equipmentId, setEquipmentId] = useState(idOf(initial?.equipment));
  const [equipmentSoftId, setEquipmentSoftId] = useState(idOf(initial?.equipmentSoft));
  // Création uniquement : à l'édition, superviseur/techniciens/solution se gèrent depuis le détail.
  const [supervisorId, setSupervisorId] = useState("");
  const [solutionId, setSolutionId] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function fetchLookups() {
    setLookupError(null);
    loadLookups().then(setLookups).catch((e) => setLookupError(errorMessage(e)));
  }
  useEffect(fetchLookups, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!number.trim() || !title.trim() || !description.trim()) {
      setError("Le numéro, le titre et la description sont obligatoires.");
      return;
    }

    // Payload explicite : le backend rejette (400) toute propriété inconnue (forbidNonWhitelisted).
    // Les relations vides sont omises : le backend ne permet pas de les remettre à NULL.
    const payload: TicketPayload = {
      number: number.trim(),
      title: title.trim(),
      description: description.trim(),
      status,
      isHelpdesk,
      internalTask,
    };
    if (caseId.trim()) payload.caseId = caseId.trim();
    if (clientId) payload.clientId = toNum(clientId);
    if (contractId) payload.contractId = toNum(contractId);
    if (siteId) payload.siteId = toNum(siteId);
    if (equipmentId) payload.equipmentId = toNum(equipmentId);
    if (equipmentSoftId) payload.equipmentSoftId = toNum(equipmentSoftId);
    if (mode === "create") {
      if (supervisorId) payload.supervisorId = toNum(supervisorId);
      if (solutionId) payload.solutionId = toNum(solutionId);
    }

    setSaving(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const clients = lookups?.users.filter((u) => u.authority === "client") ?? [];
  const technicians = lookups?.users.filter((u) => u.authority === "technician") ?? [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {error && <ErrorBanner message={error} />}
      {lookupError && <ErrorBanner message={`Listes de choix indisponibles : ${lookupError}`} onRetry={fetchLookups} />}

      <section className="card space-y-4">
        <h2 className="font-semibold text-slate-900">Informations</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="number" className="label">Numéro *</label>
            <input id="number" className="input" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div>
            <label htmlFor="status" className="label">Statut</label>
            <select id="status" className="input" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="title" className="label">Titre *</label>
          <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="description" className="label">Description *</label>
          <textarea id="description" rows={5} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="caseId" className="label">Référence externe (case ID)</label>
            <input id="caseId" className="input" value={caseId} onChange={(e) => setCaseId(e.target.value)} />
          </div>
          <div className="flex items-end gap-6 pb-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isHelpdesk} onChange={(e) => setIsHelpdesk(e.target.checked)} /> Helpdesk
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={internalTask} onChange={(e) => setInternalTask(e.target.checked)} /> Tâche interne
            </label>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold text-slate-900">Rattachements</h2>
        {!lookups && !lookupError ? (
          <Spinner label="Chargement des listes…" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select id="client" label="Client" value={clientId} onChange={setClientId} options={clients.map((u) => ({ value: String(u.id), label: userLabel(u) }))} />
              <Select id="contract" label="Contrat" value={contractId} onChange={setContractId} options={(lookups?.contracts ?? []).map((c) => ({ value: String(c.id), label: contractLabel(c) }))} />
              <Select id="site" label="Site" value={siteId} onChange={setSiteId} options={(lookups?.sites ?? []).map((s) => ({ value: String(s.id), label: siteLabel(s) }))} />
              <Select id="equipment" label="Équipement (matériel)" value={equipmentId} onChange={setEquipmentId} options={(lookups?.equipment ?? []).map((x) => ({ value: String(x.id), label: equipmentLabel(x) }))} />
              <Select id="equipmentSoft" label="Équipement (logiciel)" value={equipmentSoftId} onChange={setEquipmentSoftId} options={(lookups?.equipmentSofts ?? []).map((x) => ({ value: String(x.id), label: equipmentSoftLabel(x) }))} />
            </div>

            {mode === "create" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Select id="supervisor" label="Superviseur" value={supervisorId} onChange={setSupervisorId} options={technicians.map((u) => ({ value: String(u.id), label: userLabel(u) }))} />
                <Select id="solution" label="Solution" value={solutionId} onChange={setSolutionId} options={(lookups?.solutions ?? []).map((s) => ({ value: String(s.id), label: solutionLabel(s) }))} />
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                L'équipe, le superviseur et la solution se définissent depuis la page de détail du ticket. Une relation déjà définie ne peut pas être vidée depuis ce formulaire.
              </p>
            )}
          </>
        )}
      </section>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={saving}>Annuler</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Enregistrement…" : submitLabel}</button>
      </div>
    </form>
  );
}

function Select({ id, label, value, onChange, options }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Aucun —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
