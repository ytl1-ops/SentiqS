// Faits hors sûreté retirés du rapport mensuel (demande de YORO du 14/11/2026).
const test = require('node:test');
const assert = require('node:assert');
const h = require('../lib/hors-surete');
const faits = require('../lib/faits-grsci');

const f = (titre) => ({ titre, niveau: 'high', source: 'X', publieMs: Date.UTC(2026, 10, 5) });

test('les faits hors sûreté relevés dans le rapport de novembre sont retirés', () => {
  for (const [cy, t] of [
    ['CI', 'Fête de la Toussaint : Ce qu’il faut savoir sur cette célébration souvent confondue avec la fête des morts'],
    ['CI', 'Voici comment réagir face à un arrêt cardiaque chez un enfant'],
    ['CI', 'Cuisinière à gaz : Ce que révèle la couleur de la flamme sur votre sécurité'],
    ['CI', "Avis d'appel d'offres relatif à l'émission simultanée de Bons et Obligations du Trésor"],
    ['CI', 'Métro d’Abidjan : 66 % des travaux exécutés, la mise en service prévue en 2029'],
    ['SN', 'Sénégal vs Soudan : les Lions déroulent après la pause et signent une démonstration offensive 4 vs 1'],
    ['SN', 'Exécution budgétaire en septembre: 4 370,7 milliards FCFA de dépenses exécutées'],
    ['GH', "La police armée commence des patrouilles à Sydney après l'attaque de Bondi Beach"],
    ['TG', 'Roger Milla annoncé mort : attention, une fausse rumeur circule sur les réseaux sociaux'],
    ['SN', 'L’avocat qui défendait le meurtrier de Tupac Shakur retrouvé mort'],
  ]) assert.ok(h.estHorsSurete(f(t), cy), t);
});

test('un fait de sûreté reste, même sur un thème écarté', () => {
  for (const [cy, t] of [
    ['SN', 'Fass Mbao : trois morts dans des affrontements entre supporters de lutteurs rivaux'],
    ['SN', 'Fusillade lors du tournage d\'un clip: un mort et un blessé grave'],
    ['GH', 'Émotion aux États-Unis : Un lycéen ghanéen de 15 ans tué par balle dans le Bronx'],
    ['NE', 'Pétrole, gazoduc et rivalité avec le Maroc : ce que révèle la stratégie militaire algérienne au Niger'],
    ['CI', 'Aéroport de San Pedro : La SODEXAM met à l’épreuve son dispositif de gestion de crise'],
    ['TG', '« Mon frère est mort sur le front » : comment le Togo laisse partir ses jeunes pour l’Ukraine'],
    ['ML', 'Opération Dougoukoloko : les FAMa frappent des positions terroristes à Niono'],
    ['SN', 'Blocage du Budget 2027: Le FDR appelle à une manifestation d\'envergure'],
  ]) assert.strictEqual(h.themeHorsSurete(f(t), cy), null, t);
});

test('le filtre s’applique au rapport, pas au cumul', () => {
  const cumul = { mois: '2026-11', pays: { CI: [
    f('Voici comment réagir face à un arrêt cardiaque chez un enfant'),
    f('Côte d’Ivoire : le PPA-CI dénonce la mort d’un sixième détenu'),
  ] } };
  const r = faits.faitsDuMois(cumul, 'CI', "Côte d'Ivoire");
  assert.deepStrictEqual(r.map((x) => x.titre), ['Côte d’Ivoire : le PPA-CI dénonce la mort d’un sixième détenu']);
  assert.strictEqual(cumul.pays.CI.length, 2);
});
