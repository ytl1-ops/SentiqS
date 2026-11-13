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

// Page d'accueil, hors du heros (texte sur photo, contraste mesure au pixel).
test("accueil : cartes de correlation, pastilles alignees et respiration mobile", () => {
  const ACC = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../web/index.html'), 'utf8');
  assert.ok(ACC.includes('.mock-card-hd{flex-wrap:wrap;gap:2px 8px}'), 'le compte doit pouvoir passer sous le theme');
  assert.ok(!/\.mock-card-hd span\{[^}]*nowrap/.test(ACC), 'nowrap fait deborder la page en anglais a 390 px');
  assert.match(ACC, /\.mock-pill\{min-width:\d+px;text-align:center\}/);
  assert.match(ACC, /@media \(max-width:760px\)\{section\{padding:64px 0\}\}/);
});

// L'accueil annoncait « 484 sources » et une fenetre de « 12 h » / « <12h »
// alors que le registre en compte davantage et que la fenetre vaut 36 h
// depuis le 06/09/2026 (voir CLAUDE.md, « La fenetre d'actualite »).
test("accueil : le nombre de sources et la fenetre d'actualite sont ceux de l'outil", () => {
  const fs = require('node:fs'), path = require('node:path');
  const ACC = fs.readFileSync(path.join(__dirname, '../../web/index.html'), 'utf8');
  const i = HTML.indexOf('const SRCS=[');
  let d = 0, j = i + 11;
  for (; j < HTML.length; j++) { if (HTML[j] === '[') d++; else if (HTML[j] === ']') { d--; if (!d) break; } }
  const nb = (HTML.slice(i + 11, j + 1).match(/\bid:\s*'/g) || []).length;
  assert.ok(nb > 400, 'registre SRCS introuvable ou mal decoupe : ' + nb);
  const annonces = [...ACC.matchAll(/<b>(\d+)<\/b><span>Sources [^<]*<\/span>/g)].map(m => +m[1]);
  assert.ok(annonces.length >= 1, 'aucun chiffre de sources sur l\'accueil');
  for (const n of annonces) assert.strictEqual(n, nb, 'sources annoncees ' + n + ' / registre ' + nb);
  const h = +HTML.match(/const FENETRE_ACTUALITE_MS = (\d+) \* 60 \* 60 \* 1000/)[1];
  assert.ok(!/12 dernières heures|&lt;12h/.test(ACC), 'fenetre de 12 h annoncee sur l\'accueil');
  assert.ok(ACC.includes(h + ' dernières heures'), 'la fenetre de ' + h + ' h n\'est pas dite');
});

// La grille des forfaits promettait au gratuit un « Flux 12h » (aucune limite a
// 12 h n'est appliquee : la fenetre vaut 36 h pour tous) et des « Publicites
// affichees » (la publicite a ete retiree). Decision de l'editeur du
// 13/11/2026 : retirer ces deux mentions, le reste de la grille inchange.
test('grille des forfaits : aucune promesse fausse sur l\'offre gratuite', () => {
  const fs = require('node:fs'), path = require('node:path');
  const ACC = fs.readFileSync(path.join(__dirname, '../../web/index.html'), 'utf8');
  for (const [nom, src] of [['appli', HTML], ['accueil', ACC]]) {
    const m = src.match(/\{key:'gratuit',[\s\S]*?feats:\[([^\]]*)\]/);
    assert.ok(m, 'offre gratuite introuvable : ' + nom);
    assert.ok(!/Flux 12h|Publicit/.test(m[1]), nom + ' : ' + m[1]);
    assert.ok(m[1].includes("'1 pays suivi'"), nom + ' : le reste de la ligne doit rester');
  }
});
