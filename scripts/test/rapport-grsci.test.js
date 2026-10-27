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
  assert.ok(t.includes('RAPPORT MENSUEL') && t.includes('DE SÛRETÉ'));
  assert.ok(t.includes('TABLE DES MATIÈRES'));
  assert.ok(t.includes("FAITS MARQUANTS EN CÔTE D'IVOIRE"));
  assert.ok(t.includes('DYNAMIQUES RÉGIONALES'));
  assert.ok(t.includes('- POLITIQUE') && t.includes('- SÉCURITÉ') && t.includes('- SOCIAL'));
  assert.ok(t.includes('MERCI'));
  assert.strictEqual(p.slides.filter((s) => s.textes.some((x) => x.includes('situation Fin octobre'))).length, 1);
  assert.ok(p.slides[0].images.some((i) => i.endsWith('couverture-abidjan.jpg')));
  for (const s of p.slides) assert.ok(s.textes.includes(g.piedTexte(g.EMETTEUR_DEFAUT)), 'signature absente du pied');
});

test('une rubrique sans fait ne produit pas de page, et beaucoup de faits se paginent', () => {
  const ci = pays('CI', 'CI', Array.from({ length: 7 }, (_, i) => fait('Sécurité ' + i, 'securite')));
  const p = g.construire(FauxPptx, { jour: '2026-10-25', ci, regionaux: [] });
  const t = tout(p);
  assert.ok(!t.includes('- POLITIQUE'));
  // Quatre faits rédigés (une page chacun), les trois autres en une page de liste.
  assert.strictEqual(p.slides.filter((s) => s.textes.some((x) => x.includes('- SÉCURITÉ'))).length, 4 + 1);
});

// Garde de la demande du 21/10/2026 : le rapport suit le modèle du groupe, pas
// le vocabulaire de l'appli. Si ce test tombe, quelqu'un a réintroduit un
// niveau d'alerte coloré ou un score dans un document du groupe. La cotation
// et l'indice de confiance, eux, y sont depuis le 23/10/2026 (« oui, go » de
// YORO) : le test exige leur PRÉSENCE.
const VOCABULAIRE_APPLI = /EN BREF|niveau d.alerte|score|\/100|MARRON|ROUGE|ORANGE|JAUNE|d.cryptage|lecture automatique|ne savons pas|TABLEAU R/i;

test("ni niveau ni score, mais cotation et confiance, dans le PowerPoint et le Word", async () => {
  const ci = pays('CI', 'CI', [fait('Attaque', 'securite', 'critical'), fait('Grève', 'humanitaire')]);
  ci.faits[0].cotation = 'confirme'; ci.faits[1].cotation = 'non_confirme';
  const reg = [pays('ML', 'Mali', [Object.assign(fait('Embuscade', 'securite'), { cotation: 'probable' })])];
  const t = tout(g.construire(FauxPptx, { jour: '2026-10-25', ci, regionaux: reg }));
  assert.doesNotMatch(t, VOCABULAIRE_APPLI);
  for (const attendu of ['Cotation : Confirmé', 'Cotation : Non confirmé', 'Cotation : Probable', 'Indice de confiance : moyenne']) assert.ok(t.includes(attendu), attendu);
  const { docx, textes } = fauxDocx();
  await require('../lib/rapport-grsci-word.js').ecrireWord(fs.mkdtempSync(path.join(os.tmpdir(), 'grsci-')), docx, { jour: '2026-10-25', ci, regionaux: reg });
  const w = textes.join('\n');
  assert.doesNotMatch(w, VOCABULAIRE_APPLI);
  assert.ok(/Cotation : Probable/.test(w) && /Indice de confiance : moyenne/.test(w));
});

test('chaque fait porte sa source et sa date, sans rien ajouter', () => {
  const ci = pays('CI', 'CI', [fait('Attaque sur un axe', 'securite')]);
  const t = tout(g.construire(FauxPptx, { jour: '2026-10-25', ci, regionaux: [] }));
  assert.ok(/attaque sur un axe/i.test(t) && /KOACI/.test(t) && /Source/.test(t));
});

