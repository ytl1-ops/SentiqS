// Tri par colonne du tableau des Alertes et chronologie 30 jours de la fiche
// pays — 27/11/2026. Deux éléments repris du prototype SentiqS 2 (dépôt
// ytl1-ops/SentiqS-2), à la demande de YORO. Les tests exercent le vrai code
// de la page, extrait du fichier de production.
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche, bac, exposer } = require('./_bac.js');

const TRI = tranche('// TRI DU TABLEAU DES ALERTES', 'async function renderAlertTable(scores) {');
const CHRONO = tranche("// CHRONOLOGIE 30 JOURS D'UN PAYS", '// FIN CHRONOLOGIE 30 JOURS');
const RENDU_TABLE = tranche('async function renderAlertTable(scores) {', "\n  return `<thead>");

test('les tranches contiennent bien le code visé (piège récurrent de tranche())', () => {
  for (const nom of ['function trierScoresTableau', 'async function trierTableauAlertes', 'const RANG_NIVEAU_TRI']) assert.ok(TRI.includes(nom), nom);
  for (const nom of ['function chronologie30Jours', 'async function faitsPays30Jours', 'function chronologie30JoursHtml', 'async function remplirChronologiePays']) assert.ok(CHRONO.includes(nom), nom);
});

// ── Tri ─────────────────────────────────────────────────────────────────────
function bacTri() {
  return exposer(bac(TRI), 'trierScoresTableau', 'sensInitialTri', 'COLONNES_TRI_ALERTES');
}
const NOMS = { CI: "Côte d'Ivoire", ML: 'Mali', BJ: 'Bénin', SN: 'Sénégal' };
const CAP = { CI: 'Yamoussoukro', ML: 'Bamako', BJ: 'Porto-Novo', SN: 'Dakar' };
const MAJ = { CI: 3000, ML: 1000, BJ: null, SN: 2000 };
const CTX = { nom: (cy) => NOMS[cy], capitale: (cy) => CAP[cy], majTs: (cy) => MAJ[cy] };
const SCORES = [
  { cy: 'ML', key: 'rouge', total100: 88, events: [1, 2, 3] },
  { cy: 'CI', key: 'jaune', total100: 30, events: [1] },
  { cy: 'SN', key: 'jaune', total100: 22, events: [] },
  { cy: 'BJ', key: 'orange', total100: 55, events: [1, 2, 3, 4, 5] },
];
const ordre = (l) => l.map((s) => s.cy).join(' ');

test('le tri suit la colonne et le sens demandés', () => {
  const t = bacTri();
  assert.strictEqual(ordre(t.trierScoresTableau(SCORES, { col: 'score', sens: 'desc' }, CTX)), 'ML BJ CI SN');
  assert.strictEqual(ordre(t.trierScoresTableau(SCORES, { col: 'score', sens: 'asc' }, CTX)), 'SN CI BJ ML');
  // Alphabétique sans tenir compte des accents : Bénin avant Côte d'Ivoire.
  assert.strictEqual(ordre(t.trierScoresTableau(SCORES, { col: 'pays', sens: 'asc' }, CTX)), 'BJ CI ML SN');
  assert.strictEqual(ordre(t.trierScoresTableau(SCORES, { col: 'capitale', sens: 'asc' }, CTX)), 'ML SN BJ CI');
  assert.strictEqual(ordre(t.trierScoresTableau(SCORES, { col: 'incidents', sens: 'desc' }, CTX)), 'BJ ML CI SN');
});

test('le niveau se trie par gravité, pas par ordre alphabétique, et une égalité se départage par le score', () => {
  const t = bacTri();
  // alphabétique donnerait jaune, jaune, orange, rouge en ordre croissant : ici aussi,
  // mais en décroissant rouge > orange > jaune, et CI (30) avant SN (22).
  assert.strictEqual(ordre(t.trierScoresTableau(SCORES, { col: 'niveau', sens: 'desc' }, CTX)), 'ML BJ CI SN');
  const marronRouge = [{ cy: 'CI', key: 'marron', total100: 60, events: [] }, { cy: 'SN', key: 'rouge', total100: 61, events: [] }, { cy: 'ML', key: 'vert', total100: 5, events: [] }];
  assert.strictEqual(ordre(t.trierScoresTableau(marronRouge, { col: 'niveau', sens: 'asc' }, CTX)), 'ML CI SN');
});

test('un pays sans aucune actu captée est le plus ancien de la colonne MAJ', () => {
  const t = bacTri();
  assert.strictEqual(ordre(t.trierScoresTableau(SCORES, { col: 'maj', sens: 'desc' }, CTX)), 'CI SN ML BJ');
  assert.strictEqual(ordre(t.trierScoresTableau(SCORES, { col: 'maj', sens: 'asc' }, CTX)), 'BJ ML SN CI');
});

test('le tri ne réordonne jamais la liste reçue, et une colonne inconnue retombe sur le score', () => {
  const t = bacTri();
  const copie = SCORES.slice();
  t.trierScoresTableau(SCORES, { col: 'pays', sens: 'asc' }, CTX);
  assert.deepStrictEqual(SCORES, copie);
  assert.strictEqual(ordre(t.trierScoresTableau(SCORES, { col: 'mesures', sens: 'asc' }, CTX)), 'SN CI BJ ML');
  assert.strictEqual(t.sensInitialTri('pays'), 'asc');
  assert.strictEqual(t.sensInitialTri('score'), 'desc');
});

