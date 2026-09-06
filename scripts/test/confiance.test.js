// Teste le filtre anti-hallucination et le score de confiance, extraits du
// fichier de production.
//
// Ce sont les deux mecanismes sur lesquels le produit fonde sa promesse
// centrale — « aucune actu de plus de 12 h presentee comme actualite du
// jour », « article verifie » — et ni l'un ni l'autre n'avait de test.
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac, exposer, noyau } = require('./_bac.js');

const contexte = exposer(
  bac(tranche('function computeConfidence', 'function evalFiabilite')),
  'antiHalluFilter', 'computeConfidence'
);
const { antiHalluFilter, computeConfidence } = contexte;
const { motsSignificatifs } = noyau;

const H = 3600000;
const art = (o) => Object.assign({
  id: 'a1', primary: 'src1', title: 'Embuscade contre un convoi militaire pres de Gao',
  score: 80, pubDate: Date.now() - H, cy: 'ML', cat: 'securite', level: 'crit',
}, o);

// ── Filtre anti-hallucination ──────────────────────────────────────────────

test('un article sans horodatage est ecarte', () => {
  assert.strictEqual(antiHalluFilter([art({ pubDate: null })]).length, 0);
});

test('un article plus vieux que la fenetre d\'actualite est ecarte', () => {
  // Fenetre portee de 12 h a 24 h le 06/09/2026. Mesure sur les 110 sources
  // natives capables d'alerter, interrogees une par une : a 12 h, 27 avaient
  // publie et couvraient 18 pays sur 54 ; a 24 h, 47 sources et 34 pays.
  // Trente pays restaient vides en permanence, dont dix des treize qui n'ont
  // qu'une seule source d'alerte.
  assert.strictEqual(antiHalluFilter([art({ pubDate: Date.now() - 25 * H })]).length, 0);
  assert.strictEqual(antiHalluFilter([art({ pubDate: Date.now() - 23 * H })]).length, 1);
  // Le cas qui motivait le changement : un article de la veille au soir,
  // ecarte avant, retenu maintenant.
  assert.strictEqual(antiHalluFilter([art({ pubDate: Date.now() - 13 * H })]).length, 1);
});

test('la fenetre est definie une seule fois, et le score de fraicheur la suit', () => {
  // Laisser la decroissance du score a 12 h alors que le Flux en retient 24
  // donnerait zero point de fraicheur a la moitie des articles affiches.
  const { HTML } = require('./_bac.js');
  assert.match(HTML, /const FENETRE_ACTUALITE_MS = 24 \* 60 \* 60 \* 1000;/);
  assert.doesNotMatch(HTML, />= 12\*60\*60\*1000/, 'plus aucun seuil de 12 h en dur');
  assert.match(HTML, /const fenetreH = FENETRE_ACTUALITE_MS \/ 3600000;/);
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
