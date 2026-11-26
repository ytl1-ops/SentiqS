// La forme double la couleur (26/11/2026, audit des couleurs demandé par YORO).
// Mesure : marron/rouge ΔE 2,7 en deutéranopie (thème clair) ; or de marque et
// marron ΔE 6,7 en thème sombre, y compris en vision normale.
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche, bac, exposer } = require('./_bac');

const NIVEAUX = ['vert', 'jaune', 'orange', 'marron', 'rouge'];
const BLOC = tranche('const NIV = {', '// renderLegendeNiveaux()');

test('chaque niveau porte un remplissage qui monte avec la gravité', () => {
  const f = NIVEAUX.map((k) => Number((BLOC.match(new RegExp('  ' + k + ': +\\{dot:\'[^\']+\', f:(\\d+),')) || [])[1]));
  assert.deepStrictEqual(f, [0, 25, 50, 75, 100]);
});

test('glypheNiveau rend un disque qui hérite la couleur, caché aux lecteurs d’écran', () => {
  const { glypheNiveau } = exposer(bac(tranche('function glypheNiveau', 'function renderLegendeNiveaux')), 'glypheNiveau');
  assert.match(glypheNiveau({ f: 75 }), /^<i class="niv-g" aria-hidden="true" style="--f:75"><\/i>$/);
  assert.strictEqual(glypheNiveau({}), '');
  assert.strictEqual(glypheNiveau(null), '');
});

test('la légende, la tuile pays, la pastille de carte, la fiche d’alerte et l’en-tête pays l’affichent', () => {
  for (const m of ['glypheNiveau(n) + n.label', 'glypheNiveau(NIV[s.key])', 'glypheNiveau(npy)', 'glypheNiveau(niv)', 'glypheNiveau(scB0.niv)'])
    assert.ok(HTML.includes(m), 'absent : ' + m);
});

test('le glyphe n’ajoute aucune couleur de gravité et reste dessiné en CSS', () => {
  const css = HTML.slice(HTML.indexOf('/* ═══ GLYPHE DE NIVEAU'), HTML.indexOf('/* ═══ MOUVEMENT ET FLUIDITÉ'));
  assert.match(css, /\.niv-g\{[^}]*currentColor/);
  for (const v of ['--r)', '--a)', '--m)', '--g)', '--j)', '#B91C1C', '#CA8A04']) assert.ok(!css.includes(v), v);
});
