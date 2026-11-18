// Cohérence des actus entre modules (demande de YORO, 18/11/2026) : « une
// cohérence et conformité entre les actus sur tous les modules, sauf l'Agenda
// qui gardera une particularité en qualité d'agenda, et la Géopolitique ».
// Une seule règle, estActuModule ; chaque module n'ajoute que ses propres
// filtres d'affichage (pays, catégorie, recherche).
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche, bac } = require('./_bac');

const H = 3600000;
function monter() {
  // estRecentReel est remplacé par un double : on teste ici la règle
  // commune, pas la datation (couverte ailleurs).
  return bac(
    "const AGENDA_AUSSI_AU_FLUX = new Set(['manifestation','sportif','religieux','ceremonie','meeting']);",
    'function estRecentReel(a){ return !!a.pubDate && (Date.now() - a.pubDate) < 36*3600000; }',
    tranche('function estActuModule(a) {', 'function antiHalluFilter('),
    'this.E = estActuModule; this.A = actusModules;'
  );
}
const art = (o) => Object.assign({ pubDate: Date.now() - H, primary: 'src', title: 'Attaque contre un poste à Djibo', level: 'mod' }, o);

test('la règle commune : fenêtre, source, titre, et pas d’événement purement calendaire', () => {
  const { E } = monter();
  assert.strictEqual(E(art({})), true);
  assert.strictEqual(E(art({ pubDate: Date.now() - 40 * H })), false);
  assert.strictEqual(E(art({ primary: '' })), false);
  assert.strictEqual(E(art({ title: 'Court' })), false);
  assert.strictEqual(E(art({ _estAgenda: true, _agendaType: 'colloque' })), false);
  assert.strictEqual(E(art({ _estAgenda: true, _agendaType: 'colloque', level: 'high' })), true);
  assert.strictEqual(E(art({ _estAgenda: true, _agendaType: 'manifestation' })), true);
});

// Les modules d'actus passent tous par la règle commune ; aucun ne refiltre
// ALL avec estRecentReel seul (ce qui laissait passer l'agenda calendaire).
const MODULES = [
  ['Flux', 'function getFiltered() {', '\n  return a;\n}'],
  ['Flash info', 'function majFlashInfo', '\n}\n'],
  ['Compteurs du Flux', 'function updStats() {', '\n}\n'],
  ['Détail d’un indicateur', 'function showKpiDrill', '\n}\n'],
  ['Actus à traiter', 'function getArticlesATraiter', '\n}\n'],
  ['Tableau de bord', 'async function renderDashboard() {', '\nfunction '],
  ['Synthèse', 'function updSynthese', 'const crit=perimetre'],
  ['Recherche', 'function buildRecherche', "if (inScope('historique')"],
  ['Réseaux sociaux', 'function updateSocialCounts', '\n}\n'],
  ['Chronologie des alertes', 'function renderAlerteChronologie', '\n}\n'],
  ['Rapports', 'function getExportData(){', '\n}'],
  ['Compteur régional', 'function compteurRegional() {', '\n}'],
];
for (const [nom, debut, fin] of MODULES) {
  test('module ' + nom + ' : règle commune estActuModule', () => {
    const corps = tranche(debut, fin);
    assert.match(corps, /actusModules\(|estActuModule\(/, nom + ' ne passe pas par la règle commune');
    assert.doesNotMatch(corps, /estRecentReel\(/, nom + ' refiltre encore avec estRecentReel seul');
  });
}

test('Synthèse filtrée par pays ou zone : le filtre se pose SUR les actus, pas sur ALL', () => {
  const corps = tranche('function updSynthese', 'const crit=perimetre');
  assert.doesNotMatch(corps, /perimetre = ALL\.filter/);
  assert.match(corps, /perimetre = actusSy\.filter\(a => a\.cy === fSyCy\)/);
});

test('les compteurs critiques/élevés du Flux comptent les actus affichées, pas tout ALL', () => {
  const corps = tranche('function updStats() {', '\n}\n');
  assert.doesNotMatch(corps, /ALL\.filter\(x=>x\.level/);
});

test('l’Agenda et le niveau d’alerte gardent leur règle propre', () => {
  assert.doesNotMatch(tranche('function getLiveAlertEvents', '\n}\n'), /estActuModule|actusModules/);
  assert.ok((HTML.match(/a\._estAgenda && estAgendaRecent\(a\)/g) || []).length >= 3, 'l’agenda lit toujours ses propres événements');
});
