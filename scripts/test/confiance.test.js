// Teste le filtre anti-hallucination et le score de confiance, extraits du
// fichier de production.
//
// Ce sont les deux mecanismes sur lesquels le produit fonde sa promesse
// centrale — « aucune actu de plus de 12 h presentee comme actualite du
// jour », « article verifie » — et ni l'un ni l'autre n'avait de test.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML = fs.readFileSync(path.join(__dirname, '../../web/SentiqS_Web.html'), 'utf8');
const debut = HTML.indexOf('function computeConfidence');
assert.ok(debut !== -1, 'computeConfidence introuvable');
const fin = HTML.indexOf('function evalFiabilite', debut);
assert.ok(fin !== -1, 'fin de bloc introuvable');

const bac = { console, Date };
vm.createContext(bac);
// estimeEvenementAncien (appele par antiHalluFilter) s'appuie sur matchMot,
// declare bien plus haut dans le fichier : on l'extrait aussi plutot que d'en
// recopier une version approchee, pour que le test suive le vrai comportement.
const iMasque = HTML.indexOf('const TERMES_AMBIGUS_MASQUES');
assert.ok(iMasque !== -1, 'TERMES_AMBIGUS_MASQUES introuvable');
vm.runInContext(HTML.slice(iMasque, HTML.indexOf('\n// HORS_PERIMETRE_KW', iMasque)), bac);
vm.runInContext(
  HTML.slice(debut, fin)
  + '\nthis.antiHalluFilter = antiHalluFilter;'
  + '\nthis.computeConfidence = computeConfidence;'
  + '\nthis.motsSignificatifs = motsSignificatifs;',
  bac
);
const { antiHalluFilter, computeConfidence, motsSignificatifs } = bac;

const H = 3600000;
const art = (o) => Object.assign({
  id: 'a1', primary: 'src1', title: 'Embuscade contre un convoi militaire pres de Gao',
  score: 80, pubDate: Date.now() - H, cy: 'ML', cat: 'securite', level: 'crit',
}, o);

// ── Filtre anti-hallucination ──────────────────────────────────────────────

test('un article sans horodatage est ecarte', () => {
  assert.strictEqual(antiHalluFilter([art({ pubDate: null })]).length, 0);
});

test('un article de plus de 12 h est ecarte', () => {
  assert.strictEqual(antiHalluFilter([art({ pubDate: Date.now() - 13 * H })]).length, 0);
  assert.strictEqual(antiHalluFilter([art({ pubDate: Date.now() - 11 * H })]).length, 1);
});

test('un article sans source identifiee est ecarte', () => {
  assert.strictEqual(antiHalluFilter([art({ primary: null })]).length, 0);
});

test('un titre vide ou trop court est ecarte', () => {
  assert.strictEqual(antiHalluFilter([art({ title: '' })]).length, 0);
  assert.strictEqual(antiHalluFilter([art({ title: 'Bref' })]).length, 0);
});

test('la fenetre de fraicheur est parametrable sans jamais s\'annuler', () => {
  const recent = art({ pubDate: Date.now() - 2 * H });
  assert.strictEqual(antiHalluFilter([recent], 1 * H).length, 0, 'fenetre resserree : ecarte');
  assert.strictEqual(antiHalluFilter([recent], 6 * H).length, 1, 'fenetre elargie : conserve');
});

// ── Score de confiance ─────────────────────────────────────────────────────

test('une source mieux notee donne un meilleur score, toutes choses egales', () => {
  const bonne = computeConfidence(art({ score: 90 }), []);
  const faible = computeConfidence(art({ score: 40 }), []);
  assert.ok(bonne.srcScore > faible.srcScore);
  assert.ok(bonne.srcScore <= 40, 'la fiabilite de source plafonne a 40 points');
});

