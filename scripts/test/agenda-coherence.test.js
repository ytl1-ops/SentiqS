// Audit de l'agenda du 27/11/2026 (YORO : « l'agenda affiche des
// incohérences »). Chaque test a été vu échouer sur le code d'avant.
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche, bac } = require('./_bac');
const C = require('../../web/js/calendrier-foules.js');

const J = 86400000;
const MAINTENANT = Date.UTC(2026, 10, 27, 13);
const jour = (ms) => new Date(ms).toISOString().slice(0, 10);

function monter() {
  const ctx = bac(
    tranche('const MOIS_IDX = {', 'function _agendaSortKey('),
    tranche('const AGENDA_INCIDENT_RE', '// Familles lues aussi dans le CORPS'),
    tranche('function agendaAJour(', 'function fermerAccesRapide('),
    'this.agendaAJour = agendaAJour;'
  );
  ctx.normaliserAccents = require('../../web/js/noyau.js').normaliserAccents;
  ctx.SentiqCalendrier = C;
  ctx.resolveAgendaCy = (cy) => cy;
  return ctx;
}

test('une entrée saisie dont la date est passée est achevée, pas « urgente »', () => {
  const { agendaAJour } = monter();
  const [cedeao, zambie, biennale, joj, gambie] = agendaAJour([
    { day: '2', month: 'Jul', title: 'Sommet extraordinaire CEDEAO — Abuja — URGENT', desc: 'Session extraordinaire.', status: 'urgent', cy: 'Nigeria' },
    { day: '13', month: 'Aou', year: '2026', title: 'Zambie — Elections generales', desc: 'Scrutin prevu le 13 aout 2026.', status: 'planifie', cy: 'Zambie' },
    { day: '19', month: 'Nov', year: '2026', title: "Dak'Art — Biennale", desc: "Biennale a Dakar, du 19 novembre au 19 decembre 2026.", status: 'planifie', cy: 'Sénégal' },
    { day: '31', month: 'Oct', year: '2026', title: 'JOJ Dakar 2026', desc: 'Du 31 octobre au 13 novembre 2026 sur trois sites.', status: 'planifie', cy: 'Sénégal' },
    { day: '5', month: 'Dec', year: '2026', title: 'Gambie — Election presidentielle', desc: 'Scrutin prevu le 5 decembre 2026.', status: 'planifie', cy: 'Gambie' },
  ], MAINTENANT);
  assert.strictEqual(cedeao.status, 'acheve');
  assert.strictEqual(zambie.status, 'acheve');
  assert.strictEqual(biennale.status, 'en-cours', 'la Biennale court jusqu’au 19 décembre');
  assert.strictEqual(joj.status, 'acheve');
  assert.strictEqual(gambie.status, 'planifie');
});

test('un événement détecté prend la date écrite dans l’article, pas celle de sa parution', () => {
  const { agendaAJour } = monter();
  const pub = MAINTENANT - 6 * 3600000;
  const [rabat, sansDate, passe] = agendaAJour([
    { id: 'a1', _detecteAuto: true, _ts: pub - 30 * 3600000, day: '26', month: 'Nov', year: '2026', hour: '09:00', status: 'acheve', cy: 'MA',
      title: 'Infirmiers et techniciens de santé : un rassemblement national prévu le 5 décembre à Rabat', desc: '' },
    { id: 'a2', _detecteAuto: true, _ts: pub, day: '27', month: 'Nov', year: '2026', hour: '07:00', status: 'planifie', cy: 'SN',
      title: 'Pastef : Ousmane Sonko annonce un grand meeting', desc: 'Sans date écrite.' },
    { id: 'a3', _detecteAuto: true, _ts: pub, day: '27', month: 'Nov', year: '2026', hour: '07:00', status: 'urgent', cy: 'NE',
      title: 'Le Chef de l’Etat reçoit des délégations', desc: 'Le Général a accordé, mercredi 25 novembre 2026, une audience.' },
  ], MAINTENANT);
  assert.strictEqual(jour(rabat._ts), '2026-12-05');
  assert.strictEqual(rabat.day + rabat.month, '05Dec');
  assert.strictEqual(rabat.status, 'planifie', 'un événement à venir n’est jamais « achevé »');
  assert.strictEqual(rabat.hour, '', 'l’heure de parution n’est pas l’heure de l’événement');
  assert.strictEqual(sansDate._ts, pub, 'sans date écrite, rien n’est deviné');
  assert.strictEqual(passe.status, 'acheve');
  assert.strictEqual(jour(passe._ts), '2026-11-25');
});

