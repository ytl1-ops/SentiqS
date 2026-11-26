// Le thème clair suit la même famille que le sombre : bleu nuit + or (26/11/2026).
// Avant : encre/graphite et bronze, un second produit visuellement. Les couleurs
// de gravité ne bougent pas, et un texte or sur blanc doit tenir le seuil AA.
const test = require('node:test');
const assert = require('node:assert');
const { HTML } = require('./_bac');

const racine = HTML.slice(HTML.indexOf(':root{'), HTML.indexOf('html[data-theme="dark"]{'));
const jeton = (n) => (racine.match(new RegExp('--' + n + ':(#[0-9A-Fa-f]{6})')) || [])[1];
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };

test('action, chrome et texte sont en bleu nuit (plus de graphite)', () => {
  for (const n of ['b', 'n', 'ink', 'nav-bg', 't']) {
    const h = jeton(n); assert.ok(h, n);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    assert.ok(b > r + 12 && b > g, '--' + n + ' ' + h + ' n’est pas bleu nuit');
  }
});

test('les couleurs de gravité du thème clair sont inchangées', () => {
  assert.strictEqual(jeton('r'), '#8B1A1A'); assert.strictEqual(jeton('a'), '#7C4A00');
  assert.strictEqual(jeton('m'), '#78350F'); assert.strictEqual(jeton('j'), '#CA8A04'); assert.strictEqual(jeton('g'), '#0F4F2A');
});

test('l’or de signature en texte tient AA sur blanc et sur la surface', () => {
  assert.ok(ratio(jeton('sig'), '#FFFFFF') >= 4.5);
  assert.ok(ratio(jeton('sig'), jeton('sf')) >= 4.5);
  assert.ok(ratio(jeton('lg'), jeton('sf')) >= 4.5);
});
