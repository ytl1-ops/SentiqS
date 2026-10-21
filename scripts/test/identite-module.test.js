// Identite d'envoi PAR MODULE de rapport — voir identiteEnvoiActuelle(module),
// identitesModulesMarquePerso() et definirIdentiteModule() dans
// web/SentiqS_Web.html.
//
// Besoin (15/10/2026) : jusque-la, SentiqS n'avait qu'une identite « active »
// globale (Parametres > Personnalisation de marque) et un choix ponctuel
// « Signer en tant que » dans le menu de partage. Impossible de dire « la
// Synthese part toujours sous Cellule de Veille, l'Agenda sous Direction de la
// Surete » : il fallait re-choisir a chaque envoi. Chaque module de rapport
// (Rapport complet, Flux, Synthese, Agenda, Sources, Alertes pays) designe
// desormais sa propre identite parmi les 3 de Parametres.
//
// Ordre de resolution quand un module est fourni : choix explicite pour CET
// envoi (seulement pendant un partage Rapports) -> identite designee pour le
// module -> identite active globale.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { bac, exposer, tranche } = require('./_bac.js');

// Magasin en memoire a la place de localStorage : definirIdentiteModule ecrit
// via saveMarquePerso, et on veut relire ce qui a REELLEMENT ete enregistre.
function construireBac({ payant = true, marque = {} } = {}) {
  const mocks = `
    let _magasin = ${JSON.stringify(marque)};
    let _ecritures = 0;
    function fonctionnalitePayante() { return ${JSON.stringify(payant)}; }
    function getMarquePerso() { return JSON.parse(JSON.stringify(_magasin)); }
    function saveMarquePerso(m) { _magasin = JSON.parse(JSON.stringify(m)); _ecritures++; }
    function _lireMagasin() { return _magasin; }
    function _nbEcritures() { return _ecritures; }
  `;
  const ctx = bac(mocks, tranche('function identitesMarquePerso', 'AGENT DE PARTAGE'));
  return exposer(ctx, 'MODULES_IDENTITE_ENVOI', 'identitesMarquePerso', 'identitesModulesMarquePerso',
    'identiteParDefautModule', 'definirIdentiteModule', 'identiteEnvoiActuelle', 'signatureEnvoiActuelle',
    '_lireMagasin', '_nbEcritures');
}

const TROIS = { identite1: 'Alpha', identite2: 'Beta', identite3: 'Gamma', identiteActive: 1 };

/** Simule le choix « Signer en tant que » d'un partage lance depuis le module Rapports. */
function partageRapportEnCours(ctx, idx) {
  vm.runInContext('_partageIdentiteChoisie = ' + JSON.stringify(idx) + '; _rapportPartageEnCours = true;', ctx);
}
/** Simule un choix resté en memoire d'un partage ANTERIEUR (actu, fiche pays...). */
function choixResteEnMemoire(ctx, idx) {
  vm.runInContext('_partageIdentiteChoisie = ' + JSON.stringify(idx) + '; _rapportPartageEnCours = false;', ctx);
}

test('les six modules de rapport peuvent designer une identite', () => {
  const ctx = construireBac({ marque: TROIS });
  assert.deepStrictEqual(Array.from(ctx.MODULES_IDENTITE_ENVOI),
    ['rapport_complet', 'flux', 'synthese', 'agenda', 'sources', 'alertes']);
});

test('un module signe de SON identite designee, pas de l identite active', () => {
  const ctx = construireBac({ marque: { ...TROIS, identitesModules: { synthese: 3 } } });
  assert.strictEqual(ctx.identiteEnvoiActuelle('synthese'), 'Gamma');
});

test('un module sans designation retombe sur l identite active', () => {
  const ctx = construireBac({ marque: { ...TROIS, identiteActive: 2, identitesModules: { synthese: 3 } } });
  assert.strictEqual(ctx.identiteEnvoiActuelle('flux'), 'Beta');
});

test('chaque module garde sa propre identite — pas d effet de l un sur l autre', () => {
  const ctx = construireBac({ marque: { ...TROIS, identitesModules: { flux: 2, agenda: 3, synthese: 1 } } });
  assert.strictEqual(ctx.identiteEnvoiActuelle('flux'), 'Beta');
  assert.strictEqual(ctx.identiteEnvoiActuelle('agenda'), 'Gamma');
  assert.strictEqual(ctx.identiteEnvoiActuelle('synthese'), 'Alpha');
  assert.strictEqual(ctx.identiteEnvoiActuelle('alertes'), 'Alpha', 'alertes : non designe -> active');
});

test('sans module, la resolution historique est inchangee (actu, fiche pays...)', () => {
  const ctx = construireBac({ marque: { ...TROIS, identiteActive: 2, identitesModules: { flux: 3 } } });
  assert.strictEqual(ctx.identiteEnvoiActuelle(), 'Beta', 'la designation d un module ne touche pas un partage hors module');
});

