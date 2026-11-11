"use client";

import { useCallback, useEffect, useState } from "react";
import { CrudPage, Modal, type CrudConfig } from "@/components/crud";
import { ErrorBanner } from "@/components/ui";
import { errorMessage } from "@/lib/format";
import {
  linkSiteEquipment, linkSiteSoft, sitesApi, unlinkSiteEquipment, unlinkSiteSoft,
} from "@/lib/api/admin";
import { listEquipment, listEquipmentSofts, equipmentLabel, equipmentSoftLabel } from "@/lib/api/lookups";
import { ticketUsageWarning } from "@/lib/api/usage";
import type { Equipment, EquipmentSoft, Site } from "@/lib/types";

function SiteLinks({ siteId, onClose }: { siteId: Site["id"]; onClose: () => void }) {
  const [site, setSite] = useState<Site | null>(null);
  const [all, setAll] = useState<{ eq: Equipment[]; soft: EquipmentSoft[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [eqSel, setEqSel] = useState("");
  const [softSel, setSoftSel] = useState("");

  const load = useCallback(async () => {
    try {
      const [sites, eq, soft] = await Promise.all([sitesApi.list(), listEquipment(), listEquipmentSofts()]);
      setSite(sites.find((s) => String(s.id) === String(siteId)) ?? null);
      setAll({ eq, soft });
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [siteId]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setErr(null);
    try { await fn(); await load(); } catch (e) { setErr(errorMessage(e)); }
  }

  const linkedEq = new Set((site?.equipment ?? []).map((e) => String(e.id)));
  const linkedSoft = new Set((site?.equipmentSofts ?? []).map((e) => String(e.id)));

  return (
    <Modal title={`Équipements et logiciels — ${site?.nomSite ?? ""}`} onClose={onClose} wide>
      {err && <ErrorBanner message={err} />}
      {!site || !all ? <p className="text-sm text-slate-500">Chargement…</p> : (
        <div className="space-y-6 text-sm">
          <section>
            <h3 className="mb-2 font-medium">Équipements (matériel)</h3>
            <ul className="mb-2 space-y-1">
              {(site.equipment ?? []).length === 0 && <li className="text-slate-400">Aucun.</li>}
              {(site.equipment ?? []).map((e) => (
                <li key={String(e.id)} className="flex justify-between gap-2">
                  {equipmentLabel(e)}
                  <button className="text-red-700 underline" onClick={() => run(() => unlinkSiteEquipment(site.id, e.id))}>Retirer</button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <select className="input" value={eqSel} onChange={(e) => setEqSel(e.target.value)} aria-label="Équipement à ajouter">
                <option value="">— ajouter un équipement —</option>
                {all.eq.filter((e) => !linkedEq.has(String(e.id))).map((e) => <option key={String(e.id)} value={String(e.id)}>{equipmentLabel(e)}</option>)}
              </select>
              <button className="btn-secondary" disabled={!eqSel} onClick={() => run(async () => { await linkSiteEquipment(site.id, Number(eqSel)); setEqSel(""); })}>Ajouter</button>
            </div>
          </section>
          <section>
            <h3 className="mb-2 font-medium">Logiciels</h3>
            <ul className="mb-2 space-y-1">
              {(site.equipmentSofts ?? []).length === 0 && <li className="text-slate-400">Aucun.</li>}
              {(site.equipmentSofts ?? []).map((e) => (
                <li key={String(e.id)} className="flex justify-between gap-2">
                  {equipmentSoftLabel(e)}
                  <button className="text-red-700 underline" onClick={() => run(() => unlinkSiteSoft(site.id, e.id))}>Retirer</button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <select className="input" value={softSel} onChange={(e) => setSoftSel(e.target.value)} aria-label="Logiciel à ajouter">
                <option value="">— ajouter un logiciel —</option>
                {all.soft.filter((e) => !linkedSoft.has(String(e.id))).map((e) => <option key={String(e.id)} value={String(e.id)}>{equipmentSoftLabel(e)}</option>)}
              </select>
              <button className="btn-secondary" disabled={!softSel} onClick={() => run(async () => { await linkSiteSoft(site.id, Number(softSel)); setSoftSel(""); })}>Ajouter</button>
            </div>
          </section>
          <div className="flex justify-end"><button className="btn-primary" onClick={onClose}>Fermer</button></div>
        </div>
      )}
    </Modal>
  );
}

function LinksButton({ site, reload }: { site: Site; reload: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-secondary !px-3 !py-1" onClick={() => setOpen(true)}>Liens</button>
      {open && <SiteLinks siteId={site.id} onClose={() => { setOpen(false); reload(); }} />}
    </>
  );
}

const cfg: CrudConfig<Site> = {
  title: "Sites",
  noun: "site",
  fields: [
    { name: "nomSite", label: "Nom du site", type: "text", required: true, maxLength: 150 },
    { name: "adresse", label: "Adresse", type: "text", required: true, maxLength: 255 },
    { name: "latitude", label: "Latitude", type: "text", maxLength: 50 },
    { name: "longitude", label: "Longitude", type: "text", maxLength: 50 },
  ],
  columns: [
    { header: "Site", render: (s) => <span className="font-medium text-slate-900">{s.nomSite}</span> },
    { header: "Adresse", render: (s) => s.adresse },
    { header: "Équipements", render: (s) => s.equipment?.length ?? 0 },
    { header: "Logiciels", render: (s) => s.equipmentSofts?.length ?? 0 },
  ],
  searchText: (s) => `${s.nomSite} ${s.adresse}`,
  searchPlaceholder: "Rechercher un site (nom, adresse)…",
  rowLabel: (s) => `« ${s.nomSite} »`,
  ...sitesApi,
  toForm: (s) => ({ nomSite: s.nomSite, adresse: s.adresse, latitude: s.latitude ?? "", longitude: s.longitude ?? "" }),
  defaults: { nomSite: "", adresse: "", latitude: "", longitude: "" },
  deleteWarning: (s) => ticketUsageWarning("site", s.id),
  rowActions: (s, reload) => <LinksButton site={s} reload={reload} />,
};

export default function SitesPage() {
  return <CrudPage cfg={cfg} />;
}
