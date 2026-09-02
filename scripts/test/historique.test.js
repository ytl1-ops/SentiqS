// Archive des niveaux, jour par jour — voir scripts/lib/historique.js.
//
// Ce module est le seul du dépôt à écrire sur disque : les tests travaillent
// donc dans un répertoire temporaire, jamais dans data/ ni dans web/.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const H = require('../lib/historique.js');

function bacTemporaire() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sentiqs-hist-'));
}

const PAYS = [
  { code: 'ML', niveau: 'rouge',  total: 15.234, verifies: 12, facteurs: 2, live: 1.2, historique: 0.03 },
  { code: 'BF', niveau: 'marron', total: 9.5,    verifies: 8,  facteurs: 1, live: 0.5, historique: 0 },
];

test('construireInstantane arrondit au centieme et trie par code', () => {
  const i = H.construireInstantane({ jour: '2026-09-02', commit: 'abc1234', pays: PAYS });
  assert.deepStrictEqual(i.pays.map((p) => p.code), ['BF', 'ML']);
  assert.strictEqual(i.pays[1].total, 15.23);
  assert.strictEqual(i.commit, 'abc1234');
});

test('construireInstantane refuse un jour mal formé', () => {
  assert.throws(() => H.construireInstantane({ jour: '02/09/2026', pays: PAYS }), /AAAA-MM-JJ/);
});

test('construireInstantane écarte le pseudo-pays « all » et les lignes vides', () => {
  const i = H.construireInstantane({
    jour: '2026-09-02',
    pays: [...PAYS, { code: 'all', niveau: 'vert' }, null, { niveau: 'rouge' }],
  });
  assert.deepStrictEqual(i.pays.map((p) => p.code), ['BF', 'ML']);
});

test('un niveau inconnu retombe sur vert plutot que de polluer la serie', () => {
  const i = H.construireInstantane({ jour: '2026-09-02', pays: [{ code: 'ML', niveau: 'ecarlate' }] });
  assert.strictEqual(i.pays[0].niveau, 'vert');
});

test('ecrireInstantane n ecrit qu une fois par jour', () => {
  const bac = bacTemporaire();
  const i = H.construireInstantane({ jour: '2026-09-02', pays: PAYS });
  const premier = H.ecrireInstantane(bac, i);
  assert.ok(premier, 'le premier passage de la journée doit écrire');

  // Le job tourne 5 a 15 fois par jour : le deuxieme passage ne doit RIEN
  // reecrire, sinon l'archive suit la collecte au lieu de suivre les jours.
  const modifie = H.construireInstantane({
    jour: '2026-09-02', pays: [{ code: 'ML', niveau: 'vert', total: 0 }],
  });
  assert.strictEqual(H.ecrireInstantane(bac, modifie), null);

  const relu = JSON.parse(fs.readFileSync(premier, 'utf8'));
  assert.strictEqual(relu.pays.find((p) => p.code === 'ML').niveau, 'rouge',
    'le premier instantané du jour fait foi, les suivants ne l\'écrasent pas');
});

test('lireSerie rend les jours dans l ordre et survit a un fichier corrompu', () => {
  const bac = bacTemporaire();
  for (const j of ['2026-09-03', '2026-09-01', '2026-09-02']) {
    H.ecrireInstantane(bac, H.construireInstantane({ jour: j, pays: PAYS }));
  }
  fs.writeFileSync(path.join(bac, '2026-09-04.json'), '{ ceci n est pas du json');
  fs.writeFileSync(path.join(bac, 'notes.txt'), 'ignore-moi');

  const serie = H.lireSerie(bac);
  assert.deepStrictEqual(serie.map((i) => i.jour), ['2026-09-01', '2026-09-02', '2026-09-03']);
});

test('lireSerie ne casse pas quand l archive n existe pas encore', () => {
  assert.deepStrictEqual(H.lireSerie(path.join(bacTemporaire(), 'jamais-cree')), []);
});

