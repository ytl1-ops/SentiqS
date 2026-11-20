// Formes accordées et conjuguées, portugais et espagnol (audit du 20/11/2026).
// matchMot compare des mots entiers : « attaque » ne reconnaissait ni
// « attaqués » ni « attaquent », et la presse lusophone et hispanophone
// n'avait aucun mot au lexique. Chaque cas de garde porte les deux sens.
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac, exposer } = require('./_bac');
const ctx = exposer(bac(tranche('const CK_CRIT', '//  FIABILITÉ & ANTI-HALLUCINATION')), 'classify');
const niveau = (t, cy) => ctx.classify(t, { cy: cy || 'SN', cat: 'politique' }, t).lvl;

test('les formes conjuguées et accordées d\'une attaque sortent critiques', () => {
  for (const t of ['Des hommes armés attaquent le poste de Djibo', 'Deux soldats attaqués près de Kaya',
    'Attaques djihadistes dans le nord du Togo', 'Une octogénaire massacrée à la machette à Bouaké',
    'Touba : une mère égorge son fils de 3 ans', 'Une dispute tourne à la fusillade à Cambérène']) {
    assert.strictEqual(niveau(t), 'crit', t);
  }
});

test('portugais et espagnol : une attaque meurtrière sort critique', () => {
  for (const t of ['Ataque armado mata 12 pessoas em Cabo Delgado', 'Ataque armado deja cinco muertos en Malabo',
    'Insurgentes atacam aldeia em Macomia, três mortos', 'Secuestrados dos trabajadores en Bata']) {
    assert.strictEqual(niveau(t, 'MZ'), 'crit', t);
  }
  assert.strictEqual(niveau('Cinco feridos em tiroteio em Luanda', 'AO'), 'high');
  assert.strictEqual(niveau('Ataque de nervos antes do exame', 'AO'), 'ok', 'locution figurée');
});

test('« abat », « blessé » : élevés à côté d\'un mot de sûreté, rien seuls', () => {
  assert.strictEqual(niveau('Un policier abat un collègue et en blesse un autre'), 'high');
  assert.strictEqual(niveau('Les arbres abattus pour la nouvelle route'), 'ok');
  assert.strictEqual(niveau('Orgueil blessé : l\'opposition boycotte la session'), 'ok');
});

test('écartés après mesure : « enlevées » et « mortes » ne font pas un critique', () => {
  assert.notStrictEqual(niveau('Souveraineté alimentaire : seules 16 000 tonnes de riz enlevées'), 'crit');
  assert.notStrictEqual(niveau('Pleuropneumonie : 110 chèvres mortes dans 12 foyers'), 'crit');
});
