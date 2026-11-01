// Bascule Firebase, 01/11/2026 : agenda sur Firestore, diagnostic des 403,
// hébergement et règles publiés par le workflow, aperçu des visuels informatif.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const commun = require('../../web/js/cache-firestore.js');
const ecr = require('../lib/cache-firestore-ecriture.js');
const { fusionnerAgenda } = require('../lib/agenda-firestore.js');

const RACINE = path.join(__dirname, '..', '..');
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8');

const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const COMPTE = { client_email: 'job@sentiqs-235ce.iam.gserviceaccount.com', private_key: privateKey, project_id: 'sentiqs-235ce' };

function fauxReseau() {
  const docs = new Map();
  const fetchFn = async (url, init) => {
    init = init || {};
    if (url === 'https://oauth2.googleapis.com/token') return { ok: true, status: 200, json: async () => ({ access_token: 'J' }) };
    const id = url.match(/\/collecte_partagee\/([^?]+)/)[1];
    if (init.method === 'PATCH') { docs.set(id, JSON.parse(init.body).fields); return { ok: true, status: 200, json: async () => ({}) }; }
    if (!docs.has(id)) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ fields: docs.get(id) }) };
  };
  return { fetchFn, docs };
}

test('l\'agenda s\'écrit sous sa propre clé, sans toucher au cache d\'actus', async () => {
  const { fetchFn, docs } = fauxReseau();
  await ecr.ecrireCache(COMPTE, [{ id: 'actu' }], fetchFn);
  await ecr.ecrireCache(COMPTE, [{ id: 'ag1', title: 'Sommet' }], fetchFn, { cle: 'agenda' });
  assert.ok(docs.has('global') && docs.has('global_a_0'));
  assert.ok(docs.has('agenda') && docs.has('agenda_a_0'));
  const cfg = { projectId: 'sentiqs-235ce', apiKey: 'K' };
  assert.deepEqual((await commun.lire(cfg, { fetchFn })).articles, [{ id: 'actu' }]);
  assert.deepEqual((await commun.lire(Object.assign({ cle: 'agenda' }, cfg), { fetchFn })).articles, [{ id: 'ag1', title: 'Sommet' }]);
  const relu = await ecr.lireCache(COMPTE, fetchFn, { cle: 'agenda' });
  assert.equal(relu.articles[0].id, 'ag1');
});

test('le cache local de l\'agenda ne recouvre pas celui des actus', async () => {
  const { fetchFn } = fauxReseau();
  await ecr.ecrireCache(COMPTE, [{ id: 'actu' }], fetchFn);
  await ecr.ecrireCache(COMPTE, [{ id: 'ag1', title: 'x' }], fetchFn, { cle: 'agenda' });
  const m = new Map();
  const stockage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
  const cfg = { projectId: 'sentiqs-235ce', apiKey: 'K' };
  await commun.lire(cfg, { fetchFn, stockage });
  await commun.lire(Object.assign({ cle: 'agenda' }, cfg), { fetchFn, stockage });
  assert.equal(m.size, 2);
  assert.deepEqual((await commun.lire(cfg, { fetchFn, stockage })).articles, [{ id: 'actu' }]);
});

test('un 403 de Firestore dit son motif (règles ou IAM), pas seulement le code', async () => {
  const fetchFn = async () => ({ ok: false, status: 403, json: async () => ({ error: { message: 'Missing or insufficient permissions.' } }) });
  await assert.rejects(commun.lireAnnonce({ projectId: 'p', apiKey: 'K' }, fetchFn), /403 : Missing or insufficient permissions/);
});

test('fusion de l\'agenda : une entrée par id, la plus récente gagne, fenêtre et plafond tenus', () => {
  const now = Date.parse('2026-11-01T12:00:00Z');
  const j = (n) => new Date(now - n * 86400000).toISOString();
  const existants = [
    { id: 'a', title: 'ancien titre', pub_date: j(1), updated_at: j(1) },
    { id: 'vieux', title: 'hors fenêtre', pub_date: j(8), updated_at: j(8) },
  ];
  const nouvelles = [{ id: 'a', title: 'nouveau titre', pub_date: j(1), updated_at: j(0) }, { id: 'b', title: 'b', pub_date: j(0), updated_at: j(0) }];
  const r = fusionnerAgenda(existants, nouvelles, now, 7 * 86400000);
  assert.deepEqual(r.map((l) => l.id), ['b', 'a']);
  assert.equal(r[1].title, 'nouveau titre');
  const beaucoup = Array.from({ length: 700 }, (_, i) => ({ id: 'x' + i, title: 't', pub_date: j(0), updated_at: j(0) }));
  assert.equal(fusionnerAgenda([], beaucoup, now, 7 * 86400000).length, 500);
});

