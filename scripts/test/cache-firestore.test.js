// Cache d'actus partagé sur Firestore : écriture par le job (Node, compte de
// service), lecture par la page (REST publique). Faux Firestore en mémoire.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const commun = require('../../web/js/cache-firestore.js');
const ecr = require('../lib/cache-firestore-ecriture.js');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const COMPTE = { client_email: 'job@sentiqs-235ce.iam.gserviceaccount.com', private_key: privateKey, project_id: 'sentiqs-235ce' };
const CFG = { projectId: 'sentiqs-235ce', apiKey: 'CLE_PUBLIQUE' };

// Faux Firestore + faux point d'accès OAuth. `echec(id)` fait refuser une écriture.
function fauxReseau(options) {
  const o = options || {};
  const docs = new Map();
  const journal = [];
  const fetchFn = async (url, init) => {
    init = init || {};
    journal.push({ methode: init.method || 'GET', url });
    if (url === 'https://oauth2.googleapis.com/token') {
      journal.at(-1).jwt = new URLSearchParams(init.body).get('assertion');
      return { ok: true, status: 200, json: async () => ({ access_token: 'JETON' }) };
    }
    const m = url.match(/\/documents\/collecte_partagee\/([^?]+)/);
    assert.ok(m, 'adresse inattendue : ' + url);
    const id = m[1];
    const authentifie = (init.headers || {}).Authorization === 'Bearer JETON';
    if ((init.method || 'GET') === 'PATCH') {
      assert.ok(authentifie, 'une écriture doit porter le jeton du compte de service');
      if (o.echec && o.echec(id)) return { ok: false, status: 500, json: async () => ({ error: { message: 'panne' } }) };
      docs.set(id, JSON.parse(init.body).fields);
      return { ok: true, status: 200, json: async () => ({}) };
    }
    if (!authentifie) assert.match(url, /key=CLE_PUBLIQUE/, 'une lecture publique porte la clé d\'API');
    if (!docs.has(id)) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ fields: docs.get(id) }) };
  };
  return { fetchFn, docs, journal };
}

const articles = (n, aleatoire) => Array.from({ length: n }, (_, i) => ({
  id: 'a' + i, cy: 'CI', title: 'Titre ' + i,
  texte: aleatoire ? crypto.randomBytes(900).toString('hex') : 'Texte répété '.repeat(40),
}));

test('ce que le job écrit, la page le relit à l\'identique', async () => {
  const { fetchFn } = fauxReseau();
  const src = articles(200);
  const r = await ecr.ecrireCache(COMPTE, src, fetchFn);
  assert.equal(r.ok, true);
  const lu = await commun.lire(CFG, { fetchFn });
  assert.deepEqual(lu.articles, src);
  assert.equal(lu.updated_at, r.updated_at);
});

test('un cache trop gros pour un document est découpé, chaque morceau sous la limite', async () => {
  const { fetchFn, docs } = fauxReseau();
  const src = articles(1500, true); // incompressible : ~2,7 Mo de JSON
  const r = await ecr.ecrireCache(COMPTE, src, fetchFn);
  assert.ok(r.parts >= 2, 'attendu plusieurs morceaux, obtenu ' + r.parts);
  for (const [id, champs] of docs) {
    if (id === 'global') continue;
    assert.ok(champs.d.stringValue.length <= commun.PARTIE_MAX, id + ' dépasse la limite');
  }
  assert.deepEqual((await commun.lire(CFG, { fetchFn })).articles, src);
});

test('deux publications alternent les emplacements ; un échec en route laisse l\'ancien cache intact', async () => {
  let panne = false;
  const reseau = fauxReseau({ echec: (id) => panne && id === 'global' });
  const v1 = articles(10), v2 = articles(20);
  const r1 = await ecr.ecrireCache(COMPTE, v1, reseau.fetchFn);
  const r2 = await ecr.ecrireCache(COMPTE, v2, reseau.fetchFn);
  assert.notEqual(r1.emplacement, r2.emplacement);
  // L'annonce est écrite en dernier : si elle échoue, la page lit encore v2 entière.
  panne = true;
  await assert.rejects(ecr.ecrireCache(COMPTE, articles(30), reseau.fetchFn), /global/);
  assert.deepEqual((await commun.lire(CFG, { fetchFn: reseau.fetchFn })).articles, v2);
});

test('la page ne retélécharge pas les morceaux quand l\'annonce n\'a pas changé', async () => {
  const { fetchFn, journal } = fauxReseau();
  await ecr.ecrireCache(COMPTE, articles(50), fetchFn);
  const memoire = new Map();
  const stockage = { getItem: (k) => (memoire.has(k) ? memoire.get(k) : null), setItem: (k, v) => memoire.set(k, v) };
  const premiere = await commun.lire(CFG, { fetchFn, stockage });
  assert.equal(premiere.inchange, false);
  const avant = journal.length;
  const seconde = await commun.lire(CFG, { fetchFn, stockage });
  assert.equal(seconde.inchange, true);
  assert.deepEqual(seconde.articles, premiere.articles);
  assert.equal(journal.length - avant, 1, 'seule l\'annonce doit être relue');
});

test('pas de cache publié : null, jamais une exception', async () => {
  const { fetchFn } = fauxReseau();
  assert.equal(await commun.lire(CFG, { fetchFn }), null);
});

test('le jeton Google est demandé avec un JWT RS256 valide', async () => {
  const { fetchFn, journal } = fauxReseau();
  await ecr.ecrireCache(COMPTE, articles(3), fetchFn);
  const jwt = journal.find((j) => j.jwt).jwt;
  const [h, c, s] = jwt.split('.');
  const dec = (x) => JSON.parse(Buffer.from(x.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  assert.equal(dec(h).alg, 'RS256');
  assert.equal(dec(c).iss, COMPTE.client_email);
  assert.match(dec(c).scope, /datastore/);
  assert.equal(dec(c).aud, 'https://oauth2.googleapis.com/token');
  const ok = crypto.createVerify('RSA-SHA256').update(h + '.' + c).verify(publicKey, Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
  assert.equal(ok, true);
});

test('lireCache relit avec le jeton du compte pour que le job fusionne', async () => {
  const { fetchFn } = fauxReseau();
  const src = articles(7);
  await ecr.ecrireCache(COMPTE, src, fetchFn);
  const lu = await ecr.lireCache(COMPTE, fetchFn);
  assert.deepEqual(lu.articles, src);
  assert.equal(await ecr.lireCache(COMPTE, fauxReseau().fetchFn), null);
});

test('le secret GitHub est lu en JSON ou en base64, jamais accepté incomplet', () => {
  const json = JSON.stringify({ ...COMPTE, type: 'service_account' });
  assert.equal(ecr.lireCompte(json).client_email, COMPTE.client_email);
  assert.equal(ecr.lireCompte(Buffer.from(json).toString('base64')).project_id, 'sentiqs-235ce');
  assert.equal(ecr.lireCompte(''), null);
  assert.equal(ecr.lireCompte('pas du json'), null);
  assert.equal(ecr.lireCompte(JSON.stringify({ client_email: 'x' })), null);
});

test('un refus du jeton Google est une erreur claire, pas un cache vide', async () => {
  const fetchFn = async () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) });
  await assert.rejects(ecr.ecrireCache(COMPTE, articles(1), fetchFn), /invalid_grant/);
});

test('un décodage lit bien du gzip produit par le job', async () => {
  const src = articles(5);
  assert.deepEqual(await commun.decoder(zlib.gzipSync(JSON.stringify(src)).toString('base64')), src);
});