test('construireSerie ne garde que la fenetre demandee', () => {
  const instantanes = [];
  for (let d = 1; d <= 10; d++) {
    instantanes.push(H.construireInstantane({
      jour: '2026-09-' + String(d).padStart(2, '0'),
      pays: [{ code: 'ML', niveau: 'orange' }],
    }));
  }
  const s = H.construireSerie(instantanes, 4);
  assert.deepStrictEqual(s.jours, ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10']);
  assert.strictEqual(s.pays.ML.length, 4);
  assert.deepStrictEqual(s.pays.ML[0], ['2026-09-07', 'orange']);
});

test('tendance compte les crans gagnes, pas les points', () => {
  const s = H.construireSerie([
    H.construireInstantane({ jour: '2026-08-01', pays: [{ code: 'ML', niveau: 'jaune' }] }),
    H.construireInstantane({ jour: '2026-08-15', pays: [{ code: 'ML', niveau: 'orange' }] }),
    H.construireInstantane({ jour: '2026-09-01', pays: [{ code: 'ML', niveau: 'rouge' }] }),
  ]);
  const t = H.tendance(s, 'ML');
  assert.strictEqual(t.crans, 3, 'jaune -> rouge = trois crans');
  assert.strictEqual(t.de, 'jaune');
  assert.strictEqual(t.vers, 'rouge');
});

test('tendance refuse de conclure sur un seul point', () => {
  // Le piege qu on veut interdire : afficher « stable » ou « en hausse » le
  // premier jour, alors qu on n a rien a comparer.
  const s = H.construireSerie([
    H.construireInstantane({ jour: '2026-09-01', pays: [{ code: 'ML', niveau: 'rouge' }] }),
  ]);
  assert.strictEqual(H.tendance(s, 'ML'), null);
  assert.strictEqual(H.tendance(s, 'ZZ'), null);
});

test('jourUTC ne depend pas du fuseau de la machine', () => {
  assert.strictEqual(H.jourUTC(Date.parse('2026-09-02T23:30:00Z')), '2026-09-02');
  assert.strictEqual(H.jourUTC(Date.parse('2026-09-03T00:30:00Z')), '2026-09-03');
});

// ── Restitution de la trajectoire dans l'interface ─────────────────────────
//
// Le code teste ici est celui de web/SentiqS_Web.html, decoupe par marqueurs
// (voir scripts/test/_bac.js). La tranche a ete verifiee comme contenant bien
// chargerHistorique, tendancePays et chipTendance.
const vm = require('node:vm');
const { tranche, bac, exposer } = require('./_bac.js');

function interface_() {
  const ctx = bac(tranche('// ── TRAJECTOIRE', 'function setDashCartoMode'));
  return exposer(ctx, 'chipTendance', 'tendancePays', 'NIV_LIBELLE');
}

// HISTORIQUE_SERIE est declare par `let` dans la tranche : lui affecter une
// valeur depuis l'objet de contexte ne toucherait pas la liaison interne. Il
// faut ecrire dedans, comme le fetch le fait dans le navigateur.
function poserSerie(ctx, serie) {
  vm.runInContext('HISTORIQUE_SERIE = ' + JSON.stringify(serie) + ';', ctx);
  return ctx;
}

test('aucune fleche tant que l archive n existe pas', () => {
  // Le cas du premier jour, et celui d'un visiteur hors ligne. Une fleche
  // affichee sans serie serait une affirmation sans mesure.
  const ctx = interface_();
  assert.strictEqual(ctx.chipTendance('ML'), '');
});

test('aucune fleche quand le niveau n a pas bouge', () => {
  const ctx = interface_();
  poserSerie(ctx, { pays: { ML: [['2026-08-01', 'marron'], ['2026-09-01', 'marron']] } });
  assert.strictEqual(ctx.chipTendance('ML'), '');
});

test('une aggravation sort une fleche montante et le nombre de crans', () => {
  const ctx = interface_();
  poserSerie(ctx, { pays: { ML: [['2026-08-01', 'jaune'], ['2026-09-01', 'marron']] } });
  const html = ctx.chipTendance('ML');
  assert.match(html, /↗/, 'la fleche doit monter');
  assert.match(html, />↗2</, 'deux crans, pas deux releves');
  assert.match(html, /aggravation de 2 crans/);
  assert.match(html, /jaune le 2026-08-01/);
});

test('une amelioration sort une fleche descendante', () => {
  const ctx = interface_();
  poserSerie(ctx, { pays: { ML: [['2026-08-01', 'rouge'], ['2026-09-01', 'orange']] } });
  const html = ctx.chipTendance('ML');
  assert.match(html, /↘/);
  assert.match(html, /amelioration de 2 crans/);
  assert.doesNotMatch(html, /-2/, 'le signe est porte par la fleche, pas par le nombre');
});

test('la fleche compte les crans, jamais le nombre de releves', () => {
  // Ce test a d'abord ete ecrit avec deux releves et deux crans : il passait
  // donc AUSSI sur une version qui affichait le nombre de releves, verifie
  // par mutation. Le depot a deja paye deux fois ce piege-la
  // (voir CLAUDE.md). Il faut donc que les deux nombres different.
  const ctx = interface_();
  poserSerie(ctx, { pays: { ML: [
    ['2026-09-01', 'jaune'], ['2026-09-02', 'jaune'],
    ['2026-09-03', 'jaune'], ['2026-09-04', 'orange'],
  ] } });
  const html = ctx.chipTendance('ML');
  assert.match(html, />↗1</, 'un cran, alors que la serie compte quatre releves');
  assert.doesNotMatch(html, />↗4</);
});

test('une serie longue mais immobile n affiche rien', () => {
  const ctx = interface_();
  const points = [];
  for (let d = 1; d <= 10; d++) points.push(['2026-09-' + String(d).padStart(2, '0'), 'orange']);
  poserSerie(ctx, { pays: { ML: points } });
  assert.strictEqual(ctx.chipTendance('ML'), '');
});

test('l interface et le job lisent la meme serie de la meme facon', () => {
  // Une divergence entre les deux serait invisible a l oeil et fausserait la
  // trajectoire montree a l utilisateur.
  const serie = H.construireSerie([
    H.construireInstantane({ jour: '2026-08-01', pays: [{ code: 'ML', niveau: 'orange' }] }),
    H.construireInstantane({ jour: '2026-09-01', pays: [{ code: 'ML', niveau: 'rouge' }] }),
  ]);
  const ctx = interface_();
  poserSerie(ctx, serie);
  const cote_job = H.tendance(serie, 'ML');
  const cote_interface = ctx.tendancePays('ML');
  assert.deepStrictEqual(cote_interface, cote_job);
});