test('la page lit l\'agenda sur Firestore avant Supabase, et le job ne sollicite plus Supabase après Firestore', () => {
  const page = lire('web/SentiqS_Web.html');
  const corps = page.slice(page.indexOf('async function lireAgendaPartagee()'), page.indexOf('// Cache court (5 min)'));
  assert.ok(corps.indexOf("cle: 'agenda'") > 0 && corps.indexOf("cle: 'agenda'") < corps.indexOf('getClientDonnees()'));
  assert.match(page, /function lignesAgendaPartagee\(articles\)/);
  const job = lire('scripts/collecte-planifiee.js');
  assert.match(job, /ecrireCache\(compteFirebase, agenda, fetch, \{ cle: 'agenda' \}\)/);
  assert.match(job, /if \(!pubExterne && typeof publierAgendaPartagee === 'function'\)/);
  assert.match(job, /if \(!pubExterne && typeof publierArticlesRagPartages === 'function'\)/);
});

test('Firebase Hosting sert web/, et le workflow publie hébergement et règles', () => {
  const cfg = JSON.parse(lire('firebase.json'));
  assert.equal(cfg.hosting.public, 'web');
  assert.equal(cfg.firestore.rules, 'firebase/firestore.rules');
  const wf = lire('.github/workflows/gh-pages-deploy.yml');
  assert.match(wf, /firebase-tools@\d+\.\d+\.\d+ deploy --only hosting/);
  assert.match(wf, /node scripts\/publier-regles-firestore\.js/, 'les règles passent par l\'API Rules');
  assert.match(wf, /FIREBASE_SERVICE_ACCOUNT: \$\{\{ secrets\.FIREBASE_SERVICE_ACCOUNT \}\}/);
  assert.match(wf, /rm -f "\$cle"/, 'la clé écrite sur le runner est effacée');
});

test('l\'aperçu des visuels est informatif : un cache illisible ne fait pas échouer une PR', () => {
  const s = lire('scripts/apercu-visuels.js');
  const bloc = s.slice(s.indexOf('if (!ligne) {'), s.indexOf('fs.mkdirSync(OUT'));
  assert.doesNotMatch(bloc, /process\.exit\(1\)/);
});

// 01/11/2026 : le secret portait une clé du projet « sentinel-surete » et le
// déploiement visait le projet de la clé, pas celui de la page.
test('le déploiement et la collecte visent le projet de la page, jamais celui de la clé', () => {
  const wf = lire('.github/workflows/gh-pages-deploy.yml');
  const etape = wf.slice(wf.indexOf('Déployer Hosting et règles Firestore'));
  assert.match(etape, /firebase-config\.js/, 'le projet cible est lu dans la config de la page');
  assert.match(etape, /"\$projet" != "\$projetCle"/, 'une clé d\'un autre projet arrête le déploiement');
  assert.ok(etape.indexOf('"$projet" != "$projetCle"') < etape.indexOf('firebase-tools'), 'la garde passe avant le déploiement');
  const job = lire('scripts/collecte-planifiee.js');
  assert.match(job, /compteLu\.project_id !== projetPage \? null/, 'la collecte refuse une clé d\'un autre projet');
});

test('les règles sont publiées par l\'API Rules : jeu de règles puis release cloud.firestore', async () => {
  const { publierRegles } = require('../publier-regles-firestore.js');
  const appels = [];
  const fetchFn = async (url, init) => {
    appels.push([init.method, url, init.body]);
    if (url === 'https://oauth2.googleapis.com/token') return { ok: true, status: 200, json: async () => ({ access_token: 'J' }) };
    if (url.endsWith('/rulesets')) return { ok: true, status: 200, json: async () => ({ name: 'projects/p/rulesets/R1' }) };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const nom = await publierRegles(COMPTE, 'sentiqs-235ce', 'rules_version = "2";', fetchFn);
  assert.equal(nom, 'projects/p/rulesets/R1');
  assert.match(appels[1][1], /firebaserules\.googleapis\.com\/v1\/projects\/sentiqs-235ce\/rulesets$/);
  assert.match(appels[1][2], /rules_version/);
  assert.equal(appels[2][0], 'PATCH');
  assert.match(appels[2][2], /"rulesetName":"projects\/p\/rulesets\/R1"/);
  assert.match(appels[2][2], /releases\/cloud\.firestore/);
});
