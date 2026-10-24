#!/usr/bin/env node
/* Smoke test Phase 3 (invitations technicien + email) — contre un backend RÉEL en marche,
 * migrations 001 et 002 appliquées.
 *
 *   BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... npm run smoke:phase3
 *
 * Mode log (défaut en dev, sans identifiants mail) : le lien est lu dans `devLink` de la réponse.
 * Mode smtp avec le serveur factice (node scripts/fake-smtp.js) : définir FAKE_SMTP_OUT=<fichier>
 * (le même que celui du serveur factice) : le lien est lu dans le mail reçu.
 * Étape « jeton expiré » : nécessite l'accès à la base (DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD,
 * DB_NAME) ; sinon elle est ignorée (couverte par les tests Jest).
 *
 * Crée des comptes « smoke3-…@example.com » et des équipes « smoke3-… » (une équipe non vide ne
 * peut pas être supprimée via l'API) : voir PHASE3.md (« Nettoyage »).
 * Les routes publiques sont limitées en débit (LOGIN_RATE_LIMIT par IP et par minute, défaut 10) :
 * attendre une minute entre deux exécutions, ou relever LOGIN_RATE_LIMIT côté backend. Node 18+. */
const fs = require('fs');
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
  const email = `smoke3-${tag}-${run}@example.com`;
  const r = await call('POST', '/users', { token: pmo, body: { email, password: PASSWORD, firstName: 'Smoke3', lastName: tag, authority, valid: true } });
  if (r.status !== 201) throw new Error(`création ${tag}: ${r.status} ${JSON.stringify(r.data)}`);
  return { id: Number(r.data.id), email };
}
const tokenFromLink = (link) => (link ? new URL(link).searchParams.get('token') : null);
// Lien d'invitation : devLink (mode log) ou dernier mail reçu par le serveur SMTP factice.
async function linkFor(inviteRes, email) {
  if (inviteRes.data && inviteRes.data.devLink) return inviteRes.data.devLink;
  const file = process.env.FAKE_SMTP_OUT;
  if (!file) return null;
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(file)) {
      const rec = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.to.includes(email)).pop();
      if (rec && rec.link) return rec.link;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}
const accept = (token, over = {}) => call('POST', '/invitations/accept', { body: { token, firstName: 'Nouveau', lastName: 'Tech', password: PASSWORD, ...over } });

