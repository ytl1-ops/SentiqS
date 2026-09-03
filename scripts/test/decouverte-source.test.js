// Teste les parties de scripts/lib/decouverte-source.js qui ne nécessitent
// pas de réseau réel : ressembleAUnFlux() et la structure de
// CHEMINS_CONNUS. decouvrirMeilleurFlux()/essayerCheminsConnus() font des
// requêtes HTTP réelles via fetchRespectueux et ne sont vérifiables qu'en
// conditions réelles (voir scripts/decouvrir-nouvelles-sources.js).
const test = require('node:test');
const assert = require('node:assert');
const { ressembleAUnFlux, CHEMINS_CONNUS } = require('../lib/decouverte-source');

test('reconnait un flux RSS 2.0', () => {
  assert.strictEqual(
    ressembleAUnFlux('<?xml version="1.0"?>\n<rss version="2.0"><channel></channel></rss>'),
    true,
  );
});

test('reconnait un flux Atom', () => {
  assert.strictEqual(
    ressembleAUnFlux('<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"></feed>'),
    true,
  );
});

test('reconnait un flux RDF (format AllAfrica)', () => {
  assert.strictEqual(
    ressembleAUnFlux('<?xml version="1.0"?>\n<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"></rdf:RDF>'),
    true,
  );
});

test('rejette une page HTML renvoyee a la place d un flux (redirection silencieuse frequente)', () => {
  assert.strictEqual(
    ressembleAUnFlux('<!DOCTYPE html><html><head><title>Page introuvable</title></head><body>404</body></html>'),
    false,
  );
});

test('rejette du contenu absent ou vide sans jeter', () => {
  assert.strictEqual(ressembleAUnFlux(''), false);
  assert.strictEqual(ressembleAUnFlux(undefined), false);
  assert.strictEqual(ressembleAUnFlux(null), false);
});

test('ne se laisse pas tromper par les mots rss/feed dans un texte HTML normal', () => {
  const html = '<!DOCTYPE html><html><body><p>Abonnez-vous a notre flux RSS via ce lien.</p></body></html>';
  assert.strictEqual(ressembleAUnFlux(html), false);
});

test('la liste des chemins connus est non vide et commence par des chemins relatifs', () => {
  assert.ok(CHEMINS_CONNUS.length > 0);
  CHEMINS_CONNUS.forEach((c) => assert.ok(c.startsWith('/'), c + ' devrait etre un chemin relatif'));
});

test('la liste des chemins connus ne contient pas de doublon', () => {
  assert.strictEqual(new Set(CHEMINS_CONNUS).size, CHEMINS_CONNUS.length);
});
