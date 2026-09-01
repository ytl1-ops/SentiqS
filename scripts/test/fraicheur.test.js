// Teste la datation des incidents vérifiés et le plafond adaptatif du signal
// temps réel, extraits du fichier de production.
//
// Ce que ces tests protègent : avant ce correctif, 27 des 53 pays ne pouvaient
// plus changer de niveau d'alerte, quoi que la collecte remonte. Une
// régression sur ces fonctions ramènerait ce gel silencieusement.
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche, bac, exposer, noyau } = require('./_bac.js');

const { dateEvenementMs, facteurFraicheur, poidsVerifie, getNivKey,
        borneRougeVerifie, MAX_LIVE_EVENTS_PAR_PAYS } = noyau;
// Les incidents verifies restent une donnee du fichier de production.
const { ALERTE_EVENTS } = exposer(
  bac(tranche('const ALERTE_EVENTS = [', '\n];') + '\n];'),
  'ALERTE_EVENTS'
);

const J = 86400000;

test('les quatre formats de date du fichier de production sont analysés', () => {
  assert.strictEqual(dateEvenementMs('29/06/2026 07h00').precision, 'jour');
  assert.strictEqual(dateEvenementMs('26/06/2026').precision, 'jour');
  assert.strictEqual(dateEvenementMs('2026-06-29').precision, 'jour');
  assert.strictEqual(dateEvenementMs('Juin 2026').precision, 'mois');
});

test('une plage retient sa borne la plus récente', () => {
  const seul = dateEvenementMs('18/01/2026').ms;
  const plage = dateEvenementMs('18-19/01/2026').ms;
  assert.ok(plage > seul, 'le dernier jour cité doit être retenu');
  assert.strictEqual(dateEvenementMs('Juillet-Aout 2025').precision, 'mois');
  assert.ok(dateEvenementMs('Juillet-Aout 2025').ms > dateEvenementMs('Juillet 2025').ms);
});

test("une année seule n'est jamais traitée comme une date précise", () => {
  for (const v of ['2026', '2025-2026', 'Fin 2025']) {
    assert.strictEqual(dateEvenementMs(v).precision, 'annee', v);
  }
});

test('une date ne peut jamais être postérieure à maintenant', () => {
  // '2026' se lit "fin 2026", qui est dans le futur : le bornage évite qu'un
  // incident imprécis paraisse plus frais que le plus récent réellement daté.
  assert.ok(dateEvenementMs('2026').ms <= Date.now());
});

test('une date non analysable est signalée, jamais devinée', () => {
  assert.strictEqual(dateEvenementMs('la semaine derniere').precision, null);
  assert.strictEqual(dateEvenementMs('').precision, null);
  assert.strictEqual(dateEvenementMs(undefined).ms, null);
});

test('la fraîcheur décroît de 1 à 0 et ne sort jamais de cet intervalle', () => {
  assert.strictEqual(facteurFraicheur(0), 1);
  assert.strictEqual(facteurFraicheur(10 * J), 1);
  assert.strictEqual(facteurFraicheur(400 * J), 0);
  const milieu = facteurFraicheur(112 * J);
  assert.ok(milieu > 0 && milieu < 1, 'décroissance progressive attendue');
  assert.ok(facteurFraicheur(60 * J) > facteurFraicheur(120 * J), 'décroissance monotone');
});

test('le socle vérifié ne perd jamais de poids : la fraîcheur ne retranche rien', () => {
  // Garde-fou contre la première version de ce correctif, qui faisait décroître
  // le poids affiché : 43 pays sur 53 baissaient d'un cran, Somalie et Kenya
  // passant au VERT. Sur un outil de sûreté, le faux négatif est le pire échec.
  const src = tranche('const baseScoreVerifie', ';');
  assert.match(src, /eventsVerifies\.reduce/,
    'baseScoreVerifie doit sommer les poids BRUTS, sans pondération par l\'âge');
});

