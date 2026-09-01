// Teste classify(), extrait du fichier de production : la fonction qui décide
// si une actualité est un incident de sûreté, et à quel niveau.
//
// C'est le cœur de la pertinence du produit et elle n'avait aucun test. Ses
// garde-fous ont chacun été ajoutés après un faux positif observé — un article
// sportif remonté comme incident critique, « tue » reconnu dans « statue » —
// et rien n'empêchait leur retour.
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac, exposer } = require('./_bac.js');

// classify() vit encore dans le script inline ; le noyau dont elle depend
// (normaliserAccents, matchMot) est pose par le socle.
const contexte = exposer(
  bac(tranche('const CK_CRIT', '//  FIABILITÉ & ANTI-HALLUCINATION')),
  'classify'
);
const { classify } = contexte;

const src = (cy, cat) => ({ cy: cy || 'SN', cat: cat || 'securite' });

test('un vrai incident de sûreté est classé critique', () => {
  assert.strictEqual(classify('Attentat revendique dans la capitale', src('SN')).lvl, 'crit');
  assert.strictEqual(classify('Embuscade contre un convoi militaire', src('ML')).lvl, 'crit');
});

test('le sport ne devient jamais un incident, même avec un vocabulaire de sûreté', () => {
  // Cas réel ayant motivé le garde-fou : « assaut » dans un titre sportif
  // faisait remonter l'article en CRITIQUE.
  const a = classify("Les Étalons Dames à l'assaut de leur propre histoire", src('BF'));
  assert.strictEqual(a.lvl, 'ok', 'un titre sportif ne peut pas être un incident');
  assert.strictEqual(a.cat, 'sport');
});

test('la culture non plus', () => {
  // Faux positif reel trouve en ecrivant ce test : « frappe » est dans
  // CK_CRIT, et aucun mot-cle culturel du titre ne compensait — une critique
  // de cinema remontait donc en CRITIQUE.
  const a = classify('Le realisateur frappe fort avec son nouveau film', src('SN'));
  assert.strictEqual(a.cat, 'culture');
  assert.strictEqual(a.lvl, 'ok');
});

test('elargir le lexique culturel ne fait perdre aucun vrai signal', () => {
  // Garde-fou sur la correction ci-dessus. « frappe fort » n'a deliberement
  // PAS ete neutralise comme locution figee, et « film » seul n'a pas ete
  // ajoute au lexique culturel : ces deux raccourcis auraient fait taire de
  // vrais incidents. Ce test echoue si quelqu'un les reprend.
  const militaire = classify('L armee malienne frappe fort contre les groupes armes', src('ML'));
  assert.strictEqual(militaire.lvl, 'crit', "« frappe fort » reste un signal quand le contexte est militaire");
  assert.strictEqual(militaire.cat, 'securite');

  const idiome = classify('Attaque signalee : retour sur le film des evenements', src('ML'));
  assert.strictEqual(idiome.lvl, 'crit', "« le film des evenements » ne doit pas faire passer un incident pour de la culture");
});

test('la correspondance porte sur le mot entier, jamais sur une sous-chaîne', () => {
  // « tue » dans « statue », « arme » dans « larme », « mort » dans
  // « amortissement » : trois confusions graves pour un outil de sûreté.
  for (const titre of [
    'Inauguration de la statue du fondateur',
    "Une larme au coin de l'oeil lors de la ceremonie",
    "Revision du plan d'amortissement comptable",
  ]) {
    assert.notStrictEqual(classify(titre, src('SN')).lvl, 'crit',
      'sous-chaîne prise pour un mot : ' + titre);
  }
});

test('les locutions figées du français courant sont neutralisées', () => {
  for (const titre of [
    'Un coup de coeur du jury pour ce jeune entrepreneur',
    "Transfert du siege social vers la nouvelle zone d'activite",
  ]) {
    assert.notStrictEqual(classify(titre, src('SN')).lvl, 'crit',
      'locution figée prise pour un signal de sûreté : ' + titre);
  }
});

test("une actualité anodine dans un pays à risque n'est pas critique pour autant", () => {
  // Sans ce garde-fou, un accord commercial au Mali remontait « ELEVE » au
  // seul motif que le Mali est un pays à risque. Une actualité dans un pays
  // critique n'est pas elle-même critique.
  const a = classify('Signature d un accord commercial bilateral', src('ML'));
  assert.notStrictEqual(a.lvl, 'crit');
  assert.notStrictEqual(a.lvl, 'high');
});

