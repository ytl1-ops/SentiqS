// Agenda : les rassemblements de foule (demande de YORO du 14/11/2026).
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche, bac } = require('./_bac');

function monter() {
  const ctx = bac(
    "function normaliserAccents(s){return String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');}",
    tranche('const EVENT_PLANIFIE_KW', '// ═══'),
    tranche('const _MOTS_AGENDA_RE', 'function estEvenementPlanifie'),
    'this.T = typeEvenementDetecte; this.AU_FLUX = AGENDA_AUSSI_AU_FLUX;'
  );
  return { type: (titre, corps) => ctx.T(titre + ' ' + (corps || ''), titre), auFlux: ctx.AU_FLUX };
}

test('les rassemblements de foule entrent à l’agenda, par leur titre', () => {
  const { type } = monter();
  assert.strictEqual(type('ÉLIMINATOIRES CAN 2027 : les Aigles du Mali jouent le leadership à Bamako'), 'sportif');
  assert.strictEqual(type('Magal de Touba 2026 : plus de quatre millions de pèlerins attendus'), 'religieux');
  assert.strictEqual(type('Mopti : Célébration de la journée nationale des autorités traditionnelles'), 'ceremonie');
  assert.strictEqual(type("Nigeria : le meeting de l'opposant Peter Obi à Lagos"), 'meeting');
  assert.strictEqual(type('Musique : Jazz à Ouaga signe son grand retour du 27 au 29 novembre'), 'concert');
  assert.strictEqual(type('Unima Theatre Festival returns Nov 27 to 29'), 'festival');
});

test('un mot court n’est lu qu’en mot entier, et le corps ne fait pas un événement', () => {
  const { type } = monter();
  assert.strictEqual(type('Government Calls for Concerted Efforts to Curb Illegal Mining'), null);
  assert.strictEqual(type('Buckreef mine closure plan faces scrutiny over safety'), null);
  assert.strictEqual(type('Le gouvernement tient sa promesse aux enseignants'), null);
  assert.strictEqual(type('Opération des FAMa sur le théâtre des opérations du centre'), null);
  // Un « forum » cité dans le corps ne fait plus d'un article politique une
  // réunion gouvernementale (119 cas sur 158 au 13/11/2026).
  assert.strictEqual(type("2027: Tinubu can't buy Nigerians with gifts, says ADC", 'Il s’exprimait lors d’un forum à Abuja.'), null);
  // Une formulation de plusieurs mots du corps reste lue.
  assert.strictEqual(type('Bamako : les syndicats durcissent le ton', 'Un préavis de grève a été déposé lundi.'), 'manifestation');
});

test('verser un fait à l’agenda ne le retire pas du Flux quand il compte', () => {
  const { auFlux } = monter();
  for (const t of ['manifestation', 'sportif', 'religieux', 'ceremonie', 'meeting']) assert.ok(auFlux.has(t), t);
  const corps = tranche('function getFiltered', 'const q=document');
  assert.match(corps, /AGENDA_AUSSI_AU_FLUX\.has\(x\._agendaType\) \|\| x\.level === 'crit' \|\| x\.level === 'high'/);
});

test('le type d’agenda est recalculé à la réhydratation, et la collecte lit le titre', () => {
  const corps = tranche('function rehydrateArticles', 'if (_sig) a._rv = _sig;');
  assert.match(corps, /typeEvenementDetecte\(texteClass, a\.title \|\| ''\)/);
  assert.strictEqual((HTML.match(/typeEvenementDetecte\(title ?\+ ?' ' ?\+ ?desc, title\)/g) || []).length, 2);
  for (const v of ['religieux', 'ceremonie', 'meeting']) assert.ok(HTML.includes('<option value="' + v + '">'), v);
});

// Demande de YORO du 14/11/2026 : « collecte le max d'actu à insérer dans
// l'agenda, pas celles en lien avec les événements sûreté ».
test('un incident ne va jamais à l’agenda, même s’il nomme un rassemblement', () => {
  const { type } = monter();
  for (const t of [
    "Nigeria : le meeting de l'opposant Peter Obi attaqué à Lagos",
    'Barcelone : des violences éclatent après les cortèges de la grève',
    'Stade de Bouaké : deux blessés dans un mouvement de foule',
    'Festival attacked by gunmen in Kaduna',
  ]) assert.strictEqual(type(t), null, t);
  // Une cyberattaque évoquée à propos d'un événement ne retire pas l'événement.
  assert.strictEqual(type('JOJ 2026 : quels dispositifs face aux cyberattaques ?'), 'sportif');
});

test('l’agenda reçoit aussi salons, expositions, sommets, visites et campagnes', () => {
  const { type } = monter();
  assert.strictEqual(type('Ecobank JoyBusiness SME Fair 2026 opens today at Ghud Park, Accra Mall'), 'foire');
  assert.strictEqual(type('Niamey : la ministre du Tourisme visite l’exposition « Niamey, des origines à 2050 »'), 'foire');
  assert.strictEqual(type('Kagame, First Lady in Cambodia for State Visit'), 'gouvernemental');
  assert.strictEqual(type('Simandou Mining Summit : l’ambition de l’ACGP'), 'colloque');
  assert.strictEqual(type('Gambie : Almameh Gibba lance sa campagne pour la présidentielle de décembre'), 'meeting');
  assert.strictEqual(type('Elim CAN 2027 : les Lions indomptables sans pitié pour la Namibie'), 'sportif');
  assert.strictEqual(type('COP31 : Faure Gnassingbé participe au sommet des dirigeants à Antalya'), 'gouvernemental');
  // Ce qui n'est pas un événement reste dehors.
  assert.strictEqual(type('JSK : Bilel Messaoudi au sommet en octobre'), null);
  assert.strictEqual(type('Le Sénégal marche sur le Soudan, suivez la conférence de presse'), null);
  assert.strictEqual(type('Brakna : le ministre lance la campagne nationale de vaccination du bétail'), null);
});

test('une ligne d’agenda partagé qui porte un incident est écartée à la lecture', () => {
  const corps = tranche('async function lireAgendaPartagee', 'catch (e) { console.warn(\'SentiqS — lireAgendaPartagee a echoue');
  assert.strictEqual((corps.match(/ligneAgendaEstIncident\(l\)/g) || []).length, 2);
});
