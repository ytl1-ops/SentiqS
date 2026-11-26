// Cohérence des données : un fait ne figure qu'une fois (26/11/2026).
// Demande de YORO : « éviter les doublons et répétitions dans les rapports ».
// Mesure sur le cumul de novembre : 23 titres identiques, dont 3 d'un pays à l'autre.
const test = require('node:test');
const assert = require('node:assert');
const { retirerDoublonsEntrePays } = require('../lib/faits-grsci');

const f = (titre, extra) => Object.assign({ titre, url: null, niveau: 'mod', cotation: null, publieMs: 1 }, extra);

test('un même article au Bénin et au Niger ne reste qu’une fois', () => {
  const c = { pays: {
    NE: [f('Le HCR alerte sur la situation des déplacés au Sahel central', { url: 'https://x.org/a', cotation: 'confirme' })],
    BJ: [f('Le HCR alerte sur la situation des déplacés au Sahel central', { url: 'https://x.org/a', niveau: 'high' })],
  } };
  const r = retirerDoublonsEntrePays(c, 'CI');
  assert.strictEqual(r.length, 1);
  assert.strictEqual(c.pays.BJ.length + c.pays.NE.length, 1);
  const reste = c.pays.BJ[0] || c.pays.NE[0];
  assert.strictEqual(reste.niveau, 'high', 'le niveau le plus grave des exemplaires est gardé');
  assert.strictEqual(reste.cotation, 'confirme', 'la meilleure cotation aussi');
});

test('le pays prioritaire garde le fait', () => {
  const t = 'Attaque contre un convoi à la frontière, trois morts';
  const c = { pays: { BF: [f(t)], CI: [f(t)] } };
  retirerDoublonsEntrePays(c, 'CI');
  assert.strictEqual(c.pays.CI.length, 1);
  assert.strictEqual(c.pays.BF.length, 0);
});

test('deux faits différents ne se replient pas, ni deux titres courts', () => {
  const c = { pays: { BF: [f('Attaque à Djibo'), f('Accident de la route près de Kaya', { url: 'u1' })], ML: [f('Attaque à Djibo'), f('Accident de la route près de Mopti', { url: 'u2' })] } };
  assert.strictEqual(retirerDoublonsEntrePays(c, 'CI').length, 0);
});

test('le doublon dans un même pays reste l’affaire de cumuler (aucun retrait ici)', () => {
  const t = 'Un titre assez long pour compter comme identité du fait';
  const c = { pays: { BF: [f(t), f(t)] } };
  assert.strictEqual(retirerDoublonsEntrePays(c, 'CI').length, 0);
});

// ── Collecte : une source qui se republie elle-même ──────────────────────
const { tranche, bac, exposer } = require('./_bac.js');
const { dedupliquerArticles } = exposer(bac(tranche('function dedupliquerArticles', '\nfunction attachConfidenceScores')), 'dedupliquerArticles');
const art = (id, title, primary, url, score = 80) => ({ id, title, primary, score, cy: 'ML', srcs: [primary], crosses: [primary], url });

test('la même source sous deux identifiants (même adresse) ne s’affiche qu’une fois, sans devenir « recoupée »', () => {
  const a = art('a', 'Attaque contre un convoi près de Tombouctou', 's1', 'https://s1/x');
  const b = art('b', 'Attaque contre un convoi près de Tombouctou (mise à jour)', 's1', 'https://s1/x');
  const out = dedupliquerArticles([a, b]);
  assert.strictEqual(out.length, 1);
  assert.ok(!out[0].verified, 'une source ne se corrobore pas elle-même');
});

test('la même source, titre identique, adresses différentes : repliée', () => {
  const a = art('a', 'Le conseil des ministres adopte trois décrets', 's1', 'https://s1/1');
  const b = art('b', 'Le conseil des ministres adopte trois décrets', 's1', 'https://s1/2');
  assert.strictEqual(dedupliquerArticles([a, b]).length, 1);
});

test('la même source, titres seulement proches : les deux restent', () => {
  const a = art('a', 'Attaque meurtrière contre un convoi militaire près de Tombouctou', 's1', 'https://s1/1');
  const b = art('b', 'Attaque meurtrière visant un convoi militaire près de Tombouctou', 's1', 'https://s1/2');
  assert.strictEqual(dedupliquerArticles([a, b]).length, 2);
});
