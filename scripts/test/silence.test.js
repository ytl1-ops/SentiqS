// « Silence n'est pas calme » — voir paysMuet/marqueSilence dans
// web/SentiqS_Web.html.
//
// Ce que ce lot protege. Mesure du run #800 : 39 sources seulement avaient
// publie depuis 12 h, couvrant 31 pays sur 54. Les 23 autres s'affichaient
// dans le cartogramme exactement comme un pays calme. Pour un professionnel
// de la surete, c'est l'ambiguite la plus couteuse de l'outil : l'absence de
// signal ressemble a l'absence de risque.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { tranche, bac, exposer } = require('./_bac.js');

function bacSilence(articles) {
  const ctx = bac(tranche('// ── SILENCE N\'EST PAS CALME', '// Rendu compact'));
  vm.runInContext('var ALL = ' + JSON.stringify(articles) + ';', ctx);
  return exposer(ctx, 'paysMuet', 'marqueSilence');
}

test('un pays sans aucun article frais est muet', () => {
  const ctx = bacSilence([{ cy: 'ML', title: 'x' }]);
  assert.strictEqual(ctx.paysMuet('TD'), true);
  assert.strictEqual(ctx.paysMuet('ML'), false);
});

test('un seul article suffit a ne plus etre muet', () => {
  // ALL ne contient QUE le temps reel de moins de 12 h (« Separation
  // stricte ») : la fenetre est deja appliquee en amont, on ne la refait pas.
  const ctx = bacSilence([{ cy: 'TD', title: 'un seul' }]);
  assert.strictEqual(ctx.paysMuet('TD'), false);
});

test('l international n est jamais marque muet', () => {
  // INT n'est pas un pays suivi : le marquer n'apprendrait rien.
  const ctx = bacSilence([]);
  assert.strictEqual(ctx.paysMuet('INT'), false);
});

test('sans flux du tout, on ne marque rien plutot que tout', () => {
  // Au demarrage, avant la premiere collecte, ALL est vide : marquer les 54
  // pays « muets » serait exact mais inutilisable, et ferait passer un etat
  // transitoire pour un constat.
  const ctx = bac(tranche('// ── SILENCE N\'EST PAS CALME', '// Rendu compact'));
  vm.runInContext('var ALL = undefined;', ctx);
  exposer(ctx, 'paysMuet');
  assert.strictEqual(ctx.paysMuet('TD'), false);
});

test('la marque dit ce qu elle signifie, et ce qu elle ne signifie pas', () => {
  const ctx = bacSilence([]);
  const html = ctx.marqueSilence('TD');
  assert.match(html, />muet</);
  assert.match(html, /depuis 12 h/);
  assert.match(html, /absence de signal ne veut pas dire absence de risque/,
    'la nuance est tout l\'interet de la marque');
  assert.match(html, /aria-label="[^"]+"/, 'lisible au lecteur d\'ecran');
});

test('un pays couvert ne porte aucune marque', () => {
  const ctx = bacSilence([{ cy: 'ML', title: 'x' }]);
  assert.strictEqual(ctx.marqueSilence('ML'), '');
});

test('la marque n est pas une alerte', () => {
  // Un pays muet n'est pas un pays dangereux. Utiliser la couleur d'alerte
  // ferait exactement le contresens qu'on cherche a eviter.
  const ctx = bacSilence([]);
  const html = ctx.marqueSilence('TD');
  assert.doesNotMatch(html, /var\(--a\)|--rouge|#b3261e/,
    'aucune couleur d\'alerte : muet n\'est pas grave, c\'est inconnu');
  assert.match(html, /dashed/, 'le tirete dit « incomplet », pas « danger »');
});

test('la marque est cablee dans la tuile du cartogramme', () => {
  const { HTML } = require('./_bac.js');
  assert.match(HTML, /\$\{Math\.round\(s\.score\)\}\$\{chipTendance\(s\.cy\)\}\$\{marqueSilence\(s\.cy\)\}/);
});
