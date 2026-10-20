// Rapport mensuel GRSCI : forme du modèle d'octobre 2024, matière automatisée.
// Un faux PptxGenJS enregistre les diapositives : le module est testé sans
// navigateur ni bibliothèque externe, et ce qu'il écrit est inspectable.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const g = require('../lib/rapport-grsci.js');

class FauxPptx {
  constructor() { this.slides = []; }
  addSlide() {
    const s = { textes: [], images: [], tables: [] };
    s.addText = (t) => { s.textes.push(typeof t === 'string' ? t : t.map((x) => x.text).join(' ')); };
    s.addImage = (o) => { s.images.push(o.path); };
    s.addShape = () => {};
    s.addTable = (rows) => { s.tables.push(rows); };
    this.slides.push(s);
    return s;
  }
  async writeFile({ fileName }) { fs.writeFileSync(fileName, 'pptx'); }
}

const fait = (titre, cat, niveau) => ({ titre, cat, niveau: niveau || 'high', source: 'KOACI', publieMs: 1, cotation: { libelle: 'Probable' } });
const pays = (cy, nom, faits) => ({
  cy, nom, niveau: 'jaune', libelle: 'JAUNE', sous: 'Modéré', total100: 22.1,
  confiance: { libelle: 'moyenne', motif: 'incident vérifié le plus récent : 113 jours' },
  faits, faitsNotables: faits.length, socle: [], facteurs: [], angleMort: { socleAncien: true }, fenetreH: 36,
  tendance: { crans: -2, depuis: '11/09/2026' },
});
const tout = (p) => p.slides.map((s) => s.textes.join(' | ')).join('\n');

test('le rapport suit le plan du modèle : couverture, sommaire, CI, régional', () => {
  const ci = pays('CI', "Côte d'Ivoire", [fait('Attaque sur un axe', 'securite'), fait('Réforme électorale', 'politique'), fait('Grève', 'humanitaire')]);
  const reg = g.PAYS_REGIONAUX.map((c) => pays(c, 'Pays ' + c, []));
  const p = g.construire(FauxPptx, { jour: '2026-10-25', ci, regionaux: reg });
  const t = tout(p);
  assert.ok(t.includes('RENCONTRE MENSUELLE'));
  assert.ok(t.includes('TABLE DES MATIÈRES'));
  assert.ok(t.includes("FAITS MARQUANTS EN CÔTE D'IVOIRE"));
  assert.ok(t.includes('DYNAMIQUES RÉGIONALES'));
  assert.ok(t.includes('POLITIQUE') && t.includes('SÉCURITÉ') && t.includes('SOCIAL ET HUMANITAIRE'));
  assert.strictEqual(p.slides.filter((s) => s.textes.some((x) => x.includes('situation au 25/10/26'))).length, reg.length);
  assert.ok(p.slides[0].images.some((i) => i.endsWith('couverture-abidjan.jpg')));
  for (const s of p.slides) assert.ok(s.images.some((i) => i.endsWith('logo-grsci.png')), 'logo absent du pied');
});

test('une rubrique sans fait ne produit pas de page, et beaucoup de faits se paginent', () => {
  const ci = pays('CI', 'CI', Array.from({ length: 7 }, (_, i) => fait('Sécurité ' + i, 'securite')));
  const p = g.construire(FauxPptx, { jour: '2026-10-25', ci, regionaux: [] });
  const t = tout(p);
  assert.ok(!t.includes('POLITIQUE (') && !/\bI\b \| POLITIQUE/.test(t));
  assert.ok(t.includes('SÉCURITÉ (1/2)') && t.includes('SÉCURITÉ (2/2)'));
});

test("le décryptage ne contient que des constats tirés des données, et dit qu'il est automatique", () => {
  const d = pays('CI', 'CI', []);
  const lignes = g.decryptage(d);
  assert.ok(lignes.some((l) => l.includes('22.1/100')));
  assert.ok(lignes.some((l) => l.includes('en baisse de 2 crans depuis le 11/09/2026')));
  assert.ok(lignes.some((l) => l.includes("ne veut pas dire qu'il ne s'est rien passé")));
  const t = tout(g.construire(FauxPptx, { jour: '2026-10-25', ci: d, regionaux: [] }));
  assert.ok(t.includes('lecture automatique, à valider'));
});

test('un pays muet est dit invisible, pas calme', () => {
  const d = Object.assign(pays('CI', 'CI', []), { angleMort: { muet: true } });
  assert.ok(g.decryptage(d).some((l) => /ne voit rien/.test(l) && /pas un signe de calme/.test(l)));
});

test('un rapport par mois, à partir du jour demandé', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grsci-'));
  assert.strictEqual(g.doitEcrire(dir, '2026-10-23', 24), false, 'trop tôt');
  assert.strictEqual(g.doitEcrire(dir, '2026-10-24', 24), true);
  fs.writeFileSync(g.cheminRapport(dir, '2026-10-24'), 'x');
  assert.strictEqual(g.doitEcrire(dir, '2026-10-30', 24), false, 'déjà écrit ce mois-ci');
  assert.strictEqual(g.doitEcrire(dir, '2026-11-24', 24), true);
});

test('les ressources du modèle sont présentes et le job est câblé', async () => {
  for (const f of ['logo-grsci.png', 'couverture-abidjan.jpg', 'afrique.png']) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'grsci', f)), f);
  }
  const job = fs.readFileSync(path.join(__dirname, '..', 'collecte-planifiee.js'), 'utf8');
  assert.ok(/rapportGrsci\.ecrire/.test(job) && /GRSCI_FORCER/.test(job));
  const wf = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'collecte-planifiee.yml'), 'utf8');
  assert.ok(/pptxgenjs@3\.12\.0/.test(wf) && /git add web\/rapports/.test(wf) && /grsci:/.test(wf));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grsci-'));
  const chemin = await g.ecrire(dir, FauxPptx, { jour: '2026-10-25', ci: pays('CI', 'CI', []), regionaux: [] });
  assert.ok(fs.existsSync(chemin) && chemin.endsWith('2026-10.pptx'));
});
