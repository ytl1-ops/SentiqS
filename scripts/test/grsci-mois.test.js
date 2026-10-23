// Relecture du rapport GRSCI d'octobre 2026 (23/10/2026) et visuels d'actu.
//
// Le rapport « mensuel » lisait la fenêtre de 36 h : deux faits ivoiriens pour
// un mois, la peine de mort au Burkina Faso en six puces (une par média), des
// titres anglais dans un document français, « VIII » coupé sur deux lignes,
// et un brouillon forcé le 21 qui serait resté le rapport officiel. Et
// l'éditeur ne veut plus AUCUN visuel de remplacement quand la source ne
// fournit ni photo ni vidéo.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const f = require('../lib/faits-grsci.js');
const g = require('../lib/rapport-grsci.js');
const { tranche } = require('./_bac');

const ZW = String.fromCharCode(0x200B);
const T = (titre, source, niveau, jour) => ({
  titre, source, niveau: niveau || 'high', cat: 'securite', url: 'https://ex.org/' + encodeURIComponent(titre),
  publieMs: Date.parse('2026-10-' + (jour || '21') + 'T08:00:00Z'),
});

test('un même fait rapporté par six médias devient un fait, ses sources listées', () => {
  const bf = [
    T('Le Burkina Faso rétablit la peine de mort, abolie en 2018 !', 'Actu Cameroun'),
    T('« Le sentimentalisme, c’est fini » : au Burkina Faso, Ibrahim Traoré rétablit la peine de mort', 'Jeune Afrique'),
    T('Burkina Faso : la peine de mort rétablie dans le nouveau code pénal', 'Maliactu'),
    T('Burkina Faso : le Parlement vote le rétablissement de la peine de mort', 'Africanews'),
    T('Burkina Faso: la junte au pouvoir rétablit la peine de mort', 'RFI Afrique'),
    T('Burkina Faso : la peine de mort réintroduite dans le code pénal', 'Guineematin'),
    T('Burkina Faso : le Premier ministre inaugure la rizerie géante de Bagré', 'Burkina24', 'mod'),
    T('Offensive agropastorale : le Premier ministre lance la récolte mécanisée du maïs à Bagré', 'Gouvernement', 'mod'),
  ];
  const r = f.regrouper(bf, 'Burkina Faso');
  assert.strictEqual(r.length, 3, r.map((x) => x.titre).join(' | '));
  assert.strictEqual(r[0].sources.length, 6);
  const t = g.faitTexte(r[0]);
  assert.strictEqual(t.etiquette, 'Sources : ');
  assert.ok(t.source.includes('RFI Afrique') && t.source.includes('Guineematin'));
  assert.strictEqual(g.faitTexte(r[1]).etiquette, 'Source : ');
});

test('Ménaka en deux langues se replie, deux attaques à deux semaines non', () => {
  const ml = [
    Object.assign(T('Massacre in Mali: Islamic State militants kill at least 48 civilians in Ménaka', 'The Africa Report', 'crit'),
      { titreFr: 'Massacre au Mali : des militants de l’État islamique tuent au moins 48 civils à Ménaka' }),
    T('Massacre au Mali : l’État islamique s’attaque à la communauté idaksahak dans la région de Ménaka', 'Jeune Afrique', 'crit', '20'),
  ];
  assert.strictEqual(f.regrouper(ml, 'Mali').length, 1);
  const deux = [
    T('Ménaka : une attaque de l’État islamique fait des dizaines de morts parmi les civils', 'A', 'crit', '03'),
    T('Ménaka : une nouvelle attaque de l’État islamique fait des dizaines de morts civils', 'B', 'crit', '19'),
  ];
  assert.strictEqual(f.regrouper(deux, 'Mali').length, 2, 'seize jours d’écart : deux faits');
  deux[1].publieMs = deux[0].publieMs + 86400000;
  assert.strictEqual(f.regrouper(deux, 'Mali').length, 1, 'le lendemain : le même fait');
});

