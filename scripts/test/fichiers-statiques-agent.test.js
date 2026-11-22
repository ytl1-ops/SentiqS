'use strict';
// Faits de l'agent, agenda de l'agent et validations en fichiers statiques
// (audit de capacité du 22/11/2026) : plus de lecture Firestore par
// utilisateur sur du contenu commun.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../lib/exporter-statiques');

const racine = path.join(__dirname, '..', '..');
const page = fs.readFileSync(path.join(racine, 'web', 'SentiqS_Web.html'), 'utf8');

test('les validations publiques ne portent jamais l\'adresse de l\'analyste', () => {
  const sortie = E.validationsPubliques([
    { id: 'a', data: { cle: 'CI|titre', decision: 'confirme', source: 'B', info: '2', par: 'analyste@exemple.org', le: '2026-11-22T07:00:00Z', note: 'recoupé' } },
  ]);
  assert.equal(sortie.length, 1);
  assert.equal(sortie[0].par, 'analyste');
  assert.ok(!JSON.stringify(sortie).includes('@'));
  assert.equal(sortie[0].note, 'recoupé');
});

test('l\'export est déterministe : trié par clé, sans horodatage d\'export', () => {
  const docs = [
    { id: 'b', data: { article: '{"u":2}' } },
    { id: 'a', data: { article: '{"u":1}' } },
  ];
  assert.deepEqual(E.actusPubliques(docs).map(d => d.id), ['a', 'b']);
  assert.equal(JSON.stringify(E.actusPubliques(docs)), JSON.stringify(E.actusPubliques(docs.slice().reverse())));
});

test('un document sans contenu est écarté, jamais exporté vide', () => {
  assert.equal(E.actusPubliques([{ id: 'x', data: {} }, null]).length, 0);
  assert.equal(E.agendaPublic([{ id: 'x', data: { evenement: '' } }]).length, 0);
  assert.equal(E.validationsPubliques([{ id: 'x', data: { cle: 'k' } }]).length, 0);
});

test('la page lit faits et agenda de l\'agent par fichier, Firestore seulement en repli', () => {
  assert.match(page, /async function _faitsAgent\(nom, collection, n\)/);
  assert.match(page, /_faitsAgent\('actus', SentiqAgent\.COLLECTIONS\.actus, 300\)/);
  assert.match(page, /_faitsAgent\('agenda', SentiqAgent\.COLLECTIONS\.agenda, 300\)/);
  assert.doesNotMatch(page, /await _listerFirestore\(SentiqAgent\.COLLECTIONS\.(actus|agenda), 300\)/);
  // le repli ne part que sur un 404, jamais sur une panne réseau
  assert.match(page, /if \(r\.status === 404\) return null;/);
});

test('les validations passent par le fichier statique pour tout compte non administrateur', () => {
  const i = page.indexOf('async function chargerValidations()');
  const corps = page.slice(i, i + 1200);
  assert.match(corps, /_lireFichierAgent\('validations'\)/);
  assert.match(corps, /estAdmin\(/);
});

test('le CDN met ces fichiers en cache et le job les exporte', () => {
  const fb = JSON.parse(fs.readFileSync(path.join(racine, 'firebase.json'), 'utf8'));
  const regle = fb.hosting.headers.find(h => /agent/.test(h.source));
  assert.ok(regle, 'règle de cache pour agent/*.json');
  assert.ok(fb.hosting.headers.indexOf(regle) < fb.hosting.headers.findIndex(h => h.source === '**/*.@(html|json)'), 'la règle précise passe avant no-cache');
  const wf = fs.readFileSync(path.join(racine, '.github', 'workflows', 'collecte-planifiee.yml'), 'utf8');
  assert.match(wf, /node scripts\/exporter-statiques\.js/);
  assert.match(wf, /git add web\/agent/);
});

test('modèle de capacité : le contenu statique ramène les lectures sous le quota', () => {
  const { calculer } = require('../lib/capacite');
  const r = calculer({ contenuStatique: true });
  assert.ok(r.lignes.firestore_lectures_jour.besoin <= r.lignes.firestore_lectures_jour.quota);
});
