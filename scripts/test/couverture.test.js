// Teste la porte d'alerte sur l'accessibilité de la collecte.
//
// Elle existe parce qu'un run a été affiché VERT alors que la collecte était
// potentiellement dégradée : rien ne regardait le taux de réponse des sources.
// Elle ne juge que l'accessibilité — pas la fraîcheur, qui varie légitimement.
const test = require('node:test');
const assert = require('node:assert');
const { evaluerAccessibilite, SEUIL_PAR_DEFAUT } = require('../lib/couverture.js');

const m = (joignables, tentees) => ({ joignables, tentees, mesurable: true });

test('une collecte saine passe', () => {
  const r = evaluerAccessibilite(m(400, 450));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.code, 'acceptable');
  assert.strictEqual(r.tauxPct, 89);
});

test('aucune source joignable échoue, et le dit sans ambiguïté', () => {
  const r = evaluerAccessibilite(m(0, 300));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'aucune_source');
  assert.match(r.message, /AUCUNE source/);
});

test('un effondrement sous le seuil échoue', () => {
  const r = evaluerAccessibilite(m(30, 300)); // 10 %
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'effondrement');
  assert.strictEqual(r.tauxPct, 10);
});

test('juste au seuil, on ne fait pas échouer', () => {
  const r = evaluerAccessibilite(m(20, 100)); // 20 %, seuil 20
  assert.strictEqual(r.ok, true, 'le seuil est une borne basse incluse');
});

test('le seuil est réglable, et le message le cite', () => {
  const r = evaluerAccessibilite(m(50, 100), 60);
  assert.strictEqual(r.ok, false);
  assert.match(r.message, /seuil 60 %/);
});

test('une absence de mesure ne fabrique jamais un échec', () => {
  // Le pire défaut possible pour une porte : crier au loup sur un vide.
  for (const mesure of [
    { joignables: 0, tentees: 0, mesurable: false },
    { joignables: 0, tentees: 0, mesurable: true },
    {},
    null,
  ]) {
    const r = evaluerAccessibilite(mesure);
    assert.strictEqual(r.ok, true, 'aucune mesure ne doit pas valoir échec');
    assert.strictEqual(r.code, 'non_mesurable');
    assert.strictEqual(r.tauxPct, null);
  }
});

test('la fraîcheur n\'entre jamais dans le jugement', () => {
  // Le cas qui a motivé cette correction : 45 sources seulement avaient une
  // actualité de moins de 12 h, alors que les sources répondaient bien.
  const r = evaluerAccessibilite({ joignables: 430, tentees: 450, mesurable: true,
    sourcesAvecArticleFrais: 45, paysAvecArticleFrais: 25 });
  assert.strictEqual(r.ok, true,
    'une faible fraîcheur ne doit pas faire échouer un cycle dont les sources répondent');
});

test('le seuil par défaut reste bas et documenté', () => {
  assert.strictEqual(SEUIL_PAR_DEFAUT, 20,
    'seuil volontairement bas : sans ligne de base, on ne signale que l\'indiscutable');
});
