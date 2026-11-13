// Remises de dons, salons, anniversaires, poses de première pierre : des
// activités, pas des incidents. Cas réels du cumul de novembre 2026 (test
// fondateur du 13/11/2026), qui sortaient ÉLEVÉ (voir DON_RE et CEREMONIE_RE
// dans la page). Plafond MODÉRÉ : le fait reste visible, il n'ouvre plus la
// file d'alerte.
//
// Chaque cas de garde porte les deux vocabulaires : l'activité ET un vrai
// incident, qui doit garder son niveau.
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac, exposer } = require('./_bac.js');

const { classify } = exposer(
  bac(tranche('const CK_CRIT', '//  FIABILITÉ & ANTI-HALLUCINATION')),
  'classify'
);
const niv = (titre, cy) => classify(titre, { cy }, titre).lvl;

test('une remise de dons ne dépasse pas modéré', () => {
  for (const [t, cy] of [
    ['SOLIDARITÉ ET SÉCURITÉ : Mme Rose Bouzaïd offre des lampadaires solaires aux sites des ressortissants burkinabè à Ouezindougou', 'BF'],
    ['Tenenkou : l’armée remet du riz et de l’huile aux personnes âgées le 26 octobre 2026', 'ML'],
  ]) assert.strictEqual(niv(t, cy), 'mod', t);
});

test('un salon, un anniversaire, une signature, un chantier ne dépassent pas modéré', () => {
  for (const [t, cy] of [
    ['Deuxième édition du salon international de la défense et de la sécurité début novembre prochain à Bamako', 'ML'],
    ['Guinée : le Barreau célèbre « 40 ans de combat pour la défense et pour les libertés »', 'GN'],
    ['Une tour de 94 mètres au cœur du Plateau : La CBAO lance le chantier spectaculaire de son futur siège à Dakar', 'SN'],
    ['Daouda Coulibaly, PDG de Sama Money, à la cérémonie de signature de convention : « La digitalisation n’est pas une menace pour vos emplois »', 'ML'],
  ]) assert.strictEqual(niv(t, cy), 'mod', t);
});

test('« pièces d’exécution » n’est pas une exécution', () => {
  assert.notStrictEqual(niv('Lancement officiel de la caravane de sensibilisation sur les bonnes pratiques de greffes et parquets et l’établissement des pièces d’exécution', 'NE'), 'crit');
});

test('une attaque pendant une activité garde son niveau', () => {
  assert.strictEqual(niv('Des hommes armés attaquent la cérémonie de remise de dons à Djibo, cinq morts', 'BF'), 'crit');
  assert.strictEqual(niv('Attaque terroriste lors du lancement officiel de la campagne à Ménaka', 'ML'), 'crit');
});

test('un sinistre garde son niveau même avec un mot d’activité', () => {
  assert.notStrictEqual(niv('Kankan : un atelier de menuiserie ravagé par un incendie, plus de 100 millions de pertes', 'GN'), 'mod');
  assert.notStrictEqual(niv('Inauguration du pont : effondrement, trois morts', 'CI'), 'mod');
});