test('un fait repris par deux médias devient Confirmé, une cotation ne redescend pas', () => {
  const r = f.regrouper([Object.assign(T('Le Burkina Faso rétablit la peine de mort', 'A'), { cotation: 'probable' }),
    Object.assign(T('Burkina Faso : la junte rétablit la peine de mort', 'B'), { cotation: 'non_confirme' })], 'Burkina Faso');
  assert.strictEqual(r[0].cotation, 'confirme');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grsci-cot-'));
  f.cumuler(dir, '2026-10', { CI: [Object.assign(T('Fait', 'A'), { cotation: 'confirme' })] });
  const c = f.cumuler(dir, '2026-10', { CI: [Object.assign(T('Fait', 'A'), { cotation: 'probable' })] });
  assert.strictEqual(c.pays.CI[0].cotation, 'confirme');
  const fn = tranche('function faitsMoisPays(cy, depuisMs) {', '// TR_CONCURRENCE_MAX');
  assert.match(fn, /cotationArticle\(/);
});

test('les plus graves d’abord, puis les plus récents', () => {
  const r = f.regrouper([T('Grève des enseignants à Bouaké', 'A', 'mod', '22'), T('Attaque contre un poste de gendarmerie', 'B', 'crit', '03'), T('Braquage sur l’axe Abidjan-Yamoussoukro', 'C', 'high', '20')], "Côte d'Ivoire");
  assert.deepStrictEqual(r.map((x) => x.niveau), ['crit', 'high', 'mod']);
});

test('le cumul du mois s’accumule passage après passage, sans doublon ni autre mois', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grsci-cumul-'));
  f.cumuler(dir, '2026-10', { CI: [T('Fait du 3', 'A', 'high', '03'), T('Autre fait du 3', 'A', 'high', '03')] });
  const sept = Object.assign(T('Vieux fait', 'A'), { publieMs: Date.parse('2026-09-28T08:00:00Z') });
  const c = f.cumuler(dir, '2026-10', { CI: [T('Fait du 3', 'A', 'crit', '03'), T(ZW + 'Grève du 21', 'B', 'mod'), sept] });
  const titres = c.pays.CI.map((x) => x.titre);
  assert.deepStrictEqual(titres, ['Fait du 3', 'Autre fait du 3', 'Grève du 21']);
  assert.strictEqual(c.pays.CI[0].niveau, 'crit', 'un reclassement doit pouvoir s’appliquer');
  assert.ok(!titres.some((x) => x.includes(ZW)), 'espace de largeur nulle retiré');
  assert.ok(fs.existsSync(f.cheminCumul(dir, '2026-10')));
});

test('une seule langue : titre traduit, sinon langue d’origine dite', () => {
  assert.strictEqual(g.titreDeFait({ titre: 'Massacre in Mali', langue: 'en', titreFr: 'Massacre au Mali' }), 'MASSACRE AU MALI');
  assert.strictEqual(g.titreDeFait({ titre: 'Massacre in Mali', langue: 'en' }), '(EN) MASSACRE IN MALI');
  assert.strictEqual(g.titreDeFait({ titre: ZW + 'Grève du FSDT', langue: 'fr' }), 'GRÈVE DU FSDT');
});

test('le rapport figé au 21 octobre est réécrit au passage suivant, période affichée', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grsci-brouillon-'));
  fs.writeFileSync(g.cheminRapport(dir, '2026-10-21'), 'x');
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ rapports: [{ mois: '2026-10', jour: '2026-10-21', genere: '2026-10-21T13:15:25.882Z' }] }));
  assert.deepStrictEqual(g.rapportsAActualiser(dir, '2026-10-23'), [{ mois: '2026-10', fin: '2026-10-23' }]);
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'SentiqS_Web.html'), 'utf8');
  assert.match(html, /période du 1er au /, 'la liste des rapports dit la période couverte');
});

test('« VIII » tient dans la pastille, et dix faits par rubrique au plus', () => {
  class FauxPptx {
    constructor() { this.slides = []; }
    addSlide() { const s = { t: [] }; s.addText = (x, o) => s.t.push([x, o]); s.addImage = () => {}; s.addShape = () => {}; this.slides.push(s); return s; }
  }
  const pays = (cy, faits) => ({ cy, nom: 'Pays ' + cy, faits });
  const ci = pays('CI', Array.from({ length: 25 }, (_, i) => T('Sécurité ' + i, 'A')));
  const reg = g.PAYS_REGIONAUX.map((c) => pays(c, []));
  const p = g.construire(FauxPptx, { jour: '2026-10-24', ci, regionaux: reg });
  const viii = p.slides.flatMap((s) => s.t).find(([x]) => x === 'VIII');
  assert.ok(viii && viii[1].fontSize < 24);
  const pagesSecu = p.slides.filter((s) => s.t.some(([x]) => x === '- SÉCURITÉ'));
  assert.strictEqual(pagesSecu.length, 2, '25 faits → 10 retenus → 2 pages');
});

test('le job cumule le mois à chaque passage et la page fournit la matière', () => {
  const job = fs.readFileSync(path.join(__dirname, '..', 'collecte-planifiee.js'), 'utf8');
  assert.match(job, /faitsGrsci\.cumuler\(RACINE_GRSCI/);
  assert.match(job, /faitsGrsci\.faitsDuMois\(cumul/);
  assert.match(job, /trFetch\(t, detectLangue\(t\), 'fr'\)/);
  const fn = tranche('function faitsMoisPays(cy, depuisMs) {', '// TR_CONCURRENCE_MAX');
  assert.match(fn, /concat\(hist\)/, 'l’historique de la collecte fait partie du mois');
  assert.match(fn, /_dateNonFiable/);
  assert.match(tranche('function archiverHistorique(rejetes) {', 'const seuil ='), /url:a\.url/);
});

test('sans photo ni vidéo de la source, aucun visuel ne s’affiche', () => {
  const css = tranche('.vact.sans-img .vact-credit{display:none}', '/* Toute la surface');
  assert.match(css, /\.vact\.sans-img:not\(\.vact-video\)[^{]*\{display:none\}/);
  assert.match(css, /\.vact:not\(\.vact-video\) \.vact-repli\{display:none\}/);
});
