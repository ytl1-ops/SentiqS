// Le cumul du mois suit le classement courant (audit du 27/11/2026) : un fait
// déjà versé n'est plus figé dans la catégorie qu'il avait le jour de sa
// collecte, et un fait que la règle courante sort du radar (sport, conseil
// pratique) ne figure plus dans la Présentation 1.
const test = require('node:test');
const assert = require('node:assert');
const faitsGrsci = require('../lib/faits-grsci');
const { reclasserCumul } = require('../reclasser-cumul');

const cumul = () => ({
  mois: '2026-11',
  pays: {
    SN: [
      { titre: 'Piqûre de scorpion : Voici les gestes à adopter après une attaque', source: 'Senego', niveau: 'crit', cat: 'politique', cotation: 'non_confirme', publieMs: 1 },
      { titre: 'Kaolack : Fin de cavale pour la jeune fille accusée du meurtre de son oncle', source: 'Senego', niveau: 'crit', cat: 'politique', cotation: 'probable', publieMs: 2 },
      { titre: 'Ligue 2 : Satellite FC domine Tembou FC et consolide son fauteuil de leader', source: 'Senego', niveau: 'mod', cat: 'securite', cotation: 'non_confirme', publieMs: 3 },
    ],
  },
});

test('la catégorie suit la règle courante, la cotation ne bouge pas', () => {
  const c = cumul();
  reclasserCumul(c);
  const [scorpion, meurtre] = c.pays.SN;
  assert.strictEqual(scorpion.cat, 'divers');
  assert.strictEqual(meurtre.cat, 'securite');
  assert.strictEqual(meurtre.cotation, 'probable');
});

test('le niveau ne change que par une règle qui l\'abaisse expressément', () => {
  const c = cumul();
  reclasserCumul(c);
  const [scorpion, meurtre] = c.pays.SN;
  assert.strictEqual(scorpion.niveau, 'mod', 'attaque d\'animal : plafond modéré');
  assert.strictEqual(meurtre.niveau, 'crit', 'un fait réel garde le niveau de sa collecte');
});

test('un fait sorti du radar (sport, niveau normal) n\'entre plus dans le rapport', () => {
  const c = cumul();
  reclasserCumul(c);
  const titres = faitsGrsci.faitsDuMois(c, 'SN', 'Sénégal').map((f) => f.titre);
  assert.ok(titres.some((t) => /meurtre/.test(t)));
  assert.ok(!titres.some((t) => /Ligue 2/.test(t)), titres.join(' | '));
});