test('la fraicheur decroit et ne devient jamais negative', () => {
  const frais = computeConfidence(art({ pubDate: Date.now() }), []);
  const vieux = computeConfidence(art({ pubDate: Date.now() - 11 * H }), []);
  const perime = computeConfidence(art({ pubDate: Date.now() - 30 * H }), []);
  assert.ok(frais.fraicheurScore > vieux.fraicheurScore);
  assert.strictEqual(perime.fraicheurScore, 0);
  assert.ok(frais.fraicheurScore <= 30, 'la fraicheur plafonne a 30 points');
});

test('une coincidence de vocabulaire ne corrobore rien', () => {
  // Defaut reel : la corroboration appariait par SOUS-CHAINE sur tout mot de
  // plus de 4 lettres, mots vides compris. Trois articles sans aucun rapport
  // partageant « gouvernement », « plusieurs » et « contre » donnaient 30/30
  // et le statut « verifie » — l'article etait presente comme recoupe sur une
  // coincidence de vocabulaire.
  const a = art({ title: 'Le gouvernement annonce plusieurs mesures contre la penurie' });
  const bruit = [
    { ...a, id: 'b', primary: 's2', title: 'Le gouvernement gouverne plusieurs regions contre toute attente' },
    { ...a, id: 'c', primary: 's3', title: 'Plusieurs manifestations contre le gouvernement a Bamako' },
    { ...a, id: 'd', primary: 's4', title: 'Contre plusieurs avis le gouvernement maintient sa position' },
  ];
  const r = computeConfidence(a, [a, ...bruit]);
  assert.strictEqual(r.corroScore, 0, 'des mots courants partages ne sont pas une corroboration');
  assert.notStrictEqual(r.statut, 'verifie');
});

test('une vraie corroboration compte toujours', () => {
  // Garde-fou symetrique : le correctif ci-dessus ne doit pas rendre la
  // corroboration inatteignable.
  const a = art({ title: 'Embuscade meurtriere contre un convoi militaire pres de Gao' });
  const echos = [
    { ...a, id: 'b', primary: 's2', title: 'Un convoi militaire vise par une embuscade meurtriere a Gao' },
    { ...a, id: 'c', primary: 's3', title: 'Gao : embuscade contre un convoi militaire, plusieurs victimes' },
    { ...a, id: 'd', primary: 's4', title: 'Embuscade militaire signalee pres de Gao contre un convoi' },
  ];
  const r = computeConfidence(a, [a, ...echos]);
  assert.strictEqual(r.corroScore, 30);
  assert.strictEqual(r.statut, 'verifie');
});

test('une source ne se corrobore jamais elle-meme', () => {
  const a = art({ title: 'Embuscade meurtriere contre un convoi militaire pres de Gao' });
  const memeSource = [
    { ...a, id: 'b', title: 'Embuscade meurtriere contre un convoi militaire pres de Gao (suite)' },
    { ...a, id: 'c', title: 'Embuscade meurtriere contre un convoi militaire pres de Gao (rappel)' },
  ];
  assert.strictEqual(computeConfidence(a, [a, ...memeSource]).corroScore, 0);
});

test('le score total ne depasse jamais 100', () => {
  const a = art({ score: 100, pubDate: Date.now(), title: 'Embuscade meurtriere contre un convoi militaire pres de Gao' });
  const echos = [1, 2, 3, 4, 5].map((k) => ({
    ...a, id: 'e' + k, primary: 's' + k,
    title: 'Embuscade meurtriere contre un convoi militaire pres de Gao',
  }));
  const r = computeConfidence(a, [a, ...echos]);
  assert.ok(r.total <= 100, 'total observe : ' + r.total);
});

test('motsSignificatifs ecarte les mots vides et les mots courts', () => {
  const mots = motsSignificatifs('Le gouvernement annonce plusieurs mesures contre la penurie');
  for (const vide of ['gouvernement', 'plusieurs', 'contre', 'le', 'la']) {
    assert.ok(!mots.includes(vide), '« ' + vide + ' » ne doit pas etre significatif');
  }
  assert.ok(mots.includes('penurie'), 'un mot porteur de sens doit etre conserve');
});
