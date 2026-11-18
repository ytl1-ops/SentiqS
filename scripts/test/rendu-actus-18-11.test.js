// Relecture du rendu des actus (demande de YORO du 18/11/2026 : « faire des
// actu une référence mondiale »). Chaque test a été vu échouer sur l'ancien code.
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche, bac } = require('./_bac');

test('les libellés de gravité affichés sont accentués', () => {
  const corps = tranche('function lp(l)', '\n');
  for (const mot of ["'ÉLEVÉ'", "'MODÉRÉ'", "'NON CONFIRMÉ'"]) assert.ok(corps.includes(mot), mot);
  assert.ok(!/'ELEVE'|'MODERE'|'NON CONF'/.test(corps));
});

test('les cartes du Flux et « À la une » prennent le nom accentué du pays', () => {
  assert.match(tranche('function carteUneHtml(a)', 'visuelActu(a'), /const cc = paysR\(a\.cy \|\| 'INT'\)/);
  assert.match(tranche('function renderOneArt(a){', 'const scl='), /const cc=paysR\(a\.cy\|\|'INT'\)/);
  assert.ok(!HTML.includes("(scl[a.sc]||'Regional')"));
});

test('un sigle de thème ne se lit plus à l’intérieur d’un mot', () => {
  const ctx = bac(
    tranche('const BALISE_THEME_KW', '// balisesArticle(a)')
    + tranche('function balisesArticle(a) {', '  if ((EVENT_PLANIFIE_KW')
    + '  return balises; }\nthis.B = balisesArticle;'
  );
  const lab = (t) => ctx.B({ title: t, analysis: '' }).map((b) => b.label);
  // « délégation » contient « gat » (groupe armé terroriste).
  assert.ok(!lab('Une délégation de journalistes nigériens visite un centre de semences').includes('Terrorisme'));
  assert.ok(lab('Un GAT neutralisé près de Torodi').includes('Terrorisme'));
  // Les mots longs gardent pluriels et dérivés.
  assert.ok(lab('Deux drones kamikazes manquent leurs cibles').includes('Terrorisme'));
  assert.ok(lab('Bataille parlementaire au Sénégal').includes('Politique'));
});

test('« souveraineté alimentaire » n’est pas un mot de crise', () => {
  assert.ok(tranche('const EXPRESSIONS_NON_SECURITAIRES', '];').includes("'souverainete alimentaire'"));
});
