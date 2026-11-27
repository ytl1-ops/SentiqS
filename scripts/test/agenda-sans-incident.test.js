// YORO, 27/11/2026 : « corrige de telle sorte que les événements tels que
// attaques… ne soient pas dans l'agenda ». L'agenda ne garde que des
// échéances ; un incident reste au Flux. Tests vus échouer sur le code d'avant.
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac } = require('./_bac');
const C = require('../../web/js/calendrier-foules.js');
const { normaliserAccents } = require('../../web/js/noyau.js');

function monter() {
  const ctx = bac(
    tranche('const AGENDA_INCIDENT_RE', '// Familles lues aussi dans le CORPS'),
    tranche('const MOIS_IDX = {', 'function _agendaSortKey('),
    tranche('function agendaAJour(', 'function fermerAccesRapide('),
    'this.estIncidentAgenda = estIncidentAgenda; this.agendaAJour = agendaAJour;'
  );
  ctx.normaliserAccents = normaliserAccents;
  ctx.SentiqCalendrier = C;
  ctx.resolveAgendaCy = (cy) => cy;
  return ctx;
}

test('un incident est reconnu en français, anglais, portugais et espagnol', () => {
  const { estIncidentAgenda: inc } = monter();
  [
    'Des hommes armés attaquent le poste de Djibo',
    'Podor : un atelier de couture part en fumée, plus de 7 millions réduits en cendres',
    'Après un match de football, un tailleur meurt à la plage après une baignade',
    'Fin des JOJ, naufrage d’une pirogue au Sénégal',
    'Assemblée nationale : de la fumée perturbe la séance, les députés évacués',
    'Ghana to fund travel for mother of slain Bronx teenager to attend funeral',
    'Gunmen ambush convoy near Maiduguri',
    'Ataque armado mata 12 pessoas em Cabo Delgado',
    'Acidente de autocarro faz 25 mortos',
    'Ataque armado deja cinco muertos en Malabo',
  ].forEach((t) => assert.ok(inc(t), t));
});

test('une échéance reste à l’agenda, commémorations comprises', () => {
  const { estIncidentAgenda: inc } = monter();
  [
    'Massacre Thiaroye 44 : Le programme de la cérémonie officielle de cette année, dévoilé',
    'Commémoration de la journée mondiale du souvenir des victimes des accidents de la route',
    'Maradi : ouverture de la session du Pôle judiciaire en matière de lutte contre le terrorisme',
    '16 jours d’activisme contre les violences faites aux femmes',
    'Pastef : Ousmane Sonko annonce un grand meeting',
    'Le SYNES brandit la menace d’une grève générale dès le 4 janvier 2027',
    'Togo : le CAR mobilise ses militants avant le meeting du 6 décembre',
    'Jubilé du Bombardier : le champion met fin à sa carrière par un gala',
    'Matchday : les Lions à l’assaut du Soudan',
    'Fête de la Toussaint : ce qu’il faut savoir sur la fête des morts',
  ].forEach((t) => assert.ok(!inc(t), t));
});

test('l’agenda retire un incident quelle que soit sa source, jamais un jour férié', () => {
  const { agendaAJour } = monter();
  const now = Date.UTC(2026, 10, 27, 13);
  const ts = Date.UTC(2026, 11, 2);
  const base = { day: '02', month: 'Dec', year: '2026', status: 'planifie', cy: 'SN', _ts: ts };
  const out = agendaAJour([
    Object.assign({}, base, { title: 'Attaque contre un convoi à Kidal', desc: '' }),
    Object.assign({}, base, { _agent: true, _finMs: ts, title: 'Gunmen kill 12 in Zamfara' }),
    Object.assign({}, base, { _detecteAuto: true, id: 'x', title: 'Incendie au marché de Sandaga', desc: '' }),
    Object.assign({}, base, { _calendrier: true, _ferie: true, title: 'Fête des martyrs' }),
    Object.assign({}, base, { title: 'Sommet de la CEDEAO à Abuja', desc: '' }),
  ], now);
  assert.deepStrictEqual(out.map((e) => e.title), ['Fête des martyrs', 'Sommet de la CEDEAO à Abuja']);
});

test('Louis lit la même liste que le module Agenda', () => {
  const corps = tranche('async function agendaComplet', '\n}\n');
  assert.match(corps, /agendaAJour\(/);
});