test('« urgent » ne vaut pas pour un événement dans plus de trois jours', () => {
  const { agendaAJour } = monter();
  const [gamou] = agendaAJour([{ id: 'g', _detecteAuto: true, _ts: MAINTENANT - 3600000, status: 'urgent', cy: 'SN', day: '27', month: 'Nov', year: '2026',
    title: 'Gamou de Médina Niassène (9 janvier) : face à 34 cas de diphtérie, le préfet renforce les mesures', desc: '' }], MAINTENANT);
  assert.strictEqual(jour(gamou._ts), '2027-01-09');
  assert.strictEqual(gamou.status, 'planifie');
});

test('l’agent et le Flux ne donnent pas deux lignes pour le même article', () => {
  const { agendaAJour } = monter();
  const titre = 'Côte d’Ivoire : festival de Massala du 27 au 29 décembre';
  const l = agendaAJour([
    { id: 'f', _detecteAuto: true, _ts: MAINTENANT, status: 'planifie', cy: 'CI', title: titre, desc: '', surl: 'https://www.koaci.com/a' },
    { id: 'agent-x', _detecteAuto: true, _agent: true, _ts: Date.UTC(2026, 11, 27, 12), _finMs: Date.UTC(2026, 11, 29, 12), status: 'planifie', cy: 'CI', title: titre, desc: '', surl: 'https://www.koaci.com/a' },
  ], MAINTENANT);
  assert.strictEqual(l.length, 1);
});

test('le module Agenda lit la même liste que Louis, agent compris', () => {
  const rendu = tranche('async function renderAgenda() {', 'function ligneAgendaHtml(');
  assert.match(rendu, /await agendaComplet\(\)/);
  assert.match(tranche('async function agendaComplet() {', 'function agendaAJour('), /agendaAgent\(\)/);
  // Les exports ne passent pas par agendaAJour : ils restent tels quels.
  assert.doesNotMatch(tranche('function getExportAgenda() {', 'function getExportSources()'), /agendaAJour/);
});

test('un événement à venir n’affiche pas « −1H »', () => {
  const ligne = tranche('function ligneAgendaHtml(', '// ── Vue Calendrier');
  assert.match(ligne, /ageHFresh >= 0 && ageHFresh < 24/);
  assert.match(ligne, /e\._agent \? null/);
});

test('une fête, un jour, une seule ligne (Noël, Korité)', () => {
  const nomPays = (cy) => cy;
  const debut = Date.UTC(2026, 11, 20), fin = Date.UTC(2027, 2, 15);
  const off = [
    ...['CI', 'SN', 'ML'].map((cy) => ({ date: '2026-12-25', cy, titre: 'Christmas Day', titreEn: 'Christmas Day' })),
    { date: '2027-03-09', cy: 'ML', titre: 'Korité (Roughly Date)', titreEn: 'Korité (Roughly Date)' },
  ];
  const calc = C.evenementsCalendrier(debut, fin, { lang: 'fr', paysConnus: ['CI', 'SN', 'ML', 'MU', 'EG'], feriesOfficiels: off, nomPays });
  const feries = C.feriesVersAgenda(off, 'fr', nomPays);
  const l = C.fusionnerCalendrier(calc, feries, 'fr', nomPays);
  const noel = l.filter((e) => /^Noël/.test(e.title) && jour(e._ts) === '2026-12-25');
  assert.strictEqual(noel.length, 1, 'une ligne Noël, pas deux');
  assert.deepStrictEqual([...noel[0]._pays].sort(), ['CI', 'ML', 'MU', 'SN']);
  const fitr = l.filter((e) => /Korité/.test(e.title));
  assert.strictEqual(fitr.length, 1);
  assert.ok(fitr[0]._pays.includes('ML') && fitr[0]._pays.length > 1);
  assert.match(fitr[0].desc, /Date officielle publiée pour : ML/);
});

