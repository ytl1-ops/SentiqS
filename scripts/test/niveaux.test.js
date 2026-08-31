// Teste les garde-fous de niveau d'alerte, extraits du fichier de production.
// Ces seuils sont la promesse centrale du produit : un signal RSS ne doit
// jamais pouvoir porter seul un pays au rouge.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML = fs.readFileSync(path.join(__dirname, '../../web/SentiqS_Web.html'), 'utf8');

function extraire(debut, fin) {
  const i = HTML.indexOf(debut);
  assert.ok(i !== -1, 'marqueur introuvable : ' + debut);
  const j = HTML.indexOf(fin, i);
  assert.ok(j !== -1, 'fin introuvable : ' + fin);
  return HTML.slice(i, j);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(extraire('function getNivKey(total)', '\n// MESURES'), sandbox);
const { getNivKey } = sandbox;

// Les plafonds sont declares en clair : on les lit plutot que de les recopier,
// pour que le test suive toute modification du fichier de production.
const lireNombre = (nom) => {
  const m = HTML.match(new RegExp(nom + '\\s*=\\s*(\\d+)'));
  assert.ok(m, nom + ' introuvable dans le fichier de production');
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

test("le flux RSS seul ne peut pas atteindre le niveau orange", () => {
  // Garde-fou central : maxLiveBonus plafonne TOUT l'apport du direct.
  const maxLiveBonus = lireNombre('maxLiveBonus');
  const niveauAtteignable = getNivKey(maxLiveBonus);
  assert.ok(
    ['vert', 'jaune'].includes(niveauAtteignable),
    `le RSS seul atteint ${niveauAtteignable} (plafond ${maxLiveBonus}) — il ne doit pas dépasser jaune`
  );
});

test("un article live pèse au plus 1 point, quel que soit son niveau", () => {
  const m = HTML.match(/WEIGHT_PAR_LEVEL_LIVE\s*=\s*\{([^}]*)\}/);
  assert.ok(m, 'WEIGHT_PAR_LEVEL_LIVE introuvable');
  const poids = [...m[1].matchAll(/(\d+)/g)].map((x) => Number(x[1]));
  assert.ok(Math.max(...poids) <= 1, 'un article live ne doit jamais peser plus de 1 point');
});
