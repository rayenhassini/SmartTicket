#!/usr/bin/env node
/* Smoke « Administration Phase B » : Utilisateurs, Types de support, Solutions, liens de contrat.
 *   BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... npm run smoke:admin-b
 * Crée des données « smoke8-… » et les supprime. Node 18+. */
const BASE = process.env.BASE_URL || 'http://localhost:3001';
const run = Date.now().toString(36);
const PW = 'Smoke-Passw0rd!';
let pass = 0, fail = 0;
async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await res.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { status: res.status, data: d };
}
const check = (l, ok, x = '') => { ok ? (pass++, console.log(`  OK    ${l}`)) : (fail++, console.log(`  ÉCHEC ${l} ${x}`)); };
const st = (l, r, s, c) => check(l, r.status === s && (!c || (r.data && r.data.code === c)), `(reçu ${r.status} ${r.data && (r.data.code || r.data.message) || ''}, attendu ${s} ${c || ''})`);
const login = (email, password = PW) => call('POST', '/auth/login', { body: { email, password } });

(async () => {
  console.log(`Smoke Administration Phase B sur ${BASE}\n`);
  const l = await login(process.env.PMO_EMAIL, process.env.PMO_PASSWORD);
  if (l.status !== 201) { console.log('Connexion PMO impossible.'); process.exit(2); }
  const t = l.data.access_token;
  const me = (await call('GET', '/users', { token: t })).data.find((u) => u.email === process.env.PMO_EMAIL);
  // Compte non-PMO réutilisé pour les contrôles 403 (supprimé à la fin).
  const plain = (await call('POST', '/users', { token: t, body: { firstName: 'S8', lastName: 'Plain', email: `smoke8-plain-${run}@example.com`, password: PW, authority: 'commercial', valid: true } })).data;
  const plainTok = (await login(plain.email)).data.access_token;

  console.log('1. Utilisateurs (R7)');
  const email = `smoke8-com-${run}@example.com`;
  const u = await call('POST', '/users', { token: t, body: { firstName: 'S8', lastName: 'Com', email, password: PW, authority: 'commercial', valid: true } });
  st('création commercial 201', u, 201);
  check('mot de passe jamais renvoyé', u.data && !('passwordHash' in u.data) && !('password' in u.data));
  st('email en double -> 409', await call('POST', '/users', { token: t, body: { firstName: 'a', lastName: 'b', email, password: PW, authority: 'commercial' } }), 409);
  st('PATCH profil (société) 200', await call('PATCH', `/users/${u.data.id}`, { token: t, body: { company: 'ACME', phoneNumber: null } }), 200);
  st('PATCH email déjà pris -> 409 lisible', await call('PATCH', `/users/${u.data.id}`, { token: t, body: { email: process.env.PMO_EMAIL } }), 409);
  st('PATCH avec password refusé (400)', await call('PATCH', `/users/${u.data.id}`, { token: t, body: { password: 'xxxxxxxxx' } }), 400);
  const ul = await login(email);
  st('compte actif peut se connecter', ul, 201);
  st('désactivation 200', await call('PATCH', `/users/${u.data.id}`, { token: t, body: { valid: false } }), 200);
  st('compte désactivé : jeton refusé immédiatement (401)', await call('GET', '/auth/me', { token: ul.data.access_token }).then((r) => (r.status === 404 ? call('GET', '/users', { token: ul.data.access_token }) : r)), 401);
  st('compte désactivé : connexion refusée', await login(email), 401);
  st('réactivation 200', await call('PATCH', `/users/${u.data.id}`, { token: t, body: { valid: true } }), 200);
  st('PMO : ne peut pas se supprimer (409 SELF_ACTION_FORBIDDEN)', await call('DELETE', `/users/${me.id}`, { token: t }), 409, 'SELF_ACTION_FORBIDDEN');
  st('PMO : ne peut pas se désactiver', await call('PATCH', `/users/${me.id}`, { token: t, body: { valid: false } }), 409, 'SELF_ACTION_FORBIDDEN');
  st('PMO : ne peut pas changer son rôle', await call('PATCH', `/users/${me.id}`, { token: t, body: { authority: 'assistant' } }), 409, 'SELF_ACTION_FORBIDDEN');
  st('PMO : modifier son propre profil reste possible', await call('PATCH', `/users/${me.id}`, { token: t, body: { company: 'Moi' } }), 200);
  st('non-PMO : /users interdit (403)', await call('GET', '/users', { token: (await login(email)).data.access_token }), 403);
  st('suppression autre compte 200/204', await call('DELETE', `/users/${u.data.id}`, { token: t }), 200);

  console.log('\n2. Types de support (R8) + suppression bloquée par FK (R10)');
  const ts = await call('POST', '/type-supports', { token: t, body: { supportName: `smoke8-ts-${run}`, supportEmail: `smoke8-ts-${run}@example.com` } });
  st('création type de support 201', ts, 201);
  check('creationDate posée par le serveur', ts.data && !!ts.data.creationDate);
  st('modification 200', await call('PATCH', `/type-supports/${ts.data.id}`, { token: t, body: { logoPath: '/logos/x.png' } }), 200);
  st('effacer le logo (null) 200', await call('PATCH', `/type-supports/${ts.data.id}`, { token: t, body: { logoPath: null } }), 200);
  st('email manquant -> 400', await call('POST', '/type-supports', { token: t, body: { supportName: 'x' } }), 400);
  const ctr = await call('POST', '/contracts', { token: t, body: { businessId: `smoke8-ct-${run}`, type: 'INFOGERANCE', nature: 'SYSTEME', sla: '4h', startDate: '2026-01-01', endDate: '2027-01-01' } });
  const lk = await call('POST', `/contracts/${ctr.data.id}/type-supports`, { token: t, body: { typeSupportId: Number(ts.data.id), supportId: 'SUP-1' } });
  st('lien contrat <-> type de support 201', lk, 201);
  const blocked = await call('DELETE', `/type-supports/${ts.data.id}`, { token: t });
  st('suppression d\'un type lié -> 409 REFERENCED_BY_OTHER_RECORDS', blocked, 409, 'REFERENCED_BY_OTHER_RECORDS');
  check('message 409 lisible', /encore utilisé/.test(blocked.data.message || ''), blocked.data && blocked.data.message);
  st('lien vers type inexistant -> 400', await call('POST', `/contracts/${ctr.data.id}/type-supports`, { token: t, body: { typeSupportId: 999999999, supportId: 'X' } }), 400);
  st('détacher le lien 200', await call('DELETE', `/contracts/${ctr.data.id}/type-supports/${lk.data.id}`, { token: t }), 200);
  st('suppression du type libre 200', await call('DELETE', `/type-supports/${ts.data.id}`, { token: t }), 200);
  st('non-PMO -> 403', await call('GET', '/type-supports', { token: plainTok }), 403);
  await call('DELETE', `/contracts/${ctr.data.id}`, { token: t });

  console.log('\n3. Solutions (R9)');
  const so = await call('POST', '/solutions', { token: t, body: { solutionText: `smoke8-solution-${run}`, proposedParId: Number(me.id), valid: true } });
  st('création solution 201', so, 201);
  st('modification du texte 200', await call('PATCH', `/solutions/${so.data.id}`, { token: t, body: { solutionText: `smoke8-solution-v2-${run}`, valid: false } }), 200);
  check('solution visible dans la liste, auteur chargé', (await call('GET', '/solutions', { token: t })).data.some((x) => x.id === so.data.id && x.proposedPar && String(x.proposedPar.id) === String(me.id)));
  st('auteur inexistant -> 400', await call('POST', '/solutions', { token: t, body: { solutionText: 'x', proposedParId: 999999999 } }), 400);
  st('non-PMO -> 403', await call('GET', '/solutions', { token: plainTok }), 403);
  const tkS = await call('POST', '/tickets', { token: t, body: { number: `smoke8-tk-${run}`, title: 'T', description: 'd', internalTask: true } });
  st('liaison solution <-> ticket', await call('PATCH', `/tickets/${tkS.data.id}`, { token: t, body: { solutionId: Number(so.data.id) } }), 200);
  st('suppression solution liée -> 200 (ticket détaché, jamais 500)', await call('DELETE', `/solutions/${so.data.id}`, { token: t }), 200);
  const tkAfter = await call('GET', `/tickets/${tkS.data.id}`, { token: t });
  check('ticket conservé sans solution', tkAfter.status === 200 && !tkAfter.data.solution);
  await call('DELETE', `/tickets/${tkS.data.id}`, { token: t });
  console.log('\n4. Liens de contrat : clients (R4b)');
  const cl = (await call('POST', '/users', { token: t, body: { firstName: 'S8', lastName: 'Client', email: `smoke8-client-${run}@example.com`, password: PW, authority: 'client', valid: true } })).data;
  const ct4 = (await call('POST', '/contracts', { token: t, body: { businessId: `smoke8-ct4-${run}`, type: 'INFOGERANCE', nature: 'SYSTEME', sla: '4h', startDate: '2026-01-01', endDate: '2027-01-01' } })).data;
  st('lier un client 201', await call('POST', `/contracts/${ct4.id}/clients`, { token: t, body: { clientId: Number(cl.id) } }), 201);
  const got = await call('GET', `/contracts/${ct4.id}`, { token: t });
  check('GET contrat renvoie le client lié', got.data.clients.some((c) => String(c.id) === String(cl.id)));
  const dupL = await call('POST', `/contracts/${ct4.id}/clients`, { token: t, body: { clientId: Number(cl.id) } });
  check('lien client en double : jamais 500', dupL.status === 409 || dupL.status === 201, `reçu ${dupL.status}`);
  st('lier un utilisateur inexistant -> 404', await call('POST', `/contracts/${ct4.id}/clients`, { token: t, body: { clientId: 999999999 } }), 404);
  st('retirer le client 200', await call('DELETE', `/contracts/${ct4.id}/clients/${cl.id}`, { token: t }), 200);
  check('client retiré', !(await call('GET', `/contracts/${ct4.id}`, { token: t })).data.clients.some((c) => String(c.id) === String(cl.id)));
  await call('DELETE', `/contracts/${ct4.id}`, { token: t });
  await call('DELETE', `/users/${cl.id}`, { token: t });
  console.log('\n5. Validations de dates / montant (R12)');
  const base = { type: 'INFOGERANCE', nature: 'SYSTEME', sla: '4h' };
  const bad = await call('POST', '/contracts', { token: t, body: { ...base, businessId: `smoke8-bad-${run}`, startDate: '2027-01-01', endDate: '2026-01-01' } });
  st('contrat fin < début -> 400', bad, 400);
  check('message de date lisible', /précède/.test(bad.data.message || ''), bad.data.message);
  st('contrat montant négatif -> 400', await call('POST', '/contracts', { token: t, body: { ...base, businessId: `smoke8-neg-${run}`, startDate: '2026-01-01', endDate: '2027-01-01', montant: '-5' } }), 400);
  const ok5 = await call('POST', '/contracts', { token: t, body: { ...base, businessId: `smoke8-ok5-${run}`, startDate: '2026-01-01', endDate: '2026-01-01' } });
  st('contrat fin = début accepté', ok5, 201);
  st('PATCH : nouvelle fin < début existant -> 400', await call('PATCH', `/contracts/${ok5.data.id}`, { token: t, body: { endDate: '2025-12-31' } }), 400);
  st('PATCH : début > fin existante -> 400', await call('PATCH', `/contracts/${ok5.data.id}`, { token: t, body: { startDate: '2026-02-01' } }), 400);
  st('PATCH : dates cohérentes 200', await call('PATCH', `/contracts/${ok5.data.id}`, { token: t, body: { endDate: '2026-06-01' } }), 200);
  await call('DELETE', `/contracts/${ok5.data.id}`, { token: t });
  st('équipement fin < début -> 400', await call('POST', '/equipment', { token: t, body: { sn: `smoke8-eq-${run}`, nomPiece: 'p', startDateContract: '2027-01-01', endDateContract: '2026-01-01' } }), 400);
  st('logiciel fin < début -> 400', await call('POST', '/equipment-softs', { token: t, body: { equipmentName: `smoke8-soft-${run}`, startDateContract: '2027-01-01', endDateContract: '2026-01-01' } }), 400);
  const eq5 = await call('POST', '/equipment', { token: t, body: { sn: `smoke8-eq5-${run}`, nomPiece: 'p', startDateContract: '2026-01-01', endDateContract: '2027-01-01' } });
  st('équipement PATCH fin < début -> 400', await call('PATCH', `/equipment/${eq5.data.id}`, { token: t, body: { endDateContract: '2025-01-01' } }), 400);
  st('équipement PATCH valid=false seul 200 (R14)', await call('PATCH', `/equipment/${eq5.data.id}`, { token: t, body: { valid: false } }), 200);
  check('équipement inactif toujours listé par l\'API (masquage côté formulaire)', (await call('GET', '/equipment', { token: t })).data.some((x) => x.id === eq5.data.id && x.valid === false));
  await call('DELETE', `/equipment/${eq5.data.id}`, { token: t });
  await call('DELETE', `/users/${plain.id}`, { token: t });
  console.log(`\n${pass} OK, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