test('le rapport du mois se réécrit chaque jour sur sa période', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grsci-'));
  const index = (r) => fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ rapports: r }));
  assert.deepStrictEqual(g.rapportsAActualiser(dir, '2026-10-05'), [{ mois: '2026-10', fin: '2026-10-05' }], 'disponible dès le premier passage');
  fs.writeFileSync(g.cheminRapport(dir, '2026-10-05'), 'x');
  index([{ mois: '2026-10', jour: '2026-10-05', genere: '2026-10-05T07:00:00Z' }]);
  assert.deepStrictEqual(g.rapportsAActualiser(dir, '2026-10-05'), [], 'une fois par jour');
  assert.deepStrictEqual(g.rapportsAActualiser(dir, '2026-10-06'), [{ mois: '2026-10', fin: '2026-10-06' }], 'le lendemain : période prolongée');
  // Le 1er novembre : octobre est finalisé (1er → 31), novembre commence.
  index([{ mois: '2026-10', jour: '2026-10-31', genere: '2026-10-31T07:00:00Z' }]);
  assert.deepStrictEqual(g.rapportsAActualiser(dir, '2026-11-01'), [{ mois: '2026-10', fin: '2026-10-31' }, { mois: '2026-11', fin: '2026-11-01' }]);
  index([{ mois: '2026-10', jour: '2026-10-31', genere: '2026-11-01T03:00:00Z' }]);
  assert.ok(!g.rapportsAActualiser(dir, '2026-11-02').some((r) => r.mois === '2026-10'), 'octobre ne bouge plus');
  assert.strictEqual(g.libellePeriode('2026-10-23'), 'Période du 1er au 23 octobre 2026');
  assert.strictEqual(g.dernierJourMois('2026-02'), '2026-02-28');
  assert.strictEqual(g.moisPrecedent('2026-01-01'), '2025-12');
});

test('les ressources du modèle sont présentes et le job est câblé', async () => {
  for (const f of ['couverture-abidjan.jpg', 'afrique.png']) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'grsci', f)), f);
  }
  const job = fs.readFileSync(path.join(__dirname, '..', 'collecte-planifiee.js'), 'utf8');
  assert.ok(/rapportGrsci\.ecrire/.test(job) && /GRSCI_FORCER/.test(job));
  const wf = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'collecte-planifiee.yml'), 'utf8');
  assert.ok(/pptxgenjs@3\.12\.0/.test(wf) && /git add web\/rapports/.test(wf) && /rapport_mensuel:/.test(wf));
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
  assert.ok(/id="rpAutoListe"/.test(html) && /fetch\('rapports\/mensuel\/index\.json'/.test(html));
  assert.ok(/function updateDLCounts\(\)\{\s*chargerRapportsAuto\(\)/.test(html));
});

