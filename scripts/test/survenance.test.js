// Teste extraireDateSurvenance(), extraite du fichier de production : la date
// REELLE de l'evenement decrit, estimee a partir d'indices de texte. C'est
// elle qui decide, avec la date de publication, si un article entre dans la
// fenetre d'actualite — donc si le pays apparait couvert ou muet.
//
// Ce que ces tests protegent, mesure du 06/09/2026 sur les 560 sources du
// registre, un dimanche : 107 articles publies DANS la fenetre etaient
// ecartes sur leur date d'evenement estimee, dont 36 par un seul cas — le
// jour de la semaine cite etant celui de la publication, le code le renvoyait
// sept jours en arriere. Parmi les victimes, publiees depuis moins de cinq
// heures : « Accident mortel de bus a Fogo : au moins 25 morts et 18 blesses »
// (Cap-Vert), « Incendie a Sfax » (Tunisie), deux alertes algeriennes
// critiques. Le revelateur : « Le poeme du dimanche », qui ne porte ce mot
// que parce qu'on etait dimanche.
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac, exposer } = require('./_bac.js');

const contexte = exposer(
  bac(tranche('const JOURS_SEMAINE_FR', 'function antiHalluFilter')),
  'extraireDateSurvenance', 'estRecentReel', 'FENETRE_ACTUALITE_MS', 'JOURS_SEMAINE_FR'
);
const { extraireDateSurvenance, estRecentReel, FENETRE_ACTUALITE_MS, JOURS_SEMAINE_FR } = contexte;

const H = 3600000;
const JOUR = 24 * H;
// Un dimanche a midi UTC, fixe : ces tests ne doivent pas changer de verdict
// selon le jour ou on les execute.
const DIMANCHE = Date.UTC(2026, 8, 6, 12, 0, 0);
const jourDe = (ts) => JOURS_SEMAINE_FR[new Date(ts).getDay()];

const art = (titre, pubDate) => ({
  title: titre, analysis: 'Depeche complete de l\'agence sur le sujet traite.',
  pubDate, cy: 'CV', primary: 'src1', score: 80,
});

test('le socle de ce test tombe bien un dimanche', () => {
  assert.strictEqual(jourDe(DIMANCHE), 'dimanche', 'la date de reference doit etre un dimanche');
});

test('un article du jour qui cite le jour meme decrit un fait du jour', () => {
  // LE defaut : publie il y a trois heures, date d'il y a sept jours, donc
  // hors fenetre, donc invisible. Cas reel du 06/09/2026.
  const pub = DIMANCHE - 3 * H;
  const a = art('Accident mortel de bus a Fogo ce dimanche : au moins 25 morts et 18 blesses', pub);
  const surv = extraireDateSurvenance(a);
  assert.strictEqual(surv.ts, pub, 'l\'evenement est du jour de publication, pas de la semaine precedente');
  assert.ok(
    (DIMANCHE - surv.ts) < FENETRE_ACTUALITE_MS,
    'un fait du jour ne peut pas sortir de la fenetre d\'actualite'
  );
});

test('« dimanche dernier » garde la lecture ancienne', () => {
  // Garde-fou symetrique : quand le redacteur dit lui-meme qu'il ne parle
  // pas du jour meme, on le croit.
  const pub = DIMANCHE - 3 * H;
  for (const suffixe of ['dernier', 'passe']) {
    const surv = extraireDateSurvenance(art('Le scrutin de dimanche ' + suffixe + ' reste conteste', pub));
    assert.strictEqual(surv.ts, pub - 7 * JOUR, 'attendu sept jours en arriere pour « dimanche ' + suffixe + ' »');
  }
});

test('un jour de la semaine ANTERIEUR reste compte en arriere', () => {
  // Non-regression : le correctif ne porte que sur l'egalite des jours.
  const pub = DIMANCHE - 3 * H;           // un dimanche
  const surv = extraireDateSurvenance(art('Les faits remontent a vendredi selon la police', pub));
  assert.strictEqual(surv.ts, pub - 2 * JOUR, 'vendredi, publie un dimanche : deux jours en arriere');
});

test('« hier » et « avant-hier » ne bougent pas', () => {
  const pub = DIMANCHE - 3 * H;
  assert.strictEqual(extraireDateSurvenance(art('L\'attaque a eu lieu hier soir pres du poste', pub)).ts, pub - JOUR);
  assert.strictEqual(extraireDateSurvenance(art('L\'attaque a eu lieu avant-hier pres du poste', pub)).ts, pub - 2 * JOUR);
});

test('un article du jour citant le jour meme reste dans le flux', () => {
  // Le test qui compte pour l'utilisateur : ce n'est pas la date estimee qui
  // l'interesse, c'est que l'incident soit visible.
  const pub = Date.now() - 3 * H;
  const jour = jourDe(pub);
  const a = art('Incendie a Sfax ce ' + jour + ' : les pneus usages compliquent l\'operation', pub);
  assert.ok(estRecentReel(a), 'un incident publie il y a trois heures doit rester affiche');
});
