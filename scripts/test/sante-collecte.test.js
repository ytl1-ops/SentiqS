// Teste la mémoire inter-runs du job de collecte planifiée : SRC_HEALTH et
// PROXY_HEALTH_PAYS doivent survivre à un run vide/absent (premier run, cache
// GitHub Actions pas encore chaud), et round-tripper fidèlement sinon — voir
// scripts/lib/sante-collecte.js pour le raisonnement complet (pourquoi ni un
// commit git, ni Supabase).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { cheminSante, lireSante, ecrireSante, compterCles } = require('../lib/sante-collecte');

function dossierTemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sante-collecte-test-'));
}

test('un répertoire absent renvoie un état vide, jamais une exception', () => {
  const racine = path.join(dossierTemp(), 'nexiste-pas');
  const etat = lireSante(racine);
  assert.deepStrictEqual(etat, { srcHealth: {}, proxyHealthPays: {} });
});

test('un fichier corrompu renvoie un état vide plutôt que de faire planter le job', () => {
  const racine = dossierTemp();
  fs.writeFileSync(cheminSante(racine), '{ceci n\'est pas du JSON');
  const etat = lireSante(racine);
  assert.deepStrictEqual(etat, { srcHealth: {}, proxyHealthPays: {} });
});

test('écriture puis lecture restitue fidèlement les deux caches (round-trip)', () => {
  const racine = dossierTemp();
  const etat = {
    srcHealth: { 'src-1': { fails: 0, lastOk: 1000, lastFail: 0 } },
    proxyHealthPays: { 'CI:2': { ok: 5, fail: 1, lastFail: 900, lastRaison: null } },
  };
  ecrireSante(racine, etat);
  const relu = lireSante(racine);
  assert.deepStrictEqual(relu, etat);
});

test('ecrireSante crée le répertoire de destination si nécessaire', () => {
  const racine = path.join(dossierTemp(), 'sous', 'dossier');
  assert.ok(!fs.existsSync(racine));
  ecrireSante(racine, { srcHealth: { a: 1 }, proxyHealthPays: {} });
  assert.ok(fs.existsSync(cheminSante(racine)));
});

test('un état partiel ou mal formé est normalisé sans jeter', () => {
  const racine = dossierTemp();
  ecrireSante(racine, { srcHealth: { a: 1 } }); // proxyHealthPays absent
  const relu = lireSante(racine);
  assert.deepStrictEqual(relu, { srcHealth: { a: 1 }, proxyHealthPays: {} });

  const racine2 = dossierTemp();
  fs.writeFileSync(cheminSante(racine2), JSON.stringify({ srcHealth: 'pas un objet', proxyHealthPays: null }));
  assert.deepStrictEqual(lireSante(racine2), { srcHealth: {}, proxyHealthPays: {} });
});

test('compterCles compte les clés d\'un objet et tolère les valeurs non-objets', () => {
  assert.strictEqual(compterCles({ a: 1, b: 2 }), 2);
  assert.strictEqual(compterCles({}), 0);
  assert.strictEqual(compterCles(null), 0);
  assert.strictEqual(compterCles(undefined), 0);
});

test('le fichier écrit se nomme sante-collecte.json sous la racine donnée', () => {
  const racine = dossierTemp();
  assert.strictEqual(cheminSante(racine), path.join(racine, 'sante-collecte.json'));
});
