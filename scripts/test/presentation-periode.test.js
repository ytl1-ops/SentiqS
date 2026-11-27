// Présentation 1 à la demande, 27/11/2026. YORO : « Ne pas faire
// presentation 1 automatique, mais plutot a la demande. Offrir le choix des
// periodes, des pays, zones geographique... »
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Per = require('../../web/js/presentation-perimetre.js');
const g = require('../lib/rapport-grsci.js');

const RACINE = path.join(__dirname, '..', '..');
const F = (titre, jour) => ({ titre, niveau: 'high', cat: 'securite', source: 'Koaci', sources: ['Koaci'], url: 'https://k.example/' + encodeURIComponent(titre), publieMs: Date.parse(jour + 'T08:00:00Z'), cotation: 'probable', extraits: [] });
const PAYS = [{ cy: 'CI', nom: "Côte d'Ivoire", faits: [
  F('Attaque à Korhogo', '2026-10-30'), F('Attaque à Bouna', '2026-11-02'), F('Attaque à Odienné', '2026-11-05'),
] }];

test('une période sur deux mois lit les deux cumuls mensuels', () => {
  assert.deepStrictEqual(Per.moisDeLaPeriode('2026-10-28', '2026-11-03'), ['2026-10', '2026-11']);
  assert.deepStrictEqual(Per.moisDeLaPeriode('2026-11-03', '2026-11-03'), ['2026-11']);
  assert.deepStrictEqual(Per.moisDeLaPeriode('2026-12-30', '2027-01-02'), ['2026-12', '2027-01']);
});

test('une plage libre écarte les faits avant ET après elle', () => {
  const r = Per.composer(PAYS, { mode: 'pays', cy: 'CI', debut: '2026-10-29', jour: '2026-11-03' });
  const titres = r.principal.d.faits.map((f) => f.titre);
  assert.deepStrictEqual(titres.sort(), ['Attaque à Bouna', 'Attaque à Korhogo']);
  assert.ok(r.criteres.includes('Période : du 29 octobre 2026 au 3 novembre 2026'), r.criteres.join(' | '));
  assert.strictEqual(r.debut, '2026-10-29');
});

test('un jour ne garde que les faits de ce jour', () => {
  const r = Per.composer(PAYS, { mode: 'pays', cy: 'CI', debut: '2026-11-02', jour: '2026-11-02' });
  assert.deepStrictEqual(r.principal.d.faits.map((f) => f.titre), ['Attaque à Bouna']);
  assert.ok(r.criteres.includes('Période : le 2 novembre 2026'));
  assert.strictEqual(g.libellePeriode('2026-11-02', '2026-11-02'), 'Journée du 2 novembre 2026');
});

test('un début après la fin est ramené à la fin, jamais une période vide en silence', () => {
  const r = Per.composer(PAYS, { mode: 'pays', cy: 'CI', debut: '2026-11-09', jour: '2026-11-05' });
  assert.strictEqual(r.debut, '2026-11-05');
  assert.deepStrictEqual(r.principal.d.faits.map((f) => f.titre), ['Attaque à Odienné']);
});

test('le job ne génère plus la Présentation 1 sans demande', () => {
  const job = fs.readFileSync(path.join(RACINE, 'scripts', 'collecte-planifiee.js'), 'utf8');
  const code = job.replace(/\/\/.*$/gm, '');
  assert.ok(!/rapportsAActualiser\s*\(/.test(code), 'rapportsAActualiser rappelé par le job');
  assert.ok(/GRSCI_FORCER\s*===\s*'1'/.test(code), 'la génération doit dépendre du lancement manuel');
  const wf = fs.readFileSync(path.join(RACINE, '.github', 'workflows', 'collecte-planifiee.yml'), 'utf8');
  assert.ok(/mois_rapport/.test(wf), 'choix du mois au lancement manuel');
});

test('la page propose jour, semaine, quinzaine, mois et plage libre', () => {
  const html = fs.readFileSync(path.join(RACINE, 'web', 'SentiqS_Web.html'), 'utf8');
  for (const v of ['mois', 'semaine', 'quinzaine', 'jour', 'plage']) assert.ok(html.includes("opt('" + v + "'"), 'option ' + v);
  assert.ok(/function p1CumulPeriode/.test(html));
});

test('une piqûre ou une morsure ne reçoit pas le repère « menace armée »', () => {
  const R = require('../../web/js/reperes-surete.js');
  const cle = (titre) => R.enjeuxSurete({ titre, cat: 'divers' }).cle;
  assert.strictEqual(cle('Piqûre de scorpion : Voici les gestes à adopter après une attaque'), 'animal');
  assert.strictEqual(cle("Attaque d'abeilles à Podor : deux morts"), 'animal');
  // Garde : un agresseur humain garde la famille de l'attaque, même avec un animal cité.
  assert.strictEqual(cle('Des hommes armés tuent un éleveur et volent ses chiens'), 'attaque');
  // Garde : un hippodrome n'est pas un hippopotame, les Éléphants sont une équipe.
  assert.notStrictEqual(cle("Bamako : coup de filet du Commissariat de l'Hippodrome"), 'animal');
  assert.notStrictEqual(cle('Les Éléphants battent le Gabon'), 'animal');
});
