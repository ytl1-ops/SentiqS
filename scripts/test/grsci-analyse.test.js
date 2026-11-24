// Présentation 1 : une analyse après chaque actu. Demande de YORO du
// 24/11/2026 : « Présentation 1, réalise des analyses après chaque actu
// publiées ». Avant, seuls les quelques faits rédigés portaient un repère
// (« Enjeux sûreté ») ; les fiches n'avaient que le titre, l'extrait et la
// source. L'analyse n'invente rien : la lecture sort des données du mois, les
// implications et les points à surveiller sont des repères par famille.
const test = require('node:test');
const assert = require('node:assert');
const g = require('../lib/rapport-grsci.js');
const r = require('../lib/redaction-grsci.js');
const fg = require('../lib/faits-grsci.js');

const JOUR = 86400000;
const T0 = Date.parse('2026-11-20T08:00:00Z');
let n = 0;
const fait = (titre, joursAvant, extra) => Object.assign({
  titre, niveau: 'crit', cat: 'securite', source: 'Source ' + (++n), url: 'https://media' + n + '.example/a',
  publieMs: T0 - joursAvant * JOUR, cotation: 'probable', langue: 'fr',
}, extra || {});

class FauxPptx {
  constructor() { this.slides = []; }
  addSlide() {
    const s = { textes: [] };
    s.addText = (t) => s.textes.push(typeof t === 'string' ? t : t.map((x) => x.text).join(''));
    s.addImage = () => {}; s.addShape = () => {};
    this.slides.push(s);
    return s;
  }
}
const EM = { identite: 'SentiqS', signature: '', logo: null, logoRatio: null };

test('chaque fiche et chaque fait rédigé du PowerPoint porte son analyse', () => {
  const titres = ['Attaque d\'un poste à Ménaka', 'Embuscade sur l\'axe Gao-Ansongo', 'Grève des transporteurs à Bamako',
    'Accident de car à Ségou, 8 morts', 'Le gouvernement adopte un projet de loi', 'Hausse du prix du pain'];
  const cumul = { pays: { CI: titres.map((t, i) => fait(t, i)), ML: titres.map((t, i) => fait(t + ' (Mali)', i)) } };
  const ci = { cy: 'CI', nom: "Côte d'Ivoire", faits: fg.faitsDuMois(cumul, 'CI', "Côte d'Ivoire") };
  const ml = { cy: 'ML', nom: 'Mali', faits: fg.faitsDuMois(cumul, 'ML', 'Mali') };
  const p = g.construire(FauxPptx, { jour: '2026-11-24', ci, regionaux: [ml], emetteur: EM });
  const textes = p.slides.flatMap((s) => s.textes).join('\n');
  // Une analyse par actu : fiches (« Analyse : ») et rédigés (« Analyse sûreté »).
  const nbFiches = (textes.match(/Analyse : /g) || []).length;
  const nbRediges = (textes.match(/Analyse sûreté/g) || []).length;
  assert.strictEqual(nbFiches + nbRediges, ci.faits.length + ml.faits.length);
  assert.ok(nbFiches > 0 && nbRediges > 0);
  assert.ok(textes.includes('À surveiller : '));
});

test('la lecture situe le fait parmi ceux de même nature, comptés par jour', () => {
  const faits = [fait('Attaque à Djibo', 0), fait('Attaque d\'un convoi près de Kaya', 3), fait('Embuscade à Dori', 3),
    fait('Hommes armés attaquent un village', 6)];
  const a = r.analyserFait(faits[0], faits);
  // Deux faits le même jour (J-3) sont un seul jour : 3e jour distinct, pas 4e.
  assert.match(a.lecture, /3e jour distinct/);
  assert.match(a.lecture, /une série, pas un fait isolé/);
  const premier = r.analyserFait(faits[3], faits);
  assert.match(premier.lecture, /Premier fait de violence armée/);
  assert.match(premier.lecture, /d'autres ont suivi sur 2 jours/);
});

test('deux reprises du même jour ne font pas une série', () => {
  const a = fait('Naufrage sur le lac Togo, 3 morts', 0, { cat: 'humanitaire' });
  const b = fait('Lac Togo : chavirement d\'une pirogue, deux morts', 0, { cat: 'humanitaire', publieMs: T0 - 3600e3 });
  const lecture = r.analyserFait(a, [a, b]).lecture;
  assert.doesNotMatch(lecture, /série/);
  assert.match(lecture, /Premier fait accidentel/);
});

test('recoupement dit tel quel, sans mot de gravité ni niveau', () => {
  const recoupe = fait('Attaque à Djibo', 0, { sources: ['A', 'B'] });
  assert.match(r.analyserFait(recoupe, [recoupe]).lecture, /recoupé par 2 médias distincts/);
  const seul = fait('Attaque à Djibo', 0);
  const l = r.analyserFait(seul, [seul]).lecture;
  assert.match(l, /une seule source, à confirmer/);
  assert.doesNotMatch(l, /gravit|critique|niveau|score/i);
});

test('un fait de contexte ou un sens figuré ne reçoit pas le repère d\'une attaque', () => {
  const cle = (titre) => r.enjeuxSurete({ titre, cat: 'securite' }).cle;
  assert.strictEqual(cle('Burkina Faso : le Parquet fait le point sur les poursuites pour faits de terrorisme'), 'contexte');
  assert.strictEqual(cle('Blanchiment d\'argent et terrorisme : le Mali muscle la surveillance de son secteur financier'), 'contexte');
  assert.notStrictEqual(cle('Semaine du dépistage du VIH : comment elle s\'attaque aux violences'), 'attaque');
  assert.strictEqual(cle('Adiaké : un instituteur tué à la machette par des individus'), 'homicide');
  assert.strictEqual(cle('Kati : trois enfants tués dans un accident'), 'accident');
  assert.strictEqual(cle('Drame à Adzopé : un élève se donne la mort'), 'drame');
  // Les incidents restent des incidents, même avec un mot de contexte.
  assert.strictEqual(cle('Frappe de drone près d\'Agadez : à Moscou, les ministres s\'engagent'), 'attaque');
  assert.strictEqual(cle('Mali : le Jnim attaque les camps de l\'armée à Niono'), 'attaque');
});

test('la récurrence n\'est pas lue pour la politique', () => {
  const faits = [0, 1, 2, 3].map((j) => fait('Le président reçoit l\'opposition', j, { cat: 'politique' }));
  assert.doesNotMatch(r.analyserFait(faits[0], faits).lecture, /jour distinct|série/);
});
