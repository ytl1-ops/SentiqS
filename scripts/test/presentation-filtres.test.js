// Présentation 1 composée dans l'appli, 25/11/2026. YORO : « Revise
// Présentation 1 avec des filtres pays, régional d'un pays, région ouest ou
// est Afrique… pour avoir des options de contenus selon les besoins. »
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Per = require('../../web/js/presentation-perimetre.js');
const g = require('../lib/rapport-grsci.js');
const { construire, SORTIE } = require('../construire-presentation-web.js');

class FauxPptx {
  constructor() { this.slides = []; }
  addSlide() {
    const s = { textes: [], images: [] };
    s.addText = (t) => s.textes.push(typeof t === 'string' ? t : t.map((x) => x.text).join(''));
    s.addImage = (o) => s.images.push(o);
    s.addShape = () => {};
    this.slides.push(s);
    return s;
  }
}
const F = (titre, extra) => Object.assign({ titre, niveau: 'high', cat: 'securite', source: 'Koaci', sources: ['Koaci'], url: 'https://koaci.example/' + encodeURIComponent(titre), publieMs: Date.parse('2026-11-14T08:00:00Z'), cotation: 'probable', extraits: [] }, extra || {});

test('les cinq régions de l’Union africaine couvrent les 54 pays, chacun une fois', () => {
  const ua = Per.REGIONS.filter((r) => r.type === 'ua').flatMap((r) => r.pays);
  assert.strictEqual(ua.length, 54);
  assert.strictEqual(new Set(ua).size, 54);
  assert.deepStrictEqual(Per.region('aes').pays, ['BF', 'ML', 'NE']);
  assert.ok(!Per.region('cedeao').pays.includes('ML'), 'la CEDEAO sans l’AES');
});

test('la zone d’un fait : par sa localité, jamais devinée', () => {
  assert.strictEqual(Per.zoneDuFait('CI', { titre: 'Korhogo : un étudiant porté disparu' }), 'nord');
  assert.strictEqual(Per.zoneDuFait('CI', { titre: 'Bouna : patrouille renforcée' }), 'nord-est');
  assert.strictEqual(Per.zoneDuFait('CI', { titre: 'Inondations à Man' }), 'ouest');
  // Homonymes : « man » anglais, « plateau » de télévision.
  assert.strictEqual(Per.zoneDuFait('CI', { titre: 'Un man arrêté sur le plateau de télévision' }), null);
  // La ville notée par la page ne suffit pas pour un nom ambigu (« Man »
  // relevé dans un article sur l’Allemagne, cumul de novembre 2026).
  assert.strictEqual(Per.zoneDuFait('CI', { titre: 'Visite du président allemand', ville: 'Man' }), null);
  assert.strictEqual(Per.zoneDuFait('CI', { titre: 'Visite officielle', ville: 'Korhogo' }), 'nord');
  assert.strictEqual(Per.zoneDuFait('CI', { titre: 'Conseil des ministres' }), null);
  assert.strictEqual(Per.zoneDuFait('NG', { titre: 'Gunmen kill five in Zamfara' }), 'nord-ouest');
});

const DONNEES = [
  { cy: 'CI', nom: 'Côte d’Ivoire', faits: [F('Korhogo : attaque d’un convoi', { niveau: 'crit' }), F('Abidjan : grève des transporteurs', { cat: 'humanitaire', cotation: 'confirme' }), F('Conseil des ministres du mercredi', { cat: 'politique', cotation: 'non_confirme' })] },
  { cy: 'BF', nom: 'Burkina Faso', faits: [F('Djibo : attaque contre un poste')] },
  { cy: 'GH', nom: 'Ghana', faits: [] },
];

test('un pays et une zone : seuls les faits de la zone, et le rapport dit combien manquent de localité', () => {
  const P = Per.composer(DONNEES, { mode: 'pays', cy: 'CI', zone: 'nord', jour: '2026-11-25' }, g.rubriqueDe);
  assert.strictEqual(P.libelle, 'Côte d’Ivoire — Nord');
  assert.deepStrictEqual(P.principal.d.faits.map((f) => f.titre), ['Korhogo : attaque d’un convoi']);
  assert.strictEqual(P.sansLieu, 1);
  assert.ok(P.criteres.some((c) => /sans localité précise/.test(c)));
  assert.strictEqual(P.groupe, null);
});

