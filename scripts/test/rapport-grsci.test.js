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

test('le rapport suit le plan du modèle : couverture, sommaire, CI, régional, merci', () => {
  const ci = pays('CI', "Côte d'Ivoire", [fait('Attaque sur un axe', 'securite'), fait('Réforme électorale', 'politique'), fait('Grève', 'humanitaire')]);
  const reg = g.PAYS_REGIONAUX.map((c) => pays(c, 'Pays ' + c, [fait('Fait ' + c, 'securite')]));
  const p = g.construire(FauxPptx, { jour: '2026-10-25', ci, regionaux: reg });
  const t = tout(p);
  assert.ok(t.includes('RENCONTRE MENSUELLE'));
  assert.ok(t.includes('TABLE DES MATIÈRES'));
  assert.ok(t.includes("FAITS MARQUANTS EN CÔTE D'IVOIRE"));
  assert.ok(t.includes('DYNAMIQUES RÉGIONALES'));
  assert.ok(t.includes('- POLITIQUE') && t.includes('- SÉCURITÉ') && t.includes('- SOCIAL'));
  assert.ok(t.includes('MERCI'));
  assert.strictEqual(p.slides.filter((s) => s.textes.some((x) => x.includes('situation Fin octobre'))).length, 1);
  assert.ok(p.slides[0].images.some((i) => i.endsWith('couverture-abidjan.jpg')));
  for (const s of p.slides) assert.ok(s.images.some((i) => i.endsWith('logo-grsci.png')), 'logo absent du pied');
});

test('une rubrique sans fait ne produit pas de page, et beaucoup de faits se paginent', () => {
  const ci = pays('CI', 'CI', Array.from({ length: 7 }, (_, i) => fait('Sécurité ' + i, 'securite')));
  const p = g.construire(FauxPptx, { jour: '2026-10-25', ci, regionaux: [] });
  const t = tout(p);
  assert.ok(!t.includes('- POLITIQUE'));
  assert.strictEqual(p.slides.filter((s) => s.textes.some((x) => x.includes('- SÉCURITÉ'))).length, 2);
});

// Garde de la demande du 21/10/2026 : le rapport suit le modèle du groupe, pas
// le vocabulaire de l'appli. Si ce test tombe, quelqu'un a réintroduit un
// niveau, une confiance, un score ou une cotation dans un document du groupe.
const VOCABULAIRE_APPLI = /EN BREF|niveau d.alerte|confiance|score|\/100|Confirm|Probable|Non confirm|MARRON|ROUGE|ORANGE|JAUNE|d.cryptage|lecture automatique|ne savons pas|TABLEAU R/i;

test("aucun vocabulaire de l'appli dans le PowerPoint ni le Word", async () => {
  const ci = pays('CI', 'CI', [fait('Attaque', 'securite', 'critical'), fait('Grève', 'humanitaire')]);
  const reg = [pays('ML', 'Mali', [fait('Embuscade', 'securite')])];
  assert.doesNotMatch(tout(g.construire(FauxPptx, { jour: '2026-10-25', ci, regionaux: reg })), VOCABULAIRE_APPLI);
  const { docx, textes } = fauxDocx();
  await require('../lib/rapport-grsci-word.js').ecrireWord(fs.mkdtempSync(path.join(os.tmpdir(), 'grsci-')), docx, { jour: '2026-10-25', ci, regionaux: reg });
  assert.doesNotMatch(textes.join('\n'), VOCABULAIRE_APPLI);
});

test('chaque fait porte sa source et sa date, sans rien ajouter', () => {
  const ci = pays('CI', 'CI', [fait('Attaque sur un axe', 'securite')]);
  const t = tout(g.construire(FauxPptx, { jour: '2026-10-25', ci, regionaux: [] }));
  assert.ok(/attaque sur un axe/i.test(t) && /KOACI/.test(t) && /Source/.test(t));
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

test("le rebase de repli du job tolère les modifications laissées par npm", () => {
  // Run 1098 du 20/10/2026 : push refusé, puis « cannot pull with rebase: You
  // have unstaged changes » (package.json modifié par npm install) — le
  // rapport était commité sur le runner et perdu.
  const wf = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'collecte-planifiee.yml'), 'utf8');
  assert.ok(/git pull --rebase --autostash origin main/.test(wf));
  assert.ok(!/git pull --rebase origin main/.test(wf));
});

