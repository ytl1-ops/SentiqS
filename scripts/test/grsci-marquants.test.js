// Rapport GRSCI : les faits marquants rédigés, avec la photo de la source.
// Demande de YORO du 23/10/2026 : « je veux un rapport avec des textes
// détaillés pour présenter les actu marquantes avec des photos et pas un
// ensemble de titres ».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const r = require('../lib/redaction-grsci.js');
const ph = require('../lib/photos-grsci.js');
const g = require('../lib/rapport-grsci.js');
const { tranche } = require('./_bac');

const F = (titre, niveau, extra) => Object.assign({
  titre, niveau: niveau || 'high', cat: 'securite', source: 'Koaci', sources: ['Koaci'],
  url: 'https://koaci.example/' + encodeURIComponent(titre), publieMs: Date.parse('2026-10-14T08:00:00Z'), cotation: 'probable',
}, extra || {});

// Un PNG réel, minimal : en-tête + IHDR suffisent à dimensionsImage.
function png(w, h) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const bloc = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); return Buffer.concat([l, Buffer.from(type), data, Buffer.alloc(4)]); };
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), bloc('IHDR', ihdr), bloc('IDAT', zlib.deflateSync(Buffer.alloc(10))), bloc('IEND', Buffer.alloc(0))]);
}
// Un JPEG réduit à ses marqueurs : SOI, APP0, SOF0 (hauteur puis largeur).
function jpeg(w, h) {
  const app0 = Buffer.from([0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0, 0, 1, 0, 1, 0, 0]);
  const sof = Buffer.from([0xFF, 0xC0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xFF, 0xD8]), app0, sof, Buffer.from([0xFF, 0xD9])]);
}

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

test('les faits les plus graves sont rédigés, les autres restent en liste, jamais les deux', () => {
  const ci = { cy: 'CI', nom: "Côte d'Ivoire", faits: [F('Attaque A', 'crit'), F('Attaque B', 'high'), F('Grève C', 'high', { cat: 'humanitaire' }), F('Braquage D', 'high'), F('Braquage E', 'high'), F('Inondation F', 'mod', { cat: 'humanitaire' })] };
  const ml = { cy: 'ML', nom: 'Mali', faits: [F('Embuscade', 'crit'), F('Autre', 'high')] };
  const plan = g.planRapport(ci, [ml]);
  const rediges = plan.ci.flatMap((x) => x.marquants).map((f) => f.titre);
  const listes = plan.ci.flatMap((x) => x.liste).map((f) => f.titre);
  assert.deepStrictEqual(rediges.sort(), ['Attaque A', 'Attaque B', 'Braquage D', 'Grève C'].sort());
  assert.ok(!rediges.some((t) => listes.includes(t)));
  assert.deepStrictEqual(plan.regionaux[0].marquants.map((f) => f.titre), ['Embuscade']);
  assert.deepStrictEqual(plan.regionaux[0].liste.map((f) => f.titre), ['Autre']);
  // Un fait seulement modéré n'occupe une page que s'il est le plus grave du pays.
  assert.deepStrictEqual(r.choisirMarquants([F('A', 'high'), F('B', 'mod')], 4).marquants.map((f) => f.titre), ['A']);
  assert.deepStrictEqual(r.choisirMarquants([F('B', 'mod')], 1).marquants.map((f) => f.titre), ['B']);
});

