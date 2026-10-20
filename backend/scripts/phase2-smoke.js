#!/usr/bin/env node
/* Smoke test Phase 2 (équipes) — à lancer contre un backend RÉEL en marche, migration 001 appliquée.
 *
 *   BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... npm run smoke:phase2
 *
 * Crée des comptes « smoke2-…@example.com » et des équipes « smoke2-… » qui ne peuvent PAS être
 * supprimés via l'API (une équipe non vide est indissoluble par conception) : voir PHASE2.md
 * (« Nettoyage ») pour le SQL de nettoyage. Node 18+. */
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
function check(label, ok, extra = '') {
  if (ok) { pass++; console.log(`  OK    ${label}`); } else { fail++; console.log(`  ÉCHEC ${label} ${extra}`); }
}
const st = (label, res, status, code) =>
  check(label, res.status === status && (!code || (res.data && res.data.code === code)), `(reçu ${res.status} ${res.data && res.data.code || ''}, attendu ${status} ${code || ''})`);

async function login(email, password = PASSWORD) {
  const r = await call('POST', '/auth/login', { body: { email, password } });
  return r.status < 300 ? r.data.access_token : null;
}
async function mkUser(pmo, authority, tag) {
  const email = `smoke2-${tag}-${run}@example.com`;
  const r = await call('POST', '/users', { token: pmo, body: { email, password: PASSWORD, firstName: 'Smoke2', lastName: tag, authority, valid: true } });
  if (r.status !== 201) throw new Error(`création ${tag}: ${r.status} ${JSON.stringify(r.data)}`);
  return { id: Number(r.data.id), email };
}