test('une région : les pays sans fait sont nommés, jamais montrés comme calmes', () => {
  const P = Per.composer(DONNEES, { mode: 'region', region: 'ouest', principal: 'CI', cotation: 'probable', jour: '2026-11-25' }, g.rubriqueDe);
  assert.strictEqual(P.principal.d.cy, 'CI');
  assert.strictEqual(P.principal.d.faits.length, 2, 'le « Non confirmé » est écarté');
  assert.deepStrictEqual(P.groupe.pays.map((d) => d.cy), ['BF']);
  assert.deepStrictEqual(P.absents, ['Ghana']);
});

test('rubriques et période : filtres appliqués, période réelle sur la couverture', () => {
  const P = Per.composer(DONNEES, { mode: 'pays', cy: 'CI', rubriques: ['humanitaire'], jours: 7, jour: '2026-11-21' }, g.rubriqueDe);
  assert.strictEqual(P.principal.d.faits.length, 0, 'publié le 14, hors des 7 derniers jours au 21');
  assert.strictEqual(P.debut, '2026-11-15');
  assert.strictEqual(g.libellePeriode('2026-11-21', P.debut), 'Période du 15 au 21 novembre 2026');
  assert.strictEqual(g.libellePeriode('2026-11-20'), 'Période du 1er au 20 novembre 2026');
});

test('le générateur suit le périmètre : libellé en couverture, titres du pays, critères au sommaire', () => {
  const P = Per.composer(DONNEES, { mode: 'pays', cy: 'CI', zone: 'nord', jour: '2026-11-25' }, g.rubriqueDe);
  const pptx = g.construire(class extends FauxPptx {}, { jour: '2026-11-25', emetteur: { identite: 'SentiqS', logo: null }, perimetre: P });
  const tout = pptx.slides.map((s) => s.textes.join(' | ')).join('\n');
  assert.match(tout, /Côte d’Ivoire — Nord/);
  assert.match(tout, /FAITS MARQUANTS — CÔTE D’IVOIRE — NORD/);
  assert.match(tout, /Zone : Nord/);
  assert.doesNotMatch(tout, /DYNAMIQUES RÉGIONALES/, 'un seul pays : pas d’intercalaire régional');
  assert.doesNotMatch(tout, /Conseil des ministres/);
});

test('le rapport du job ne change pas de forme sans périmètre', () => {
  const P = g.perimetreDe({ ci: DONNEES[0], regionaux: [DONNEES[1]] });
  assert.strictEqual(P.libelle, null);
  assert.strictEqual(P.principal.titre, 'FAITS MARQUANTS EN CÔTE D\'IVOIRE');
  assert.strictEqual(P.groupe.titre, 'DYNAMIQUES RÉGIONALES');
});

test('le générateur servi au navigateur est à jour de ses sources', () => {
  assert.strictEqual(fs.readFileSync(SORTIE, 'utf8'), construire(),
    'web/js/presentation-1.js est périmé : lancer node scripts/construire-presentation-web.js');
  global.self = global;
  delete require.cache[SORTIE];
  require(SORTIE);
  assert.strictEqual(typeof self.SentiqPresentation1.rapport.construire, 'function');
  assert.strictEqual(typeof self.SentiqPresentation1.word.construireWord, 'function');
  // « Le terme GRSCI ne doit pas figurer dans l'appli » (01/11/2026).
  assert.doesNotMatch(fs.readFileSync(SORTIE, 'utf8'), /grsci/i);
});

test('les images du modèle servies au navigateur sont celles du job', () => {
  for (const f of ['couverture-abidjan.jpg', 'carte-ci.jpg', 'afrique.png']) {
    assert.ok(fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'assets', 'presentation-1', f)).equals(fs.readFileSync(path.join(g.ASSETS, f))), f);
  }
});

test('la page compose avec ces modules, chargés à l’ouverture du module Rapports seulement', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'SentiqS_Web.html'), 'utf8');
  assert.match(html, /id="rpP1"/);
  assert.doesNotMatch(html, /<script[^>]+src="js\/presentation-(1|perimetre)\.js"/, 'pas de chargement au démarrage');
  assert.match(html, /chargerScriptLocal\('js\/presentation-1\.js'/);
  assert.match(html, /S\.rapport\.construire\(PptxGenJS, donnees\)/);
  assert.match(html, /S\.word\.construireWord\(D, donnees\)/);
});
