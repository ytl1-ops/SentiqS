// « Ce que nous ne savons pas » : le bloc qui protège l'usager d'un faux calme.
//
// Audit du 20/10/2026 : 26 pays n'avaient qu'une source capable d'alerter,
// deux n'avaient aucune actualité de moins de 12 h, et le socle vérifié de la
// plupart avait plus de 90 jours. Tout cela était mesuré (paysMuet,
// verifier-redondance-sources.js, indiceConfiance) mais rien ne le disait dans
// la Synthèse ni dans les rapports envoyés aux clients : un pays sur lequel on
// ne sait rien s'y lisait comme un pays calme.
//
// angleMort (noyau) range un périmètre en quatre familles. Il ne note ni ne
// classe aucun pays : il dit seulement où l'outil est aveugle.
const test = require('node:test');
const assert = require('node:assert');
const N = require('../../web/js/noyau.js');
const { tranche, HTML } = require('./_bac.js');

const p = (cy, o) => Object.assign({ cy, nom: cy, muet: false, aveugle: false, sourcesAlerte: 3, ageSocleJ: 10 }, o);

test('un pays muet est rangé dans « muets », pas dans « hors alerte »', () => {
  const am = N.angleMort([p('ER', { muet: true, aveugle: true })]);
  assert.deepStrictEqual(am.muets.map(x => x.cy), ['ER']);
  assert.deepStrictEqual(am.horsAlerte, []);
});

test('du flux sans source fiable : « hors alerte »', () => {
  const am = N.angleMort([p('GW', { aveugle: true })]);
  assert.deepStrictEqual(am.horsAlerte.map(x => x.cy), ['GW']);
});

test('une seule source capable d\'alerter, ou aucune : « source unique »', () => {
  const am = N.angleMort([p('BJ', { sourcesAlerte: 1 }), p('LS', { sourcesAlerte: 0 }), p('CI', { sourcesAlerte: 4 })]);
  assert.deepStrictEqual(am.sourceUnique.map(x => x.cy), ['BJ', 'LS']);
});

test('socle de plus de 90 jours, ou absent : « socle ancien »', () => {
  const am = N.angleMort([p('LY', { ageSocleJ: 160 }), p('SC', { ageSocleJ: null }), p('CI', { ageSocleJ: 90 })]);
  assert.deepStrictEqual(am.socleAncien.map(x => x.cy), ['LY', 'SC']);
});

test('un pays bien couvert n\'apparaît nulle part, et vide se dit vide', () => {
  const am = N.angleMort([p('CI')]);
  assert.strictEqual(am.total, 0);
  assert.strictEqual(am.vide, true);
});

test('le socle ancien suit le seuil de la confiance, il n\'est pas recopié', () => {
  const am = N.angleMort([p('X', { ageSocleJ: N.CONFIANCE_SOCLE_ANCIEN_J }), p('Y', { ageSocleJ: N.CONFIANCE_SOCLE_ANCIEN_J + 1 })]);
  assert.deepStrictEqual(am.socleAncien.map(x => x.cy), ['Y']);
});

test('la règle « capable d\'alerter » vit dans le noyau, la bibliothèque des scripts la réexporte', () => {
  const lib = require('../lib/capacite-alerte');
  assert.strictEqual(lib.peutAlerter, N.peutAlerter);
  assert.strictEqual(lib.estRequeteGoogleNews, N.estRequeteGoogleNews);
  assert.strictEqual(N.peutAlerter({ score: 90, rss: 'https://news.google.com/rss/search?q=x' }, 70), false);
  assert.strictEqual(N.peutAlerter({ score: 72, rss: 'https://koaci.com/feed/' }, 70), true);
  assert.strictEqual(N.peutAlerter({ score: 68, rss: 'https://koaci.com/feed/' }, 70), false);
});

test('le bloc est affiché dans la Synthèse et dans les rapports d\'alertes', () => {
  const synthese = tranche('async function updSynthese() {', '\n// ── AGENDA');
  assert.match(synthese, /blocAngleMortHTML\(/);
  assert.ok((HTML.match(/texteAngleMort\(/g) || []).length >= 4, 'définition + PDF + Word + aperçu');
});
