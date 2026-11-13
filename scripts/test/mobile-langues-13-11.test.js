// Captures de YORO sur téléphone, 13/11/2026 : menu « Partager » sorti de
// l'écran, titres français affichés tels quels en anglais, « dernière
// synchronisation il y a 291 h » avec des chiffres vieux de douze jours, et
// des noms de source en arabe. Consigne : « aucune langue autre que FR ou
// ENG ne doit être affichée dans l'appli ».
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const path = require('node:path');
const { HTML, tranche, bac } = require('./_bac.js');

test('le menu Partager se place d\'après sa largeur mesurée, jamais hors de l\'écran', () => {
  const c = bac(tranche('function placerMenuPartage', '\nfunction toggleShareMenu('));
  c.window = { innerWidth: 360, innerHeight: 740 };
  vm.runInContext('var window = this.window;', c);
  // Bouton « Partager » d'une carte du Flux, à droite ; menu large (texte agrandi, trois identités).
  const menu = { style: {}, offsetWidth: 300, offsetHeight: 330 };
  c.placerMenuPartage(menu, { getBoundingClientRect: () => ({ left: 290, top: 400, bottom: 430 }) });
  const gauche = parseFloat(menu.style.left);
  assert.ok(gauche >= 8 && gauche + 300 <= 352, 'menu de ' + gauche + ' à ' + (gauche + 300) + ' px sur un écran de 360');
  assert.strictEqual(menu.style.maxWidth, '344px');
});

test('plus aucune position de menu calculée sur une largeur fixe de 210 px', () => {
  assert.doesNotMatch(HTML, /const mw = 210/);
  assert.ok((HTML.match(/placerMenuPartage\(menu, btn\)/g) || []).length >= 4);
});

test('en anglais, un titre français traduit en partie par la table n\'est pas affiché', () => {
  const c = bac();
  const SL = require(path.join(__dirname, '../../web/js/langue.js'));
  require(path.join(__dirname, '../../web/js/dico-en.js'));
  Object.assign(c, { LANG: 'en', SentiqLangue: SL, _trTexteAffichable: (t) => t });
  vm.runInContext(tranche('const AR_RANGE', '// _trTexteAffichable(texte)'), c);
  vm.runInContext(tranche('const SOC_STOPWORDS', '// ── Sentiment'), c);
  vm.runInContext(tranche('// ── Une seule langue a l\'ecran', '// Traduction echouee pour de bon'), c);
  // La page déclare les noms de pays à la première bascule (PAYS_EN).
  SL.ajouter({ "Côte d'Ivoire": "Côte d'Ivoire" });
  const titre = "Côte d'Ivoire : sécurité alimentaire et sécurisation foncière, le gouvernement soutient les femmes productrices";
  assert.notStrictEqual(SL.traduire(titre), titre, 'la table touche bien au nom du pays (sinon le test ne prouve rien)');
  assert.strictEqual(c.traductionTable(titre), null);
  // Un libellé entièrement couvert par la table reste traduit.
  assert.strictEqual(c.traductionTable('Pays couverts'), 'Countries covered');
});

test('la connexion ne présente pas des chiffres périmés comme actuels', () => {
  const f = tranche('function renderAuthStats', '\nfunction construireBulletinPublicHTML');
  assert.match(f, /FENETRE_ACTUALITE_MS/);
  assert.match(f, /auth_sync_day/);
  assert.match(HTML, /auth_sync_day:'il y a \{n\} jours'/);
  assert.match(HTML, /auth_sync_day:'\{n\} days ago'/);
});

test('aucun nom de source du registre n\'est écrit en arabe', () => {
  const noms = [...HTML.matchAll(/\{id:'[^']+',n:'([^']*)'/g)].map((m) => m[1]);
  assert.ok(noms.length > 400);
  assert.deepStrictEqual(noms.filter((n) => /[؀-ۿ]/.test(n)), []);
});