test('le tableau trie par défaut au score décroissant et expose le tri aux lecteurs d\'écran', () => {
  assert.match(TRI, /let TRI_TABLEAU_ALERTES = \{ col: 'score', sens: 'desc' \};/);
  assert.ok(RENDU_TABLE.includes('scores = trierScoresTableau(scores, tri, contexteTriAlertes());'));
  assert.ok(RENDU_TABLE.includes('aria-sort='));
  assert.ok(RENDU_TABLE.includes('<button type="button" class="tri-col'));
  // Les deux colonnes de mesures ne sont pas des critères de tri.
  assert.ok(RENDU_TABLE.includes("[null,'Mesure clé expatriés']"));
});

// ── Chronologie ─────────────────────────────────────────────────────────────
function bacChrono() {
  return exposer(bac(TRI, CHRONO), 'chronologie30Jours', 'CHRONO_PAYS_JOURS');
}
const MAINTENANT = Date.UTC(2026, 10, 27, 9);
const J = (jour, h = 10) => Date.parse(jour + 'T' + String(h).padStart(2, '0') + ':00:00Z');

test('trente jours exactement, se terminant aujourd\'hui, un jour sans relevé reste vide', () => {
  const c = bacChrono().chronologie30Jours([['2026-11-20', 'orange'], ['2026-11-22', 'orange']], [], MAINTENANT);
  assert.strictEqual(c.jours.length, 30);
  assert.strictEqual(c.debut, '2026-10-29');
  assert.strictEqual(c.fin, '2026-11-27');
  const jour = (j) => c.jours.find((x) => x.jour === j);
  assert.strictEqual(jour('2026-11-20').niveau, 'orange');
  // Le 21 n'a pas de relevé : il n'est pas comblé par ses voisins.
  assert.strictEqual(jour('2026-11-21').niveau, null);
  assert.strictEqual(c.nbReleves, 2);
  assert.strictEqual(c.nbChangements, 0);
});

test('un changement de niveau est daté du jour où il est relevé, y compris le premier jour de la fenêtre', () => {
  const serie = [['2026-10-20', 'jaune'], ['2026-10-29', 'orange'], ['2026-11-05', 'orange'], ['2026-11-10', 'marron'], ['2026-11-12', 'orange']];
  const c = bacChrono().chronologie30Jours(serie, [], MAINTENANT);
  const chg = c.jours.filter((j) => j.changement).map((j) => j.jour + ':' + j.changement.de + '>' + j.changement.a);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(chg)), ['2026-10-29:jaune>orange', '2026-11-10:orange>marron', '2026-11-12:marron>orange']);
  assert.strictEqual(c.nbChangements, 3);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.comptes)), { orange: 3, marron: 1 });
});

test('seuls les faits critiques et élevés de la fenêtre entrent, une même adresse une seule fois, à sa première date', () => {
  const faits = [
    { titre: 'Attaque à Kong', niveau: 'crit', publieMs: J('2026-11-25'), url: 'https://a.ci/1' },
    { titre: 'Attaque à Kong (reprise)', niveau: 'crit', publieMs: J('2026-11-25', 12), url: 'https://a.ci/1' },
    { titre: 'Grève des transporteurs', niveau: 'high', publieMs: J('2026-11-24') },
    { titre: 'Conseil des ministres', niveau: 'mod', publieMs: J('2026-11-24') },
    { titre: 'Fait trop ancien', niveau: 'crit', publieMs: J('2026-10-01') },
    { titre: 'Fait daté du futur', niveau: 'crit', publieMs: MAINTENANT + 3600000 },
  ];
  const c = bacChrono().chronologie30Jours([], faits, MAINTENANT);
  assert.strictEqual(c.nbFaits, 2);
  const titres = c.jours.flatMap((j) => j.faits.map((f) => j.jour + ' ' + f.titre));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(titres)), ['2026-11-24 Grève des transporteurs', '2026-11-25 Attaque à Kong']);
});

test('la chronologie ne lit ni n\'écrit le niveau : aucun appel au calcul d\'alerte', () => {
  for (const interdit of ['calcAlertScore', 'getLiveAlertEvents', 'LAST_NIV_PAR_PAYS', 'ALERTE_EVENTS']) {
    assert.ok(!CHRONO.includes(interdit), interdit);
  }
});

test('la fiche pays porte la chronologie et la remplit après affichage', () => {
  const i = HTML.indexOf('async function ouvrirVuePays(cy) {');
  const corps = HTML.slice(i, HTML.indexOf('\nasync function ', i + 10));
  assert.ok(corps.includes("section('Chronologie 30 jours', 'ti-timeline'"));
  assert.ok(corps.includes('id="chrono30-${cy}"'));
  assert.ok(corps.indexOf('remplirChronologiePays(cy);') > corps.indexOf('document.body.appendChild(overlay);'));
  // L'archive se charge à la demande : chargerHistorique rend sa promesse.
  assert.match(HTML, /if \(historiqueDemande\) return historiqueDemande;\n  historiqueDemande = fetch\('historique\/serie\.json'/);
});
