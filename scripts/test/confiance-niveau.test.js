// La confiance d'un niveau d'alerte, affichée à côté de lui.
//
// Audit du 20/10/2026, sur l'archive web/historique : aucun des 172
// incidents vérifiés n'avait moins de 112 jours, l'âge médian du socle des
// 22 pays marron ou rouge était de 115 jours, et la collecte du jour
// n'apportait que 4,6 % des points. Le socle est un plancher qui ne décroît
// pas (voir borneRougeVerifie dans le noyau) : un rouge de juin s'affichait
// en octobre exactement comme un rouge de la veille, sur le cartogramme et
// dans les rapports envoyés aux clients.
//
// Arbitrage du 20/10/2026 : le niveau ne baisse jamais, mais la confiance
// qu'on peut lui accorder s'affiche partout à côté de lui. Seuils 45 jours
// (durée de poids plein du noyau) et 90 jours.
const test = require('node:test');
const assert = require('node:assert');
const N = require('../../web/js/noyau.js');
const { tranche, HTML } = require('./_bac.js');

const JOUR = 86400000;
const MAINTENANT = Date.UTC(2026, 9, 20, 12);
const ilYa = (j) => MAINTENANT - j * JOUR;
const conf = (o) => N.indiceConfiance(Object.assign({ maintenant: MAINTENANT }, o));

test('socle récent appuyé par un signal du jour : confiance élevée', () => {
  assert.strictEqual(conf({ dernierVerifieMs: ilYa(10), signauxDuJour: 2 }).cle, 'elevee');
  assert.strictEqual(conf({ dernierVerifieMs: ilYa(45), signauxDuJour: 1 }).cle, 'elevee');
});

test('socle de plus de 45 jours, ou aucun signal du jour : confiance moyenne', () => {
  assert.strictEqual(conf({ dernierVerifieMs: ilYa(46), signauxDuJour: 3 }).cle, 'moyenne');
  assert.strictEqual(conf({ dernierVerifieMs: ilYa(10), signauxDuJour: 0 }).cle, 'moyenne');
  // Plus de 90 jours mais appuyé par la collecte : la collecte témoigne.
  assert.strictEqual(conf({ dernierVerifieMs: ilYa(115), signauxDuJour: 1 }).cle, 'moyenne');
});

test('socle de plus de 90 jours sans signal du jour : confiance faible', () => {
  // Le cas de la Libye au 20/10/2026 : rouge, socle de 112 jours, rien du jour.
  const c = conf({ dernierVerifieMs: ilYa(112), signauxDuJour: 0 });
  assert.strictEqual(c.cle, 'faible');
  assert.match(c.motif, /112 jours/);
  assert.strictEqual(c.ageSocleJ, 112);
});

test('un pays muet ne monte jamais au-dessus de moyenne', () => {
  assert.strictEqual(conf({ dernierVerifieMs: ilYa(5), signauxDuJour: 2, muet: true }).cle, 'moyenne');
});

test('sans aucun incident vérifié daté, on ne sait rien : faible sans signal, moyenne avec', () => {
  // Une absence de date ne doit jamais passer pour une date récente : ce serait
  // faire disparaître de l'alerte les pays les moins bien documentés.
  assert.strictEqual(conf({ dernierVerifieMs: null, signauxDuJour: 0 }).cle, 'faible');
  assert.strictEqual(conf({ dernierVerifieMs: null, signauxDuJour: 2 }).cle, 'moyenne');
  assert.strictEqual(conf({ dernierVerifieMs: null, signauxDuJour: 0 }).ageSocleJ, null);
});

test('chaque indice porte un libellé à afficher et un motif lisible', () => {
  for (const o of [{ dernierVerifieMs: ilYa(5), signauxDuJour: 1 }, { dernierVerifieMs: ilYa(60), signauxDuJour: 0 }, { dernierVerifieMs: ilYa(200), signauxDuJour: 0 }]) {
    const c = conf(o);
    assert.ok(['élevée', 'moyenne', 'faible'].includes(c.libelle), c.libelle);
    assert.ok(c.motif && c.motif.length > 10, c.motif);
  }
});

test('les seuils suivent la durée de poids plein du noyau, ils ne sont pas recopiés', () => {
  assert.strictEqual(N.CONFIANCE_SOCLE_RECENT_J, N.DECROISSANCE_PLEIN_J);
  assert.strictEqual(N.CONFIANCE_SOCLE_ANCIEN_J, 90);
});

test("l'indice ne touche jamais au niveau : calcAlertScore l'expose à côté de la clé", () => {
  const corps = tranche('function calcAlertScore(cy) {', '\nfunction mkDot(');
  assert.match(corps, /indiceConfiance\(/);
  assert.match(corps, /confiance[,\s]/);
  // La clé du niveau est calculée avant et sans l'indice.
  const avantCle = corps.slice(0, corps.indexOf('const key   ='));
  assert.doesNotMatch(avantCle, /indiceConfiance/);
});

test('la confiance est affichée sur la tuile du cartogramme et sur la fiche d\'alerte', () => {
  const page = HTML;
  const appels = page.match(/marqueConfiance\(/g) || [];
  assert.ok(appels.length >= 3, 'définition + tuile + fiche : ' + appels.length);
  const fiche = tranche('async function renderAlertCard(score) {', '\n}\n');
  assert.match(fiche, /marqueConfiance\(/);
});
