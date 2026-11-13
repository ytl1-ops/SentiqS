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

// Flux sur telephone : la date de survenance, insecable, sortait de la carte
// (3 cartes sur 39 a 390 px, 6 a 360 px, cache reel du 13/11/2026).
test('Flux sur telephone : la date de survenance passe a la ligne, ecran etroit ET mode mobile force', () => {
  const regle = '.art-top .survtime{white-space:normal;min-width:0;max-width:100%;overflow-wrap:anywhere}';
  assert.ok(HTML.includes('html:not(.force-web) ' + regle), 'regle ecran etroit absente');
  assert.ok(HTML.includes('html.force-mobile ' + regle), 'regle mode mobile force absente');
});

// Tablette : le bandeau « Cliquez sur Actualiser » tenait sur trois lignes a
// 820 px (76 px avant le contenu, 45 apres). La pastille passe a droite.
test('tablette : le bandeau de collecte tient sur une bande, mode automatique ET tablette forcee', () => {
  for (const regle of [
    '.pb-body{display:flex;align-items:center;flex-wrap:nowrap;gap:12px}',
    '.pb-step{display:block;line-height:1.45}',
    '.pb-pills{margin-top:0;flex-shrink:0}',
  ]) {
    assert.ok(HTML.includes('html:not(.force-web):not(.force-mobile) ' + regle), 'automatique : ' + regle);
    assert.ok(HTML.includes('html.force-tablette ' + regle), 'forcee : ' + regle);
  }
});
