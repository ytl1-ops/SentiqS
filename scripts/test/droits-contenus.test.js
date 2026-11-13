// Droits sur les contenus des sources dans les documents exportes — 13/11/2026.
//
// Un rapport exporte (Word, PDF, PowerPoint) est un document qu'on vend et
// qu'on transmet. Le droit de courte citation couvre un titre, un lien et un
// court extrait attribue ; il ne couvre ni la photo d'un journal ni un long
// passage recopie. D'ou :
//   - les images des sources ne sont embarquees dans un document QUE si
//     l'utilisateur l'a choisi (Parametres > Affichage), jamais par defaut ;
//   - l'extrait est court et dit qu'il est un extrait, et de qui.
// L'ecran, lui, n'embarque rien : il affiche l'image depuis l'adresse de la
// source, avec son credit. Ce reglage ne touche donc pas l'ecran.
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac, exposer } = require('./_bac');

function bacReglages(stock = {}) {
  const ctx = bac(tranche("const REGLAGES_AFFICHAGE = {", 'function majReglagesAffichage() {'));
  exposer(ctx, 'REGLAGES_AFFICHAGE');
  const classes = new Set();
  ctx.localStorage = { getItem: (k) => (k in stock ? stock[k] : null), setItem: (k, v) => { stock[k] = v; } };
  ctx.document = { documentElement: { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) } } };
  return ctx;
}

test('les images des sources ne vont pas dans un document par defaut', () => {
  const ctx = bacReglages();
  assert.ok(ctx.REGLAGES_AFFICHAGE.documents, 'reglage « documents » absent');
  assert.strictEqual(ctx.REGLAGES_AFFICHAGE.documents.defaut, 'non');
  assert.strictEqual(ctx.imagesDocumentsActives(), false);
});

test('choisir « oui » les autorise, « economiser les donnees » les coupe quand meme', () => {
  assert.strictEqual(bacReglages({ sentinel_aff_documents: 'oui' }).imagesDocumentsActives(), true);
  const ctx = bacReglages({ sentinel_aff_documents: 'oui', sentinel_aff_images: 'non' });
  ctx.appliquerReglageAffichage('images', 'non');
  assert.strictEqual(ctx.imagesDocumentsActives(), false);
});

test('chargerImagesRapport ne demande rien sans le choix explicite', () => {
  const src = tranche('async function chargerImagesRapport(arts, max) {', 'function parseRSS(xml, src) {');
  assert.match(src, /imagesDocumentsActives\(\)/);
});

test('le reglage est dans Parametres > Affichage, en francais et en anglais', () => {
  const page = require('fs').readFileSync(require('path').join(__dirname, '../../web/SentiqS_Web.html'), 'utf8');
  assert.match(page, /data-aff-documents="oui"/);
  assert.match(page, /data-aff-documents="non"/);
  assert.strictEqual((page.match(/aff_documents:'/g) || []).length, 2);
});

test('l extrait d un rapport est court et attribue', () => {
  const src = tranche('const RESUME_RAPPORT_MAX = ', ';');
  assert.ok(Number(src.replace(/\D/g, '')) <= 400, 'extrait trop long : ' + src);
  const det = tranche('function detailRapportActu(a) {', '// Images des sources dans les rapports');
  assert.match(det, /extrait cité|quoted excerpt/);
});