// Il exista un plafondLive() qui bridait le temps réel d'autant plus que le
// socle vérifié était RÉCEMMENT SAISI. La mesure a montré l'inversion : les
// Seychelles, sans un incident au dossier, atteignaient l'orange ; le Sénégal,
// qui en a trois, ne le pouvait pas. Ce test interdit son retour.
test('la fraîcheur de la saisie ne bride plus le temps réel', () => {
  assert.strictEqual(typeof noyau.plafondLive, 'undefined',
    'plafondLive est revenu : le frein serait de nouveau indexé sur l\'âge de la saisie');
  assert.strictEqual(typeof noyau.PLAFOND_LIVE_BASE_FRAICHE, 'undefined');
});

test('le seul signal temps réel ne peut pas porter un pays au ROUGE', () => {
  // La promesse centrale du produit. Elle tient aujourd'hui par l'arithmétique
  // seule : le live plafonne à MAX_LIVE_EVENTS_PAR_PAYS points (1 pt/article)
  // plus 0,5 d'historique, et cela ne franchit pas l'écart entre le seuil
  // marron (8) et le seuil rouge (14).
  const maxHistorique = 0.5;
  assert.notStrictEqual(getNivKey(MAX_LIVE_EVENTS_PAR_PAYS + maxHistorique), 'rouge');
});

// La porte de borneRougeVerifie ne se déclenche donc JAMAIS avec les nombres
// d'aujourd'hui. Ce n'est pas une raison de la croire inutile — c'est une
// raison de prouver qu'elle tiendrait si le plafond montait. Sans ce test,
// elle serait une porte qui ne se ferme jamais, et personne ne le saurait.
test('si le plafond du live montait, la porte rouge tiendrait seule', () => {
  const PLAFOND_HYPOTHETIQUE = 20;      // au-delà de l'écart marron -> rouge
  const plancher = 3;                   // socle vérifié : jaune
  const total = plancher + PLAFOND_HYPOTHETIQUE;
  assert.strictEqual(getNivKey(total), 'rouge',
    'prémisse du test : sans porte, l\'arithmétique donnerait bien rouge');
  assert.strictEqual(borneRougeVerifie(getNivKey(total), getNivKey(plancher)), 'marron',
    'la porte doit ramener au marron un pays dont le socle vérifié dit jaune');
});

test('la porte rouge laisse passer les pays que le socle place déjà au marron', () => {
  // Le retirer à ces pays-là serait une régression, pas une protection : ce
  // sont ceux où le rouge compte le plus (Somalie, Tchad, Soudan du Sud...).
  assert.strictEqual(borneRougeVerifie('rouge', 'marron'), 'rouge');
  assert.strictEqual(borneRougeVerifie('rouge', 'rouge'), 'rouge');
  assert.strictEqual(borneRougeVerifie('rouge', 'orange'), 'marron');
  assert.strictEqual(borneRougeVerifie('rouge', 'jaune'), 'marron');
  assert.strictEqual(borneRougeVerifie('rouge', 'vert'), 'marron');
});

test('la porte ne touche à rien en dessous du rouge', () => {
  for (const k of ['vert', 'jaune', 'orange', 'marron']) {
    assert.strictEqual(borneRougeVerifie(k, 'vert'), k,
      k + ' ne doit pas être modifié par une porte qui ne concerne que le rouge');
  }
});

test('chaque incident du fichier de production porte une date analysable', () => {
  const muets = ALERTE_EVENTS.filter(e => dateEvenementMs(e.date).precision === null);
  // strictEqual sur la longueur, pas deepStrictEqual sur le tableau : les
  // tableaux nés dans le contexte vm n'ont pas le prototype Array de l'hôte,
  // et deepStrictEqual échoue alors même sur deux tableaux vides.
  assert.strictEqual(muets.length, 0,
    'incident(s) sans date analysable — ils pèseraient un poids de contexte sans que '
    + 'personne le sache : ' + muets.map(e => e.date).join(' · '));
});

test('poidsVerifie réduit un élément non daté au lieu de le compter plein', () => {
  const date = poidsVerifie({ weight: 4, date: '29/06/2026' }, Date.parse('2026-07-01T00:00:00Z'));
  const annee = poidsVerifie({ weight: 4, date: '2026' }, Date.parse('2026-07-01T00:00:00Z'));
  assert.strictEqual(date.poids, 4, 'un incident récent et daté garde son poids');
  assert.ok(annee.poids < date.poids, 'un élément daté à l\'année près pèse moins');
  assert.strictEqual(annee.fraicheur, 0, 'et ne fait jamais paraître le socle frais');
});
