#!/usr/bin/env node
/* Smoke « mot de passe oublié » : backend RÉEL en marche, migration 004 appliquée, mode mail « log ».
 *   BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... BACKEND_LOG=/chemin/journal-backend.log npm run smoke:reset
 * Le lien n'est volontairement PAS renvoyé par l'API (sinon fuite d'existence du compte) : il est lu
 * dans le journal console du backend (« [MAIL-LOG] … Lien de réinitialisation : … »).
 * Crée des comptes « smoke5-…@example.com ». Node 18+. */
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:3001';
const LOG = process.env.BACKEND_LOG;
const PASSWORD = 'Smoke-Passw0rd!', NEW1 = 'Nouveau-Passw0rd-1', NEW2 = 'Nouveau-Passw0rd-2';
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
async function linkFor(email, nth = 1) {
  for (let i = 0; i < 20; i++) {
    const lines = fs.readFileSync(LOG, 'utf8').split('\n').filter((l) => l.includes(`À: ${email} — Lien de réinitialisation`));
    if (lines.length >= nth) return lines[nth - 1].match(/reset-password\?token=([A-Za-z0-9_-]+)/)[1];
    await sleep(250);
  }
  return null;
}
const countLines = (email) => fs.readFileSync(LOG, 'utf8').split('\n').filter((l) => l.includes(`À: ${email} — Lien de réinitialisation`)).length;
const login = (email, password) => call('POST', '/auth/login', { body: { email, password } });

