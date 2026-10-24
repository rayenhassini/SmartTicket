#!/usr/bin/env node
/* Smoke test « Espace technicien » (ticket ↔ équipe, périmètre, droits du responsable).
 * Backend RÉEL en marche, migrations 001, 002 et 003 appliquées :
 *   BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... npm run smoke:tech
 * Mode log des invitations (défaut dev) : le lien est lu dans `devLink`.
 * Crée des comptes « smoke4-…@example.com », des équipes « smoke4-… » et des tickets « smoke4-… » :
 * voir PHASE3B.md (« Nettoyage »). Node 18+. */
const BASE = process.env.BASE_URL || 'http://localhost:3001';
const PASSWORD = 'Smoke-Passw0rd!';
const run = Date.now().toString(36);
let pass = 0, fail = 0;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}
const check = (label, ok, extra = '') => { if (ok) { pass++; console.log(`  OK    ${label}`); } else { fail++; console.log(`  ÉCHEC ${label} ${extra}`); } };
const st = (label, res, status, code) =>
  check(label, res.status === status && (!code || (res.data && res.data.code === code)), `(reçu ${res.status} ${res.data && (res.data.code || res.data.message) || ''}, attendu ${status} ${code || ''})`);
async function login(email, password = PASSWORD) {
  const r = await call('POST', '/auth/login', { body: { email, password } });
  return r.status < 300 ? r.data : null;
}
async function mkUser(pmo, authority, tag) {
  const email = `smoke4-${tag}-${run}@example.com`;
  const r = await call('POST', '/users', { token: pmo, body: { email, password: PASSWORD, firstName: 'Smoke4', lastName: tag, authority, valid: true } });
  if (r.status !== 201) throw new Error(`création ${tag}: ${r.status} ${JSON.stringify(r.data)}`);
  return { id: Number(r.data.id), email };
}
const mkTeam = async (pmo, tag) => (await call('POST', '/teams', { token: pmo, body: { name: `smoke4-${tag}-${run}` } })).data.id;
const mkTicket = async (pmo, tag) => (await call('POST', '/tickets', { token: pmo, body: { number: `smoke4-${tag}-${run}`, title: `Ticket ${tag}`, description: 'smoke espace technicien' } })).data;
const ids = (list) => list.tickets.map((t) => Number(t.id));

