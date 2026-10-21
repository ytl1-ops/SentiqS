// Une seule langue à l'écran : le français ou l'anglais, jamais celle de la source.
//
// Consigne de YORO du 21/10/2026 : « ça peut être de l'arabe ou tout autre
// langue. Les langues à afficher sont uniquement le FR ou le ENG, pas les 2 en
// même temps. » Avant, une traduction échouée affichait le texte source brut,
// et la note du Flux annonçait même que les titres restaient dans leur langue.
// Ces tests exercent la vraie L(), la vraie trFetch() et la vraie
// detectLangue(), extraites du fichier de production.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { HTML, tranche, bac } = require('./_bac.js');

function monte(lang, moteur) {
  const c = bac();
  Object.assign(c, {
    LANG: lang, TR_CACHE: {}, setTimeout, EXTRAIT_MAX_CARACTERES: 300,
    _trTexteAffichable: (t) => t, _trTexteTraduisible: (t) => t, _trDecodeEntities: (t) => t,
    redessins: 0, redessinerVuesOuvertes() { c.redessins++; },
    TR_AGENT_PROVIDERS: [moteur || (async () => { throw new Error('hors ligne'); })],
  });
  vm.runInContext(tranche('const AR_RANGE', '// _trTexteAffichable(texte)'), c);
  vm.runInContext(tranche('const SOC_STOPWORDS', '// ── Sentiment'), c);
  vm.runInContext(tranche('// ── Une seule langue a l\'ecran', '// retraduireActu(id)'), c);
  vm.runInContext(tranche('async function trFetch(', '// ── TRADUCTION DES RAPPORTS'), c);
  vm.runInContext(tranche('const TR_CONCURRENCE_MAX', '// traduireAvantPartage(texte)'), c);
  vm.runInContext(tranche('function L(texte) {', '// ── PAYS = CLÉ'), c);
  return c;
}
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const ARABE = 'هجوم مسلح على قافلة عسكرية في شمال مالي';
const ANGLAIS = 'Gunmen killed three soldiers after the attack on the convoy';

test('un titre en arabe n\'est jamais affiché brut : « en cours », puis traduit et redessiné', async () => {
  const c = monte('fr', async (t) => (t === ARABE ? 'Attaque armée contre un convoi militaire dans le nord du Mali' : t));
  assert.strictEqual(c.L(ARABE), 'Traduction en cours…');
  await attendre(400);
  assert.strictEqual(c.L(ARABE), 'Attaque armée contre un convoi militaire dans le nord du Mali');
  assert.strictEqual(c.redessins, 1, 'les vues ouvertes sont redessinées une fois le lot traduit');
});

test('traduction impossible : la carte le dit dans la langue choisie, sans le texte source', async () => {
  const fr = monte('fr');
  await fr.preTraduireRapport([ANGLAIS, ARABE]);
  assert.strictEqual(fr.L(ANGLAIS), 'Texte en anglais — traduction indisponible pour le moment');
  assert.strictEqual(fr.L(ARABE), 'Texte en arabe — traduction indisponible pour le moment');
  assert.match(fr.noteTraductionRapport(), /^Note : 2 texte\(s\) de source n'ont pas pu être traduits/);
  const en = monte('en');
  const titre = 'Attaque armée contre un convoi militaire dans le nord du Mali';
  await en.preTraduireRapport([titre]);
  assert.strictEqual(en.L(titre), 'French text — translation unavailable right now');
  assert.match(en.noteTraductionRapport(), /could not be translated/);
});

test('un texte court ou de langue incertaine garde son texte : on n\'efface pas sur une détection hasardeuse', async () => {
  const c = monte('en');
  await c.preTraduireRapport(['Côte d\'Ivoire', 'Gao']);
  assert.strictEqual(c.L('Côte d\'Ivoire'), 'Côte d\'Ivoire');
  assert.strictEqual(c.L('Gao'), 'Gao');
  // Un titre français reste tel quel en français.
  assert.strictEqual(monte('fr').L('Attaque armée contre un convoi militaire dans le nord du Mali'),
    'Attaque armée contre un convoi militaire dans le nord du Mali');
});

test('un moteur qui rend le texte inchangé l\'a jugé déjà dans la bonne langue : pas d\'échec', async () => {
  const c = monte('fr', async (t) => t);
  // detectLangue y voit de l'anglais (« the », « and », « with »…), le moteur non.
  const titre = 'Le Mali and the Burkina Faso with the AES';
  await c.preTraduireRapport([titre]);
  assert.strictEqual(c.L(titre), titre);
  assert.strictEqual(c.noteTraductionRapport(), '');
});

test('en anglais, la table de l\'interface traduit les données saisies avant tout service en ligne', () => {
  const c = monte('en');
  c.SentiqLangue = { connu: (t) => t === 'Sommet de la CEDEAO a Abuja sur la securite regionale', traduire: () => 'ECOWAS summit in Abuja on regional security' };
  assert.strictEqual(c.L('Sommet de la CEDEAO a Abuja sur la securite regionale'), 'ECOWAS summit in Abuja on regional security');
});

test('la note du Flux annonce la traduction, plus « restent dans la langue de leur source »', () => {
  assert.ok(!/restent dans la langue de leur source|stay in the language of their source/.test(HTML));
  assert.match(HTML, /note_flux:'Flux opérationnel.{0,300}traduits automatiquement en français/);
  assert.match(HTML, /note_flux:'Feed:.{0,300}translated automatically into English/);
});

test('le traducteur du navigateur passe en premier, puis Google ; un échec du bouton Traduire montre la mention', () => {
  const ordre = tranche('const TR_AGENT_PROVIDERS', '// _trDecodeEntities');
  assert.match(ordre, /\[\s*_trViaNavigateur,\s*avecDisjoncteur\(_trViaGoogle/);
  const bouton = tranche('async function retraduireActu(id)', '// ═══');
  assert.match(bouton, /_trEchec\(a\.title\) \? texteNonTraduit\(a\.title\)/);
  assert.match(tranche('async function traduireAvantPartage', 'function L(texte)'), /texteNonTraduit\(texteAff\)/);
});
