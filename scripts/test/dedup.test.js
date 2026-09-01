// Teste la logique de dedoublonnage REELLE, extraite du fichier de production
// web/SentiqS_Web.html — pas une copie. Si la fonction change la-bas, ce test
// suit automatiquement. Lancer : node --test scripts/test/
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac, exposer, noyau } = require('./_bac.js');

// motsSignificatifs et articlesSontDoublons sont desormais dans le noyau
// (web/js/noyau.js) : on les prend au module, comme la page les prend au
// <script src>. Seule dedupliquerArticles vit encore inline.
const { motsSignificatifs, articlesSontDoublons } = noyau;
const { dedupliquerArticles } = exposer(
  bac(tranche('function dedupliquerArticles', '\nfunction attachConfidenceScores')),
  'dedupliquerArticles'
);

const art = (id, title, primary, score = 80) =>
  ({ id, title, primary, score, cy: 'ML', srcs: [primary], crosses: [primary], url: 'https://x/' + id });

test('les mots vides ne sont pas des mots significatifs', () => {
  const m = motsSignificatifs('Le gouvernement renforce la sécurité des personnes déplacées à Mopti');
  assert.ok(!m.includes('gouvernement'), 'gouvernement doit être écarté');
  assert.ok(!m.includes('securite'), 'securite doit être écarté');
  assert.ok(m.includes('deplacees'), 'deplacees doit être conservé');
});

test("deux faits distincts ne sont plus fusionnés (régression du bug à 3 mots)", () => {
  const a = art('a', 'Le gouvernement renforce la sécurité des personnes déplacées à Mopti', 's1');
  const b = art('b', 'Sécurité routière : le gouvernement forme les personnes handicapées à Bamako', 's2');
  assert.strictEqual(articlesSontDoublons(a, b), false);
  assert.strictEqual(dedupliquerArticles([a, b]).length, 2, 'aucun article ne doit disparaître');
});

test("l'appariement se fait sur le mot entier, pas la sous-chaîne", () => {
  assert.ok(!motsSignificatifs('La zone régionale').includes('region'),
    '"region" ne doit pas correspondre à "régionale"');
});

test('un vrai doublon reste fusionné et garde une trace', () => {
  const a = art('a', 'Attaque meurtrière contre un convoi militaire près de Tombouctou', 's1', 90);
  const b = art('b', 'Attaque meurtrière visant un convoi militaire près de Tombouctou', 's2', 70);
  assert.strictEqual(articlesSontDoublons(a, b), true);
  const out = dedupliquerArticles([a, b]);
  assert.strictEqual(out.length, 1, 'les vrais doublons doivent être repliés');
  assert.strictEqual(out[0].id, 'a', 'la source la mieux notée est conservée');
  assert.strictEqual(out[0].verified, true);
  assert.strictEqual(out[0]._fusionnes.length, 1, 'la fusion doit laisser une trace');
  assert.strictEqual(out[0]._fusionnes[0].id, 'b');
});

test('une même source ne se corrobore jamais elle-même', () => {
  const a = art('a', 'Attaque meurtrière contre un convoi militaire près de Tombouctou', 's1');
  const b = art('b', 'Attaque meurtrière visant un convoi militaire près de Tombouctou', 's1');
  assert.strictEqual(dedupliquerArticles([a, b]).length, 2);
});