(async () => {
  console.log(`Smoke Espace technicien sur ${BASE}\n`);
  let pmoLogin;
  if (process.env.PMO_EMAIL && process.env.PMO_PASSWORD) pmoLogin = await login(process.env.PMO_EMAIL, process.env.PMO_PASSWORD);
  else {
    const b = await call('POST', '/auth/bootstrap', { body: { email: `smoke4-boot-${run}@example.com`, password: PASSWORD, firstName: 'Smoke4', lastName: 'Boot', authority: 'pmo' } });
    pmoLogin = b.status === 201 ? b.data : null;
  }
  if (!pmoLogin) { console.log('Token PMO introuvable (fournir PMO_EMAIL / PMO_PASSWORD).'); process.exit(2); }
  const pmo = pmoLogin.access_token;

  console.log('1. Mise en place : équipes A (t1 responsable, t2) et B (t3), t4 sans équipe, un client');
  const t = {};
  for (const tag of ['t1', 't2', 't3', 't4']) t[tag] = await mkUser(pmo, 'technician', tag);
  const client = await mkUser(pmo, 'client', 'client');
  const A = await mkTeam(pmo, 'A'), B = await mkTeam(pmo, 'B'), C = await mkTeam(pmo, 'C');
  await call('POST', `/teams/${A}/members`, { token: pmo, body: { userId: t.t1.id } });
  await call('POST', `/teams/${A}/members`, { token: pmo, body: { userId: t.t2.id } });
  await call('POST', `/teams/${B}/members`, { token: pmo, body: { userId: t.t3.id } });
  const L = {};
  for (const tag of ['t1', 't2', 't3', 't4']) L[tag] = await login(t[tag].email);
  const tok = (tag) => L[tag].access_token;
  const clientTok = (await login(client.email)).access_token;
  check('login technicien : authority = technician (aiguillage frontend)', L.t1.user.authority === 'technician' && pmoLogin.user.authority === 'pmo');

  console.log('\n2. Ticket non assigné : invisible pour tous les techniciens');
  const T1 = await mkTicket(pmo, 'T1');
  check('ticket créé « Not Assigned », sans équipe', T1.status === 'Not Assigned' && !T1.teamId);
  for (const tag of ['t1', 't2', 't3', 't4']) {
    const l = await call('GET', '/me/tickets', { token: tok(tag) });
    check(`${tag} : GET /me/tickets ne contient pas T1`, l.status === 200 && !ids(l.data).includes(Number(T1.id)));
  }

  console.log('\n3. Le PMO assigne l\'équipe A (Not Assigned → Assigned)');
  st('technicien : PATCH /tickets/:id/team → 403', await call('PATCH', `/tickets/${T1.id}/team`, { token: tok('t1'), body: { teamId: Number(A) } }), 403);
  st('équipe inexistante → 404', await call('PATCH', `/tickets/${T1.id}/team`, { token: pmo, body: { teamId: 999999999 } }), 404);
  st('teamId invalide → 400', await call('PATCH', `/tickets/${T1.id}/team`, { token: pmo, body: { teamId: 'x' } }), 400);
  const as = await call('PATCH', `/tickets/${T1.id}/team`, { token: pmo, body: { teamId: Number(A) } });
  st('PMO : assigner A → 200', as, 200);
  check('statut Assigned + équipe A + date d\'assignation', as.data.status === 'Assigned' && as.data.team && Number(as.data.team.id) === Number(A) && !!as.data.assignedDate);

  console.log('\n4. Périmètre : visible pour les membres de A, invisible ailleurs (filtrage serveur)');
  const l1 = await call('GET', '/me/tickets', { token: tok('t1') });
  const l2 = await call('GET', '/me/tickets', { token: tok('t2') });
  check('t1 (responsable) voit T1, isLeader = true', ids(l1.data).includes(Number(T1.id)) && l1.data.isLeader === true);
  check('t2 (simple) voit T1, isLeader = false', ids(l2.data).includes(Number(T1.id)) && l2.data.isLeader === false);
  const l3 = await call('GET', '/me/tickets', { token: tok('t3') }), l4 = await call('GET', '/me/tickets', { token: tok('t4') });
  check('t3 (équipe B) ne voit pas T1', l3.status === 200 && !ids(l3.data).includes(Number(T1.id)));
  check('t4 (sans équipe) : liste vide', l4.status === 200 && l4.data.tickets.length === 0 && l4.data.teamId === null);
  st('t2 : détail de T1 → 200', await call('GET', `/me/tickets/${T1.id}`, { token: tok('t2') }), 200);
  st('t3 (hors équipe) : détail de T1 → 404', await call('GET', `/me/tickets/${T1.id}`, { token: tok('t3') }), 404);
  st('t4 (sans équipe) : détail de T1 → 404', await call('GET', `/me/tickets/${T1.id}`, { token: tok('t4') }), 404);
  st('client : GET /me/tickets → 403', await call('GET', '/me/tickets', { token: clientTok }), 403);
  st('PMO : GET /me/tickets → 403 (le PMO utilise /tickets)', await call('GET', '/me/tickets', { token: pmo }), 403);
  st('sans token → 401', await call('GET', '/me/tickets'), 401);
  st('technicien : GET /tickets (route PMO) → 403', await call('GET', '/tickets', { token: tok('t1') }), 403);
  st('technicien : PATCH /tickets/:id/status (route PMO) → 403', await call('PATCH', `/tickets/${T1.id}/status`, { token: tok('t1'), body: { status: 'Closed' } }), 403);

  console.log('\n5. Technicien simple : consultation seulement (API)');
  st('t2 : changer le statut → 403 NOT_TEAM_LEADER', await call('PATCH', `/me/tickets/${T1.id}/status`, { token: tok('t2'), body: { status: 'In Progress' } }), 403, 'NOT_TEAM_LEADER');
  st('t2 : saisir une solution → 403 NOT_TEAM_LEADER', await call('PUT', `/me/tickets/${T1.id}/solution`, { token: tok('t2'), body: { solutionText: 'x' } }), 403, 'NOT_TEAM_LEADER');
  st('t3 (autre équipe, même si responsable de B) : statut sur T1 → 404', await call('PATCH', `/me/tickets/${T1.id}/status`, { token: tok('t3'), body: { status: 'In Progress' } }), 404);
  st('t3 : solution sur T1 → 404', await call('PUT', `/me/tickets/${T1.id}/solution`, { token: tok('t3'), body: { solutionText: 'x' } }), 404);

  console.log('\n6. Responsable de A : statuts autorisés et solution');
  st('statut « Assigned » refusé (hors liste) → 400', await call('PATCH', `/me/tickets/${T1.id}/status`, { token: tok('t1'), body: { status: 'Assigned' } }), 400);
  st('statut « Not Assigned » refusé → 400', await call('PATCH', `/me/tickets/${T1.id}/status`, { token: tok('t1'), body: { status: 'Not Assigned' } }), 400);
  for (const s of ['In Progress', 'On Hold', 'Resolved']) {
    const r = await call('PATCH', `/me/tickets/${T1.id}/status`, { token: tok('t1'), body: { status: s } });
    check(`t1 : statut → ${s}`, r.status === 200 && r.data.ticket.status === s, `(reçu ${r.status})`);
  }
  st('solution vide → 400', await call('PUT', `/me/tickets/${T1.id}/solution`, { token: tok('t1'), body: { solutionText: '   ' } }), 400);
  const sol1 = await call('PUT', `/me/tickets/${T1.id}/solution`, { token: tok('t1'), body: { solutionText: 'Redémarrage du service puis mise à jour du firmware.' } });
  st('t1 : saisir une solution → 200', sol1, 200);
  const solId = sol1.data.ticket.solution && sol1.data.ticket.solution.id;
  check('solution liée, valide, proposée par t1', !!solId && sol1.data.ticket.solution.valid === true);
  const sol2 = await call('PUT', `/me/tickets/${T1.id}/solution`, { token: tok('t1'), body: { solutionText: 'Solution révisée.' } });
  check('mise à jour : même solution, texte modifié', sol2.status === 200 && sol2.data.ticket.solution.id === solId && sol2.data.ticket.solution.solutionText === 'Solution révisée.');

  console.log('\n7. Visibilité des mises à jour : équipe et PMO');
  const seen2 = await call('GET', `/me/tickets/${T1.id}`, { token: tok('t2') });
  check('t2 voit « Resolved » + la solution', seen2.data.ticket.status === 'Resolved' && seen2.data.ticket.solution.solutionText === 'Solution révisée.' && !!seen2.data.ticket.resolvedDate);
  const seenP = await call('GET', `/tickets/${T1.id}`, { token: pmo });
  check('le PMO voit « Resolved » + la solution', seenP.data.status === 'Resolved' && seenP.data.solution && seenP.data.solution.solutionText === 'Solution révisée.');

  console.log('\n8. Clôture, réassignation, suppression');
  const cl = await call('PATCH', `/me/tickets/${T1.id}/status`, { token: tok('t1'), body: { status: 'Closed' } });
  check('t1 : statut → Closed (date de clôture)', cl.status === 200 && cl.data.ticket.status === 'Closed' && !!cl.data.ticket.closedDate);
  st('PMO : changer l\'équipe d\'un ticket Closed → 409', await call('PATCH', `/tickets/${T1.id}/team`, { token: pmo, body: { teamId: Number(B) } }), 409, 'TICKET_NOT_REASSIGNABLE');
  const T2 = await mkTicket(pmo, 'T2');
  await call('PATCH', `/tickets/${T2.id}/team`, { token: pmo, body: { teamId: Number(A) } });
  const del = await call('PATCH', `/me/tickets/${T2.id}/status`, { token: tok('t1'), body: { status: 'Deleted' } });
  check('t1 : statut → Deleted', del.status === 200 && del.data.ticket.status === 'Deleted');
  const after = await call('GET', '/me/tickets', { token: tok('t2') });
  check('un ticket « Deleted » disparaît de la liste de l\'équipe', !ids(after.data).includes(Number(T2.id)));
  st('… et son détail répond 404 pour l\'équipe', await call('GET', `/me/tickets/${T2.id}`, { token: tok('t2') }), 404);
  const pAll = await call('GET', `/tickets/${T2.id}`, { token: pmo });
  check('… mais le PMO le voit toujours (statut Deleted)', pAll.status === 200 && pAll.data.status === 'Deleted');

  console.log('\n9. Suppression d\'équipe : refusée si elle porte des tickets');
  const T3 = await mkTicket(pmo, 'T3');
  st('assigner T3 à l\'équipe C (vide)', await call('PATCH', `/tickets/${T3.id}/team`, { token: pmo, body: { teamId: Number(C) } }), 200);
  st('supprimer l\'équipe C (0 membre, 1 ticket) → 409 TEAM_HAS_TICKETS', await call('DELETE', `/teams/${C}`, { token: pmo }), 409, 'TEAM_HAS_TICKETS');

  console.log('\n10. Parcours invitation → espace technicien (invitation dans l\'équipe C, vide : devient responsable)');
  const email = `smoke4-inv-${run}@example.com`;
  const inv = await call('POST', '/invitations', { token: pmo, body: { email, teamId: Number(C) } });
  if (inv.status !== 201 || !inv.data.devLink) { console.log('  (invitation : mode log requis pour lire le lien — étape ignorée)'); }
  else {
    const token = new URL(inv.data.devLink).searchParams.get('token');
    st('acceptation de l\'invitation → 201', await call('POST', '/invitations/accept', { body: { token, firstName: 'Inv', lastName: 'Tech', password: PASSWORD } }), 201);
    const li = await login(email);
    check('login du compte invité : authority = technician', li && li.user.authority === 'technician');
    const mine = await call('GET', '/me/tickets', { token: li.access_token });
    check('le nouveau technicien voit T3 de son équipe et est responsable (équipe vide → 1er membre)', mine.status === 200 && ids(mine.data).includes(Number(T3.id)) && mine.data.isLeader === true);
    st('il change le statut de T3 → 200', await call('PATCH', `/me/tickets/${T3.id}/status`, { token: li.access_token, body: { status: 'In Progress' } }), 200);
    st('… mais pas les tickets des autres équipes (T1 de A) → 404', await call('GET', `/me/tickets/${T1.id}`, { token: li.access_token }), 404);
    st('GET /tickets (route PMO) → 403', await call('GET', '/tickets', { token: li.access_token }), 403);
  }

  console.log(`\nRésultat : ${pass} OK, ${fail} échec(s).`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
