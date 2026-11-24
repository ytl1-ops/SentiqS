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

// Lacunes du 24/11/2026 : coup d'État, tué par balle, vol à main armée en
// portugais et en espagnol. Chaque cas de garde porte les deux sens.
test('portugais et espagnol : coup d\'État et tué par balle sortent critiques', () => {
  for (const [t, cy] of [['Tentativa de golpe de Estado em Bissau', 'GW'], ['Intento de golpe de Estado en Malabo', 'GQ'],
    ['Jovem morto a tiro no Cazenga', 'AO'], ['Un hombre muerto a tiros en Bata', 'GQ'], ['Homicídio em Luanda', 'AO']]) {
    assert.strictEqual(niveau(t, cy), 'crit', t);
  }
  assert.strictEqual(niveau('Golpe de teatro na Assembleia', 'GW'), 'ok', 'golpe seul n\'est pas un coup d\'État');
  assert.strictEqual(niveau('Mata do Maiombe : governo lança plano de reflorestação', 'AO'), 'ok', '« mata » = la forêt');
});

test('portugais et espagnol : vol à main armée élevé ; accident plafonné, attaque non', () => {
  assert.strictEqual(niveau('Roubo à mão armada no Zango', 'AO'), 'high');
  assert.strictEqual(niveau('Detenido tras un atraco en Malabo', 'GQ'), 'high');
  assert.strictEqual(niveau('Muertos en un accidente de tráfico en Mongomo', 'GQ'), 'high', 'un accident n\'est pas une attaque');
  assert.strictEqual(niveau('Ataque armado contra un autobús: accidente provocado, cinco muertos', 'GQ'), 'crit', 'garde : les deux vocabulaires');
});