test('le plancher pays ne joue que si un lien avec la sûreté existe déjà', () => {
  // Un contenu réellement sécuritaire mais sans mot critique remonte à 'high'
  // dans un pays du socle élevé, et pas dans un pays hors socle.
  const dansPaysRisque = classify('Renforcement du dispositif de securite', src('ML'));
  const dansPaysCalme  = classify('Renforcement du dispositif de securite', src('CV'));
  assert.strictEqual(dansPaysRisque.lvl, 'high');
  assert.strictEqual(dansPaysCalme.lvl, 'mod');
});

test('les accents ne changent pas le classement', () => {
  const avec  = classify('Manifestation réprimée à Conakry', src('GN'));
  const sans  = classify('Manifestation reprimee a Conakry', src('GN'));
  assert.strictEqual(avec.lvl, sans.lvl);
  assert.strictEqual(avec.cat, sans.cat);
});

test('la catégorie suit le vocabulaire dominant, pas celle de la source', () => {
  const a = classify('Epidemie de cholera : appel a l aide humanitaire urgente', src('SN', 'securite'));
  assert.strictEqual(a.cat, 'humanitaire',
    'un contenu humanitaire ne doit pas rester catégorisé « sécurité » par héritage de la source');
});

test('classify renvoie toujours un niveau et une catégorie exploitables', () => {
  const niveaux = ['crit', 'high', 'mod', 'ok'];
  for (const titre of ['', 'a', 'Reunion ordinaire du conseil municipal', '12345']) {
    const r = classify(titre, src('SN'));
    assert.ok(niveaux.includes(r.lvl), 'niveau inattendu pour « ' + titre + " » : " + r.lvl);
    assert.ok(typeof r.cat === 'string' && r.cat.length > 0);
  }
});

// ── Vocabulaire de CRISE contre vocabulaire de DOMAINE ────────────────────
// Mesuré le 1er septembre 2026 sur les 512 articles du cache : seuls 12
// portaient un mot humanitaire, d'où 2,1 % de la répartition. Le classement
// n'était pas en cause — quand un mot humanitaire est présent, il l'emporte
// dans 83 % des cas. C'est le lexique qui était trop étroit.
//
// Mais CK_HUM alimente lienSecuriteFaible, qui fait sortir un article du
// niveau « ok ». L'élargir naïvement faisait passer « Paludisme : le Mali à la
// tête d'une révolution thérapeutique » en ÉLEVÉ — une bonne nouvelle affichée
// comme une alerte.
test('le vocabulaire humanitaire de domaine ne relève aucun niveau', () => {
  const bonnesNouvelles = [
    'Paludisme : le Mali à la tête d\'une révolution thérapeutique africaine',
    'FCTA begins 2-week mass rabies vaccination across Abuja',
    'À Bria, MSF facilite l\'accès aux soins pédiatriques',
  ];
  for (const t of bonnesNouvelles) {
    assert.strictEqual(classify(t, src('ML')).lvl, 'ok',
      '« ' + t.slice(0, 40) + '… » ne doit pas être une alerte');
  }
});

test('le vocabulaire humanitaire de crise continue, lui, de compter', () => {
  // famine, choléra, réfugiés : eux justifient de sortir du niveau « ok ».
  for (const t of ['Famine declaree dans la region', 'Epidemie de cholera : 40 cas confirmes']) {
    assert.notStrictEqual(classify(t, src('ML')).lvl, 'ok',
      'une crise humanitaire réelle doit rester un signal');
  }
});

test('le domaine humanitaire décide bien de la catégorie', () => {
  assert.strictEqual(classify('Paludisme : campagne de vaccination lancee', src('ML')).cat, 'humanitaire');
  assert.strictEqual(classify('MSF ouvre un centre de soins', src('CF')).cat, 'humanitaire');
});

test('le lexique économique élargi ne touche pas les niveaux', () => {
  // CK_ECO n'entre pas dans lienSecuriteFaible — l'élargir est sans effet
  // sur l'alerte, et ce test l'ancre.
  assert.strictEqual(classify('Le FMI annonce un programme de 2,2 milliards de dollars', src('SN')).cat, 'economique');
  assert.strictEqual(classify('Le FMI annonce un programme de 2,2 milliards de dollars', src('SN')).lvl, 'ok');
});