test('le rapport et son index publiés sont cohérents', () => {
  const racine = path.join(__dirname, '..', '..', 'web', 'rapports', 'mensuel');
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
  for (const attendu of ['RAPPORT MENSUEL', 'DE SÛRETÉ', g.piedTexte(g.EMETTEUR_DEFAUT), 'TABLE DES MATIÈRES', '- POLITIQUE', '- SOCIAL', 'DYNAMIQUES RÉGIONALES', 'MERCI', 'MANIFESTATION ANTI 4E MANDAT']) {
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

// Décision de YORO du 27/10/2026 : « supprime la mention GRSCI mais garde le
// modèle de présentation ». Ni le nom, ni le sigle, ni le logo du groupe ne
// doivent atteindre le lecteur : PowerPoint, Word, propriétés du document,
// module Rapports de l'appli et adresses de téléchargement.
test('aucune mention du groupe GRSCI n\u2019atteint le lecteur', async () => {
  const interdit = /G\.?R\.?S\.?CI|Groupe des Responsables|RENCONTRE MENSUELLE/i;
  const ci = pays('CI', "Côte d'Ivoire", [fait('Attaque sur un axe', 'securite')]);
  const reg = g.PAYS_REGIONAUX.map((c) => pays(c, 'Pays ' + c, [fait('Fait ' + c, 'securite')]));
  const p = g.construire(FauxPptx, { jour: '2026-10-25', ci, regionaux: reg });
  assert.doesNotMatch(tout(p), interdit);
  assert.doesNotMatch(String(p.title || ''), interdit);
  for (const s of p.slides) assert.ok(!s.images.some((i) => /logo-grsci/.test(i)), 'logo du groupe');
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'assets', 'grsci', 'logo-grsci.png')));
  const w = require('../lib/rapport-grsci-word.js');
  const { docx, textes } = fauxDocx();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mensuel-'));
  await w.ecrireWord(dir, docx, { jour: '2026-10-25', ci, regionaux: reg });
  assert.doesNotMatch(textes.join('\n'), interdit);
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'SentiqS_Web.html'), 'utf8');
  const debut = html.indexOf('function chargerRapportsAuto');
  assert.ok(debut > 0);
  assert.doesNotMatch(html.slice(debut, html.indexOf('\n}', debut)), /GRSCI/);
  assert.doesNotMatch(html.slice(html.indexOf('Rapports automatiques'), html.indexOf('id="rpAutoListe"')), /GRSCI/);
  assert.ok(!fs.existsSync(path.join(__dirname, '..', '..', 'web', 'rapports', 'GRSCI')), 'ancien dossier GRSCI encore servi');
});

// Demande de YORO du 27/10/2026 : le logo et l'identité d'envoi de
// l'organisation doivent pouvoir être insérés dans le rapport.
test('le rapport porte l’identité d’envoi et le logo configurés, sinon SentiqS sans logo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emetteur-'));
  fs.copyFileSync(path.join(__dirname, '..', 'assets', 'grsci', 'afrique.png'), path.join(dir, 'logo.png'));
  fs.writeFileSync(path.join(dir, 'conf.json'), JSON.stringify({ identite: 'Direction Sûreté Exemple', signature: '', logo: 'logo.png' }));
  const em = g.lireEmetteur(path.join(dir, 'conf.json'));
  assert.strictEqual(em.identite, 'Direction Sûreté Exemple');
  assert.ok(em.logo && em.logo.endsWith('logo.png') && em.logoRatio > 0);
  const ci = pays('CI', "Côte d'Ivoire", [fait('Attaque sur un axe', 'securite')]);
  const p = g.construire(FauxPptx, { jour: '2026-10-25', ci, regionaux: [], emetteur: em });
  assert.ok(p.slides[0].textes.includes('Direction Sûreté Exemple'), 'identité en couverture');
  for (const s of p.slides) {
    assert.ok(s.textes.includes('Direction Sûreté Exemple'), 'identité au pied');
    assert.ok(s.images.some((i) => i === em.logo), 'logo au pied');
  }
  assert.strictEqual(p.author, 'Direction Sûreté Exemple');
  const w = require('../lib/rapport-grsci-word.js');
  const { docx, textes } = fauxDocx();
  await w.ecrireWord(dir, docx, { jour: '2026-10-25', ci, regionaux: [], emetteur: em });
  assert.ok(textes.includes('Direction Sûreté Exemple'));
  // Un logo illisible ou absent ne bloque jamais le rapport.
  fs.writeFileSync(path.join(dir, 'casse.json'), JSON.stringify({ identite: 'X', logo: 'absent.png' }));
  assert.strictEqual(g.lireEmetteur(path.join(dir, 'casse.json')).logo, null);
  const defaut = g.lireEmetteur(path.join(dir, 'inexistant.json'));
  assert.strictEqual(defaut.identite, 'SentiqS');
  assert.strictEqual(defaut.logo, null);
  // Le fichier du dépôt est lisible et son logo, s'il est déclaré, existe.
  const depot = JSON.parse(fs.readFileSync(g.CONFIG_EMETTEUR, 'utf8'));
  if (depot.logo) assert.ok(g.lireEmetteur().logo, 'logo déclaré mais illisible : ' + depot.logo);
});
