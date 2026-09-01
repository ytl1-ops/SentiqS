// Teste les garde-fous de niveau d'alerte, extraits du fichier de production.
// Ces seuils sont la promesse centrale du produit : un signal RSS ne doit
// jamais pouvoir porter seul un pays au rouge.
const test = require('node:test');
const assert = require('node:assert');
const { HTML, noyau, tranche } = require('./_bac.js');

const { getNivKey } = noyau;

// Les plafonds sont lus la ou ils vivent — dans le noyau pour ceux qui en
// font partie, dans le fichier de production pour ceux qui y sont restes —
// plutot que recopies, pour que le test suive toute modification.
const lireNombre = (nom) => {
  if (typeof noyau[nom] === 'number') return noyau[nom];
  const m = HTML.match(new RegExp(nom + '\\s*=\\s*(\\d+)'));
  assert.ok(m, nom + ' introuvable, ni dans le noyau ni dans le fichier de production');
  return Number(m[1]);
};

test('les seuils de niveau sont strictement croissants', () => {
  assert.strictEqual(getNivKey(0), 'vert');
  assert.strictEqual(getNivKey(2), 'jaune');
  assert.strictEqual(getNivKey(5), 'orange');
  assert.strictEqual(getNivKey(8), 'marron');
  assert.strictEqual(getNivKey(14), 'rouge');
});

test('juste sous chaque seuil, le niveau reste le précédent', () => {
  assert.strictEqual(getNivKey(1.9), 'vert');
  assert.strictEqual(getNivKey(4.9), 'jaune');
  assert.strictEqual(getNivKey(7.9), 'orange');
  assert.strictEqual(getNivKey(13.9), 'marron');
});

test("le flux RSS seul ne peut jamais porter un pays au ROUGE", () => {
  // Le contrat a change, volontairement. Il etait : « le RSS seul ne depasse
  // pas JAUNE » — un plafond fixe de 2 points pour un seuil rouge de 14. Sa
  // consequence mesuree : 27 pays sur 53 ne pouvaient plus changer de niveau,
  // et un pays sans incident pre-saisi restait JAUNE en pleine crise.
  //
  // Le contrat est desormais : le socle verifie est un PLANCHER, la collecte
  // monte librement au-dessus, MAIS le passage au ROUGE reste conditionne a
  // une verification humaine. C'est cet invariant-la qu'il faut proteger.
  const plafondMax = lireNombre('MAX_LIVE_EVENTS_PAR_PAYS');
  const historiqueMax = 0.5;
  const atteignable = getNivKey(plafondMax + historiqueMax);
  assert.notStrictEqual(
    atteignable, 'rouge',
    `le RSS seul atteint ${atteignable} (plafond ${plafondMax}) — il ne doit jamais atteindre rouge`
  );
});

test("le socle verifie sert de plancher, jamais de plafond", () => {
  // calcAlertScore doit ADDITIONNER le live au socle sans le brider par une
  // mesure de fraicheur. Le defaut corrige : plus un pays etait recemment
  // saisi, moins il pouvait bouger.
  const src = tranche('const totalSansLive =', 'const total =');
  assert.doesNotMatch(src, /plafondLive|Math\.min\(baseScoreLive/,
    'le live est de nouveau bride par la fraicheur de la saisie');
  assert.match(src, /liveBonusLimite\s*=\s*baseScoreLive/,
    'le live doit entrer entier : son seul bridage est le nombre d\'articles retenus');
});

test("aucun pays ne peut afficher ROUGE si son socle verifie est sous MARRON", () => {
  // L'invariant du produit, exprime sur le code de production lui-meme plutot
  // que sur des nombres : il survit a un changement de seuil ou de plafond.
  const src = tranche('const keyPlancher =', 'const niv   =');
  assert.match(src, /borneRougeVerifie\(\s*keyBrut\s*,\s*keyPlancher\s*\)/,
    'le niveau affiche doit passer par la porte rouge');
});

test("un article live pèse au plus 1 point, quel que soit son niveau", () => {
  const m = HTML.match(/WEIGHT_PAR_LEVEL_LIVE\s*=\s*\{([^}]*)\}/);
  assert.ok(m, 'WEIGHT_PAR_LEVEL_LIVE introuvable');
  const poids = [...m[1].matchAll(/(\d+)/g)].map((x) => Number(x[1]));
  assert.ok(Math.max(...poids) <= 1, 'un article live ne doit jamais peser plus de 1 point');
});
