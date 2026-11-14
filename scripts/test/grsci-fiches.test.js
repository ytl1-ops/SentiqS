// Rapport mensuel : chaque actu est une fiche, avec son texte et la photo de
// la source quand elle en publie une. Demande de YORO du 14/11/2026 : « toutes
// les actu doivent être présentées avec texte et image si disponible ». Avant,
// seuls les faits marquants rédigés avaient un texte et une photo ; les autres
// n'étaient qu'un titre et une ligne de source.
const test = require('node:test');
const assert = require('node:assert');
const g = require('../lib/rapport-grsci.js');
const w = require('../lib/rapport-grsci-word.js');
const fg = require('../lib/faits-grsci.js');

const JPEG = (() => {
  const app0 = Buffer.from([0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0, 0, 1, 0, 1, 0, 0]);
  const sof = Buffer.from([0xFF, 0xC0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xFF, 0xD8]), app0, sof, Buffer.from([0xFF, 0xD9])]);
})();
const photo = (credit) => ({ data: JPEG, type: 'jpg', w: 800, h: 600, credit, lien: 'https://' + credit + '/article' });

let n = 0;
const brut = (titre, niveau, extra) => Object.assign({
  titre, niveau: niveau || 'mod', cat: 'politique', source: 'Source ' + (++n), url: 'https://media' + n + '.example/a',
  publieMs: Date.parse('2026-11-10T08:00:00Z') - n * 3600e3, cotation: 'probable', langue: 'fr',
  resume: 'Chapô détaillé de « ' + titre + ' », publié par le média.',
}, extra || {});

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
const EM = { identite: 'SentiqS', signature: '', logo: null, logoRatio: null };

function donnees() {
  const titres = ['Remaniement du gouvernement annoncé', 'Visite du Premier ministre à Bouaké', 'Réforme du code électoral adoptée', 'Le parlement vote le budget', 'Grève des enseignants du privé', 'Nouvelle route inaugurée'];
  const cumul = { pays: { CI: titres.map((t, i) => brut(t, i ? 'mod' : 'high', i === 4 ? { cat: 'humanitaire' } : {})), ML: [brut('Embuscade près de Gao', 'crit', { cat: 'securite' }), brut('Pénurie de carburant à Bamako', 'mod', { cat: 'economique' })] } };
  const ci = { cy: 'CI', nom: "Côte d'Ivoire", faits: fg.faitsDuMois(cumul, 'CI', "Côte d'Ivoire") };
  const ml = { cy: 'ML', nom: 'Mali', faits: fg.faitsDuMois(cumul, 'ML', 'Mali') };
  return { ci, regionaux: [ml] };
}

test('toutes les actus du rapport sont illustrées par le job, les rédigées d’abord', () => {
  const { ci, regionaux } = donnees();
  const plan = g.planRapport(ci, regionaux);
  const tous = plan.ci.flatMap((x) => x.marquants.concat(x.liste)).concat(plan.regionaux.flatMap((x) => x.marquants.concat(x.liste)));
  const illustres = g.faitsIllustres(ci, regionaux);
  assert.strictEqual(illustres.length, tous.length, 'chaque actu du rapport peut recevoir une photo');
  const rediges = g.faitsMarquants(ci, regionaux);
  assert.deepStrictEqual(illustres.slice(0, rediges.length), rediges, 'si le budget manque, ce sont les fiches qui attendent');
});

test('PowerPoint : chaque actu montre son texte, et sa photo quand il y en a une', () => {
  const { ci, regionaux } = donnees();
  const plan = g.planRapport(ci, regionaux);
  const listees = plan.ci.flatMap((x) => x.liste).concat(plan.regionaux.flatMap((x) => x.liste));
  assert.ok(listees.length >= 3);
  listees[0].photo = photo('media-a.example');
  const pp = g.construire(FauxPptx, { jour: '2026-11-14', ci, regionaux, emetteur: EM });
  const tout = pp.slides.map((s) => s.textes.join('\n')).join('\n');
  for (const f of listees) assert.ok(tout.includes('Chapô détaillé de « ' + f.titre), 'texte présent pour « ' + f.titre + ' »');
  const avecPhoto = pp.slides.find((s) => s.images.some((i) => /Photo : media-a/.test(i.altText || '')));
  assert.ok(avecPhoto, 'la photo de la source est posée');
  assert.ok(avecPhoto.textes.some((t) => t.includes('Photo : © media-a.example')), 'avec son crédit');
  // Sans photo, rien : aucune image pour les autres actus listées.
  const images = pp.slides.flatMap((s) => s.images).filter((i) => /^Photo/.test(i.altText || ''));
  assert.strictEqual(images.length, 1);
});

test('un extrait non traduit le dit, comme le titre', () => {
  const f = fg.regrouper([brut('Attack on a convoy near Gao', 'high', { langue: 'en', titreFr: 'Attaque contre un convoi près de Gao', resume: 'Gunmen attacked a convoy.' })], 'Mali')[0];
  assert.strictEqual(g.ficheTexte(f).extrait.langue, '(EN) ');
  f.extraits[0].fr = true;
  assert.strictEqual(g.ficheTexte(f).extrait.langue, '');
});

// Faux `docx` : enregistre le texte des TextRun et compte les images.
function fauxDocx() {
  const textes = [];
  let images = 0;
  class Noeud { constructor(o) { Object.assign(this, o || {}); } }
  const D = new Proxy({}, {
    get(_, k) {
      if (k === 'TextRun') return class extends Noeud { constructor(o) { super(o); textes.push(typeof o === 'string' ? o : o.text || ''); } };
      if (k === 'ImageRun') return class extends Noeud { constructor(o) { super(o); images++; } };
      if (/Type$|Align|Rule|RelativeFrom|BorderStyle|PageOrientation|PageNumber/.test(String(k))) return new Proxy({}, { get: (_, x) => String(x) });
      return Noeud;
    },
  });
  return { D, textes, images: () => images };
}

test('Word : chaque actu montre son texte, et sa photo quand il y en a une', () => {
  const { ci, regionaux } = donnees();
  const plan = g.planRapport(ci, regionaux);
  const listees = plan.ci.flatMap((x) => x.liste).concat(plan.regionaux.flatMap((x) => x.liste));
  const { D, textes, images } = fauxDocx();
  w.construireWord(D, { jour: '2026-11-14', ci, regionaux, emetteur: EM });
  const sansPhoto = images();
  const tout = textes.join('\n');
  for (const f of listees) assert.ok(tout.includes('« Chapô détaillé de « ' + f.titre), 'texte présent pour « ' + f.titre + ' »');
  listees[0].photo = photo('media-b.example');
  const b = fauxDocx();
  w.construireWord(b.D, { jour: '2026-11-14', ci, regionaux, emetteur: EM });
  assert.strictEqual(b.images(), sansPhoto + 1, 'la photo de la fiche est posée');
  assert.ok(b.textes.some((t) => t.includes('Photo : © media-b.example')));
});
