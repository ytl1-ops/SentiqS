// Ce que l'ecran annonce sur la fraicheur doit etre ce que le code applique.
//
// Audit d'interface du 07/09/2026, page reelle rendue dans Chromium : le
// compteur du Flux affichait « 0 article (<12h) », la tuile « Pays couverts »
// portait « Dernieres 12h », l'etat vide disait « Aucune actualite de moins de
// 12h », et les rapports exportes en PDF, Word et PowerPoint titraient
// « EVENEMENTS DES DERNIERES 12 HEURES ». La fenetre est de 36 heures depuis
// le 06/09/2026.
//
// La tuile « Actus /Xh » avait ete corrigee a l'epoque et son test existe
// (langue.test.js) ; les trente-deux autres etiquettes ne l'avaient pas ete.
// Sur un outil de surete, un incident d'il y a trente-six heures peut avoir
// ete resolu : l'utilisateur a le droit de le savoir, et le client qui recoit
// le rapport aussi.
//
// La regle imposee ici : aucune duree d'actualite ecrite en dur dans un texte
// destine a l'ecran ou a l'export. Elles se lisent toutes dans
// FENETRE_ACTUALITE_MS, par libelleFenetre()/libelleFenetreCourt().
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche, bac, exposer } = require('./_bac');

const FENETRE_H = (() => {
  const m = /const FENETRE_ACTUALITE_MS = (\d+) \* 60 \* 60 \* 1000;/.exec(HTML);
  assert.ok(m, 'la page doit declarer FENETRE_ACTUALITE_MS en heures');
  return Number(m[1]);
})();

test('les libelles de fenetre sont derives de la constante, jamais recopies', () => {
  const ctx = exposer(bac(
    tranche('const FENETRE_ACTUALITE_MS =', 'function estimeEvenementAncien'),
  ), 'FENETRE_ACTUALITE_MS');
  assert.strictEqual(ctx.libelleFenetre(), FENETRE_H + ' h');
  assert.strictEqual(ctx.libelleFenetreCourt(), FENETRE_H + 'h');
});

// Les seules durees de 12 h qui restent legitimes, et pourquoi. Toute autre
// occurrence dans un texte d'ecran decrit la fenetre d'actualite et ment.
const EXCEPTIONS = [
  // getLiveAlertEvents : fenetre PROPRE aux signaux d'alerte, volontairement
  // plus courte que celle du Flux.
  /const MAX_AGE = 12\*60\*60\*1000;/,
  // Badge « -12H » : met en avant les articles publies depuis moins de douze
  // heures A L'INTERIEUR de la fenetre. Il dit vrai.
  /Date\.now\(\)-a\.pubDate\)<12\*3600000\)/,
  /-12H<\/span>/,
  /−12H<\/span>/,
  // Descriptif commercial de l'offre gratuite : une promesse de produit, pas
  // une etiquette de fraicheur. Elle appartient au proprietaire.
  /Flux 12h, 1 pays suivi/,
];

test('aucune etiquette de fraicheur ne recopie une duree en dur', () => {
  const lignes = HTML.split('\n');
  const motif = /(?<![\w])12\s?h(?![a-z0-9])|12 dernieres heures|12 dernières heures|12 heures|12 Hours|douze heures|less than 12|older than 12/i;
  const fautes = [];
  lignes.forEach((ligne, i) => {
    const nu = ligne.trim();
    if (nu.startsWith('//') || nu.startsWith('*') || nu.startsWith('/*')) return;
    if (!motif.test(ligne)) return;
    if (EXCEPTIONS.some((e) => e.test(ligne))) return;
    fautes.push('L' + (i + 1) + ' : ' + nu.slice(0, 120));
  });
  assert.deepStrictEqual(fautes, [],
    'ces lignes annoncent 12 h a l\'ecran alors que la fenetre en vaut ' + FENETRE_H + ' :\n' + fautes.join('\n'));
});

test('les textes traduisibles portent le marqueur, pas le nombre', () => {
  // Le dictionnaire i18n est applique par textContent : une duree ecrite
  // dedans echapperait a tout calcul. Le marqueur {h} est substitue au rendu.
  const dico = tranche('const I18N =', '\n};');
  const durees = [...dico.matchAll(/\d+\s?h(?:eures|ours)?\b/gi)]
    .map((m) => m[0])
    // 72 h : validite du compte d'essai gratuit. Une condition commerciale,
    // pas une etiquette de fraicheur — elle appartient au proprietaire.
    .filter((d) => !/^72\s?h/i.test(d));
  assert.deepStrictEqual(durees, [],
    'le dictionnaire i18n ne doit contenir aucune duree en dur : ' + durees.join(', '));
  assert.match(HTML, /\{hc?\}/, 'les textes de fenetre doivent porter le marqueur {h} ou {hc}');
});
