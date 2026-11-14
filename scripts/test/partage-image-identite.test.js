// Partage d'une actu en image et choix de l'identite d'envoi — demande de
// YORO du 14/11/2026 : « regarde les rendus des actus a partager en images,
// toujours choix d'identite d'envoi ».
//
// Ce que la mesure a trouve (images generees par la vraie page) :
// - la tete de l'image portait la marque, l'identite choisie n'etait qu'une
//   mention en petit en pied, et le logo de l'organisation n'y figurait pas ;
// - en anglais, le niveau restait en francais (« MODÉRÉ »), le pays sans
//   accent (« Cote d'Ivoire »), et une actu pas encore traduite sortait avec
//   « Translating… » en guise de titre, fige dans l'image ;
// - « Signer en tant que » n'apparaissait qu'a partir de deux identites.
const test = require('node:test');
const assert = require('node:assert');
const { bac, exposer, tranche, HTML: html } = require('./_bac.js');

const corpsDe = (debut, fin) => { const i = html.indexOf(debut); assert.ok(i >= 0, debut); const j = html.indexOf(fin, i + debut.length); assert.ok(j > i, fin); return html.slice(i, j); };

test('le niveau partage suit la langue de l interface', () => {
  for (const [lang, attendu] of [['fr', 'MODÉRÉ'], ['en', 'MODERATE']]) {
    const ctx = exposer(bac('var LANG = ' + JSON.stringify(lang) + ';', tranche('function libelleNiveauPartage', 'function paysPartage')), 'libelleNiveauPartage');
    assert.strictEqual(ctx.libelleNiveauPartage('mod'), attendu);
    assert.strictEqual(ctx.libelleNiveauPartage('crit'), lang === 'en' ? 'CRITICAL' : 'CRITIQUE');
  }
});

test('une actu non traduite ne sort jamais avec « traduction en cours » dans l image', () => {
  const mocks = `
    var LANG = 'en'; var TR_CACHE = {};
    function texteEtranger(t) { return /[éè]/.test(t); }
    function texteNonTraduit(t, enCours) { return enCours ? 'Translating…' : 'French text — translation unavailable right now'; }
    function L(t) { return TR_CACHE['en:' + t] || 'Translating…'; }
  `;
  const ctx = exposer(bac(mocks, tranche('function _texteImage', 'function _chargerLogoImage')), '_texteImage');
  assert.strictEqual(ctx._texteImage('Grève des transporteurs'), 'French text — translation unavailable right now');
  // Un texte deja dans la langue (ou traduit) passe par L().
  assert.strictEqual(ctx._texteImage('Already English'), 'Translating…');
});

test('l image est signee en tete par l emetteur, avec le logo de l organisation', () => {
  const corps = corpsDe('async function genererImageActuBlob', 'function _telechargerImage');
  assert.match(corps, /identiteEnvoiActuelle\(\)/);
  assert.match(corps, /logoMarqueActuelle\(\)/);
  assert.match(corps, /drawImage\(logoIm/);
  assert.match(corps, /_traduireAvantImage\(/);
  assert.match(corps, /const titre = _texteImage\(a\.title\)/);
  // L'emetteur est dessine AVANT le badge de niveau, donc en tete.
  assert.ok(corps.indexOf('fillText(txtEmetteur') > 0 && corps.indexOf('fillText(txtEmetteur') < corps.indexOf('fillText(badgeTxt'));
  assert.doesNotMatch(corps, /fillText\(nomMarqueActuelle\(\)\.toUpperCase\(\)/);
  assert.doesNotMatch(corps, /'CRITIQUE', high: 'ÉLEVÉ'/);
});

test('« Signer en tant que » est toujours propose au partage d une actu', () => {
  const corps = corpsDe('function toggleShareMenu(ev, id)', 'function _nomIdentiteBouton');
  assert.doesNotMatch(corps, /dispo\.length >= 2/);
  assert.match(corps, /identite1 \|\| nomMarqueActuelle\(\)/);
  const i = corps.indexOf("let identiteRow = '';");
  assert.ok(i > 0);
  assert.doesNotMatch(corps.slice(i, i + 80), /fonctionnalitePayante/);
});

test('une identite seule se lit en entier sur son bouton', () => {
  const ctx = exposer(bac('', tranche('function _nomIdentiteBouton', 'function _choisirIdentitePartage')), '_nomIdentiteBouton');
  assert.strictEqual(ctx._nomIdentiteBouton('Direction de la Sûreté', 1), 'Direction de la Sûreté');
  assert.strictEqual(ctx._nomIdentiteBouton('Direction de la Sûreté', 3), 'Direction de …');
});