test('l’Égypte ne fête pas Noël le 25 décembre ; Achoura n’est pas le nouvel an', () => {
  const l = C.evenementsCalendrier(Date.UTC(2026, 11, 20), Date.UTC(2026, 11, 30), { lang: 'fr', paysConnus: ['EG', 'MU'], feriesOfficiels: [] });
  const noel = l.find((e) => /^Noël/.test(e.title));
  assert.deepStrictEqual(noel._pays, ['MU']);
  const src = require('node:fs').readFileSync(require.resolve('../../web/js/calendrier-foules.js'), 'utf8');
  assert.doesNotMatch(src, /Fête du nouvel an musulman/);
});

test('un jour férié s’affiche dans la langue de l’interface, jamais en amharique ou en portugais', () => {
  const f = (titre, titreEn, cy, date) => C.titreFerie({ titre, titreEn, cy, date: date || '2027-01-19' }, 'fr');
  assert.strictEqual(f('ጥምቀት (Epiphany (Orthodox))', 'Epiphany (Orthodox)', 'ET'), 'Timkat (Épiphanie orthodoxe)');
  assert.strictEqual(f('Dia do Heroi Nacional (Heroes\'s Day)', 'Heroes\'s Day', 'MZ'), 'Journée des héros');
  assert.strictEqual(f('عيد الثورة 25 يناير (Revolution Day 2011 / National Police Day)', 'Revolution Day 2011 / National Police Day', 'EG'), 'Fête de la Révolution du 25 janvier et de la Police');
  assert.strictEqual(f('Easter Saturday (Holy Saturday)', 'Holy Saturday', 'ZW'), 'Samedi saint');
  assert.strictEqual(f('Dia da Libertação (Ponte) (Liberation Day (Ponte))', 'Liberation Day (Ponte)', 'AO'), 'Pont : Fête de la Libération');
  assert.strictEqual(f('Korité (Roughly Date)', 'Korité (Roughly Date)', 'ML'), 'Aïd el-Fitr (Korité) (date estimée)');
  // Un pays francophone garde son nom local, en français.
  assert.strictEqual(f('Journée de la Souveraineté du Peuple (People\'s Sovereignty Day)', 'Inconnu', 'BJ'), 'Journée de la Souveraineté du Peuple');
  // Le second jour n'est pas « Jour de l'an » une seconde fois.
  assert.strictEqual(f('New Year\'s Day', 'New Year\'s Day', 'RW', '2027-01-02'), 'Lendemain du jour de l\'an');
  assert.strictEqual(C.titreFerie({ titre: 'Boxing Day', titreEn: 'Boxing Day', cy: 'NG', date: '2026-12-28' }, 'en'), 'Boxing Day (substitute day)');
});

test('une date se lit sans glisser d’une année, et un lieu n’est pas une date', () => {
  const pub = Date.UTC(2026, 10, 26, 10);
  assert.strictEqual(jour(C.dateAnnoncee('Retour sur la cérémonie du 10 novembre', pub).debutMs), '2026-11-10');
  assert.strictEqual(jour(C.dateAnnoncee('Le concert aura lieu le 5 janvier', Date.UTC(2026, 11, 28)).debutMs), '2027-01-05');
  const r = C.dateAnnoncee('Biennale du 19 novembre au 19 décembre 2026', pub);
  assert.deepStrictEqual([jour(r.debutMs), jour(r.finMs)], ['2026-11-19', '2026-12-19']);
  assert.strictEqual(C.dateAnnoncee('Le stade du 1er mai de Boké est-il prêt ?', pub), null);
  assert.strictEqual(C.statutParDate(Date.UTC(2026, 11, 5, 12), Date.UTC(2026, 11, 5, 12), Date.UTC(2026, 11, 5, 18), 'planifie'), 'en-cours');
  assert.strictEqual(C.statutParDate(Date.UTC(2026, 11, 5, 12), null, Date.UTC(2026, 11, 6, 1), 'urgent'), 'acheve');
});

test('l’agenda de l’agent garde un événement de plusieurs jours jusqu’à son dernier jour', () => {
  const f = tranche('function agendaAgentVersEntree(', '// Revue de l');
  assert.match(f, /fin < Date\.now\(\) - 86400000/);
  assert.match(f, /_finMs: fin/);
  assert.ok(HTML.includes('SentiqCalendrier.fusionnerCalendrier('));
});