test('une designation vers une identite videe retombe sur l active (jamais une signature vide)', () => {
  const ctx = construireBac({ marque: { identite1: 'Alpha', identite2: '', identite3: 'Gamma', identiteActive: 1, identitesModules: { flux: 2 } } });
  assert.strictEqual(ctx.identiteEnvoiActuelle('flux'), 'Alpha');
  assert.strictEqual(ctx.identitesModulesMarquePerso({ identite1: 'Alpha', identitesModules: { flux: 2 } }).flux, 0);
});

test('identitesModulesMarquePerso ignore les valeurs invalides', () => {
  const ctx = construireBac({ marque: TROIS });
  const r = ctx.identitesModulesMarquePerso({ ...TROIS, identitesModules: { flux: 7, agenda: 'x', synthese: 2, inconnu: 1 } });
  assert.strictEqual(r.flux, 0);
  assert.strictEqual(r.agenda, 0);
  assert.strictEqual(r.synthese, 2);
  assert.strictEqual(r.inconnu, undefined, 'un module hors liste n est pas conserve');
  // Champ absent ou de mauvais type : tout a zero, sans exception.
  assert.strictEqual(ctx.identitesModulesMarquePerso({ ...TROIS }).flux, 0);
  assert.strictEqual(ctx.identitesModulesMarquePerso({ ...TROIS, identitesModules: 'abc' }).flux, 0);
  assert.strictEqual(ctx.identitesModulesMarquePerso(null).flux, 0);
});

test('le choix explicite d un partage Rapports prime sur la designation du module', () => {
  const ctx = construireBac({ marque: { ...TROIS, identitesModules: { synthese: 3 } } });
  partageRapportEnCours(ctx, 2);
  assert.strictEqual(ctx.identiteEnvoiActuelle('synthese'), 'Beta');
});

test('un choix reste en memoire d un AUTRE partage ne signe jamais un export de module', () => {
  // C'est la fuite que la remise a zero evite : partager une actu en signant
  // « Beta », puis exporter le Flux depuis sa barre d'export — le document ne
  // doit pas porter « Beta » alors que le Flux designe « Gamma ».
  const ctx = construireBac({ marque: { ...TROIS, identitesModules: { flux: 3 } } });
  choixResteEnMemoire(ctx, 2);
  assert.strictEqual(ctx.identiteEnvoiActuelle('flux'), 'Gamma');
  // Et sans designation, c'est l'active — pas le choix perime.
  assert.strictEqual(ctx.identiteEnvoiActuelle('agenda'), 'Alpha');
  // Hors module (partage d'actu), ce choix reste, lui, bien applique.
  assert.strictEqual(ctx.identiteEnvoiActuelle(), 'Beta');
});

test('un choix explicite vers une identite non renseignee retombe sur la designation du module', () => {
  const ctx = construireBac({ marque: { identite1: 'Alpha', identite2: '', identite3: 'Gamma', identiteActive: 1, identitesModules: { flux: 3 } } });
  partageRapportEnCours(ctx, 2);
  assert.strictEqual(ctx.identiteEnvoiActuelle('flux'), 'Gamma');
});

test('sur un plan gratuit, aucune identite n est jamais signee, meme designee', () => {
  const ctx = construireBac({ payant: false, marque: { ...TROIS, identitesModules: { synthese: 3 } } });
  assert.strictEqual(ctx.identiteEnvoiActuelle('synthese'), '');
  assert.strictEqual(ctx.signatureEnvoiActuelle('synthese'), '');
});

test('la signature texte d un module reprend l identite designee, au meme format', () => {
  const ctx = construireBac({ marque: { ...TROIS, identitesModules: { agenda: 2 } } });
  assert.strictEqual(ctx.signatureEnvoiActuelle('agenda'), '\n\n— Beta');
  assert.strictEqual(ctx.signatureEnvoiActuelle(), '\n\n— Alpha');
});

test('identiteParDefautModule : la designation, a defaut l identite active', () => {
  const ctx = construireBac({ marque: { ...TROIS, identiteActive: 2, identitesModules: { flux: 3 } } });
  assert.strictEqual(ctx.identiteParDefautModule('flux'), 3);
  assert.strictEqual(ctx.identiteParDefautModule('agenda'), 2);
});

test('definirIdentiteModule n enregistre que ce module et laisse le reste intact', () => {
  const ctx = construireBac({ marque: { ...TROIS, nomMarque: 'Ma Societe', identiteActive: 2, identitesModules: { flux: 3 } } });
  assert.strictEqual(ctx.definirIdentiteModule('agenda', 2), true);
  const m = JSON.parse(JSON.stringify(ctx._lireMagasin()));
  assert.strictEqual(m.identitesModules.agenda, 2);
  assert.strictEqual(m.identitesModules.flux, 3, 'la designation d un autre module est conservee');
  assert.strictEqual(m.nomMarque, 'Ma Societe');
  assert.strictEqual(m.identite1, 'Alpha');
  assert.strictEqual(m.identiteActive, 2);
});

test('definirIdentiteModule(module, 0) revient a l identite active', () => {
  const ctx = construireBac({ marque: { ...TROIS, identitesModules: { flux: 3 } } });
  ctx.definirIdentiteModule('flux', 0);
  assert.strictEqual(ctx.identiteEnvoiActuelle('flux'), 'Alpha');
  assert.strictEqual(ctx.identitesModulesMarquePerso(ctx._lireMagasin()).flux, 0);
});

