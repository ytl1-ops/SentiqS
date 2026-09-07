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

// ── Pont entre langues ────────────────────────────────────────────────────
// Mesure du 06/09/2026 sur le cache publie : l'accident de bus de Fogo
// (Cap-Vert, 25 morts) y figurait CINQ fois — anglais, francais, anglais,
// francais, francais — dont trois au niveau eleve, et aucune paire n'etait
// reconnue : les titres ne partageaient aucun mot. Le pont rapproche deux
// titres qui portent le meme nombre ET un mot de la meme famille
// d'evenement, en trois langues. Un article sans nombre n'est jamais
// rapproche.

test('le meme bilan en trois langues est un doublon', () => {
  const fr = art('a', 'Cap-Vert : au moins 25 personnes tuées dans un accident de bus', 's1');
  const en = art('b', 'At least 25 killed in bus crash on Cape Verde’s Fogo island', 's2');
  const pt = art('c', 'Acidente de autocarro em Fogo faz 25 mortos e 18 feridos', 's3');
  assert.strictEqual(articlesSontDoublons(fr, en), true, 'francais ~ anglais');
  assert.strictEqual(articlesSontDoublons(en, pt), true, 'anglais ~ portugais');
  assert.strictEqual(articlesSontDoublons(fr, pt), true, 'francais ~ portugais');
  const restants = dedupliquerArticles([fr, en, pt]);
  assert.strictEqual(restants.length, 1, 'un seul article doit rester');
  assert.strictEqual(restants[0].verified, true, 'deux sources independantes : recoupe');
});

test('le nombre seul ne suffit pas', () => {
  // « 25 » est partout. Sans famille d'evenement commune, rien n'est
  // rapproche : une ecole inauguree et un accident ne sont pas un fait.
  const a = art('a', 'Le gouvernement inaugure 25 nouvelles écoles dans la région', 's1');
  const b = art('b', 'At least 25 killed in bus crash on Fogo island', 's2');
  assert.strictEqual(articlesSontDoublons(a, b), false);
});

test('la famille seule ne suffit pas', () => {
  // Deux accidents differents le meme jour : sans bilan commun, on ne fusionne
  // pas. Le prix d'un doublon garde est moindre que celui d'un fait efface.
  const a = art('a', 'Accident mortel de bus sur la route de Praia', 's1');
  const b = art('b', 'Bus crash kills passengers on the Fogo road', 's2');
  assert.strictEqual(articlesSontDoublons(a, b), false);
});

test('une annee n\'est pas un bilan', () => {
  // « 2021 » rapprocherait n'importe quel anniversaire de n'importe quel autre.
  const a = art('a', 'Cinq ans après le coup d’État de 2021, un appel au recueillement', 's1');
  const b = art('b', 'Coup attempt foiled, 2021 conspirators jailed', 's2');
  assert.strictEqual(articlesSontDoublons(a, b), false);
  assert.deepStrictEqual([...noyau.nombresDuTitre('Coup d’État de 2021 : 3 morts')], [3]);
});

test('un article sans nombre n\'est jamais rapproche par le pont', () => {
  // Les funerailles des victimes sont un autre article que l'accident.
  const a = art('a', 'Cap-Vert : au moins 25 personnes tuées dans un accident de bus', 's1');
  const b = art('b', 'Cap-Vert : funérailles de certaines victimes de l’accident d’un bus', 's2');
  assert.strictEqual(articlesSontDoublons(a, b), false);
});

test('un repli deja trace ne se note pas une seconde fois', () => {
  // Le cache partage est refusionne a chaque cycle avec les articles frais,
  // qui portent les memes identifiants. Mesure du 07/09/2026 sur le cache
  // publie : 372 traces pour 46 articles distincts, 28 fois le meme titre.
  const a = art('a', 'Attaque meurtrière contre un convoi militaire près de Tombouctou', 's1', 90);
  const b = art('b', 'Convoi militaire attaqué près de Tombouctou : attaque meurtrière', 's2', 70);
  const premier = dedupliquerArticles([a, b]);
  assert.strictEqual(premier.length, 1);
  assert.strictEqual(premier[0]._fusionnes.length, 1, 'une trace apres le premier repli');
  // Second cycle : le meme article b revient du flux, avec le meme id.
  const bBis = { ...b };
  const second = dedupliquerArticles([premier[0], bBis]);
  assert.strictEqual(second.length, 1);
  assert.strictEqual(second[0]._fusionnes.length, 1, 'toujours une seule trace, pas deux');
  assert.strictEqual(second[0]._fusionnes[0].id, 'b');
});
