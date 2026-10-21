// Rapports : langue choisie, emetteur, rubriques — 21/10/2026.
//
// Signalement de l'editeur : le rapport sortait signe « SentiQs » alors que
// l'identite d'envoi avait ete changee, restait en partie en francais en mode
// anglais, et listait les actus en vrac. Ces tests lisent le code de
// production (pas une copie).
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { tranche } = require('./_bac');

function monte(lang, extra = {}) {
  const ctx = { console, Date, LANG: lang, infoPays: (cy) => ({ flag: '', name: cy === 'CI' ? "Côte d'Ivoire" : cy === 'ML' ? 'Mali' : 'International' }),
    PAYS_INFO: { CI: {}, ML: {} }, detectGeo: () => ({}), _cyNivTexteEtCouleur: () => null,
    nomMarqueActuelle: () => 'SentiqS', identiteEnvoiActuelle: () => '' };
  Object.assign(ctx, extra);
  vm.createContext(ctx);
  vm.runInContext(tranche('const PAYS_EN = {', '// ── UPDATE COMPTEURS DL'), ctx);
  vm.runInContext('this.RAPPORT_EN_FIXE = RAPPORT_EN_FIXE;', ctx);
  return ctx;
}

test('l emetteur du rapport est l identite d envoi, a defaut la marque', () => {
  assert.strictEqual(monte('fr', { identiteEnvoiActuelle: () => 'Cellule de Veille' }).emetteurRapport('flux'), 'Cellule de Veille');
  assert.strictEqual(monte('fr').emetteurRapport('flux'), 'SentiqS');
});

test('les generateurs signent la couverture et le pied de l emetteur, pas de la marque', () => {
  const word = tranche('async function exportWord(type)', '</script>');
  assert.match(word, /text:emetteurW,bold:true,size:56/);
  assert.doesNotMatch(word, /text:nomMarqueActuelle\(\),bold:true,size:56/);
  assert.match(tranche('bulletinHeader(titre', 'statsGrid(items)'), /b\.emetteur \|\| nomMarqueActuelle\(\)/);
});

test('en anglais, les libelles fixes sont dits en anglais et les titres d article intacts', () => {
  const c = monte('en');
  assert.strictEqual(c.trRapport('Rapport opérationnel'), 'Operational report');
  assert.strictEqual(c.trRapport('Page 3'), 'Page 3');
  assert.strictEqual(c.trRapport('Rapport opérationnel de la brigade de Kong'), 'Rapport opérationnel de la brigade de Kong');
  assert.strictEqual(c.trRapport('Attaque contre un convoi près de Kong'), 'Attaque contre un convoi près de Kong');
  assert.strictEqual(monte('fr').trRapport('Rapport opérationnel'), 'Rapport opérationnel');
});

test('les statuts d agenda avec tiret entoure d espaces sont traduits', () => {
  assert.match(monte('en').trRapport('Sommet CEDEAO  —  EN COURS'), /ONGOING$/);
});

test('rubrique puis pays : un article politique cite un sommet devient geopolitique', () => {
  const c = monte('fr');
  const arts = [
    { cat: 'securite', cy: 'ML', level: 'crit', title: 'Attaque a Gao', pubDate: 5 },
    { cat: 'politique', cy: 'CI', level: 'mod', title: 'Sommet de la CEDEAO a Abidjan', pubDate: 4 },
    { cat: 'politique', cy: 'CI', level: 'mod', title: 'Le gouvernement adopte un budget', pubDate: 3 },
    { cat: 'economique', cy: 'CI', level: 'ok', title: 'Cacao : les prix montent', pubDate: 2 },
  ];
  const g = c.groupesRubriquePays(arts);
  assert.deepStrictEqual(Array.from(g.map(x => x.rub.k)), ['securite', 'politique', 'geopolitique', 'economique']);
  assert.strictEqual(g[2].pays[0].items[0].title, 'Sommet de la CEDEAO a Abidjan');
  assert.strictEqual(g[0].pays[0].cy, 'ML');
});

test('garde : le mot « un » d un titre francais ne rend pas un article geopolitique', () => {
  const c = monte('fr');
  assert.strictEqual(c.rubriqueRapport({ cat: 'politique', cy: 'CI', title: 'Un ministre inaugure un marche', analysis: '' }), 'politique');
  assert.strictEqual(c.rubriqueRapport({ cat: 'politique', cy: 'CI', title: 'Reunion de l ONU sur le Mali', analysis: '' }), 'geopolitique');
});

test('la ligne pays passe au-dessus du titre dans le PDF et dans l apercu', () => {
  const pdf = tranche('    articleItem(a) {', '    // Grille 2 colonnes');
  assert.ok(pdf.indexOf('lignePaysArticle(a)') !== -1 && pdf.indexOf('lignePaysArticle(a)') < pdf.indexOf('a.title') , 'pays avant titre (PDF)');
  const ap = tranche('function _apArticleItem(a) {', 'function _apCorrelationCard(s) {');
  assert.ok(ap.indexOf('lignePaysArticle(a)') !== -1 && ap.indexOf('lignePaysArticle(a)') < ap.indexOf('a.title'), 'pays avant titre (apercu)');
});

test('un texte qui n a pas pu etre traduit est dit dans une note, pas tu', () => {
  // Depuis le 21/10/2026 il n'est plus montre dans sa langue d'origine :
  // il est signale comme non traduit (voir une-langue.test.js).
  const c = monte('en', { AR_RANGE: /[\u0600-\u06FF]/, detectLangue: () => 'fr', TR_CACHE: {}, _trTexteAffichable: (t) => t, _traduireParLots: async (l) => { l.forEach((x) => { c.TR_CACHE['en:' + x] = x; }); } });
  vm.runInContext(tranche('// ── Une seule langue a l\'ecran', '// retraduireActu(id)'), c);
  vm.runInContext(tranche('async function preTraduireRapport(textes) {', 'async function traduireAvantPartage'), c);
  vm.runInContext(tranche('function L(texte) {', '// ── PAYS = CLÉ'), c);
  return c.preTraduireRapport(['Attaque armee contre un convoi a Gao']).then(() => {
    assert.match(c.noteTraductionRapport(), /could not be translated/);
    assert.strictEqual(c.L('Attaque armee contre un convoi a Gao'), 'French text — translation unavailable right now');
  });
});
