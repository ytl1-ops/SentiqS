// « Exécution du budget », « enlèvement des marchandises », « fête des morts »,
// et l'apostrophe typographique qui faisait échapper « coup d’envoi » à sa
// garde. Cas réels du cumul de novembre 2026 (voir SENS_ADMINISTRATIFS dans la
// page) : la Côte d'Ivoire, pays pilote, ouvrait le mois sur la Toussaint et
// une tournée d'information portuaire classées CRITIQUES.
//
// Chaque cas de garde porte les deux vocabulaires : le mot sensible ET un vrai
// signal de sûreté reste critique, sinon le test ne prouverait rien.
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac, exposer } = require('./_bac.js');

const { classify } = exposer(
  bac(tranche('const CK_CRIT', '//  FIABILITÉ & ANTI-HALLUCINATION')),
  'classify'
);
const niv = (titre, cy) => classify(titre, { cy: cy || 'CI' }, titre).lvl;

test("l'exécution d'un budget, d'un arrêt ou d'un chantier n'est pas un incident", () => {
  for (const t of [
    'Exécution du budget 2025 : de grosses interrogations',
    'Uemoa : le taux d’exécution des réformes au Togo estimé à 79,8 % en 2026',
    'Cédéao : le greffe demande au Togo des précisions sur l’exécution de l’arrêt du 29 janvier',
    'Cour suprême : l’entreprise obtient un sursis à exécution d’un arrêt',
    'Mauvaise exécution des marchés publics - Des sanctions pour l\'exemple',
  ]) assert.notStrictEqual(niv(t, 'TG'), 'crit', t);
});

test('une exécution au sens propre reste critique', () => {
  assert.strictEqual(niv('Exécution sommaire de cinq villageois dénoncée par Nouakchott', 'MR'), 'crit');
  assert.strictEqual(niv('Exécution extrajudiciaire d’un détenu à Gao', 'ML'), 'crit');
});

test('enlever des marchandises n\'est pas un enlèvement de personnes', () => {
  assert.notStrictEqual(niv('Enlèvement des marchandises au PAA : la FENACCI-Ports lance une tournée'), 'crit');
  assert.strictEqual(niv('Enlèvement de quatre enseignants à San', 'ML'), 'crit');
});

test('la fête des morts n\'est pas un bilan', () => {
  assert.notStrictEqual(niv('Fête de la Toussaint : ce qu’il faut savoir sur la fête des morts'), 'crit');
  assert.strictEqual(niv('Attaque contre un poste : six morts', 'BF'), 'crit');
});

test("l'apostrophe typographique ne fait plus échapper une locution à sa garde", () => {
  assert.notStrictEqual(niv('Kéniéba : coup d’envoi des travaux du futur hôtel de ville', 'ML'), 'crit');
  assert.strictEqual(niv('Tentative de coup d’État déjouée à la présidence', 'BF'), 'crit');
});

test("« attaquer » un budget, « coup d'avance » : critique, pas incident", () => {
  // Présentation 1 de novembre 2026 (audit du 15/11/2026).
  for (const [t, cy] of [
    ["‘Stability on paper, hardship in our pockets’ – Minority caucus attacks 2027 Budget", 'GH'],
    ['Opposition attacks the mid-year budget review', 'GH'],
    ["L'opposition s'attaque au projet de loi de finances 2027", 'SN'],
    ["ACCORD SUR LA HAUTE MER : LE COUP D’AVANCE DIPLOMATIQUE DU BURKINA FASO", 'BF'],
  ]) assert.notStrictEqual(niv(t, cy), 'crit', t);
  // Garde : une attaque contre des personnes reste critique, même si le
  // titre parle aussi de budget.
  assert.strictEqual(niv('Gunmen attack the budget office in Kano, two killed', 'NG'), 'crit');
  assert.strictEqual(niv('Attaque contre la direction du budget à Djibo : deux gendarmes tués', 'BF'), 'crit');
});
