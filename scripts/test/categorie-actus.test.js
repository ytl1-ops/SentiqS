// La catégorie d'une actu (sécurité, politique, social, économie, faits
// divers), décidée par son titre. Audit du 27/11/2026 : « une piqûre de
// scorpion est placée en politique » (YORO). Sur 100 faits de novembre relus
// un par un, 51 catégories étaient fausses, surtout parce qu'un titre sans
// mot de catégorie prenait celle de sa SOURCE : un média déclaré « politique »
// publie aussi des meurtres, des incendies et la lutte sénégalaise.
//
// Les titres ci-dessous sont des faits réels du cumul de novembre. Chacun a
// été vu échouer sur la version précédente de classify().
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac, exposer } = require('./_bac.js');

const { classify } = exposer(
  bac(tranche('const CK_CRIT', '//  FIABILITÉ & ANTI-HALLUCINATION')),
  'classify'
);
// Source généraliste déclarée « politique », comme Senego, Seneweb, Malijet.
const generaliste = (cy) => ({ cy: cy || 'SN', cat: 'politique' });
const cat = (titre, cy) => classify(titre + ' ', generaliste(cy), titre).cat;
const lvl = (titre, cy) => classify(titre + ' ', generaliste(cy), titre).lvl;

test('une piqûre de scorpion est un fait divers, et jamais un critique', () => {
  const t = 'Piqûre de scorpion : Voici les gestes à adopter après une attaque';
  assert.strictEqual(cat(t), 'divers');
  assert.notStrictEqual(lvl(t), 'crit');
  assert.notStrictEqual(lvl(t), 'high');
});

test('une attaque d\'abeilles reste un fait divers, pas une attaque', () => {
  const t = 'Podor : Parti à la recherche de sa chèvre, cet homme a été retrouvé mort après une attaque d\'abeilles';
  assert.strictEqual(cat(t), 'divers');
  assert.notStrictEqual(lvl(t), 'crit');
});

test('un agresseur humain garde la sécurité, même avec un animal dans le titre', () => {
  const t = 'Des hommes armés attaquent un village et volent des serpents sacrés';
  assert.strictEqual(cat(t, 'ML'), 'securite');
  assert.strictEqual(lvl(t, 'ML'), 'crit');
});

test('le crime ordinaire est de la sécurité, pas de la politique', () => {
  assert.strictEqual(cat('Kaolack : Fin de cavale pour la jeune fille accusée du meurtre de son oncle'), 'securite');
  assert.strictEqual(cat('Touba : une mère égorge son fils de 3 ans et évoque un « fardeau »'), 'securite');
  assert.strictEqual(cat('Une fillette de 5 ans meurt après une agression présumée lors de la querelle des parents'), 'securite');
});

test('accidents, incendies et noyades sont des faits divers', () => {
  assert.strictEqual(cat('Labé : une femme tuée et plusieurs blessés dans un accident à Popodara', 'GN'), 'divers');
  assert.strictEqual(cat('Tragédie sur la VDN: un incendie d’appartement fait un mort'), 'divers');
  assert.strictEqual(cat('Drame routier entre la Guinée et le Sénégal : deux morts et trois blessés'), 'divers');
});

test('un accident n\'est pas un incident : son bilan ne compte pas comme vocabulaire de sécurité', () => {
  // Le bus attaqué reste une attaque (AGRESSION_RE).
  assert.strictEqual(cat('Un bus attaqué par des hommes armés après un accident', 'BF'), 'securite');
});

test('la santé, les grèves et les migrations vont au Social', () => {
  assert.strictEqual(cat('Mobilisation sanitaire dans près de 70 pays : la Semaine du dépistage du VIH'), 'humanitaire');
  assert.strictEqual(cat('Santé et action sociale : And Gueusseum décrète 48 heures de grève'), 'humanitaire');
  assert.strictEqual(cat('Orpailleurs de Guinée : 76 000 burkinabè rapatriés, 150 ivoiriens bloqués', 'BF'), 'humanitaire');
});

test('le budget et le FMI vont à l\'économie', () => {
  assert.strictEqual(cat('LFR : Babacar Ba alerte sur les risques d’un rejet pour l\'économie sénégalaise'), 'economique');
  assert.strictEqual(cat('Les 2,2 milliards de dollars du FMI sur le point d’échapper au président Diomaye'), 'economique');
});

test('les institutions et la diplomatie restent en politique', () => {
  assert.strictEqual(cat('Togo : le CAR mobilise ses militants avant le meeting du 6 décembre', 'TG'), 'politique');
  assert.strictEqual(cat('Assimi Goïta accueilli avec les honneurs à Niamey par Abdourahamane Tiani', 'NE'), 'politique');
});

test('un titre sans aucun mot de catégorie ne prend plus celle d\'un média généraliste', () => {
  assert.strictEqual(cat('Certificat de vie'), 'divers');
  // Une source spécialisée garde la sienne.
  assert.strictEqual(classify('Certificat de vie ', { cy: 'SN', cat: 'economique' }, 'Certificat de vie').cat, 'economique');
});

test('un conseil pratique n\'est pas un fait : niveau normal', () => {
  const t = 'Voici comment réagir face à un arrêt cardiaque chez un enfant';
  assert.strictEqual(classify(t + ' Les bons gestes en cas d\'urgence.', generaliste(), t).lvl, 'ok');
  // Sauf s'il décrit un incident.
  assert.notStrictEqual(lvl('Ce qu\'il faut savoir sur l\'attaque de Djibo : 12 soldats tués', 'BF'), 'ok');
});

test('l\'exécution budgétaire n\'est pas une exécution', () => {
  assert.notStrictEqual(lvl('Exécution budgétaire à fin septembre 2026 : 3 785,2 milliards FCFA de recettes'), 'crit');
});

test('la catégorie ne fait jamais monter un niveau : un vrai incident reste critique', () => {
  assert.strictEqual(lvl('Mali : le JNIM attaque l’armée et ses supplétifs russes dans la région de Ségou', 'ML'), 'crit');
  assert.strictEqual(cat('Mali : le JNIM attaque l’armée et ses supplétifs russes dans la région de Ségou', 'ML'), 'securite');
});
