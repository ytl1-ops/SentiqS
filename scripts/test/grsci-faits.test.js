// Rapport GRSCI : un mois de faits, pas 36 heures (relecture du 23/10/2026).
//
// Le rapport d'octobre forcé le 23 ne contenait que la fenêtre d'actualité :
// deux faits pour la Côte d'Ivoire, un pour le Bénin. Ces gardes exigent que
// chaque passage verse ses faits dans un cumul mensuel sans doublon, que le
// rapport lise ce cumul, et qu'une avant-première forcée ne bloque pas le
// rapport de la rencontre.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cumul = require('../lib/grsci-faits.js');
const g = require('../lib/rapport-grsci.js');

const f = (titre, niveau, publieMs, url) => ({ titre, niveau, publieMs, url: url || null, source: 'KOACI', cat: 'securite', cotation: { libelle: 'Probable' } });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'grsci-cumul-'));

test('les faits de passages successifs se cumulent sur le mois, sans doublon', () => {
  const dir = tmp();
  cumul.cumuler(dir, '2026-11-02', [{ cy: 'CI', faits: [f('Attaque A', 'high', 1, 'https://a'), f('Grève B', 'mod', 2)] }]);
  const r = cumul.cumuler(dir, '2026-11-20', [{ cy: 'CI', faits: [f('Attaque A', 'high', 1, 'https://a'), f('Embuscade C', 'crit', 3)] }]);
  const ci = r.find((d) => d.cy === 'CI');
  assert.deepStrictEqual(ci.faits.map((x) => x.titre), ['Embuscade C', 'Attaque A', 'Grève B'], 'les plus graves d’abord, un seul « Attaque A »');
});

test('un mois neuf repart de zéro', () => {
  const dir = tmp();
  cumul.cumuler(dir, '2026-10-30', [{ cy: 'ML', faits: [f('Fait d’octobre', 'high', 1)] }]);
  const r = cumul.cumuler(dir, '2026-11-01', [{ cy: 'ML', faits: [f('Fait de novembre', 'high', 2)] }]);
  assert.deepStrictEqual(r[0].faits.map((x) => x.titre), ['Fait de novembre']);
  assert.ok(fs.existsSync(cumul.cheminCumul(dir, '2026-10-30')) && fs.existsSync(cumul.cheminCumul(dir, '2026-11-01')));
});

test('le cumul ne garde ni la cotation ni le vocabulaire de l’appli, et reste borné', () => {
  const dir = tmp();
  const beaucoup = Array.from({ length: cumul.MAX_STOCKES_PAYS + 30 }, (_, i) => f('Fait ' + i, 'mod', i));
  cumul.cumuler(dir, '2026-11-05', [{ cy: 'CI', faits: beaucoup }]);
  const brut = fs.readFileSync(cumul.cheminCumul(dir, '2026-11-05'), 'utf8');
  assert.doesNotMatch(brut, /cotation|Probable/);
  assert.strictEqual(JSON.parse(brut).pays.CI.length, cumul.MAX_STOCKES_PAYS);
});

test('le cumul n’est pas pris pour un rapport par l’index', () => {
  const dir = tmp();
  cumul.cumuler(dir, '2026-11-05', [{ cy: 'CI', faits: [f('A', 'high', 1)] }]);
  assert.deepStrictEqual(g.reconstruireIndex(dir), []);
});

test('le job verse ses faits à chaque passage, pas seulement le jour du rapport', () => {
  const job = fs.readFileSync(path.join(__dirname, '..', 'collecte-planifiee.js'), 'utf8');
  const i = job.indexOf('grsciFaits.cumuler(');
  const j = job.indexOf('rapportGrsci.doitEcrire(');
  assert.ok(i > 0 && j > 0 && i < j, 'le cumul doit précéder la décision d’écrire le rapport');
});

test('une avant-première forcée avant le 24 ne bloque pas le rapport de la rencontre', async () => {
  const dir = tmp();
  const ci = { cy: 'CI', nom: 'CI', faits: [] };
  const Faux = class { constructor() { this.s = []; } addSlide() { const s = { addText() {}, addImage() {}, addShape() {}, addTable() {} }; this.s.push(s); return s; } async writeFile({ fileName }) { fs.writeFileSync(fileName, 'x'); } };
  await g.ecrire(dir, Faux, { jour: '2026-10-23', ci, regionaux: [] });
  assert.strictEqual(g.doitEcrire(dir, '2026-10-24', 24), true, 'le 24 réécrit l’avant-première du 23');
  await g.ecrire(dir, Faux, { jour: '2026-10-24', ci, regionaux: [] });
  assert.strictEqual(g.doitEcrire(dir, '2026-10-27', 24), false, 'puis un seul rapport');
});

test('la pastille de numéro tient sur une ligne jusqu’à « VIII »', () => {
  assert.strictEqual(g.taillePastille('II'), 24);
  assert.ok(g.taillePastille('VIII') <= 16, 'à 24 pt « VIII » passait sur deux lignes');
});

test('la Côte d’Ivoire est bornée sur un mois de cumul', () => {
  const ci = { cy: 'CI', nom: 'CI', faits: Array.from({ length: 80 }, (_, i) => f('Fait ' + i, 'high', i)) };
  let pages = 0;
  const Faux = class { addSlide() { pages++; return { addText() {}, addImage() {}, addShape() {}, addTable() {} }; } };
  g.construire(Faux, { jour: '2026-10-25', ci, regionaux: [] });
  // couverture, sommaire, 2 intercalaires, merci + pages de faits
  assert.ok(pages - 5 <= Math.ceil(g.MAX_FAITS_CI / g.FAITS_PAR_PAGE), pages + ' diapositives');
});