test('le texte rédigé : contexte, chapôs cités et attribués, enjeux, sources', () => {
  const f = F('Attaque contre un poste de gendarmerie près de Tougbo', 'crit', {
    ville: 'Tougbo', sources: ['Koaci', 'AIP'],
    extraits: [{ source: 'Koaci', resume: 'Des hommes armés ont ouvert le feu sur un poste avancé.' }, { source: 'AIP', resume: 'Des hommes armés ont ouvert le feu sur un poste avancé.' }, { source: 'RFI', resume: 'Un gendarme blessé.' }],
  });
  const t = r.rediger(f, "Côte d'Ivoire");
  assert.match(t.contexte, /mercredi 14 octobre 2026/);
  assert.match(t.contexte, /Lieu : Tougbo, Côte d'Ivoire/);
  assert.match(t.contexte, /recoupé/);
  assert.strictEqual(t.extraits.length, 2, 'deux chapôs au plus, le doublon écarté');
  assert.deepStrictEqual(t.extraits.map((e) => e.source), ['Koaci', 'RFI']);
  assert.match(t.enjeux, /Menace armée/);
  const seul = r.rediger(F('Braquage sur l’axe Abidjan-Yamoussoukro'), "Côte d'Ivoire");
  assert.match(seul.contexte, /Une seule source à ce stade \(Koaci\)/);
  assert.ok(seul.sansExtrait && !seul.extraits.length, 'sans chapô, le texte le dit');
  assert.match(seul.enjeux, /Criminalité/);
});

test('les enjeux suivent la famille d’événement, le titre avant le chapô', () => {
  const e = (titre, resume, cat) => r.enjeuxSurete(F(titre, 'high', { resume, cat })).cle;
  assert.strictEqual(e('Le Burkina Faso rétablit la peine de mort', 'pour les crimes de terrorisme', 'politique'), 'justice');
  assert.strictEqual(e('Grève des enseignants à Bouaké'), 'manifestation');
  assert.strictEqual(e('Two aid workers kidnapped near Gao'), 'enlevement');
  assert.strictEqual(e('Tentative de coup d’État déjouée'), 'coup');
  assert.strictEqual(e('Accident de bus : 25 morts'), 'accident');
  assert.strictEqual(e('Bus attaqué par des hommes armés : 12 morts'), 'attaque');
  assert.strictEqual(e('Un militant de l’opposition arrêté', null, 'politique'), 'politique', '« militant » n’est pas une menace armée');
  assert.strictEqual(e('Hausse du prix du riz', null, 'economique'), 'categorie');
});

test('une photo est un JPEG ou un PNG assez grand, rien d’autre', () => {
  assert.deepStrictEqual(ph.dimensionsImage(png(800, 450)), { type: 'png', w: 800, h: 450 });
  assert.deepStrictEqual(ph.dimensionsImage(jpeg(1200, 675)), { type: 'jpg', w: 1200, h: 675 });
  assert.strictEqual(ph.dimensionsImage(Buffer.from('RIFF0000WEBPVP8 ' + 'x'.repeat(40))), null, 'WebP écarté');
  assert.strictEqual(ph.imageDeclaree('<meta content="/img/a.jpg" property="og:image">', 'https://site.ci/a/b'), 'https://site.ci/img/a.jpg');
  assert.strictEqual(ph.imageDeclaree('<meta property="og:image" content="https://cdn.ci/x.png?a=1&amp;b=2">', 'https://site.ci/'), 'https://cdn.ci/x.png?a=1&b=2');
  assert.strictEqual(ph.imageDeclaree('<meta property="og:image" content="http://site.ci/a.jpg">', 'https://site.ci/'), null, 'http refusé');
});

test('le job illustre un fait avec l’image du flux, sinon l’aperçu de l’article, sinon rien', async () => {
  const reponses = {
    'https://flux.ci/photo.jpg': jpeg(1200, 675),
    'https://koaci.example/sans-image-flux': Buffer.from('<html><head><meta property="og:image" content="https://koaci.example/og.png"></head></html>'),
    'https://koaci.example/og.png': png(900, 500),
    'https://koaci.example/icone': Buffer.from('<meta property="og:image" content="https://koaci.example/ico.png">'),
    'https://koaci.example/ico.png': png(64, 64),
  };
  const fauxFetch = async (url) => {
    const b = reponses[url];
    if (!b) return { ok: false, headers: new Map(), body: null };
    return { ok: true, headers: { get: () => String(b.length) }, body: (async function* () { yield b; })() };
  };
  const a = F('A', 'crit', { img: 'https://flux.ci/photo.jpg' });
  const b = F('B', 'crit', { liens: [{ source: 'Koaci', url: 'https://koaci.example/sans-image-flux' }] });
  const c = F('C', 'crit', { liens: [{ source: 'Koaci', url: 'https://koaci.example/icone' }] });
  assert.strictEqual(await ph.illustrer([a, b, c], fauxFetch), 2);
  assert.strictEqual(a.photo.type, 'jpg');
  assert.strictEqual(b.photo.type, 'png');
  assert.strictEqual(b.img, 'https://koaci.example/og.png', 'adresse gardée pour le cumul');
  assert.strictEqual(b.photo.credit, 'koaci.example');
  assert.strictEqual(c.photo, undefined, 'une icône n’illustre rien');
});

test('PowerPoint : une page rédigée par fait marquant, la photo seulement si elle existe', () => {
  const avec = F('Attaque contre un poste de gendarmerie', 'crit', { resume: 'Des hommes armés ont ouvert le feu.', photo: { data: jpeg(1200, 675), type: 'jpg', w: 1200, h: 675, credit: 'koaci.example', lien: 'https://koaci.example/a' } });
  const sans = F('Braquage sur un axe', 'high');
  const ci = { cy: 'CI', nom: "Côte d'Ivoire", confiance: { libelle: 'moyenne' }, faits: [avec, sans] };
  const p = g.construire(FauxPptx, { jour: '2026-10-23', ci, regionaux: [] });
  const page = (t) => p.slides.find((s) => s.textes.some((x) => x.includes(t)));
  const pa = page('Attaque contre un poste de gendarmerie');
  assert.ok(pa.textes.some((x) => x.includes('Ce que rapportent les sources') && x.includes('« Des hommes armés ont ouvert le feu. »') && x.includes('Enjeux sûreté')));
  const photo = pa.images.find((i) => i.data);
  assert.ok(photo && /^image\/jpeg;base64,/.test(photo.data), 'photo embarquée');
  assert.ok(Math.abs(photo.w / photo.h - 1200 / 675) < 0.01, 'proportions respectées');
  assert.ok(pa.textes.some((x) => x.includes('Photo : © koaci.example')), 'crédit');
  const ps = page('Braquage sur un axe');
  assert.ok(!ps.images.some((i) => i.data), 'pas de photo : aucune image de remplacement');
  assert.ok(p.slides.some((s) => s.textes.some((x) => x.includes('à valider et compléter par l\'analyste'))), 'la méthode est dite');
});

test('Word : même texte rédigé, photo avec crédit, rien sans photo', () => {
  const runs = [];
  const images = [];
  const D = new Proxy({}, {
    get(_, nom) {
      if (['WidthType', 'ShadingType', 'AlignmentType', 'BorderStyle', 'PageNumber', 'PageOrientation', 'HeightRule', 'VerticalAlign', 'HorizontalPositionRelativeFrom', 'VerticalPositionRelativeFrom', 'TextWrappingType'].includes(nom)) return new Proxy({}, { get: (__, k) => String(k) });
      return function (o) { if (nom === 'TextRun' && o && o.text) runs.push(o.text); if (nom === 'ImageRun') images.push(o); this.o = o; };
    },
  });
  const photo = { data: png(800, 600), type: 'png', w: 800, h: 600, credit: 'aip.ci', lien: 'https://aip.ci/a' };
  const ci = { cy: 'CI', nom: "Côte d'Ivoire", faits: [F('Grève des enseignants', 'high', { cat: 'humanitaire', resume: 'Mot d’ordre de 72 heures.', photo }), F('Braquage', 'high')] };
  require('../lib/rapport-grsci-word.js').construireWord(D, { jour: '2026-10-23', ci, regionaux: [] });
  const t = runs.join('\n');
  for (const x of ['Contexte', 'Ce que rapportent les sources', '« Mot d’ordre de 72 heures. »', 'Enjeux sûreté', 'Photo : © aip.ci']) assert.ok(t.includes(x), x);
  const photos = images.filter((i) => i.data === photo.data);
  assert.strictEqual(photos.length, 1, 'une seule photo : celle du fait qui en a une');
  assert.strictEqual(photos[0].transformation.width / photos[0].transformation.height, 800 / 600);
});

test('le job fournit chapô, ville et image, et les reporte dans le cumul', () => {
  const fn = tranche('function faitsMoisPays(cy, depuisMs) {', '// TR_CONCURRENCE_MAX');
  assert.match(fn, /resume: resumeFaitMois\(a\)/);
  assert.match(fn, /!g\.estime \? g\.ville : null/, 'jamais la capitale par défaut');
  assert.match(fn, /img: mediaActu\(a\)\.img/);
  const job = fs.readFileSync(path.join(__dirname, '..', 'collecte-planifiee.js'), 'utf8');
  assert.match(job, /photosGrsci\.illustrer\(marquants\b/);
  assert.match(job, /entree\.resumeFr = e\.resume/);
  const f = require('../lib/faits-grsci.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grsci-marq-'));
  f.cumuler(dir, '2026-10', { CI: [F('Fait', 'high')] });
  const c = f.cumuler(dir, '2026-10', { CI: [F('Fait', 'high', { resume: 'Chapô arrivé plus tard', img: 'https://x.ci/a.jpg', ville: 'Bouaké' })] });
  assert.strictEqual(c.pays.CI[0].resume, 'Chapô arrivé plus tard');
  assert.strictEqual(c.pays.CI[0].img, 'https://x.ci/a.jpg');
  assert.strictEqual(c.pays.CI[0].ville, 'Bouaké');
});

// Rapport du 27/10/2026 : logo d'AllAfrica en guise de photo (Burkina Faso),
// blason d'un syndicat (Bénin). Pas de photo plutôt qu'un logo.
test('un logo de site n’est jamais pris pour la photo du fait', () => {
  const { ressembleLogo } = require('../lib/photos-grsci');
  assert.ok(ressembleLogo('https://allafrica.com/static/images/logo/aa-logo-og.png'));
  assert.ok(ressembleLogo('https://exemple.com/favicon.png'));
  assert.ok(ressembleLogo('https://exemple.com/img/union.png', { type: 'png', w: 600, h: 600 }), 'PNG carré');
  assert.ok(!ressembleLogo('https://exemple.com/uploads/2026/10/IMG_1234.jpg', { type: 'jpg', w: 1200, h: 800 }));
  assert.ok(!ressembleLogo('https://exemple.com/uploads/2026/10/scene.png', { type: 'png', w: 1200, h: 675 }));
  assert.ok(!ressembleLogo('https://exemple.com/uploads/catalogue-2026.jpg'), '« logo » au milieu d’un mot ne compte pas');
});
