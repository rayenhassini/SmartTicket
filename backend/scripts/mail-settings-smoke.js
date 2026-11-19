#!/usr/bin/env node
/* Smoke « Paramètres mail » (configuration d'envoi en base, chiffrée) — Phase B+.
 *   BASE_URL=... PMO_EMAIL=... PMO_PASSWORD=... [DB_CMD=...] [FAKE_SMTP_OUT=fichier] npm run smoke:mail-settings
 * Pour l'envoi réel vers le SMTP factice : backend avec MAIL_HOST=127.0.0.1 MAIL_PORT=2525 MAIL_SECURE=false
 * et `node scripts/fake-smtp.js` (FAKE_SMTP_OUT=<fichier>). Le secret de test est fictif. */
const { execSync } = require('child_process');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:3001';
const run = Date.now().toString(36);
const PW = 'Smoke-Passw0rd!';
const SECRET = 'abcd efgh ijkl mnop'; // mot de passe d'application fictif (16 caractères, espaces comme Google)
let pass = 0, fail = 0;
async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await res.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { status: res.status, data: d, raw: t };
}
const check = (l, ok, x = '') => { ok ? (pass++, console.log(`  OK    ${l}`)) : (fail++, console.log(`  ÉCHEC ${l} ${x}`)); };
const st = (l, r, s, c) => check(l, r.status === s && (!c || (r.data && r.data.code === c)), `(reçu ${r.status} ${r.data && (r.data.code || r.data.message) || ''}, attendu ${s} ${c || ''})`);
const sql = (q) => execSync(`${process.env.DB_CMD} -N -e "${q}"`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

(async () => {
  console.log(`Smoke Paramètres mail sur ${BASE}\n`);
  const l = await call('POST', '/auth/login', { body: { email: process.env.PMO_EMAIL, password: process.env.PMO_PASSWORD } });
  if (l.status !== 201) { console.log('Connexion PMO impossible.'); process.exit(2); }
  const t = l.data.access_token;
  const plain = (await call('POST', '/users', { token: t, body: { firstName: 'S9', lastName: 'Plain', email: `smoke9-mplain-${run}@example.com`, password: PW, authority: 'technician', valid: true } })).data;
  const plainTok = (await call('POST', '/auth/login', { body: { email: plain.email, password: PW } })).data.access_token;
  const gmail = `smoke9-${run}@gmail.test`;

  console.log('1. Accès');
  st('sans jeton → 401', await call('GET', '/settings/mail'), 401);
  st('non-PMO GET → 403', await call('GET', '/settings/mail', { token: plainTok }), 403);
  st('non-PMO PUT → 403', await call('PUT', '/settings/mail', { token: plainTok, body: { gmail, appName: 'X', appPassword: SECRET } }), 403);
  st('non-PMO test → 403', await call('POST', '/settings/mail/test', { token: plainTok }), 403);

  console.log('\n2. Validation');
  st('email invalide → 400', await call('PUT', '/settings/mail', { token: t, body: { gmail: 'nope', appName: 'X', appPassword: SECRET } }), 400);
  st('nom manquant → 400', await call('PUT', '/settings/mail', { token: t, body: { gmail, appPassword: SECRET } }), 400);
  st('mot de passe trop court → 400', await call('PUT', '/settings/mail', { token: t, body: { gmail, appName: 'X', appPassword: 'court' } }), 400);
  st('mot de passe de 16 caractères mais invalide (symboles) → 400 APP_PASSWORD_INVALID', await call('PUT', '/settings/mail', { token: t, body: { gmail, appName: 'X', appPassword: 'abcd-efgh-ijkl-mn!' } }), 400, 'APP_PASSWORD_INVALID');
  st('champ inconnu refusé (400)', await call('PUT', '/settings/mail', { token: t, body: { gmail, appName: 'X', appPassword: SECRET, host: 'evil' } }), 400);

  console.log('\n3. Enregistrement : le secret n\'est jamais renvoyé');
  const put = await call('PUT', '/settings/mail', { token: t, body: { gmail: gmail.toUpperCase(), appName: 'SmartTicket Smoke', appPassword: SECRET } });
  st('PUT 200', put, 200);
  check('réponse : configuré, source database, email normalisé', put.data.configured && put.data.source === 'database' && put.data.gmail === gmail && put.data.appName === 'SmartTicket Smoke');
  check('réponse sans mot de passe', !put.raw.includes('abcd') && !put.raw.includes('mnop') && !('appPassword' in put.data) && !('passwordEnc' in put.data));
  const get = await call('GET', '/settings/mail', { token: t });
  check('GET sans mot de passe', get.status === 200 && !get.raw.includes('abcd') && !/password(?!.*has)/i.test(Object.keys(get.data).filter((k) => k !== 'hasPassword').join()));
  check('GET : hasPassword true', get.data.hasPassword === true);
  if (process.env.DB_CMD) {
    const stored = sql(`SELECT password_enc FROM mail_settings WHERE id=1`);
    check('en base : chiffré (préfixe v1:), jamais en clair', stored.startsWith('v1:') && !stored.includes('abcdefghijklmnop') && !stored.includes('abcd'));
  } else console.log('  (DB_CMD non fourni : contrôle du chiffrement en base ignoré)');
  st('remplacement par une 2e configuration (successeur) 200', await call('PUT', '/settings/mail', { token: t, body: { gmail, appName: 'Autre nom', appPassword: 'zzzz yyyy xxxx wwww' } }), 200);
  check('une seule ligne de configuration', !process.env.DB_CMD || sql('SELECT COUNT(*) FROM mail_settings') === '1');
  check('la config remplacée est celle affichée', (await call('GET', '/settings/mail', { token: t })).data.appName === 'Autre nom');

  console.log('\n4. Envoi réel avec la configuration en base (SMTP factice)');
  const tr = await call('POST', '/settings/mail/test', { token: t });
  if (tr.status === 200) {
    check('email de test envoyé (source database)', tr.data.sent === true && tr.data.source === 'database');
    if (process.env.FAKE_SMTP_OUT && fs.existsSync(process.env.FAKE_SMTP_OUT)) {
      const last = fs.readFileSync(process.env.FAKE_SMTP_OUT, 'utf8').trim().split('\n').filter(Boolean).map((x) => JSON.parse(x)).pop();
      check('le SMTP a reçu le mail depuis le Gmail configuré', last && last.from === gmail && last.to.includes(process.env.PMO_EMAIL), JSON.stringify(last));
    }
  } else {
    // Sans SMTP factice joignable : l'erreur doit être claire (502 + cause), jamais un faux succès.
    check('SMTP injoignable : 502 MAIL_SEND_FAILED avec cause (jamais de faux succès)', tr.status === 502 && tr.data.code === 'MAIL_SEND_FAILED' && /Cause/.test(tr.data.message), `reçu ${tr.status} ${tr.raw}`);
  }

  await call('DELETE', `/users/${plain.id}`, { token: t });
  console.log(`\n${pass} OK, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