(async () => {
  console.log(`Smoke Phase 2 sur ${BASE}\n`);
  let pmo;
  if (process.env.PMO_EMAIL && process.env.PMO_PASSWORD) pmo = await login(process.env.PMO_EMAIL, process.env.PMO_PASSWORD);
  else {
    const b = await call('POST', '/auth/bootstrap', { body: { email: `smoke2-boot-${run}@example.com`, password: PASSWORD, firstName: 'Smoke2', lastName: 'Boot', authority: 'pmo' } });
    pmo = b.status === 201 ? b.data.access_token : null;
  }
  if (!pmo) { console.log('Token PMO introuvable (fournir PMO_EMAIL / PMO_PASSWORD).'); process.exit(2); }

  console.log('1. Comptes de test');
  const t = {};
  for (const tag of ['t1', 't2', 't3', 't4', 't5']) t[tag] = await mkUser(pmo, 'technician', tag);
  const client = await mkUser(pmo, 'client', 'client');
  const assistant = await mkUser(pmo, 'assistant', 'assistant');
  const t1Token = await login(t.t1.email), clientToken = await login(client.email), assistantToken = await login(assistant.email);
  check('logins technicien / client / assistant', t1Token && clientToken && assistantToken);

  console.log('\n2. Droits (Phase 1 toujours active)');
  for (const [name, tk] of [['client', clientToken], ['assistant', assistantToken], ['technician', t1Token]]) {
    st(`${name} : GET /teams → 403`, await call('GET', '/teams', { token: tk }), 403);
    st(`${name} : POST /teams → 403`, await call('POST', '/teams', { token: tk, body: { name: `smoke2-x-${run}` } }), 403);
  }
  st('client : GET /teams/mine → 403', await call('GET', '/teams/mine', { token: clientToken }), 403);
  st('technicien sans équipe : GET /teams/mine → 404', await call('GET', '/teams/mine', { token: t1Token }), 404);
  st('sans token : GET /teams → 401', await call('GET', '/teams'), 401);

  console.log('\n3. Équipe vide, premier membre = responsable, paliers d\'effectif');
  const A = await call('POST', '/teams', { token: pmo, body: { name: `smoke2-A-${run}` } });
  st('créer une équipe vide → 201', A, 201);
  check('leader null, effectif « empty »', A.data.leaderId === null && A.data.staffing === 'empty' && A.data.memberCount === 0);
  st('nom en double → 409', await call('POST', '/teams', { token: pmo, body: { name: `smoke2-A-${run}` } }), 409, 'TEAM_NAME_TAKEN');
  st('nom vide → 400', await call('POST', '/teams', { token: pmo, body: { name: '   ' } }), 400);
  const idA = A.data.id;
  let v = await call('POST', `/teams/${idA}/members`, { token: pmo, body: { userId: t.t1.id } });
  st('ajouter t1 → 201', v, 201);
  check('t1 est responsable, effectif « critical » (rouge)', v.data.leaderId === t.t1.id && v.data.staffing === 'critical');
  check('événement first_member', v.data.leaderEvents[0].reason === 'first_member');
  v = await call('POST', `/teams/${idA}/members`, { token: pmo, body: { userId: t.t2.id } });
  check('2 membres : « warning » (orange), responsable inchangé', v.data.staffing === 'warning' && v.data.leaderId === t.t1.id);
  await call('POST', `/teams/${idA}/members`, { token: pmo, body: { userId: t.t3.id } });
  v = await call('POST', `/teams/${idA}/members`, { token: pmo, body: { userId: t.t4.id } });
  check('4 membres : « normal »', v.data.staffing === 'normal' && v.data.memberCount === 4);
  st('ajouter un client → 400', await call('POST', `/teams/${idA}/members`, { token: pmo, body: { userId: client.id } }), 400);
  st('ajouter t1 deux fois → 409', await call('POST', `/teams/${idA}/members`, { token: pmo, body: { userId: t.t1.id } }), 409, 'ALREADY_MEMBER');
  st('userId invalide → 400', await call('POST', `/teams/${idA}/members`, { token: pmo, body: { userId: 'abc' } }), 400);

  console.log('\n4. Lecture technicien : sa propre équipe uniquement');
  const mine = await call('GET', '/teams/mine', { token: t1Token });
  st('t1 : GET /teams/mine → 200', mine, 200);
  check('nom, 4 membres, aucun email ni effectif', mine.data.memberCount === 4 && !('email' in mine.data.members[0]) && !('staffing' in mine.data));

  console.log('\n5. Interdit de descendre à 0');
  const B = await call('POST', '/teams', { token: pmo, body: { name: `smoke2-B-${run}` } });
  const idB = B.data.id;
  await call('POST', `/teams/${idB}/members`, { token: pmo, body: { userId: t.t5.id } });
  st('retirer le seul membre → 409', await call('DELETE', `/teams/${idB}/members/${t.t5.id}`, { token: pmo }), 409, 'LAST_MEMBER');
  st('transférer le seul membre → 409', await call('POST', `/teams/${idB}/members/${t.t5.id}/transfer`, { token: pmo, body: { targetTeamId: idA } }), 409, 'LAST_MEMBER');
  st('t5 déjà dans B, l\'ajouter à A → 409', await call('POST', `/teams/${idA}/members`, { token: pmo, body: { userId: t.t5.id } }), 409, 'ALREADY_IN_OTHER_TEAM');

  console.log('\n6. Succession sur retrait du responsable (plus ancien joined_at)');
  v = await call('DELETE', `/teams/${idA}/members/${t.t1.id}`, { token: pmo });
  st('retirer le responsable t1 → 200', v, 200);
  check('t2 (le plus ancien restant) devient responsable', v.data.leaderId === t.t2.id && v.data.memberCount === 3);
  check('événement auto_succession', v.data.leaderEvents[0].reason === 'auto_succession');
  st('t1 retiré de nouveau → 404', await call('DELETE', `/teams/${idA}/members/${t.t1.id}`, { token: pmo }), 404);

  console.log('\n7. Responsable manuel');
  st('responsable non membre → 409', await call('PATCH', `/teams/${idA}/leader`, { token: pmo, body: { userId: t.t5.id } }), 409, 'LEADER_NOT_MEMBER');
  v = await call('PATCH', `/teams/${idA}/leader`, { token: pmo, body: { userId: t.t4.id } });
  check('t4 désigné responsable (manual)', v.status === 200 && v.data.leaderId === t.t4.id && v.data.leaderEvents[0].reason === 'manual');

  console.log('\n8. Transfert');
  v = await call('POST', `/teams/${idA}/members/${t.t3.id}/transfer`, { token: pmo, body: { targetTeamId: idB } });
  st('transférer t3 de A vers B → 200', v, 200);
  const joined = v.data.members.find((m) => m.userId === t.t3.id);
  check('t3 dans B, pas responsable (t5 reste responsable), joined_at récent', joined && !joined.isLeader && v.data.leaderId === t.t5.id && Date.now() - new Date(joined.joinedAt).getTime() < 60000);
  st('source = cible → 400', await call('POST', `/teams/${idB}/members/${t.t3.id}/transfer`, { token: pmo, body: { targetTeamId: idB } }), 400);
  st('équipe cible inexistante → 404', await call('POST', `/teams/${idB}/members/${t.t3.id}/transfer`, { token: pmo, body: { targetTeamId: 999999999 } }), 404);

  console.log('\n9. Comptes : suppression / rôle / désactivation d\'un membre');
  st('DELETE /users d\'un membre → 409', await call('DELETE', `/users/${t.t4.id}`, { token: pmo }), 409, 'USER_IS_TEAM_MEMBER');
  st('changer le rôle d\'un membre → 409', await call('PATCH', `/users/${t.t4.id}`, { token: pmo, body: { authority: 'client' } }), 409, 'USER_IS_TEAM_MEMBER');
  const t5Token = await login(t.t5.email);
  v = await call('PATCH', `/users/${t.t5.id}`, { token: pmo, body: { valid: false } });
  st('valid=false sur t5 (responsable de B, 2 membres) → 200', v, 200);
  let b = await call('GET', `/teams/${idB}`, { token: pmo });
  check('t5 retiré de B, t3 devient responsable', b.data.memberCount === 1 && b.data.leaderId === t.t3.id && b.data.leaderEvents[0].reason === 'auto_succession');
  st('token de t5 désactivé → 401', await call('GET', '/teams/mine', { token: t5Token }), 401);
  st('valid=false sur le dernier membre (t3) → 409', await call('PATCH', `/users/${t.t3.id}`, { token: pmo, body: { valid: false } }), 409, 'LAST_MEMBER');
  check('t3 toujours actif (login possible)', !!(await login(t.t3.email)));

  console.log('\n10. Techniciens et suppression d\'équipe');
  const techs = await call('GET', '/teams/technicians', { token: pmo });
  check('liste des techniciens avec leur équipe', techs.status === 200 && techs.data.find((x) => x.id === t.t4.id)?.teamName === `smoke2-A-${run}`);
  st('supprimer une équipe non vide → 409', await call('DELETE', `/teams/${idA}`, { token: pmo }), 409, 'TEAM_NOT_EMPTY');
  const C = await call('POST', '/teams', { token: pmo, body: { name: `smoke2-C-${run}` } });
  st('renommer une équipe vide → 200', await call('PATCH', `/teams/${C.data.id}`, { token: pmo, body: { name: `smoke2-C2-${run}` } }), 200);
  st('supprimer une équipe vide → 200', await call('DELETE', `/teams/${C.data.id}`, { token: pmo }), 200);
  st('équipe supprimée → 404', await call('GET', `/teams/${C.data.id}`, { token: pmo }), 404);
  const list = await call('GET', '/teams', { token: pmo });
  check('liste : effectif et responsable présents', list.status === 200 && list.data.every((x) => 'staffing' in x && 'memberCount' in x));

  console.log(`\nRésultat : ${pass} OK, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
