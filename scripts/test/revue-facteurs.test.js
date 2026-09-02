// Fraicheur des facteurs structurels — voir ageRevueMois() dans
// web/js/noyau.js et scripts/verifier-datation-incidents.js.
//
// Ce que ces tests protegent : les 38 facteurs de FACTEURS_SPECIAUX pesent
// leur bonus PLEIN et ne portent aucune date. Le code ne retranche rien —
// dater ces facteurs demande un analyste, et retirer du poids a partir de
// dates qu'on n'a pas produirait un faux negatif, l'erreur la plus chere de
// cet outil. Il rend seulement la dette visible, et empeche qu'elle grossisse.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { tranche, bac, exposer, HTML } = require('./_bac.js');
const noyau = require('../../web/js/noyau.js');

const T = Date.parse('2026-09-02T00:00:00Z');

test('ageRevueMois compte les mois, pas les annees', () => {
  assert.strictEqual(noyau.ageRevueMois('2026-03', T), 6);
  assert.strictEqual(noyau.ageRevueMois('2025-09', T), 12);
  assert.strictEqual(noyau.ageRevueMois('2026-09', T), 0);
});

test('ageRevueMois rend null sur ce qu il ne sait pas lire', () => {
  // Le format libre est deja la regle des dates d incident ('Juin 2026',
  // '2025-2026'...). Ici on impose AAAA-MM : un champ de revue approximatif
  // ne servirait a rien, c est une date de decision.
  for (const mauvais of [undefined, null, '', 'mars 2026', '2026', '2026-13', '2026-00', 42, {}]) {
    assert.strictEqual(noyau.ageRevueMois(mauvais, T), null, 'refuse : ' + JSON.stringify(mauvais));
  }
});

test('une date de revue future sort un age negatif, jamais null', () => {
  // La distinction compte : null veut dire « personne n a date ce facteur »,
  // negatif veut dire « quelqu un a saisi une date impossible ». La CI doit
  // refuser le second sans le confondre avec le premier.
  assert.strictEqual(noyau.ageRevueMois('2026-12', T), -3);
  assert.ok(noyau.ageRevueMois('2026-12', T) < 0);
});

test('revueDepassee traite l absence de date comme une revue perimee', () => {
  assert.strictEqual(noyau.revueDepassee(undefined, T), true);
  assert.strictEqual(noyau.revueDepassee('2026-01', T), true);
  assert.strictEqual(noyau.revueDepassee('2026-08', T), false);
  assert.strictEqual(noyau.revueDepassee('2026-03', T), false, 'six mois pile reste dans les clous');
});

// ── Restitution ────────────────────────────────────────────────────────────
function interfaceFacteurs() {
  // La tranche va jusqu'au bloc suivant pour englober htmlFacteurs, qui est
  // ce que marqueRevue sert reellement. `facteurs` est fourni vide : on teste
  // la marque, pas la liste.
  const t = tranche('  // La date de revue d\'un facteur structurel', '  const htmlAgenda');
  const ctx = bac('const facteurs = [];', t);
  return exposer(ctx, 'marqueRevue');
}

test('la tranche testee contient bien le rendu des facteurs', () => {
  // Garde-fou : ce depot a deja eu deux tranches mal bornees dont les tests
  // passaient en n examinant rien (voir CLAUDE.md).
  const t = tranche('  // La date de revue d\'un facteur structurel', '  const htmlAgenda');
  assert.match(t, /const marqueRevue/);
  assert.match(t, /const htmlFacteurs/);
});

test('un facteur sans date porte la mention « non date »', () => {
  const ctx = interfaceFacteurs();
  const html = ctx.marqueRevue({ label: 'x', bonus: 1 });
  assert.match(html, /non dat/);
  assert.match(html, /pese son bonus plein/, 'l\'infobulle doit dire pourquoi c\'est un probleme');
});

test('un facteur recemment revu affiche son age et reste discret', () => {
  const ctx = interfaceFacteurs();
  const recent = new Date();
  const revu = recent.getUTCFullYear() + '-' + String(recent.getUTCMonth() + 1).padStart(2, '0');
  const html = ctx.marqueRevue({ label: 'x', bonus: 1, revu });
  assert.match(html, /revu ce mois-ci/);
  assert.doesNotMatch(html, /var\(--a\)/, 'pas de couleur d\'alerte sur un facteur a jour');
});

test('un facteur perime est signale en couleur d alerte', () => {
  const ctx = interfaceFacteurs();
  const html = ctx.marqueRevue({ label: 'x', bonus: 1, revu: '2020-01' });
  assert.match(html, /revu il y a \d+ mois/);
  assert.match(html, /var\(--a\)/, 'au-dela de six mois, le facteur doit se voir');
});

test('le poids des facteurs n est PAS touche par la date de revue', () => {
  // Le point le plus important de ce lot. Une premiere idee etait de faire
  // decroitre le bonus d un facteur non revu ; sur ce produit, un faux
  // negatif coute plus cher qu une donnee perimee, et aucune date n existe
  // pour calibrer la decroissance. Si quelqu un branche un jour ageRevueMois
  // sur le calcul du score, ce test doit tomber et forcer la mesure d abord.
  const bloc = tranche('  const specials       = FACTEURS_SPECIAUX[cy] || [];', '  const baseScoreLive');
  assert.doesNotMatch(bloc, /ageRevueMois|revueDepassee|\.revu\b/,
    'le calcul du score ne doit dependre d\'aucune date de revue tant qu\'aucune mesure ne l\'a valide');
});

test('les 38 facteurs actuels restent sous le cliquet de la CI', () => {
  // Miroir du controle de scripts/verifier-datation-incidents.js, pour que la
  // suite de tests le dise aussi, et pas seulement la CI.
  const ctx = {};
  vm.createContext(ctx);
  const i = HTML.indexOf('const FACTEURS_SPECIAUX = {');
  const j = HTML.indexOf('\n};', i);
  vm.runInContext(HTML.slice(i, j) + '\n};\nthis.F = FACTEURS_SPECIAUX;', ctx);
  const tous = Object.values(ctx.F).reduce((n, l) => n.concat(l), []);
  const nonDates = tous.filter((f) => noyau.ageRevueMois(f.revu) === null).length;
  assert.ok(nonDates <= 38, nonDates + ' facteurs non dates, plafond 38 — voir le cliquet dans la CI');
  assert.ok(tous.every((f) => noyau.ageRevueMois(f.revu) === null || noyau.ageRevueMois(f.revu) >= 0),
    'aucune date de revue ne doit etre dans le futur');
});
