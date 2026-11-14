// Demande de YORO, 13/11/2026 : s'inspirer (principes seulement) d'un outil
// de gestion de crise pour la hiérarchie de page et des graphiques d'une
// fiche pays d'un outil de veille pour le tableau de bord. Les graphiques
// lisent les données déjà calculées par la page et mènent aux actus.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { HTML, tranche, bac } = require('./_bac.js');

function contexte(serie, cy) {
  const c = bac();
  Object.assign(c, {
    LANG: 'fr', HISTORIQUE_SERIE: serie, GLOBAL_CY_FILTER: cy || 'all',
    PAYS_INFO: { ML: { name: 'Mali', flag: '' }, CI: { name: "Côte d'Ivoire", flag: '' } },
    escHtml: (s) => String(s), libelleFenetre: () => '36 h',
  });
  const code = tranche('// ═══ PANORAMA DU TABLEAU DE BORD — 13/11/2026 ═══', '// Dessine la trajectoire');
  assert.match(code, /function panoramaDashboard/, 'la tranche contient bien le panorama');
  vm.runInContext(code, c);
  return c;
}
const scores = [
  { cy: 'ML', pays: { name: 'Mali', flag: '' }, score: 89.5, key: 'rouge' },
  { cy: 'CI', pays: { name: "Côte d'Ivoire", flag: '' }, score: 40, key: 'jaune' },
];
const arts = [
  { cy: 'ML', cat: 'securite', level: 'crit' }, { cy: 'CI', cat: 'securite', level: 'normal' },
  { cy: 'CI', cat: 'economique', level: 'high' },
];
const serie = { jours: ['2026-11-11', '2026-11-12', '2026-11-13'], pays: {
  ML: [['2026-11-11', 'marron'], ['2026-11-12', 'rouge'], ['2026-11-13', 'rouge']],
  CI: [['2026-11-11', 'orange'], ['2026-11-12', 'jaune'], ['2026-11-13', 'jaune']],
} };

test('la trajectoire compte les pays à l\'orange ou plus, et au marron ou plus, par relevé', () => {
  const c = contexte(serie);
  const s = JSON.parse(JSON.stringify(c.serieTensionPano(serie, 30)));
  assert.deepStrictEqual(s.map(d => [d.orangePlus, d.marronPlus]), [[2, 1], [1, 1], [1, 1]]);
});

test('chaque élément du panorama mène aux données qu\'il montre', () => {
  const h = contexte(serie).panoramaDashboard(scores, arts, (k) => '#000');
  assert.match(h, /data-filtre="alniv:rouge"/);
  assert.match(h, /data-filtre="cat:securite"/);
  assert.match(h, /data-filtre="pays:ML"/);
  // 14/11/2026 : la courbe n'ouvre plus un compteur global, un clic sur un
  // jour liste les pays de ce jour (zone panoJour) ; la légende mène aux niveaux.
  assert.match(h, /id="panoCourbe" role="button" tabindex="0" aria-controls="panoJour"/);
  assert.doesNotMatch(h, /data-filtre="kpi:tension"/);
  assert.match(h, /id="panoJour" aria-live="polite"/);
  assert.match(h, /data-filtre="alniv:orange"/);
  assert.match(h, /data-filtre="alniv:marron"/);
});

test('un jour de la trajectoire liste ses pays, du plus grave au moins grave', () => {
  const c = contexte(serie);
  const j = JSON.parse(JSON.stringify(c.paysEnTensionJour(serie, '2026-11-11')));
  assert.deepStrictEqual(j, [{ cy: 'ML', key: 'marron' }, { cy: 'CI', key: 'orange' }]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.paysEnTensionJour(serie, '2026-11-13'))), [{ cy: 'ML', key: 'rouge' }]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.paysEnTensionJour(serie, '2026-01-01'))), []);
});

test('un niveau est écrit en toutes lettres à côté de sa couleur', () => {
  const h = contexte(serie).panoramaDashboard(scores, arts, (k) => '#000');
  assert.match(h, /Mali<span class="niv">Grave<\/span>/);
  assert.match(h, /<i style="background:#000"><\/i>Grave <b>1<\/b>/);
});

test('chaque graphique dit sa source, et le thème suit le pays choisi', () => {
  const h = contexte(serie, 'CI').panoramaDashboard(scores, arts, (k) => '#000');
  assert.strictEqual((h.match(/class="pano-src"/g) || []).length, 4);
  assert.match(h, /Sécurité<span class="niv">0 critiques ou élevées<\/span><\/span><span class="piste"><span class="barre" style="width:100%"><\/span><\/span><span class="val">1</);
});

test('pas de trajectoire avant deux relevés', () => {
  const un = { jours: ['2026-11-13'], pays: { ML: [['2026-11-13', 'rouge']] } };
  const h = contexte(un).panoramaDashboard(scores, arts, (k) => '#000');
  assert.doesNotMatch(h, /panoCourbe/);
  assert.match(h, /à partir de deux relevés/);
});

test('le panorama est câblé dans le tableau de bord, et les sections portent un sur-titre', () => {
  assert.match(HTML, /\$\{panoramaDashboard\(scores, artsActifs, k => scoreColor\(\{key:k\}\)\)\}/);
  assert.match(HTML, /dessinerCourbePano\(k => scoreColor\(\{key:k\}\)\);/);
  assert.match(HTML, /<span class="sur-titre">'\+\(LANG==='en'\?'Situation'/);
  assert.match(HTML, /\.sur-titre\{display:block/);
  // Le clic sur un niveau ouvre d'abord le module Alertes.
  assert.match(HTML, /function allerNiveauAlerte\(k, essai\)[\s\S]{0,300}\.ntab\[data-view="alertes"\]/);
});

test('les autres graphiques du tableau de bord mènent à leurs données (14/11/2026)', () => {
  // Profil de risque : chaque point ouvre le Flux du pays sur cette dimension,
  // chaque axe le Flux de la dimension ; les points sont dessinés après toutes
  // les formes, sinon le polygone suivant absorbe le clic.
  assert.match(HTML, /data-filtre="payscat:\$\{x\.s\.cy\}:\$\{ax\.k\}" role="button" tabindex="0"/);
  assert.match(HTML, /data-filtre="cat:\$\{ax\.k\}" role="button" tabindex="0"/);
  assert.match(HTML, /formes\.map\(f => f\.forme\)\.join\(''\) \+ formes\.map\(f => f\.points\)\.join\(''\)/);
  assert.match(HTML, /if \(k === 'payscat'\) \{[^}]*applyGlobalCountryFilter\(v\.slice\(0, j\)\); return filtrerFluxPar\(v\.slice\(j \+ 1\)\)/);
  // Listes par niveau : le titre ouvre les fiches de ce niveau, un pays sa fiche.
  assert.match(HTML, /const zoneCard = \(titre, liste, couleur, cle\)/);
  assert.match(HTML, /data-filtre="alniv:\$\{cle\}"/);
  assert.match(HTML, /'#854D0E'\), 'jaune'\)\}/);
});
