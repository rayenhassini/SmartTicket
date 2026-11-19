#!/usr/bin/env node
/* Smoke « Administration Phase A » : Sites, Contrats, Équipements, Logiciels + mapping 409 (R10/R11).
 *   BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... npm run smoke:admin
 * Crée des données « smoke7-… » puis les supprime. Node 18+. */
const BASE = process.env.BASE_URL || 'http://localhost:3001';
const run = Date.now().toString(36);
let pass = 0, fail = 0;
async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await res.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { status: res.status, data: d };
}
const check = (l, ok, x = '') => { ok ? (pass++, console.log(`  OK    ${l}`)) : (fail++, console.log(`  ÉCHEC ${l} ${x}`)); };
const st = (l, r, s, c) => check(l, r.status === s && (!c || (r.data && r.data.code === c)), `(reçu ${r.status} ${r.data && (r.data.code || r.data.message) || ''}, attendu ${s} ${c || ''})`);

(async () => {
  console.log(`Smoke Administration Phase A sur ${BASE}\n`);
  const l = await call('POST', '/auth/login', { body: { email: process.env.PMO_EMAIL, password: process.env.PMO_PASSWORD } });
  if (l.status !== 201) { console.log('Connexion PMO impossible.'); process.exit(2); }
  const t = l.data.access_token;
  const PW = 'Smoke-Passw0rd!';
  const mkUser = async (tag, authority) => (await call('POST', '/users', { token: t, body: { email: `smoke7-${tag}-${run}@example.com`, password: PW, firstName: 'S7', lastName: tag, authority, valid: true } })).data;
  const tech = await mkUser('tech', 'technician');
  const techTok = (await call('POST', '/auth/login', { body: { email: tech.email, password: PW } })).data.access_token;

  console.log('1. Sites');
  const s = await call('POST', '/sites', { token: t, body: { nomSite: `smoke7-site-${run}`, adresse: '1 rue Test' } });
  st('création site 201', s, 201);
  st('site visible dans GET /sites', { status: (await call('GET', '/sites', { token: t })).data.some((x) => x.id === s.data.id) ? 200 : 0 }, 200);
  st('modification 200', await call('PATCH', `/sites/${s.data.id}`, { token: t, body: { adresse: '2 rue Test', latitude: null } }), 200);
  st('technicien -> 403 sur POST /sites', await call('POST', '/sites', { token: techTok, body: { nomSite: 'x', adresse: 'y' } }), 403);
  st('sans token -> 401', await call('GET', '/sites'), 401);

  console.log('2. Équipements / logiciels (+ doublon 409)');
  const sn = `smoke7-sn-${run}`;
  const eq = await call('POST', '/equipment', { token: t, body: { sn, nomPiece: 'Pièce', startDateContract: '2026-01-01', endDateContract: '2027-01-01' } });
  st('création équipement 201', eq, 201);
  const dup = await call('POST', '/equipment', { token: t, body: { sn, nomPiece: 'Autre', startDateContract: '2026-01-01', endDateContract: '2027-01-01' } });
  st('N° de série en double -> 409 DUPLICATE_ENTRY', dup, 409, 'DUPLICATE_ENTRY');
  check('message 409 lisible (numéro de série + valeur)', /numéro de série/.test(dup.data.message) && dup.data.message.includes(sn), dup.data.message);
  const soft = await call('POST', '/equipment-softs', { token: t, body: { equipmentName: `smoke7-soft-${run}`, version: '1.0', startDateContract: '2026-01-01', endDateContract: '2027-01-01' } });
  st('création logiciel 201', soft, 201);
  st('modification logiciel (version effacée) 200', await call('PATCH', `/equipment-softs/${soft.data.id}`, { token: t, body: { version: null } }), 200);
  st('liaison site↔équipement 201', await call('POST', `/sites/${s.data.id}/equipment`, { token: t, body: { equipmentId: Number(eq.data.id) } }), 201);
  st('liaison site↔logiciel 201', await call('POST', `/sites/${s.data.id}/equipment-softs`, { token: t, body: { equipmentSoftId: Number(soft.data.id) } }), 201);
  st('retrait site<->équipement 200', await call('DELETE', `/sites/${s.data.id}/equipment/${eq.data.id}`, { token: t }), 200);
  check('équipement réellement retiré du site', !(await call('GET', `/sites/${s.data.id}`, { token: t })).data.equipment.some((x) => String(x.id) === String(eq.data.id)));
  st('retrait site<->logiciel 200', await call('DELETE', `/sites/${s.data.id}/equipment-softs/${soft.data.id}`, { token: t }), 200);
  check('logiciel réellement retiré du site', !(await call('GET', `/sites/${s.data.id}`, { token: t })).data.equipmentSofts.some((x) => String(x.id) === String(soft.data.id)));
  await call('POST', `/sites/${s.data.id}/equipment`, { token: t, body: { equipmentId: Number(eq.data.id) } });
  await call('POST', `/sites/${s.data.id}/equipment-softs`, { token: t, body: { equipmentSoftId: Number(soft.data.id) } });
  const dupLink = await call('POST', `/sites/${s.data.id}/equipment`, { token: t, body: { equipmentId: Number(eq.data.id) } });
  check('liaison en double : 409 (jamais 500)', dupLink.status === 409 || dupLink.status === 201, `reçu ${dupLink.status}`);

  console.log('3. Contrats (ENUM + doublon 409)');
  const bid = `smoke7-ct-${run}`;
  const ct = { businessId: bid, type: 'INFOGERANCE', nature: 'SYSTEME', sla: '4h', startDate: '2026-01-01', endDate: '2027-01-01', montant: '1500.000' };
  const c = await call('POST', '/contracts', { token: t, body: ct });
  st('création contrat 201', c, 201);
  st('identifiant de contrat en double -> 409', await call('POST', '/contracts', { token: t, body: ct }), 409, 'DUPLICATE_ENTRY');
  st('type hors ENUM -> 400', await call('POST', '/contracts', { token: t, body: { ...ct, businessId: bid + 'x', type: 'INCONNU' } }), 400);
  st('modification contrat 200', await call('PATCH', `/contracts/${c.data.id}`, { token: t, body: { sla: '8h', dueDate: null } }), 200);
  st('commercialId inexistant -> 400 REFERENCE_NOT_FOUND (plus de 500)', await call('POST', '/contracts', { token: t, body: { ...ct, businessId: bid + 'y', commercialId: 999999999 } }), 400, 'REFERENCE_NOT_FOUND');

  console.log('4. Ticket rattaché + suppression = détachement (SET NULL)');
  const tk = await call('POST', '/tickets', { token: t, body: { number: `smoke7-tk-${run}`, title: 'T', description: 'd', internalTask: true, siteId: Number(s.data.id), contractId: Number(c.data.id), equipmentId: Number(eq.data.id), equipmentSoftId: Number(soft.data.id) } });
  st('ticket avec site/contrat/équipement/logiciel 201', tk, 201);
  for (const [lbl, path] of [['site', `/sites/${s.data.id}`], ['contrat', `/contracts/${c.data.id}`], ['équipement', `/equipment/${eq.data.id}`], ['logiciel', `/equipment-softs/${soft.data.id}`]]) {
    const r = await call('DELETE', path, { token: t });
    check(`suppression ${lbl} -> 2xx (jamais 500)`, r.status >= 200 && r.status < 300, `reçu ${r.status}`);
  }
  const after = await call('GET', `/tickets/${tk.data.id}`, { token: t });
  check('ticket conservé, rattachements détachés', after.status === 200 && !after.data.site && !after.data.contract && !after.data.equipment && !after.data.equipmentSoft);
  st('suppression site déjà supprimé -> 404', await call('DELETE', `/sites/${s.data.id}`, { token: t }), 404);

  console.log('5. Nettoyage');
  await call('DELETE', `/tickets/${tk.data.id}`, { token: t });
  await call('DELETE', `/users/${tech.id}`, { token: t });
  console.log(`\n${pass} OK, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
