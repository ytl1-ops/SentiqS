// Teste _detecterPaysCoeur(), extrait du fichier de production : la fonction
// qui décide À QUEL PAYS rattacher une actualité collectée.
//
// Rattacher un article au mauvais pays fait remonter un incident étranger
// dans la fiche d'un pays — un faux positif que rien ne rattrape en aval, et
// que le drapeau « confiant » est justement là pour éviter. Cette heuristique
// est la plus exposée du moteur et n'avait aucun test.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML = fs.readFileSync(path.join(__dirname, '../../web/SentiqS_Web.html'), 'utf8');
const debut = HTML.indexOf('const PAYS_DETECT');
assert.ok(debut !== -1, 'PAYS_DETECT introuvable');
const fin = HTML.indexOf('function classify', debut);
assert.ok(fin !== -1, 'fin de bloc introuvable');

const bac = { console };
vm.createContext(bac);
vm.runInContext(
  HTML.slice(debut, fin) + '\nthis._detecterPaysCoeur = _detecterPaysCoeur;\nthis.detectPaysFromText = detectPaysFromText;',
  bac
);
const { _detecterPaysCoeur, detectPaysFromText } = bac;
const ou = (titre, contenu, srcCy) => _detecterPaysCoeur(titre, contenu || '', srcCy);

test('un pays nommé dans le titre l\'emporte sur le pays de la source', () => {
  // Les agrégateurs (AllAfrica, APA) relaient des articles de tout le
  // continent : le pays de la source ne dit rien du sujet.
  assert.deepStrictEqual(
    { ...ou('Attaque a Bamako signalee ce matin', '', 'GH') },
    { cy: 'ML', confiant: true }
  );
  assert.strictEqual(ou('Ouagadougou : marche ferme', '', 'SN').cy, 'BF');
});

test('une capitale citée suffit à identifier le pays', () => {
  assert.strictEqual(ou('Incident a Lagos', '', 'NG').cy, 'NG');
  assert.strictEqual(ou('Abidjan et Accra renforcent leur cooperation', '', 'SN').cy, 'CI');
});

test('le corps du texte est examiné quand le titre ne nomme aucun pays', () => {
  const r = ou('Nouvelles mesures annoncees', 'Le gouvernement de Niamey a annonce', 'SN');
  assert.strictEqual(r.cy, 'NE');
  assert.strictEqual(r.confiant, true);
});

test('un sujet hors périmètre est marqué international, pas rattaché à la source', () => {
  // Cas signalé : un article de football européen relayé par un média malien
  // n'est pas une actualité du Mali.
  assert.strictEqual(ou('Le selectionneur belge annonce sa liste', '', 'ML').cy, 'INT');
  assert.strictEqual(ou('Sommet a Paris entre dirigeants', '', 'ML').cy, 'INT');
});

test('un rattachement par défaut est signalé comme non confirmé', () => {
  // LE garde-fou de cette fonction. Cas signalé : « Loi 101 » (législation
  // québécoise) relayé sur la page Ghana d'un agrégateur — aucun pays africain
  // nommé, aucun signal hors périmètre non plus. Le pays de la source est
  // retenu faute d'alternative, mais confiant=false permet aux vues « par
  // pays » d'exclure ce faux rattachement.
  const r = ou('Loi 101 : le debat relance', '', 'GH');
  assert.strictEqual(r.cy, 'GH');
  assert.strictEqual(r.confiant, false,
    'un rattachement par simple absence d\'alternative ne doit jamais être marqué confiant');
});

test('une actualité générique reste non confirmée même sur sa propre source', () => {
  const r = ou('Reunion du conseil des ministres', '', 'BF');
  assert.strictEqual(r.cy, 'BF');
  assert.strictEqual(r.confiant, false);
});

test('un texte vide retombe sur la source sans jamais prétendre à la confiance', () => {
  for (const vide of ['', '   ']) {
    const r = ou(vide, '', 'SN');
    assert.strictEqual(r.cy, 'SN');
    assert.strictEqual(r.confiant, false);
  }
});

test('detectPaysFromText renvoie un code pays exploitable', () => {
  assert.strictEqual(detectPaysFromText('Manifestation a Conakry', '', 'SN'), 'GN');
  const r = detectPaysFromText('', '', 'SN');
  assert.ok(typeof r === 'string' && r.length >= 2, 'un code pays est toujours renvoyé');
});

test('la détection ne renvoie jamais une valeur inexploitable', () => {
  const entrees = [
    ['12345', '', 'SN'],
    ['???', '', 'ML'],
    ['a'.repeat(500), '', 'GH'],
  ];
  for (const [t, c, src] of entrees) {
    const r = ou(t, c, src);
    assert.ok(typeof r.cy === 'string' && r.cy.length >= 2, 'code pays attendu pour : ' + t.slice(0, 20));
    assert.strictEqual(typeof r.confiant, 'boolean');
  }
});
