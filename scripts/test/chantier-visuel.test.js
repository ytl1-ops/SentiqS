// Chantier visuel du 13/11/2026 — ecran seulement (voir CLAUDE.md).
//
// Audit sur les donnees reelles du jour : les sept indicateurs du tableau de
// bord laissaient une colonne vide a droite sur bureau (auto-fill reserve une
// piste de trop) et la septieme tuile restait seule sur sa ligne sur
// telephone ; le titre de la carte regionale se tassait sur quatre lignes a
// cote des trois boutons. Ces gardes ont ete vues echouer sur l'ancien code.
const test = require('node:test');
const assert = require('node:assert');
const { HTML } = require('./_bac');

test('la grille des indicateurs remplit la ligne (auto-fit) et porte sa classe', () => {
  assert.match(HTML, /<div class="kpi-grid" style="display:grid;[^"]*">\s*\$\{kpiCard\(artsActifs\.length/);
  assert.match(HTML, /\.kpi-grid\{grid-template-columns:repeat\(auto-fit,minmax\(\d+px,1fr\)\) !important\}/);
});

test('sur telephone la derniere tuile impaire prend toute la largeur, ecran etroit ET mode mobile force', () => {
  const regle = '.kpi-grid>.kpi-tile:last-child:nth-child(odd){grid-column:1/-1}';
  assert.ok(HTML.includes('html:not(.force-web) ' + regle), 'regle ecran etroit absente');
  assert.ok(HTML.includes('html.force-mobile ' + regle), 'regle mode mobile force absente');
});

test("l'en-tete de la carte regionale passe a la ligne au lieu de tasser le titre", () => {
  assert.match(HTML, /<div class="carto-hd" style="[^"]*display:flex/);
  assert.match(HTML, /<span class="carto-titre" style="font-family:var\(--font-serif\)/);
  assert.match(HTML, /\.carto-hd\{flex-wrap:wrap/);
});