(async () => {
  console.log(`Smoke mot de passe oublié sur ${BASE}\n`);
  if (!LOG) { console.log('BACKEND_LOG requis (journal console du backend en mode log).'); process.exit(2); }
  const pmoL = await login(process.env.PMO_EMAIL, process.env.PMO_PASSWORD);
  if (pmoL.status !== 201) { console.log('Connexion PMO impossible.'); process.exit(2); }
  const pmo = pmoL.data.access_token;
  const mk = async (tag, authority) => {
    const email = `smoke5-${tag}-${run}@example.com`;
    const r = await call('POST', '/users', { token: pmo, body: { email, password: PASSWORD, firstName: 'Smoke5', lastName: tag, authority, valid: true } });
    if (r.status !== 201) throw new Error(`création ${tag} ${r.status} ${JSON.stringify(r.data)}`);
    return email;
  };
  const tech = await mk('tech', 'technician'), pmo2 = await mk('pmo', 'pmo'), off = await mk('off', 'technician');
  const offUser = (await call('GET', '/users', { token: pmo })).data.find((u) => u.email === off);
  await call('PATCH', `/users/${offUser.id}`, { token: pmo, body: { valid: false } });

  console.log('1. Réponse neutre (aucune fuite d\'information)');
  const known = await call('POST', '/auth/forgot-password', { body: { email: tech } });
  const unknown = await call('POST', '/auth/forgot-password', { body: { email: `inconnu-${run}@example.com` } });
  st('email connu → 200', known, 200); st('email inconnu → 200', unknown, 200);
  check('message strictement identique', JSON.stringify(known.data) === JSON.stringify(unknown.data) && Object.keys(known.data).length === 1);
  st('email invalide → 400', await call('POST', '/auth/forgot-password', { body: { email: 'pas-un-email' } }), 400);
  st('champ en trop (authority) → 400', await call('POST', '/auth/forgot-password', { body: { email: tech, authority: 'pmo' } }), 400);
  await call('POST', '/auth/forgot-password', { body: { email: off } });
  await sleep(600);
  check('aucun mail pour un email inconnu', countLines(`inconnu-${run}@example.com`) === 0);
  check('aucun mail pour un compte désactivé', countLines(off) === 0);

  console.log('\n2. Jeton : lien reçu, validation du corps');
  const t1 = await linkFor(tech);
  check('un mail (log) contient le lien /reset-password?token=…', !!t1);
  const body = (token, p = NEW1, c = NEW1) => ({ token, password: p, passwordConfirm: c });
  st('mots de passe différents → 400 PASSWORD_MISMATCH', await call('POST', '/auth/reset-password', { body: body(t1, NEW1, 'autre-chose') }), 400, 'PASSWORD_MISMATCH');
  st('mot de passe trop court → 400', await call('POST', '/auth/reset-password', { body: body(t1, 'court', 'court') }), 400);
  st('jeton inconnu → 404 RESET_TOKEN_INVALID', await call('POST', '/auth/reset-password', { body: body('x'.repeat(43)) }), 404, 'RESET_TOKEN_INVALID');
  st('champ interdit (authority) → 400', await call('POST', '/auth/reset-password', { body: { ...body(t1), authority: 'pmo' } }), 400);
  st('champ interdit (email) → 400', await call('POST', '/auth/reset-password', { body: { ...body(t1), email: pmo2 } }), 400);
  check('le jeton reste utilisable après ces refus', (await login(tech, PASSWORD)).status === 201);

  console.log('\n3. Réinitialisation puis connexion (rôle lu en base)');
  st('reset avec le bon jeton → 200', await call('POST', '/auth/reset-password', { body: body(t1) }), 200);
  const oldPw = await login(tech, PASSWORD), newPw = await login(tech, NEW1);
  check('ancien mot de passe refusé (401)', oldPw.status === 401);
  check('nouveau mot de passe accepté, authority = technician (→ /my/tickets)', newPw.status === 201 && newPw.data.user.authority === 'technician');
  st('réutilisation du même jeton → 410 RESET_TOKEN_USED', await call('POST', '/auth/reset-password', { body: body(t1, NEW2, NEW2) }), 410, 'RESET_TOKEN_USED');
  check('… et le mot de passe n\'a pas changé', (await login(tech, NEW1)).status === 201 && (await login(tech, NEW2)).status === 401);

  console.log('\n4. Autre rôle : le reset ne change jamais l\'authority');
  await call('POST', '/auth/forgot-password', { body: { email: pmo2 } });
  const tp = await linkFor(pmo2);
  st('reset du compte PMO → 200', await call('POST', '/auth/reset-password', { body: body(tp) }), 200);
  const lp = await login(pmo2, NEW1);
  check('login PMO : authority = pmo (→ /tickets)', lp.status === 201 && lp.data.user.authority === 'pmo');

  console.log('\n5. Anti-spam, remplacement et expiration');
  if (!process.env.DB_CMD) console.log('  (DB_CMD non fourni : tests anti-spam / expiration ignorés)');
  else {
    const { execSync } = require('child_process');
    const sql = (q) => execSync(`${process.env.DB_CMD} -e "${q}"`);
    const uid = `(SELECT id FROM users WHERE email='${tech}')`;
    sql(`UPDATE password_reset_tokens SET created_at = NOW() - INTERVAL 5 MINUTE WHERE user_id = ${uid}`); // sort du délai anti-spam
    const before = countLines(tech);
    await call('POST', '/auth/forgot-password', { body: { email: tech } });
    await call('POST', '/auth/forgot-password', { body: { email: tech } });
    await sleep(800);
    check('2 demandes rapprochées → 1 seul mail (délai de 60 s)', countLines(tech) === before + 1);
    const tA = await linkFor(tech, before + 1);
    sql(`UPDATE password_reset_tokens SET created_at = NOW() - INTERVAL 5 MINUTE WHERE user_id = ${uid}`);
    await call('POST', '/auth/forgot-password', { body: { email: tech } });
    const tB = await linkFor(tech, before + 2);
    st('ancien jeton remplacé par un plus récent → 410 RESET_TOKEN_USED', await call('POST', '/auth/reset-password', { body: body(tA, NEW2, NEW2) }), 410, 'RESET_TOKEN_USED');
    sql(`UPDATE password_reset_tokens SET expires_at = NOW(3) - INTERVAL 1 MINUTE WHERE used_at IS NULL AND user_id = ${uid}`);
    st('jeton expiré → 410 RESET_TOKEN_EXPIRED', await call('POST', '/auth/reset-password', { body: body(tB, NEW2, NEW2) }), 410, 'RESET_TOKEN_EXPIRED');
    check('… le mot de passe est inchangé', (await login(tech, NEW1)).status === 201);
  }

  console.log(`\nRésultat : ${pass} OK, ${fail} échec(s).`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
