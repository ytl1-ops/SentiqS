// Rapport de novembre, 14/11/2026 : PowerPoint refusait d'ouvrir le fichier.
// pptxgenjs écrit l'adresse d'un lien sans l'échapper dans le .rels de la
// diapositive ; un seul « & » (paramètres utm d'un article de Guinéematin)
// rendait le XML invalide. Toute adresse posée en lien doit arriver échappée.
const test = require('node:test');
const assert = require('node:assert');
const g = require('../lib/rapport-grsci.js');
const fg = require('../lib/faits-grsci.js');

const URL_SUIVI = 'https://guineematin.com/2026/11/13/violences/?utm_source=rss&utm_medium=rss&utm_campaign=x';
const JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]);

function collecteur() {
  const liens = [];
  const voir = (o) => { if (o && o.hyperlink) liens.push(o.hyperlink.url); };
  class P {
    constructor() { this.slides = []; }
    addSlide() {
      const s = {};
      s.addText = (t, o) => { voir(o); if (Array.isArray(t)) t.forEach((x) => voir(x.options)); };
      s.addImage = (o) => voir(o);
      s.addShape = () => {};
      this.slides.push(s);
      return s;
    }
  }
  return { P, liens };
}

test('urlPptx échappe ce que pptxgenjs laisse passer, refuse ce qui n’est pas http(s)', () => {
  assert.strictEqual(g.urlPptx('https://a.example/?x=1&y=2'), 'https://a.example/?x=1&amp;y=2');
  assert.strictEqual(g.urlPptx('https://a.example/"<b>'), 'https://a.example/%22%3Cb%3E');
  assert.strictEqual(g.urlPptx('javascript:alert(1)'), null);
});

test('aucun lien du PowerPoint ne porte un « & » brut', () => {
  const brut = (titre, niveau, extra) => Object.assign({ titre, niveau, cat: 'securite', source: 'Guinéematin', url: URL_SUIVI, publieMs: Date.parse('2026-11-13T08:00:00Z'), cotation: 'probable', langue: 'fr', resume: 'Dix morts à Balato.' }, extra || {});
  const cumul = { pays: { CI: [brut('Attaque à Korhogo', 'high'), brut('Grève à Abidjan', 'mod', { cat: 'humanitaire' })], GN: [brut('Violences à Balato', 'crit'), brut('Manifestation à Conakry', 'mod')] } };
  const ci = { cy: 'CI', nom: "Côte d'Ivoire", faits: fg.faitsDuMois(cumul, 'CI', "Côte d'Ivoire") };
  const gn = { cy: 'GN', nom: 'Guinée', faits: fg.faitsDuMois(cumul, 'GN', 'Guinée') };
  g.faitsIllustres(ci, [gn]).forEach((f) => { f.photo = { data: JPEG, type: 'jpg', w: 800, h: 600, credit: 'guineematin.com', lien: URL_SUIVI }; });
  const { P, liens } = collecteur();
  g.construire(P, { jour: '2026-11-14', ci, regionaux: [gn], emetteur: { identite: 'SentiqS', signature: '', logo: null, logoRatio: null } });
  const suivis = liens.filter((u) => /utm_/.test(u));
  assert.ok(suivis.length >= 4, 'liens d’article et de photo exercés (' + suivis.length + ')');
  for (const u of liens) assert.ok(!/&(?!amp;)/.test(u), 'lien non échappé : ' + u);
});
