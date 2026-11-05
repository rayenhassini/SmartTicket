#!/usr/bin/env node
/* Smoke « Espace client » (Phase 4) : backend RÉEL en marche, migrations 001 → 006 appliquées.
 *   BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... npm run smoke:client
 * Facultatif :
 *   BACKEND_LOG=/chemin/journal-backend.log  → teste aussi le mot de passe oublié d'un client (mode mail « log »)
 *   DB_CMD="mysql -u root -pXXX smartticket_v1" → teste l'expiration d'invitation et le cas « ticket externe historique sans client »
 * Crée des comptes « smoke6-…@example.com », une équipe « smoke6-… » et des tickets « smoke6-… » (voir PHASE4.md, « Nettoyage »).
 * Mode log des invitations requis (défaut dev) : le lien est lu dans `devLink`. Node 18+. */
const fs = require('fs');
const { execSync } = require('child_process');
const BASE = process.env.BASE_URL || 'http://localhost:3001';
const LOG = process.env.BACKEND_LOG;
const DB = process.env.DB_CMD;
const PASSWORD = 'Smoke-Passw0rd!';
const run = Date.now().toString(36);
let pass = 0, fail = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await res.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { status: res.status, data: d };
}
const check = (l, ok, x = '') => { ok ? (pass++, console.log(`  OK    ${l}`)) : (fail++, console.log(`  ÉCHEC ${l} ${x}`)); };
const st = (l, r, s, c) => check(l, r.status === s && (!c || (r.data && r.data.code === c)), `(reçu ${r.status} ${r.data && (r.data.code || r.data.message) || ''}, attendu ${s} ${c || ''})`);
const login = (email, password = PASSWORD) => call('POST', '/auth/login', { body: { email, password } });
const sql = (q) => execSync(`${DB} -N -e "${q}"`).toString().trim();
const nums = (l) => l.map((t) => t.number);

