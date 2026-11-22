// Tenue à la charge (22/11/2026) : quand Firestore refuse (quota du plan
// gratuit épuisé), la page sert la dernière copie gardée sur l'appareil au
// lieu de lancer une collecte de ~560 sources par visiteur.
const test = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');
const commun = require('../../web/js/cache-firestore.js');
const modele = require('../lib/capacite.js');

const CFG = { projectId: 'p', apiKey: 'k' };
const b64 = a => zlib.gzipSync(Buffer.from(JSON.stringify(a))).toString('base64');
const stockage = (o) => ({ getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = v; } });

test('lireLocal rend la dernière copie, marquée dégradée', async () => {
  const st = stockage({ [commun.CLE_LOCALE]: JSON.stringify({ updated_at: '2026-11-22T10:00:00Z', emplacement: 'a', donnees: b64([{ id: 1 }]) }) });
  const r = await commun.lireLocal(CFG, st);
  assert.deepStrictEqual(r.articles, [{ id: 1 }]);
  assert.strictEqual(r.degrade, true);
});

test('lireLocal rend null sans copie ou avec une copie illisible', async () => {
  assert.strictEqual(await commun.lireLocal(CFG, stockage({})), null);
  const st = stockage({ [commun.CLE_LOCALE]: JSON.stringify({ updated_at: 'x', donnees: 'pas-du-gzip' }) });
  assert.strictEqual(await commun.lireLocal(CFG, st), null);
  assert.strictEqual(await commun.lireLocal(CFG, null), null);
});

test('la page ne relance pas Firestore pendant la pause et accepte une copie de 24 h', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../web/SentiqS_Web.html'), 'utf8');
  assert.match(html, /_fsPanneJusqua = Date\.now\(\) \+ FS_PANNE_PAUSE_MS/);
  assert.match(html, /if \(Date\.now\(\) < _fsPanneJusqua\) return window\.SentiqCacheFirestore\.lireLocal/);
  assert.match(html, /fs\.degrade \? COLLECTE_PARTAGEE_DEGRADEE_MAX_MS/);
});

test('les en-têtes de cache Hosting : js et assets mis en cache, html revalidé', () => {
  const h = JSON.parse(fs.readFileSync(path.join(__dirname, '../../firebase.json'), 'utf8')).hosting.headers;
  const val = s => (h.find(r => r.source === s).headers.find(x => x.key === 'Cache-Control') || {}).value;
  assert.match(val('js/**'), /max-age=300/);
  assert.match(val('assets/**'), /max-age=604800/);
  assert.strictEqual(val('**/*.@(html|json)'), 'no-cache');
  // la règle précise passe AVANT la règle générale (la première l'emporte)
  assert.ok(h.findIndex(r => r.source.includes('historique')) < h.findIndex(r => r.source === '**/*.@(html|json)'));
});

test('le modèle de capacité : les quotas gratuits ne tiennent pas à 50 000 sans cache statique', () => {
  const m = modele.calculer({ utilisateurs: 50000 });
  assert.ok(m.lignes.firestore_lectures_jour.besoin > modele.QUOTAS.firestore_lectures_jour);
  assert.ok(m.lignes.hosting_spark_mo_jour.besoin > modele.QUOTAS.hosting_spark_mo_jour);
  // une ouverture simple coûte au moins 1 lecture (l'annonce)
  assert.ok(m.lectures_par_ouverture >= 1);
});

test('le modèle de capacité : une fois le contenu servi en statique, les lectures tombent sous le quota', () => {
  const m = modele.calculer({ utilisateurs: 50000, contenuStatique: true });
  assert.ok(m.lignes.firestore_lectures_jour.besoin <= modele.QUOTAS.firestore_lectures_jour);
});
