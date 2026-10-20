#!/usr/bin/env node
/* Smoke test Phase 1 (sécurité) — à lancer contre un backend RÉEL (MySQL) en marche.
 *
 *   BASE_URL=http://localhost:3001 PMO_EMAIL=... PMO_PASSWORD=... npm run smoke:phase1
 *
 * - Sans PMO_EMAIL/PMO_PASSWORD, tente POST /auth/bootstrap (base vide uniquement).
 * - CHECK_RATE_LIMIT=1 ajoute le test 429 (bloque ensuite l'IP pendant LOGIN_RATE_TTL).
 * - CORS_ALLOWED=http://localhost:3000 : origine attendue comme autorisée.
 * Crée des utilisateurs/tickets préfixés « smoke-… » et supprime les tickets créés.
 * Node 18+ (fetch intégré). */
const BASE = process.env.BASE_URL || 'http://localhost:3001';
const ALLOWED_ORIGIN = process.env.CORS_ALLOWED || 'http://localhost:3000';
const PASSWORD = 'Smoke-Passw0rd!';
const run = Date.now().toString(36);
let pass = 0, fail = 0;

async function call(method, path, { token, body, headers } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}
function check(label, ok, extra = '') {
  if (ok) { pass++; console.log(`  OK    ${label}`); }
  else { fail++; console.log(`  ÉCHEC ${label} ${extra}`); }
}
const expectStatus = (label, res, status) => check(label, res.status === status, `(reçu ${res.status}, attendu ${status})`);

async function login(email, password = PASSWORD) {
  const r = await call('POST', '/auth/login', { body: { email, password } });
  return r.status === 201 || r.status === 200 ? r.data.access_token : null;
}
async function createUser(pmo, authority) {
  const email = `smoke-${authority}-${run}@example.com`;
  const r = await call('POST', '/users', { token: pmo, body: { email, password: PASSWORD, firstName: 'Smoke', lastName: authority, authority, valid: true } });
  if (r.status !== 201) throw new Error(`création ${authority} impossible: ${r.status} ${JSON.stringify(r.data)}`);
  return { id: Number(r.data.id), email };
}

