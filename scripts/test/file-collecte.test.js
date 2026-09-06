// Teste ordonnerFileCollecte(), extrait du fichier de production : l'ordre
// dans lequel les sources sont interrogees, et donc QUI est sacrifie quand
// un passage planifie s'arrete au plafond de temps.
//
// Ce que ces tests protegent, mesure du 06/09/2026 : avec 560 sources, la
// collecte planifiee s'arrete desormais au plafond (11 min 03 s) et couvrait
// 45 pays sur 54. Sur les neuf absents, la Mauritanie etait la SEULE a avoir
// du contenu frais a portee (7 articles sous 12 h chez fr_mr, 2 chez
// allafrica_mr, 2 chez ami_mr) : ses sources n'avaient pas ete atteintes
// avant l'arret. Les huit autres n'avaient rien publie sous 36 h.
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac, exposer } = require('./_bac.js');

const contexte = exposer(
  bac('const PAYS_INFO = {};\n' + tranche('const ROTATION_TOUR_COMPLET_MS', 'async function doCollect')),
  'ordonnerFileCollecte', 'paysAveugles', 'rangRotatif', 'ROTATION_TOUR_COMPLET_MS'
);
const { ordonnerFileCollecte, paysAveugles, rangRotatif } = contexte;

// Registre reduit : deux sources par pays, dans un ordre fixe.
const registre = ['SN', 'ML', 'MR', 'CI'].flatMap((cy) => [
  { id: cy.toLowerCase() + '1', cy },
  { id: cy.toLowerCase() + '2', cy },
]);
const rangs = (file) => file.map((s) => s.id);

test('une source d\'un pays sans aucun article passe devant les pays deja documentes', () => {
  // Instant choisi pour que la rotation place la Mauritanie en QUEUE de
  // file : sans le rang « pays aveugle », c'est exactement la position ou
  // le plafond de temps la sacrifie. Le test doit donc echouer si ce rang
  // disparait — verifie en le retirant.
  const total = registre.length;
  const instantOuMrEstDernier = (() => {
    for (let pas = 0; pas < total; pas++) {
      const t = Math.round((pas / total) * contexte.ROTATION_TOUR_COMPLET_MS);
      const dernier = [...registre].sort((a, b) =>
        rangRotatif(registre.indexOf(a), total, t) - rangRotatif(registre.indexOf(b), total, t)
      ).at(-1);
      if (dernier.cy === 'MR') return t;
    }
    throw new Error('aucun instant ne place la Mauritanie en queue — registre de test a revoir');
  })();

  const sansPriorite = ordonnerFileCollecte(registre, { maintenant: instantOuMrEstDernier });
  assert.strictEqual(sansPriorite.at(-1).cy, 'MR', 'preuve du defaut : sans priorite, MR est collectee en dernier');

  const avecPriorite = ordonnerFileCollecte(registre, {
    estAveugle: (s) => s.cy === 'MR',
    maintenant: instantOuMrEstDernier,
  });
  assert.deepStrictEqual(
    avecPriorite.slice(0, 2).map((s) => s.cy), ['MR', 'MR'],
    'les deux sources du pays aveugle doivent ouvrir la file, pas la fermer : ' + rangs(avecPriorite).join(', ')
  );
});

test('la zone prioritaire choisie par l\'utilisateur reste devant un pays aveugle', () => {
  // La priorite « pays aveugle » complete la zone prioritaire, elle ne la
  // remplace pas : l'utilisateur qui a choisi une zone a demande a etre
  // servi en premier sur celle-la.
  const file = ordonnerFileCollecte(registre, {
    estZonePrio: (s) => s.cy === 'CI',
    estAveugle: (s) => s.cy === 'MR',
    maintenant: 0,
  });
  assert.deepStrictEqual(file.slice(0, 4).map((s) => s.cy), ['CI', 'CI', 'MR', 'MR'], rangs(file).join(', '));
});

test('une source d\'un pays aveugle n\'est jamais ecartee par le cooldown', () => {
  // Meme raison que pour la zone prioritaire : une source en cooldown vaut
  // mieux qu'un pays sur lequel on ne sait rien. Sans cette exemption, le
  // seul pays qu'on avait une chance de rattraper disparait de la file.
  const toutEnCooldown = () => true;
  const sansExemption = ordonnerFileCollecte(registre, { skippable: toutEnCooldown, maintenant: 0 });
  assert.strictEqual(sansExemption.length, 0, 'preuve du defaut : tout en cooldown, la file est vide');

  const avecExemption = ordonnerFileCollecte(registre, {
    estAveugle: (s) => s.cy === 'MR',
    skippable: toutEnCooldown,
    maintenant: 0,
  });
  assert.deepStrictEqual(avecExemption.map((s) => s.cy), ['MR', 'MR'], rangs(avecExemption).join(', '));
});

test('sans aucune priorite, l\'ordre reste exactement l\'ordre rotatif', () => {
  // Non-regression : le correctif ne doit pas defaire la rotation, qui est
  // ce qui empeche une tranche du registre d'etre TOUJOURS en queue.
  const t = 987_654_321;
  const attendu = [...registre].sort((a, b) =>
    rangRotatif(registre.indexOf(a), registre.length, t) - rangRotatif(registre.indexOf(b), registre.length, t)
  );
  assert.deepStrictEqual(rangs(ordonnerFileCollecte(registre, { maintenant: t })), rangs(attendu));
});

test('paysAveugles ne retient que les pays absents du cache', () => {
  const ctx = exposer(
    bac("const PAYS_INFO = {SN:1, ML:1, MR:1, CI:1};\n" + tranche('function paysAveugles', 'async function doCollect')),
    'paysAveugles'
  );
  const vus = ctx.paysAveugles([{ cy: 'SN' }, { cy: 'CI' }, { cy: null }, null]);
  assert.deepStrictEqual([...vus].sort(), ['ML', 'MR']);
});

test('un cache vide rend les 54 pays aveugles, sans faire planter la file', () => {
  // Premier chargement : tout est aveugle, donc plus rien ne l'est
  // vraiment — la file doit retomber sur l'ordre rotatif habituel.
  const t = 12_345;
  const file = ordonnerFileCollecte(registre, { estAveugle: () => true, maintenant: t });
  const attendu = [...registre].sort((a, b) =>
    rangRotatif(registre.indexOf(a), registre.length, t) - rangRotatif(registre.indexOf(b), registre.length, t)
  );
  assert.deepStrictEqual(rangs(file), rangs(attendu));
});