test('definirIdentiteModule refuse un module inconnu et le plan gratuit, sans rien ecrire', () => {
  const ctx = construireBac({ marque: TROIS });
  assert.strictEqual(ctx.definirIdentiteModule('nimporte_quoi', 2), false);
  assert.strictEqual(ctx._nbEcritures(), 0);
  const gratuit = construireBac({ payant: false, marque: TROIS });
  assert.strictEqual(gratuit.definirIdentiteModule('flux', 2), false);
  assert.strictEqual(gratuit._nbEcritures(), 0);
});

test('la designation enregistree est bien relue ensuite par la resolution', () => {
  const ctx = construireBac({ marque: TROIS });
  ctx.definirIdentiteModule('synthese', 3);
  assert.strictEqual(ctx.identiteEnvoiActuelle('synthese'), 'Gamma');
  assert.strictEqual(ctx.identiteEnvoiActuelle('flux'), 'Alpha');
});

// ── Garde-fous sur le fichier de production ─────────────────────────────────
// Chaque generateur de document doit resoudre l'identite POUR SON MODULE. Ces
// tests lisent le texte du fichier (les bibliotheques Word/PDF/PowerPoint ne
// se chargent pas dans ce bac) : ils attrapent l'oubli, pas le rendu — le rendu
// a ete verifie dans un navigateur (voir CLAUDE.md).
const { HTML } = require('./_bac.js');

function genere(debut, fin) {
  // Texte entre deux marqueurs, jamais vide (sinon le test passerait en n'examinant rien).
  const t = tranche(debut, fin);
  assert.ok(t.length > 200, 'tranche suspectement courte pour ' + debut);
  return t;
}

const GENERATEURS = [
  ['image de rapport', 'async function genererImageRapportBlob', 'function toggleShareMenuRapport', 'identiteEnvoiActuelle(type)'],
  ['PowerPoint', 'async function exportPPTX(type)', 'function _pdfBuilder', 'identiteEnvoiActuelle(type)'],
  ['PDF', 'async function exportPDF(type)', 'function _apPageWrap', 'identiteEnvoiActuelle(type)'],
  ['aperçu HTML', 'function _apPageWrap(', 'function _buildRapportSyntheseHTML', 'emetteurRapport(type)'],
  ['aperçu Synthèse', 'function _buildRapportSyntheseHTML', 'async function apercuSynthese', "emetteurRapport('synthese')"],
  ['Word', 'async function exportWord(type)', '</script>', 'emetteurRapport(type)'],
  ['Excel', 'async function exportExcel(type)', 'async function exportCSV', 'identiteEnvoiActuelle(type)'],
];
for (const [nom, debut, fin, attendu] of GENERATEURS) {
  test('le generateur ' + nom + ' signe de l identite de SON module', () => {
    const t = genere(debut, fin);
    assert.ok(t.includes(attendu), nom + ' doit appeler ' + attendu);
    assert.ok(!/identiteEnvoiActuelle\(\)/.test(t),
      nom + ' appelle encore identiteEnvoiActuelle() sans module : la designation par module serait ignoree');
  });
}

test('chaque export passe son module a dlFile (le message de partage du document en depend)', () => {
  const appels = HTML.match(/\bdlFile\([^\n]*\);/g) || [];
  const sansDefinition = appels.filter(l => !l.startsWith('dlFile(blob, name'));
  assert.strictEqual(sansDefinition.length, 5, 'Word, PDF, PowerPoint, Excel, CSV : ' + sansDefinition.join(' | '));
  for (const l of sansDefinition) {
    assert.ok(/,\s*(type|'flux')\);$/.test(l), 'dlFile sans module : ' + l);
  }
});

test('le menu de partage Rapports pre-selectionne l identite du module', () => {
  const t = genere('function toggleShareMenuRapport', 'async function envoyerRapportCanal');
  assert.ok(t.includes('identiteParDefautModule(type'), 'la ligne « Signer en tant que » doit partir de l identite du module');
  assert.ok(!/idx===active/.test(t), 'l ancienne pre-selection (identite active globale) ne doit plus exister');
});

test('envoyerRapportCanal remet a zero le choix d envoi, y compris en cas d echec', () => {
  const t = genere('async function envoyerRapportCanal(', 'async function _envoyerRapportCanalInterne');
  assert.ok(/try\s*\{/.test(t) && /finally\s*\{/.test(t), 'try/finally attendu');
  const finalement = t.slice(t.indexOf('finally'));
  assert.ok(/_rapportPartageEnCours = false/.test(finalement));
  assert.ok(/_partageIdentiteChoisie = null/.test(finalement));
});

test('chaque module de rapport a sa liste d identite dans le module Rapports', () => {
  for (const module of ['rapport_complet', 'flux', 'synthese', 'agenda', 'sources', 'alertes']) {
    assert.ok(HTML.includes('data-id-module="' + module + '"'), 'liste manquante pour ' + module);
  }
});