(async () => {
  console.log(`Smoke Phase 1 sur ${BASE}\n`);

  console.log('1. Authentification de base');
  expectStatus('GET /tickets sans token → 401', await call('GET', '/tickets'), 401);
  expectStatus('GET /tickets token invalide → 401', await call('GET', '/tickets', { token: 'bad.token.value' }), 401);
  expectStatus('POST /auth/login mauvais mot de passe → 401 (route publique)', await call('POST', '/auth/login', { body: { email: 'nobody@example.com', password: 'wrong-password' } }), 401);

  let pmoToken;
  if (process.env.PMO_EMAIL && process.env.PMO_PASSWORD) {
    pmoToken = await login(process.env.PMO_EMAIL, process.env.PMO_PASSWORD);
  } else {
    const b = await call('POST', '/auth/bootstrap', { body: { email: `smoke-boot-${run}@example.com`, password: PASSWORD, firstName: 'Smoke', lastName: 'Boot', authority: 'pmo' } });
    pmoToken = b.status === 201 ? b.data.access_token : null;
  }
  if (!pmoToken) { console.log('Impossible d’obtenir un token PMO (fournir PMO_EMAIL / PMO_PASSWORD).'); process.exit(2); }
  expectStatus('POST /auth/bootstrap quand des comptes existent → 409 (route publique)', await call('POST', '/auth/bootstrap', { body: { email: `x-${run}@example.com`, password: PASSWORD, firstName: 'X', lastName: 'Y' } }), 409);
  expectStatus('PMO : GET /tickets → 200', await call('GET', '/tickets', { token: pmoToken }), 200);

  console.log('\n2. Comptes de test');
  const tech = await createUser(pmoToken, 'technician');
  const client = await createUser(pmoToken, 'client');
  const assistant = await createUser(pmoToken, 'assistant');
  const demo = await createUser(pmoToken, 'pmo');
  const techToken = await login(tech.email), clientToken = await login(client.email), assistantToken = await login(assistant.email), demoToken = await login(demo.email);
  check('logins technician / client / assistant / pmo', techToken && clientToken && assistantToken && demoToken);

  console.log('\n3. Refus pour Client, Technicien, Assistant (lectures et écritures)');
  const reads = ['/tickets', '/users', '/solutions', '/contracts', '/sites', '/equipment', '/equipment-softs', '/type-supports'];
  for (const [name, t] of [['client', clientToken], ['technician', techToken], ['assistant', assistantToken]]) {
    for (const path of reads) expectStatus(`${name} : GET ${path} → 403`, await call('GET', path, { token: t }), 403);
    expectStatus(`${name} : POST /tickets → 403`, await call('POST', '/tickets', { token: t, body: { number: `smoke-${run}-x`, title: 'x', description: 'y' } }), 403);
    expectStatus(`${name} : PATCH /users/${demo.id} → 403`, await call('PATCH', `/users/${demo.id}`, { token: t, body: { authority: 'pmo' } }), 403);
    expectStatus(`${name} : DELETE /users/${demo.id} → 403`, await call('DELETE', `/users/${demo.id}`, { token: t }), 403);
    expectStatus(`${name} : POST /users → 403`, await call('POST', '/users', { token: t, body: { email: `evil-${name}-${run}@example.com`, password: PASSWORD, firstName: 'E', lastName: 'V', authority: 'pmo' } }), 403);
  }

  console.log('\n4. Fix removeTechnician (base réelle)');
  const created = await call('POST', '/tickets', { token: pmoToken, body: { number: `smoke-${run}-1`, title: 'Smoke removeTechnician', description: 'test' } });
  expectStatus('PMO : POST /tickets → 201', created, 201);
  const ticketId = created.data && created.data.id;
  expectStatus('PMO : assigner le technicien → 201', await call('POST', `/tickets/${ticketId}/technicians`, { token: pmoToken, body: { technicianId: tech.id } }), 201);
  let t = await call('GET', `/tickets/${ticketId}`, { token: pmoToken });
  check('technicien présent après assignation', t.data.technicians.length === 1);
  const removed = await call('DELETE', `/tickets/${ticketId}/technicians/${tech.id}`, { token: pmoToken });
  expectStatus('PMO : DELETE /tickets/:id/technicians/:userId → 200', removed, 200);
  check('réponse : plus aucun technicien', removed.data && removed.data.technicians.length === 0);
  t = await call('GET', `/tickets/${ticketId}`, { token: pmoToken });
  check('relecture en base : plus aucun technicien (ligne pivot supprimée)', t.data.technicians.length === 0);

  console.log('\n5. Relecture du compte en base à chaque requête');
  expectStatus('demo (pmo) : GET /tickets → 200', await call('GET', '/tickets', { token: demoToken }), 200);
  expectStatus('PMO rétrograde demo en client', await call('PATCH', `/users/${demo.id}`, { token: pmoToken, body: { authority: 'client' } }), 200);
  expectStatus('même token, rôle courant en base : GET /tickets → 403', await call('GET', '/tickets', { token: demoToken }), 403);
  expectStatus('PMO désactive le technicien (valid=false)', await call('PATCH', `/users/${tech.id}`, { token: pmoToken, body: { valid: false } }), 200);
  expectStatus('token du technicien désactivé → 401 immédiat', await call('GET', '/tickets', { token: techToken }), 401);
  expectStatus('PMO supprime le client', await call('DELETE', `/users/${client.id}`, { token: pmoToken }), 200);
  expectStatus('token du client supprimé → 401', await call('GET', '/tickets', { token: clientToken }), 401);

  console.log('\n6. DELETE /tickets/:id réservé au PMO');
  expectStatus('assistant : DELETE /tickets/:id → 403', await call('DELETE', `/tickets/${ticketId}`, { token: assistantToken }), 403);
  expectStatus('PMO : DELETE /tickets/:id → 200', await call('DELETE', `/tickets/${ticketId}`, { token: pmoToken }), 200);

  console.log('\n7. CORS');
  const bad = await call('OPTIONS', '/tickets', { headers: { Origin: 'http://evil.example', 'Access-Control-Request-Method': 'GET' } });
  check('origine inconnue : pas d’en-tête Access-Control-Allow-Origin', !bad.headers.get('access-control-allow-origin'));
  const good = await call('OPTIONS', '/tickets', { headers: { Origin: ALLOWED_ORIGIN, 'Access-Control-Request-Method': 'GET' } });
  check(`origine ${ALLOWED_ORIGIN} autorisée`, good.headers.get('access-control-allow-origin') === ALLOWED_ORIGIN);

  if (process.env.CHECK_RATE_LIMIT === '1') {
    console.log('\n8. Rate limit du login');
    let got429 = false;
    for (let i = 0; i < 60 && !got429; i++) {
      const r = await call('POST', '/auth/login', { body: { email: 'nobody@example.com', password: 'wrong-password' } });
      if (r.status === 429) got429 = true;
    }
    check('429 Too Many Requests après trop de tentatives', got429);
  } else {
    console.log('\n8. Rate limit : ignoré (CHECK_RATE_LIMIT=1 pour le tester)');
  }

  console.log(`\nRésultat : ${pass} OK, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