test("le rapport est retrouvable : lien stable, index lu par l'appli", async () => {
  // Signalement du 21/10/2026 : le rapport existait sur le dépôt mais rien dans
  // l'appli ne y menait, et Pages ne liste pas un dossier.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grsci-'));
  await g.ecrire(dir, FauxPptx, { jour: '2026-10-25', ci: pays('CI', 'CI', []), regionaux: [] });
  await g.ecrire(dir, FauxPptx, { jour: '2026-11-24', ci: pays('CI', 'CI', []), regionaux: [] });
  await g.ecrire(dir, FauxPptx, { jour: '2026-11-26', ci: pays('CI', 'CI', []), regionaux: [] });
  assert.ok(fs.existsSync(path.join(dir, 'dernier.pptx')));
  const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')).rapports;
  assert.deepStrictEqual(idx.map((r) => r.mois), ['2026-11', '2026-10'], 'récent d’abord, un seul par mois');
  assert.ok(!isNaN(new Date(idx[0].genere)), 'date de génération lisible');
  assert.deepStrictEqual(idx[0].formats, ['pptx']);
  fs.writeFileSync(path.join(dir, '2026-11.pdf'), 'x');
  const apres = g.reconstruireIndex(dir);
  assert.deepStrictEqual(apres[0].formats, ['pptx', 'pdf'], 'le PDF ajouté après coup est vu par l\u2019index');
  assert.strictEqual(apres[0].genere, idx[0].genere, 'la date de génération déjà écrite est conservée');
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'SentiqS_Web.html'), 'utf8');
  assert.ok(/id="rpAutoListe"/.test(html) && /fetch\('rapports\/GRSCI\/index\.json'/.test(html));
  assert.ok(/function updateDLCounts\(\)\{\s*chargerRapportsAuto\(\)/.test(html));
});

test('le rapport et son index publiés sont cohérents', () => {
  const racine = path.join(__dirname, '..', '..', 'web', 'rapports', 'GRSCI');
  const idx = JSON.parse(fs.readFileSync(path.join(racine, 'index.json'), 'utf8')).rapports;
  assert.ok(idx.length >= 1);
  for (const r of idx) for (const f of r.formats) assert.ok(fs.existsSync(path.join(racine, r.mois + '.' + f)), r.mois + '.' + f);
  assert.ok(fs.existsSync(path.join(racine, 'dernier.pptx')));
});

// Faux `docx` : chaque classe garde ses options, les énumérations rendent leur nom.
function fauxDocx() {
  const enums = new Set(['WidthType', 'ShadingType', 'AlignmentType', 'BorderStyle', 'PageNumber', 'PageOrientation', 'HeightRule', 'VerticalAlign',
    'HorizontalPositionRelativeFrom', 'VerticalPositionRelativeFrom', 'TextWrappingType']);
  const textes = [];
  const classes = {};
  return {
    textes,
    docx: new Proxy({}, {
      get(_, nom) {
        if (nom === 'Packer') return { toBuffer: async () => Buffer.from('docx-factice') };
        if (enums.has(nom)) return new Proxy({}, { get: (__, k) => nom + '.' + String(k) });
        if (!classes[nom]) {
          classes[nom] = function (o) {
            this.nom = nom; this.o = o;
            if (nom === 'TextRun' && o && o.text) textes.push(o.text);
          };
        }
        return classes[nom];
      },
    }),
  };
}

test('la version Word reprend les pages du PowerPoint avec de vrais textes', async () => {
  const w = require('../lib/rapport-grsci-word.js');
  const { docx, textes } = fauxDocx();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grsci-'));
  const ci = pays('CI', 'Côte d\u2019Ivoire', [fait('Manifestation anti 4e mandat', 'politique'), fait('Faux QR codes', 'humanitaire')]);
  const chemin = await w.ecrireWord(dir, docx, { jour: '2026-10-25', ci, regionaux: [pays('ML', 'Mali', [])] });
  assert.ok(chemin.endsWith('2026-10.docx') && fs.existsSync(chemin) && fs.existsSync(path.join(dir, 'dernier.docx')));
  const tout = textes.join('\n');
  for (const attendu of ['RENCONTRE MENSUELLE', 'TABLE DES MATIÈRES', '- POLITIQUE', '- SOCIAL', 'DYNAMIQUES RÉGIONALES', 'MERCI', 'MANIFESTATION ANTI 4E MANDAT']) {
    assert.ok(tout.includes(attendu), attendu);
  }
  assert.ok(fs.existsSync(path.join(dir, 'index.json')) && JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')).rapports[0].formats.includes('docx'));
});

test('les drapeaux couvrent le pays pilote et les neuf pays régionaux', () => {
  for (const cy of ['CI', ...g.PAYS_REGIONAUX]) {
    const r = g.rectsDrapeau(cy);
    assert.ok(r.length >= 2, cy);
    const aire = r.reduce((a, x) => a + x[2] * x[3], 0);
    assert.ok(Math.abs(aire - 1) < 1e-9, cy + ' : les bandes recouvrent exactement le drapeau');
  }
});

test('le workflow installe docx, convertit en PDF et le job écrit le Word', () => {
  const wf = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'collecte-planifiee.yml'), 'utf8');
  assert.ok(/docx@8\.5\.0/.test(wf) && /soffice --headless --convert-to pdf/.test(wf) && /indexer-rapports-grsci/.test(wf));
  const job = fs.readFileSync(path.join(__dirname, '..', 'collecte-planifiee.js'), 'utf8');
  assert.ok(/ecrireWord/.test(job));
});
