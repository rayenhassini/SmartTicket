#!/usr/bin/env node
/* Smoke « Succession PMO » (démission + invitation du successeur) — Phase B+.
 *   BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... DB_CMD="mariadb -uroot ... smartticket_v1" npm run smoke:pmo
 * Prérequis backend : ALLOW_DIRECT_USER_CREATION=true (jeux de données) et, soit MAIL_MODE=log (le lien est renvoyé
 * dans la réponse), soit un SMTP local + FAKE_SMTP_OUT=<fichier> (scripts/fake-smtp.js).
 * DB_CMD (client SQL ligne de commande) : sert à antidater une expiration et à RESTAURER le PMO de test à la fin
 * (la succession rétrograde réellement le PMO d'origine). Sans DB_CMD : le script s'arrête avant la succession réelle. */
const { execSync } = require('child_process');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:3001';
const run = Date.now().toString(36);
const PW = 'Smoke-Passw0rd!';
const origEmail = process.env.PMO_EMAIL;
const succEmail = `smoke9-succ-${run}@example.com`;
let pass = 0, fail = 0;
async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await res.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { status: res.status, data: d };
}
const check = (l, ok, x = '') => { ok ? (pass++, console.log(`  OK    ${l}`)) : (fail++, console.log(`  ÉCHEC ${l} ${x}`)); };
const st = (l, r, s, c) => check(l, r.status === s && (!c || (r.data && r.data.code === c)), `(reçu ${r.status} ${r.data && (r.data.code || r.data.message) || ''}, attendu ${s} ${c || ''})`);
const login = (email, password = PW) => call('POST', '/auth/login', { body: { email, password } });
const sql = (q) => execSync(`${process.env.DB_CMD} -e "${q}"`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tokenOf = (link) => new URL(link).searchParams.get('token');

// Lien d'invitation : renvoyé par l'API en mode log, sinon lu dans le fichier du SMTP factice.
async function linkFor(resp, to) {
  if (resp.data && resp.data.devLink) return resp.data.devLink;
  if (!process.env.FAKE_SMTP_OUT) return null;
  for (let i = 0; i < 20; i++) {
    const lines = fs.existsSync(process.env.FAKE_SMTP_OUT) ? fs.readFileSync(process.env.FAKE_SMTP_OUT, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    const rec = lines.reverse().find((r) => r.to.includes(to) && r.link && r.link.includes('/pmo/accept'));
    if (rec) return rec.link;
    await sleep(250);
  }
  return null;
}

(async () => {
  console.log(`Smoke Succession PMO sur ${BASE}\n`);
  const l = await login(origEmail, process.env.PMO_PASSWORD);
  if (l.status !== 201) { console.log('Connexion PMO impossible.'); process.exit(2); }
  const t = l.data.access_token;
  const users0 = (await call('GET', '/users', { token: t })).data;
  const activePmos = users0.filter((u) => u.authority === 'pmo' && u.valid);
  if (activePmos.length !== 1) { console.log(`Pré-condition : exactement 1 PMO actif attendu (trouvé ${activePmos.length}).`); process.exit(2); }
  const plain = (await call('POST', '/users', { token: t, body: { firstName: 'S9', lastName: 'Plain', email: `smoke9-plain-${run}@example.com`, password: PW, authority: 'technician', valid: true } })).data;
  if (!plain || !plain.id) { console.log('Prérequis : ALLOW_DIRECT_USER_CREATION=true sur le backend.'); process.exit(2); }
  const plainTok = (await login(plain.email)).data.access_token;

  console.log('1. État initial et contrôles d\'accès');
  st('GET /pmo/resignation sans démission : status none', await call('GET', '/pmo/resignation', { token: t }), 200);
  check('status = none', (await call('GET', '/pmo/resignation', { token: t })).data.status === 'none');
  st('non-PMO : POST /pmo/resignation → 403', await call('POST', '/pmo/resignation', { token: plainTok, body: { successorEmail: succEmail } }), 403);
  st('non-PMO : POST /pmo/resignation/cancel → 403', await call('POST', '/pmo/resignation/cancel', { token: plainTok }), 403);
  st('sans jeton : GET /pmo/resignation → 401', await call('GET', '/pmo/resignation'), 401);
  st('email invalide → 400', await call('POST', '/pmo/resignation', { token: t, body: { successorEmail: 'pas-un-email' } }), 400);
  st('successeur = soi-même → 409', await call('POST', '/pmo/resignation', { token: t, body: { successorEmail: origEmail } }), 409, 'SUCCESSOR_IS_SELF');
  st('successeur avec compte existant → 409', await call('POST', '/pmo/resignation', { token: t, body: { successorEmail: plain.email } }), 409, 'EMAIL_ALREADY_REGISTERED');
  st('POST /users authority=pmo (second PMO) → 409', await call('POST', '/users', { token: t, body: { firstName: 'a', lastName: 'b', email: `smoke9-x-${run}@example.com`, password: PW, authority: 'pmo' } }), 409, 'PMO_ALREADY_EXISTS');
  st('promotion d\'un technicien en PMO (PATCH) → 409', await call('PATCH', `/users/${plain.id}`, { token: t, body: { authority: 'pmo' } }), 409, 'PMO_ALREADY_EXISTS');

  console.log('\n2. Démission en cours, annulation, nouvelle démission');
  const r1 = await call('POST', '/pmo/resignation', { token: t, body: { successorEmail: succEmail.toUpperCase() } });
  st('démission 201', r1, 201);
  check('statut pending, email normalisé en minuscules', r1.data.status === 'pending' && r1.data.successorEmail === succEmail);
  check('le jeton n\'est jamais dans la vue', !JSON.stringify(r1.data).match(/token=|"token"/) || !!r1.data.devLink);
  const link1 = await linkFor(r1, succEmail);
  check('lien reçu (devLink ou email SMTP)', !!link1, 'ni devLink ni FAKE_SMTP_OUT');
  if (!link1) process.exit(2);
  check('GET /pmo/resignation : pending', (await call('GET', '/pmo/resignation', { token: t })).data.status === 'pending');
  st('seconde démission pendant la première → 409 RESIGNATION_ALREADY_PENDING', await call('POST', '/pmo/resignation', { token: t, body: { successorEmail: `smoke9-other-${run}@example.com` } }), 409, 'RESIGNATION_ALREADY_PENDING');
  st('le PMO reste PMO pendant la démission (GET /tickets 200)', await call('GET', '/tickets', { token: t }), 200);
  const v1 = await call('GET', `/pmo/succession/validate?token=${tokenOf(link1)}`);
  st('validate (public) 200', v1, 200);
  check('validate : email fixé, rien d\'autre', v1.data.email === succEmail && Object.keys(v1.data).sort().join() === 'email,expiresAt');
  st('validate : jeton inconnu → 404', await call('GET', '/pmo/succession/validate?token=inconnu'), 404, 'SUCCESSION_INVALID');
  st('annulation 200', await call('POST', '/pmo/resignation/cancel', { token: t }), 200);
  check('état : none après annulation', (await call('GET', '/pmo/resignation', { token: t })).data.status === 'none');
  st('annuler sans démission → 404', await call('POST', '/pmo/resignation/cancel', { token: t }), 404, 'NO_PENDING_RESIGNATION');
  st('ancien lien : validate → 410 SUCCESSION_CANCELLED', await call('GET', `/pmo/succession/validate?token=${tokenOf(link1)}`), 410, 'SUCCESSION_CANCELLED');
  st('ancien lien : accept → 410', await call('POST', '/pmo/succession/accept', { body: { token: tokenOf(link1), firstName: 'N', lastName: 'P', password: PW } }), 410, 'SUCCESSION_CANCELLED');

  if (!process.env.DB_CMD) { console.log('\n  (DB_CMD non fourni : succession réelle et expiration ignorées)'); console.log(`\n${pass} OK, ${fail} échec(s)`); await call('DELETE', `/users/${plain.id}`, { token: t }); process.exit(fail ? 1 : 0); }

  console.log('\n3. Expiration (échéance antidatée)');
  const rExp = await call('POST', '/pmo/resignation', { token: t, body: { successorEmail: succEmail } });
  st('nouvelle démission après annulation 201', rExp, 201);
  const linkExp = await linkFor(rExp, succEmail);
  sql(`UPDATE pmo_resignations SET expires_at = NOW() - INTERVAL 1 MINUTE WHERE status='pending'`);
  st('lien expiré : validate → 410 SUCCESSION_EXPIRED', await call('GET', `/pmo/succession/validate?token=${tokenOf(linkExp)}`), 410, 'SUCCESSION_EXPIRED');
  st('lien expiré : accept → 410', await call('POST', '/pmo/succession/accept', { body: { token: tokenOf(linkExp), firstName: 'N', lastName: 'P', password: PW } }), 410);
  check('état : none (expirée)', (await call('GET', '/pmo/resignation', { token: t })).data.status === 'none');

  console.log('\n4. Succession réelle');
  const r2 = await call('POST', '/pmo/resignation', { token: t, body: { successorEmail: succEmail } });
  st('démission après expiration 201', r2, 201);
  const tok2 = tokenOf(await linkFor(r2, succEmail));
  st('accept : champ email interdit (400)', await call('POST', '/pmo/succession/accept', { body: { token: tok2, email: 'autre@example.com', firstName: 'N', lastName: 'P', password: PW } }), 400);
  st('accept : champ authority interdit (400)', await call('POST', '/pmo/succession/accept', { body: { token: tok2, authority: 'client', firstName: 'N', lastName: 'P', password: PW } }), 400);
  st('accept : mot de passe trop court (400)', await call('POST', '/pmo/succession/accept', { body: { token: tok2, firstName: 'N', lastName: 'P', password: 'court' } }), 400);
  st('accept : jeton inconnu → 404', await call('POST', '/pmo/succession/accept', { body: { token: 'inconnu', firstName: 'N', lastName: 'P', password: PW } }), 404);
  check('toujours un seul PMO actif avant acceptation', (await call('GET', '/users', { token: t })).data.filter((u) => u.authority === 'pmo' && u.valid).length === 1);
  const acc = await call('POST', '/pmo/succession/accept', { body: { token: tok2, firstName: 'Nouveau', lastName: 'Pmo', password: PW } });
  st('accept 201', acc, 201);
  st('rejouer le lien → 410 SUCCESSION_USED', await call('POST', '/pmo/succession/accept', { body: { token: tok2, firstName: 'N', lastName: 'P', password: PW } }), 410, 'SUCCESSION_USED');
  st('ancien PMO : jeton refusé immédiatement (401)', await call('GET', '/tickets', { token: t }), 401);
  st('ancien PMO : connexion refusée (compte désactivé)', await login(origEmail, process.env.PMO_PASSWORD), 401);
  const nl = await login(succEmail);
  st('nouveau PMO : connexion 201', nl, 201);
  check('nouveau PMO : authority pmo', nl.data.user.authority === 'pmo');
  const nt = nl.data.access_token;
  st('nouveau PMO : GET /tickets 200', await call('GET', '/tickets', { token: nt }), 200);
  const users1 = (await call('GET', '/users', { token: nt })).data;
  check('exactement un PMO actif après succession', users1.filter((u) => u.authority === 'pmo' && u.valid).length === 1);
  const old = users1.find((u) => u.email === origEmail);
  check('ancien PMO : rôle technician, compte désactivé', old && old.authority === 'technician' && old.valid === false);
  st('réactivation de l\'ancien compte (technicien) autorisée mais pas en PMO', await call('PATCH', `/users/${old.id}`, { token: nt, body: { authority: 'pmo', valid: true } }), 409, 'PMO_ALREADY_EXISTS');
  st('nouveau PMO ne peut pas se supprimer', await call('DELETE', `/users/${users1.find((u) => u.email === succEmail).id}`, { token: nt }), 409, 'SELF_ACTION_FORBIDDEN');
  check('démission suivante possible (état none)', (await call('GET', '/pmo/resignation', { token: nt })).data.status === 'none');

  console.log('\n5. Restauration du PMO de test');
  await call('DELETE', `/users/${plain.id}`, { token: nt });
  sql(`DELETE FROM users WHERE email='${succEmail}'`);
  sql(`UPDATE users SET authority='pmo', valid=1 WHERE email='${origEmail}'`);
  st('PMO d\'origine de nouveau opérationnel', await login(origEmail, process.env.PMO_PASSWORD), 201);

  console.log(`\n${pass} OK, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