(async () => {
  console.log(`Smoke Phase 3 sur ${BASE}\n`);
  let pmo;
  if (process.env.PMO_EMAIL && process.env.PMO_PASSWORD) pmo = await login(process.env.PMO_EMAIL, process.env.PMO_PASSWORD);
  else {
    const b = await call('POST', '/auth/bootstrap', { body: { email: `smoke3-boot-${run}@example.com`, password: PASSWORD, firstName: 'Smoke3', lastName: 'Boot', authority: 'pmo' } });
    pmo = b.status === 201 ? b.data.access_token : null;
  }
  if (!pmo) { console.log('Token PMO introuvable (fournir PMO_EMAIL / PMO_PASSWORD).'); process.exit(2); }

  console.log('1. Droits : seul le PMO crée / liste / annule');
  const tech0 = await mkUser(pmo, 'technician', 't0');
  const client = await mkUser(pmo, 'client', 'client');
  const t0Token = await login(tech0.email), clientToken = await login(client.email);
  const A = await call('POST', '/teams', { token: pmo, body: { name: `smoke3-A-${run}` } });
  const idA = A.data.id;
  for (const [name, tk] of [['technicien', t0Token], ['client', clientToken], ['sans token', undefined]]) {
    const expected = tk ? 403 : 401;
    st(`${name} : POST /invitations → ${expected}`, await call('POST', '/invitations', { token: tk, body: { email: `smoke3-x-${run}@example.com`, teamId: idA } }), expected);
    st(`${name} : GET /invitations → ${expected}`, await call('GET', '/invitations', { token: tk }), expected);
    st(`${name} : POST /invitations/1/cancel → ${expected}`, await call('POST', '/invitations/1/cancel', { token: tk }), expected);
  }

  console.log('\n2. Création (PMO) et validations');
  const e1 = `smoke3-n1-${run}@example.com`;
  st('teamId manquant → 400', await call('POST', '/invitations', { token: pmo, body: { email: e1 } }), 400);
  st('email invalide → 400', await call('POST', '/invitations', { token: pmo, body: { email: 'pas-un-email', teamId: idA } }), 400);
  st('équipe inexistante → 404', await call('POST', '/invitations', { token: pmo, body: { email: e1, teamId: 999999999 } }), 404);
  st('email déjà inscrit → 409', await call('POST', '/invitations', { token: pmo, body: { email: client.email, teamId: idA } }), 409, 'EMAIL_ALREADY_REGISTERED');
  const inv1 = await call('POST', '/invitations', { token: pmo, body: { email: e1, teamId: idA } });
  st('PMO : invitation + teamId → 201', inv1, 201);
  check('statut pending, équipe renvoyée, technicien', inv1.data.status === 'pending' && inv1.data.teamId === idA && inv1.data.authority === 'technician');
  check('aucun jeton ni hash dans la réponse (hors devLink du mode log)', !('token' in inv1.data));
  st('doublon pending → 409', await call('POST', '/invitations', { token: pmo, body: { email: e1, teamId: idA } }), 409, 'INVITATION_ALREADY_PENDING');
  const list = await call('GET', '/invitations?status=pending', { token: pmo });
  check('liste : l\'invitation est « pending »', list.status === 200 && list.data.some((i) => i.id === inv1.data.id));
  const link1 = await linkFor(inv1, e1);
  check(`lien d'invitation obtenu (${inv1.data.mailMode})`, !!link1 && link1.includes('/invite/accept?token='));
  const tok1 = tokenFromLink(link1);

  console.log('\n3. Page publique : validation du jeton');
  const v = await call('GET', `/invitations/validate?token=${encodeURIComponent(tok1)}`);
  st('validate sans authentification → 200', v, 200);
  check('expose uniquement email + équipe + expiration', v.data.email === e1 && Object.keys(v.data).sort().join() === 'email,expiresAt,teamName');
  st('jeton inconnu → 404', await call('GET', '/invitations/validate?token=inconnu'), 404, 'INVITATION_INVALID');

  console.log('\n4. Acceptation : compte technicien + membre + responsable (équipe vide)');
  st('mot de passe trop court → 400', await accept(tok1, { password: 'court' }), 400);
  st('champ non autorisé (authority) → 400', await accept(tok1, { authority: 'pmo' }), 400);
  st('jeton inconnu → 404', await accept('inconnu'), 404, 'INVITATION_INVALID');
  st('acceptation → 201', await accept(tok1), 201);
  const n1Token = await login(e1);
  check('le nouveau technicien peut se connecter', !!n1Token);
  const me = await call('GET', '/teams/mine', { token: n1Token });
  check('/teams/mine : équipe A, 1 membre', me.status === 200 && me.data.id === idA && me.data.memberCount === 1);
  const tA = await call('GET', `/teams/${idA}`, { token: pmo });
  check('équipe vide → le nouveau est RESPONSABLE (first_member), effectif critique', tA.data.leader && tA.data.leader.id !== undefined && tA.data.members[0].isLeader === true && tA.data.leaderEvents[0].reason === 'first_member' && tA.data.staffing === 'critical');
  st('réutilisation du lien → 410', await accept(tok1), 410, 'INVITATION_USED');
  st('validate après usage → 410', await call('GET', `/invitations/validate?token=${encodeURIComponent(tok1)}`), 410, 'INVITATION_USED');
  st('nouveau technicien : GET /tickets → 403 (aucun accès tickets)', await call('GET', '/tickets', { token: n1Token }), 403);
  st('nouveau technicien : GET /invitations → 403', await call('GET', '/invitations', { token: n1Token }), 403);
  st('email désormais inscrit : nouvelle invitation → 409', await call('POST', '/invitations', { token: pmo, body: { email: e1, teamId: idA } }), 409, 'EMAIL_ALREADY_REGISTERED');

  console.log('\n5. Équipe non vide : simple membre (règles Phase 2)');
  const e2 = `smoke3-n2-${run}@example.com`;
  const inv2 = await call('POST', '/invitations', { token: pmo, body: { email: e2, teamId: idA } });
  const tok2 = tokenFromLink(await linkFor(inv2, e2));
  st('acceptation → 201', await accept(tok2, { firstName: 'Second' }), 201);
  const tA2 = await call('GET', `/teams/${idA}`, { token: pmo });
  check('2 membres, responsable inchangé, effectif « warning »', tA2.data.memberCount === 2 && tA2.data.staffing === 'warning' && tA2.data.leaderId === tA.data.leaderId);

  console.log('\n6. Annulation (PMO)');
  const e3 = `smoke3-n3-${run}@example.com`;
  const inv3 = await call('POST', '/invitations', { token: pmo, body: { email: e3, teamId: idA } });
  const tok3 = tokenFromLink(await linkFor(inv3, e3));
  const c = await call('POST', `/invitations/${inv3.data.id}/cancel`, { token: pmo });
  check('annulation → 200, statut cancelled', c.status === 200 && c.data.status === 'cancelled', `(reçu ${c.status})`);
  st('lien annulé : validate → 410', await call('GET', `/invitations/validate?token=${encodeURIComponent(tok3)}`), 410, 'INVITATION_CANCELLED');
  st('lien annulé : acceptation → 410', await accept(tok3), 410, 'INVITATION_CANCELLED');
  st('double annulation → 409', await call('POST', `/invitations/${inv3.data.id}/cancel`, { token: pmo }), 409, 'INVITATION_NOT_PENDING');
  st('annuler une invitation inexistante → 404', await call('POST', '/invitations/999999999/cancel', { token: pmo }), 404);
  st('ré-inviter après annulation → 201', await call('POST', '/invitations', { token: pmo, body: { email: e3, teamId: idA } }), 201);

  console.log('\n7. Jeton expiré');
  const e4 = `smoke3-n4-${run}@example.com`;
  const inv4 = await call('POST', '/invitations', { token: pmo, body: { email: e4, teamId: idA } });
  const tok4 = tokenFromLink(await linkFor(inv4, e4));
  if (process.env.DB_HOST && process.env.DB_NAME) {
    const mysql = require('mysql2/promise');
    const db = await mysql.createConnection({ host: process.env.DB_HOST, port: +(process.env.DB_PORT || 3306), user: process.env.DB_USERNAME || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME });
    await db.query('UPDATE user_invitations SET expires_at = NOW(3) - INTERVAL 1 HOUR WHERE id = ?', [inv4.data.id]);
    await db.end();
    st('validate d\'un jeton expiré → 410', await call('GET', `/invitations/validate?token=${encodeURIComponent(tok4)}`), 410, 'INVITATION_EXPIRED');
    st('acceptation d\'un jeton expiré → 410', await accept(tok4), 410, 'INVITATION_EXPIRED');
    const l = await call('GET', '/invitations', { token: pmo });
    check('la liste affiche « expired »', l.data.find((i) => i.id === inv4.data.id).status === 'expired');
    st('ré-inviter après expiration → 201', await call('POST', '/invitations', { token: pmo, body: { email: e4, teamId: idA } }), 201);
  } else {
    console.log('  (ignoré : DB_HOST / DB_NAME non fournis — couvert par les tests Jest)');
  }

  console.log('\n8. Email inscrit entre l\'invitation et l\'acceptation');
  const e5 = `smoke3-n5-${run}@example.com`;
  const inv5 = await call('POST', '/invitations', { token: pmo, body: { email: e5, teamId: idA } });
  const tok5 = tokenFromLink(await linkFor(inv5, e5));
  await call('POST', '/users', { token: pmo, body: { email: e5, password: PASSWORD, firstName: 'Deja', lastName: 'Inscrit', authority: 'client', valid: true } });
  st('acceptation → 409', await accept(tok5), 409, 'EMAIL_ALREADY_REGISTERED');

  console.log(`\nRésultat : ${pass} OK, ${fail} échec(s).`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