(async () => {
  console.log(`Smoke Espace client sur ${BASE}\n`);
  const pmoL = await login(process.env.PMO_EMAIL, process.env.PMO_PASSWORD);
  if (pmoL.status !== 201) { console.log('Connexion PMO impossible (PMO_EMAIL / PMO_PASSWORD).'); process.exit(2); }
  const pmo = pmoL.data.access_token;
  const mk = async (tag, authority, extra = {}) => {
    const email = `smoke6-${tag}-${run}@example.com`;
    const r = await call('POST', '/users', { token: pmo, body: { email, password: PASSWORD, firstName: 'Smoke6', lastName: tag, authority, valid: true, ...extra } });
    if (r.status !== 201) throw new Error(`création ${tag} ${r.status} ${JSON.stringify(r.data)}`);
    return { id: Number(r.data.id), email };
  };
  const tk = (n, extra = {}) => call('POST', '/tickets', { token: pmo, body: { number: `smoke6-${n}-${run}`, title: `Titre ${n}`, description: `desc-${n} mot-secret-description`, ...extra } });

  console.log('1. Mise en place : clients A et B, un client désactivé, un technicien responsable (équipe T), une équipe vide');
  const cA = await mk('cA', 'client'), cB = await mk('cB', 'client'), cOff = await mk('cOff', 'client', { valid: false });
  const lead = await mk('lead', 'technician'), tech2 = await mk('tech2', 'technician');
  const teamT = (await call('POST', '/teams', { token: pmo, body: { name: `smoke6-T-${run}` } })).data.id;
  const teamE = (await call('POST', '/teams', { token: pmo, body: { name: `smoke6-E-${run}` } })).data.id;
  await call('POST', `/teams/${teamT}/members`, { token: pmo, body: { userId: lead.id } });
  await call('POST', `/teams/${teamT}/members`, { token: pmo, body: { userId: tech2.id } });
  const tokA = (await login(cA.email)).data.access_token, tokB = (await login(cB.email)).data.access_token;
  const tokLead = (await login(lead.email)).data.access_token, tokTech = (await login(tech2.email)).data.access_token;
  check('login client : authority = client (→ /client/tickets)', (await login(cA.email)).data.user.authority === 'client');

  console.log('\n2. Règle interne / externe (API PMO)');
  st('externe sans client → 409 CLIENT_REQUIRED', await tk('x1'), 409, 'CLIENT_REQUIRED');
  st('externe (Helpdesk) sans client → 409 CLIENT_REQUIRED', await tk('x2', { isHelpdesk: true }), 409, 'CLIENT_REQUIRED');
  const internal = await tk('int-noclient', { internalTask: true });
  st('interne sans client → 201', internal, 201);
  st('clientId = un technicien → 400 INVALID_CLIENT', await tk('x3', { clientId: lead.id }), 400, 'INVALID_CLIENT');
  st('clientId = un client désactivé → 400 INVALID_CLIENT', await tk('x4', { clientId: cOff.id }), 400, 'INVALID_CLIENT');
  st('clientId inexistant → 400 INVALID_CLIENT', await tk('x5', { clientId: 999999999 }), 400, 'INVALID_CLIENT');
  const TA1 = (await tk('A1', { clientId: cA.id })).data, TA2 = (await tk('A2', { clientId: cA.id })).data;
  const TA3 = (await tk('A3-internal', { clientId: cA.id, internalTask: true })).data;
  const TA4 = (await tk('A4-deleted', { clientId: cA.id })).data;
  const TB1 = (await tk('B1', { clientId: cB.id })).data;
  check('tickets externes avec client créés', !!(TA1 && TA2 && TA3 && TA4 && TB1 && TA1.id));
  st('mise à jour : passer un interne sans client en externe → 409 CLIENT_REQUIRED', await call('PATCH', `/tickets/${internal.data.id}`, { token: pmo, body: { internalTask: false } }), 409, 'CLIENT_REQUIRED');
  st('mise à jour : … avec un client → 200', await call('PATCH', `/tickets/${internal.data.id}`, { token: pmo, body: { internalTask: false, clientId: cB.id } }), 200);
  st('mise à jour : clientId = technicien → 400 INVALID_CLIENT', await call('PATCH', `/tickets/${TA2.id}`, { token: pmo, body: { clientId: lead.id } }), 400, 'INVALID_CLIENT');
  st('assigner une équipe à un ticket interne SANS client → 200 (autorisé)', await (async () => {
    const t = (await tk('int2', { internalTask: true })).data; return call('PATCH', `/tickets/${t.id}/team`, { token: pmo, body: { teamId: Number(teamE) } });
  })(), 200);
  if (DB) {
    const legacy = (await tk('legacy', { internalTask: true })).data;
    sql(`UPDATE tickets SET internal_task = 0 WHERE id = ${legacy.id}`); // simule un ticket externe historique sans client
    st('historique : assigner une équipe → 409 CLIENT_REQUIRED', await call('PATCH', `/tickets/${legacy.id}/team`, { token: pmo, body: { teamId: Number(teamT) } }), 409, 'CLIENT_REQUIRED');
    st('historique : modifier le titre seul (API) → 200, non bloqué', await call('PATCH', `/tickets/${legacy.id}`, { token: pmo, body: { title: 'Titre modifié' } }), 200);
    st('historique : changement de statut PMO non bloqué → 200', await call('PATCH', `/tickets/${legacy.id}/status`, { token: pmo, body: { status: 'On Hold' } }), 200);
    await call('PATCH', `/tickets/${legacy.id}`, { token: pmo, body: { internalTask: false, clientId: cA.id } });
    st('historique : après ajout d\'un client → assignation OK (200)', await call('PATCH', `/tickets/${legacy.id}/team`, { token: pmo, body: { teamId: Number(teamT) } }), 200);
  } else console.log('  (DB_CMD non fourni : cas « externe historique » ignoré)');

  await call('PATCH', `/tickets/${TA4.id}/status`, { token: pmo, body: { status: 'Deleted' } });

  console.log('\n3. Isolation : le client A ne voit que SES tickets externes non supprimés');
  const lA = await call('GET', '/client/tickets', { token: tokA });
  st('client A : GET /client/tickets → 200', lA, 200);
  check('liste A = A1, A2 (pas A3 interne, A4 supprimé, ni B1)', lA.status === 200 && nums(lA.data).includes(TA1.number) && nums(lA.data).includes(TA2.number) &&
    !nums(lA.data).includes(TA3.number) && !nums(lA.data).includes(TA4.number) && !nums(lA.data).includes(TB1.number));
  const lB = await call('GET', '/client/tickets', { token: tokB });
  check('liste B contient B1 (et le ticket requalifié en externe), pas ceux de A', nums(lB.data).includes(TB1.number) && !nums(lB.data).includes(TA1.number));
  st('A : détail de A1 → 200', await call('GET', `/client/tickets/${TA1.id}`, { token: tokA }), 200);
  st('A : détail du ticket de B → 404', await call('GET', `/client/tickets/${TB1.id}`, { token: tokA }), 404);
  st('A : détail de son ticket interne → 404', await call('GET', `/client/tickets/${TA3.id}`, { token: tokA }), 404);
  st('A : détail de son ticket supprimé → 404', await call('GET', `/client/tickets/${TA4.id}`, { token: tokA }), 404);
  st('A : ticket inexistant → 404', await call('GET', '/client/tickets/999999999', { token: tokA }), 404);
  st('A : id non numérique → 400', await call('GET', '/client/tickets/abc', { token: tokA }), 400);

  console.log('\n4. Vue restreinte (liste blanche de champs) et responsable');
  const d0 = (await call('GET', `/client/tickets/${TA1.id}`, { token: tokA })).data;
  const expected = ['closedDate', 'creationDate', 'description', 'id', 'number', 'resolvedDate', 'responsibleEmail', 'siteName', 'solutionText', 'status', 'title'];
  check('détail : exactement les champs prévus (rien d\'autre ne fuit)', JSON.stringify(Object.keys(d0).sort()) === JSON.stringify(expected), JSON.stringify(Object.keys(d0)));
  check('liste : mêmes champs restreints', JSON.stringify(Object.keys(lA.data[0]).sort()) === JSON.stringify(expected));
  check('sans équipe : responsibleEmail = null (« Non assigné »), pas de solution, statut Not Assigned', d0.responsibleEmail === null && d0.solutionText === null && d0.status === 'Not Assigned');
  await call('PATCH', `/tickets/${TA2.id}/team`, { token: pmo, body: { teamId: Number(teamE) } });
  check('équipe SANS leader : responsibleEmail = null (« Non assigné »)', (await call('GET', `/client/tickets/${TA2.id}`, { token: tokA })).data.responsibleEmail === null);
  st('PMO assigne l\'équipe T à A1 → 200', await call('PATCH', `/tickets/${TA1.id}/team`, { token: pmo, body: { teamId: Number(teamT) } }), 200);
  const d1 = (await call('GET', `/client/tickets/${TA1.id}`, { token: tokA })).data;
  check('équipe avec leader : responsibleEmail = email du leader, statut Assigned', d1.responsibleEmail === lead.email && d1.status === 'Assigned');
  st('responsable : statut → En cours', await call('PATCH', `/me/tickets/${TA1.id}/status`, { token: tokLead, body: { status: 'In Progress' } }), 200);
  st('responsable : saisit la solution', await call('PUT', `/me/tickets/${TA1.id}/solution`, { token: tokLead, body: { solutionText: 'Redémarrage du routeur.' } }), 200);
  const d2 = (await call('GET', `/client/tickets/${TA1.id}`, { token: tokA })).data;
  check('le client voit la solution alors que le ticket est encore « En cours »', d2.status === 'In Progress' && d2.solutionText === 'Redémarrage du routeur.');
  check('… et ne voit pas d\'autres métadonnées de la solution', !('solution' in d2) && !('proposedPar' in d2));
  await call('PATCH', `/me/tickets/${TA1.id}/status`, { token: tokLead, body: { status: 'Resolved' } });
  check('date de résolution visible une fois Résolu', !!(await call('GET', `/client/tickets/${TA1.id}`, { token: tokA })).data.resolvedDate);

  console.log('\n5. Filtre et recherche (côté serveur)');
  const byStatus = await call('GET', '/client/tickets?status=Resolved', { token: tokA });
  check('status=Resolved → seulement A1', byStatus.status === 200 && nums(byStatus.data).join() === TA1.number);
  const byAssigned = await call('GET', '/client/tickets?status=Assigned', { token: tokA });
  check('status=Assigned → A2 (équipe sans leader)', byAssigned.status === 200 && nums(byAssigned.data).join() === TA2.number);
  st('status=Deleted → 400 (jamais renvoyé au client)', await call('GET', '/client/tickets?status=Deleted', { token: tokA }), 400);
  st('status inconnu → 400', await call('GET', '/client/tickets?status=bogus', { token: tokA }), 400);
  const q1 = await call('GET', `/client/tickets?q=${encodeURIComponent(`smoke6-A1-${run}`)}`, { token: tokA });
  check('q sur le numéro → A1', q1.status === 200 && nums(q1.data).join() === TA1.number);
  const q2 = await call('GET', '/client/tickets?q=Titre%20A2', { token: tokA });
  check('q sur le titre → A2', nums(q2.data).join() === TA2.number);
  const q3 = await call('GET', '/client/tickets?q=mot-secret-description', { token: tokA });
  check('q sur la description seule → aucun résultat (numéro + titre uniquement)', q3.status === 200 && q3.data.length === 0);
  for (const wild of ['%', '_', '%25%25', '\\']) {
    const r = await call('GET', `/client/tickets?q=${encodeURIComponent(wild)}`, { token: tokA });
    check(`q « ${wild} » traité littéralement (pas de joker) → 0 résultat`, r.status === 200 && r.data.length === 0);
  }
  st('q trop long (101) → 400', await call('GET', `/client/tickets?q=${'a'.repeat(101)}`, { token: tokA }), 400);
  st('paramètre inconnu → 400', await call('GET', '/client/tickets?foo=bar', { token: tokA }), 400);
  check('q + statut combinés', (await call('GET', `/client/tickets?status=Resolved&q=A2`, { token: tokA })).data.length === 0);
  check('q ne traverse pas les clients (B cherche « A1 »)', (await call('GET', `/client/tickets?q=A1`, { token: tokB })).data.length === 0);

  console.log('\n6. Lecture seule et confinement du rôle client');
  const w = [
    ['POST', '/tickets', { number: `smoke6-w-${run}`, title: 'x', description: 'y', internalTask: true }],
    ['PATCH', `/tickets/${TA1.id}`, { title: 'piraté' }], ['DELETE', `/tickets/${TA1.id}`, undefined],
    ['PATCH', `/tickets/${TA1.id}/status`, { status: 'Closed' }], ['PATCH', `/tickets/${TA1.id}/team`, { teamId: Number(teamT) }],
    ['PATCH', `/tickets/${TA1.id}/solution`, { solutionId: 1 }], ['POST', `/tickets/${TA1.id}/technicians`, { technicianId: lead.id }],
    ['PATCH', `/me/tickets/${TA1.id}/status`, { status: 'Closed' }], ['PUT', `/me/tickets/${TA1.id}/solution`, { solutionText: 'x' }],
    ['POST', '/users', { email: `smoke6-evil-${run}@example.com`, password: PASSWORD, firstName: 'a', lastName: 'b', authority: 'pmo' }],
    ['POST', '/invitations', { email: `smoke6-x-${run}@example.com`, teamId: Number(teamT) }], ['POST', '/client-invitations', { email: `smoke6-y-${run}@example.com` }],
    ['POST', '/teams', { name: 'x' }],
  ];
  for (const [m, p, b] of w) st(`client : ${m} ${p.replace(/\/\d+/g, '/:id')} → 403`, await call(m, p, { token: tokA, body: b }), 403);
  for (const p of ['/tickets', '/users', '/teams', '/teams/mine', '/me/tickets', '/solutions', '/contracts', '/client-invitations', '/invitations'])
    st(`client : GET ${p} → 403`, await call('GET', p, { token: tokA }), 403);
  for (const [m, p] of [['POST', '/client/tickets'], ['PATCH', `/client/tickets/${TA1.id}`], ['PUT', `/client/tickets/${TA1.id}`], ['DELETE', `/client/tickets/${TA1.id}`]])
    st(`${m} ${p.replace(/\/\d+/g, '/:id')} : aucune route d'écriture côté client → 404`, await call(m, p, { token: tokA, body: { title: 'x' } }), 404);
  check('le ticket n\'a pas été modifié par ces tentatives', (await call('GET', `/tickets/${TA1.id}`, { token: pmo })).data.title === 'Titre A1');
  st('technicien : GET /client/tickets → 403', await call('GET', '/client/tickets', { token: tokTech }), 403);
  st('PMO : GET /client/tickets → 403', await call('GET', '/client/tickets', { token: pmo }), 403);
  st('sans token → 401', await call('GET', '/client/tickets'), 401);
  st('technicien : POST /client-invitations → 403', await call('POST', '/client-invitations', { token: tokTech, body: { email: `smoke6-z-${run}@example.com` } }), 403);
  st('technicien : GET /client-invitations → 403', await call('GET', '/client-invitations', { token: tokTech }), 403);

  console.log('\n7. Invitation client (PMO → acceptation publique)');
  const email = `smoke6-inv-${run}@example.com`;
  st('email invalide → 400', await call('POST', '/client-invitations', { token: pmo, body: { email: 'pas-un-email' } }), 400);
  st('champ « teamId » refusé (pas d\'équipe sur une invitation client) → 400', await call('POST', '/client-invitations', { token: pmo, body: { email, teamId: Number(teamT) } }), 400);
  st('champ « authority » refusé → 400', await call('POST', '/client-invitations', { token: pmo, body: { email, authority: 'pmo' } }), 400);
  st('email déjà enregistré → 409 EMAIL_ALREADY_REGISTERED', await call('POST', '/client-invitations', { token: pmo, body: { email: cA.email } }), 409, 'EMAIL_ALREADY_REGISTERED');
  const inv = await call('POST', '/client-invitations', { token: pmo, body: { email: email.toUpperCase() } });
  st('PMO : inviter un client → 201', inv, 201);
  if (inv.status !== 201 || !inv.data.devLink) { console.log('  (mode log requis pour lire devLink — suite ignorée)'); }
  else {
    check('lien = /invite/client?token=… (jamais /invite/accept), email normalisé en minuscules', /\/invite\/client\?token=/.test(inv.data.devLink) && inv.data.email === email);
    const token = new URL(inv.data.devLink).searchParams.get('token');
    st('doublon en attente → 409 INVITATION_ALREADY_PENDING', await call('POST', '/client-invitations', { token: pmo, body: { email } }), 409, 'INVITATION_ALREADY_PENDING');
    const v = await call('GET', `/client-invitations/validate?token=${encodeURIComponent(token)}`);
    check('validate (public) : email et expiration seulement', v.status === 200 && JSON.stringify(Object.keys(v.data).sort()) === '["email","expiresAt"]' && v.data.email === email);
    st('validate : jeton inconnu → 404 INVITATION_INVALID', await call('GET', '/client-invitations/validate?token=nope'), 404, 'INVITATION_INVALID');
    const ok = { token, firstName: 'Clara', lastName: 'Client', password: 'Passw0rd-client', phoneNumber: '+216 20 000 000', location: 'Tunis, Lac 2' };
    st('accept sans téléphone → 400', await call('POST', '/client-invitations/accept', { body: { ...ok, phoneNumber: undefined } }), 400);
    st('accept sans localisation → 400', await call('POST', '/client-invitations/accept', { body: { ...ok, location: '  ' } }), 400);
    st('accept mot de passe court → 400', await call('POST', '/client-invitations/accept', { body: { ...ok, password: 'court' } }), 400);
    st('accept avec « authority » → 400 (le rôle ne vient jamais du client)', await call('POST', '/client-invitations/accept', { body: { ...ok, authority: 'pmo' } }), 400);
    st('accept avec « clientRole » → 400', await call('POST', '/client-invitations/accept', { body: { ...ok, clientRole: 'clientManager' } }), 400);
    st('accept avec « email » → 400', await call('POST', '/client-invitations/accept', { body: { ...ok, email: 'autre@example.com' } }), 400);
    const acc = await call('POST', '/client-invitations/accept', { body: ok });
    st('accept (société omise = facultative) → 201', acc, 201);
    st('second usage du lien → 410 INVITATION_USED', await call('POST', '/client-invitations/accept', { body: ok }), 410, 'INVITATION_USED');
    st('validate après usage → 410 INVITATION_USED', await call('GET', `/client-invitations/validate?token=${encodeURIComponent(token)}`), 410, 'INVITATION_USED');
    const li = await login(email, ok.password);
    check('login du compte invité : authority = client (→ /client/tickets)', li.status === 201 && li.data.user.authority === 'client');
    const u = (await call('GET', '/users', { token: pmo })).data.find((x) => x.email === email);
    check('compte créé : client_role = clientUser, valid, téléphone et localisation enregistrés', u && u.clientRole === 'clientUser' && u.valid === true && u.phoneNumber === ok.phoneNumber && u.location === ok.location && !u.company);
    const mine = await call('GET', '/client/tickets', { token: li.data.access_token });
    check('le nouveau client accède à son espace (liste vide)', mine.status === 200 && mine.data.length === 0);
    st('… et pas à l\'espace PMO → 403', await call('GET', '/tickets', { token: li.data.access_token }), 403);
    const accCo = await (async () => {
      const e2 = `smoke6-inv2-${run}@example.com`; const i2 = await call('POST', '/client-invitations', { token: pmo, body: { email: e2 } });
      const t2 = new URL(i2.data.devLink).searchParams.get('token');
      const a2 = await call('POST', '/client-invitations/accept', { body: { ...ok, token: t2, company: 'ACME SARL' } });
      const u2 = (await call('GET', '/users', { token: pmo })).data.find((x) => x.email === e2);
      return a2.status === 201 && u2 && u2.company === 'ACME SARL';
    })();
    check('avec société renseignée : enregistrée', accCo);

    const e3 = `smoke6-inv3-${run}@example.com`; const i3 = await call('POST', '/client-invitations', { token: pmo, body: { email: e3 } });
    const t3 = new URL(i3.data.devLink).searchParams.get('token');
    check('liste PMO : l\'invitation apparaît « pending »', (await call('GET', '/client-invitations?status=pending', { token: pmo })).data.some((x) => x.email === e3));
    st('annulation → 200', await call('POST', `/client-invitations/${i3.data.id}/cancel`, { token: pmo }), 200);
    st('annuler deux fois → 409 INVITATION_NOT_PENDING', await call('POST', `/client-invitations/${i3.data.id}/cancel`, { token: pmo }), 409, 'INVITATION_NOT_PENDING');
    st('lien annulé → 410 INVITATION_CANCELLED', await call('GET', `/client-invitations/validate?token=${encodeURIComponent(t3)}`), 410, 'INVITATION_CANCELLED');
    st('nouvelle invitation possible après annulation → 201', await call('POST', '/client-invitations', { token: pmo, body: { email: e3 } }), 201);
    if (DB) {
      const e4 = `smoke6-inv4-${run}@example.com`; const i4 = await call('POST', '/client-invitations', { token: pmo, body: { email: e4 } });
      sql(`UPDATE client_invitations SET expires_at = NOW(3) - INTERVAL 1 MINUTE WHERE email = '${e4}'`);
      st('lien expiré → 410 INVITATION_EXPIRED', await call('GET', `/client-invitations/validate?token=${encodeURIComponent(new URL(i4.data.devLink).searchParams.get('token'))}`), 410, 'INVITATION_EXPIRED');
    }

    console.log('\n8. Mot de passe oublié d\'un client (flux Phase 3C inchangé)');
    if (!LOG) console.log('  (BACKEND_LOG non fourni : étape ignorée)');
    else {
      st('forgot-password (client) → 200', await call('POST', '/auth/forgot-password', { body: { email } }), 200);
      let tokenR = null;
      for (let i = 0; i < 20 && !tokenR; i++) {
        const ls = fs.readFileSync(LOG, 'utf8').split('\n').filter((l) => l.includes(`À: ${email} — Lien de réinitialisation`));
        if (ls.length) tokenR = ls[ls.length - 1].match(/reset-password\?token=([A-Za-z0-9_-]+)/)[1]; else await sleep(250);
      }
      check('lien de réinitialisation reçu', !!tokenR);
      st('reset-password → 200', await call('POST', '/auth/reset-password', { body: { token: tokenR, password: 'Nouveau-Passw0rd-9', passwordConfirm: 'Nouveau-Passw0rd-9' } }), 200);
      const l2 = await login(email, 'Nouveau-Passw0rd-9');
      check('login avec le nouveau mot de passe : authority = client (→ /client/tickets)', l2.status === 201 && l2.data.user.authority === 'client');
    }
  }

  console.log('\n9. Non-régression rapide : invitation technicien intacte');
  const te = `smoke6-tinv-${run}@example.com`;
  const ti = await call('POST', '/invitations', { token: pmo, body: { email: te, teamId: Number(teamT) } });
  st('POST /invitations (technicien, avec équipe) → 201', ti, 201);
  if (ti.data && ti.data.devLink) {
    check('lien technicien = /invite/accept', /\/invite\/accept\?token=/.test(ti.data.devLink));
    st('acceptation technicien → 201', await call('POST', '/invitations/accept', { body: { token: new URL(ti.data.devLink).searchParams.get('token'), firstName: 'T', lastName: 'Inv', password: 'Passw0rd-tech' } }), 201);
    check('login : authority = technician', (await login(te, 'Passw0rd-tech')).data.user.authority === 'technician');
  }
  st('POST /invitations sans équipe → 400 (équipe toujours obligatoire côté technicien)', await call('POST', '/invitations', { token: pmo, body: { email: `smoke6-t2-${run}@example.com` } }), 400);

  console.log(`\nRésultat : ${pass} OK, ${fail} échec(s).`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
