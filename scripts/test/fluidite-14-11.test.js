// Fluidité et accueil, 14/11/2026 (voir CLAUDE.md, « Audit marketing et
// fluidité du 14/11/2026 »). Gardes vues échouer sur l'ancien code.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { HTML, tranche, bac } = require('./_bac');

const ACCUEIL = fs.readFileSync(path.join(__dirname, '../../web/index.html'), 'utf8');

function bacAccesRapide() {
  const src = tranche('function _sansAccents(t)', 'let _arSel = 0');
  const c = bac(src);
  c.PAYS_INFO = { CI: { name: "Côte d'Ivoire", flag: '' }, ML: { name: 'Mali', flag: '' }, ZA: { name: 'Afrique du Sud', flag: '' } };
  c.PAYS_EN = { CI: "Côte d'Ivoire", ML: 'Mali', ZA: 'South Africa' };
  c.LANG = 'fr';
  c.document = { querySelectorAll: () => [
    { style: {}, textContent: 'Alertes', dataset: { view: 'alertes' } },
    { style: { display: 'none' }, textContent: 'Paramètres', dataset: { view: 'params' } },
  ] };
  return c;
}

test('accès rapide : un pays se trouve sans accent, en français comme en anglais', () => {
  const c = bacAccesRapide();
  const cote = c.elementsAccesRapide('cote');
  assert.deepStrictEqual(Array.from(cote.filter((e) => e.type === 'pays').map((e) => e.cy)), ['CI']);
  assert.deepStrictEqual(Array.from(c.elementsAccesRapide('south').filter((e) => e.type === 'pays').map((e) => e.cy)), ['ZA']);
  assert.deepStrictEqual(Array.from(c.elementsAccesRapide('sud').filter((e) => e.type === 'pays').map((e) => e.cy)), ['ZA']);
});

test('accès rapide : modules visibles seulement, et une recherche proposée dès deux lettres', () => {
  const c = bacAccesRapide();
  assert.ok(c.elementsAccesRapide('aler').some((e) => e.type === 'module' && e.vue === 'alertes'));
  assert.ok(!c.elementsAccesRapide('param').some((e) => e.vue === 'params'), 'un onglet masqué ne doit pas être proposé');
  assert.ok(!c.elementsAccesRapide('a').some((e) => e.type === 'recherche'));
  const r = c.elementsAccesRapide('drone').find((e) => e.type === 'recherche');
  assert.ok(r && r.q === 'drone');
});

test('accès rapide : Ctrl+K et « / » ouvrent la fenêtre, jamais pendant une saisie ni sur l\'écran de connexion', () => {
  const src = tranche("document.addEventListener('keydown', ev => {\n  const cible = ev.target", '\n});\n');
  assert.match(src, /ev\.ctrlKey \|\| ev\.metaKey/);
  assert.match(src, /ev\.key === '\/' && !saisie/);
  assert.match(src, /authOverlay/);
  assert.match(HTML, /id="accesRapideBtn"[^>]*aria-label="Aller à un pays ou un module"/);
});

test('le filtre pays rejoint la barre du haut hors téléphone, et reste sur sa ligne sur téléphone', () => {
  assert.match(HTML, /<div class="cy-slot-tb" id="cySlotTb"><\/div>/);
  assert.match(HTML, /html\.pays-en-tete \.compact-filters\{display:none\}/);
  const src = tranche('function affichageTelephone()', 'let _placerFiltreRaf');
  assert.match(src, /force-mobile/);
  assert.match(src, /const cible = tel \? ligne : slot;/);
  assert.match(HTML, /placerFiltrePays\(\); \} catch\(_\) \{\} \}\n\}/, 'setDisplayMode doit recaler le filtre');
});

test("l'onglet Alertes ne réécrit pas ses 54 fiches quand rien n'a changé", () => {
  const src = tranche('async function recalcAlertes(opts)', '// Persistance des niveaux actifs');
  assert.match(src, /if \(grid\._htmlRendu !== htmlGrille\)/);
  assert.match(src, /if \(table\._htmlRendu !== htmlTable\)/);
  assert.match(HTML, /#alerteGrid > \[id\^="alerteCard-"\]\{content-visibility:auto/);
});

test('le badge « -12H » ne se coupe plus en deux lignes', () => {
  assert.match(HTML, /margin-left:var\(--sp-1\);white-space:nowrap;">-12H<\/span>/);
});

test("accueil : l'essai est l'action principale et la preuve est le vrai bulletin du jour", () => {
  const hero = ACCUEIL.slice(ACCUEIL.indexOf('<div class="hero-ctas">'), ACCUEIL.indexOf('<p class="hero-note">'));
  const essai = hero.indexOf('btn-primary'), preuve = hero.indexOf('bulletins/CI/dernier.html');
  assert.ok(essai !== -1 && preuve !== -1 && essai < preuve, "l'essai doit précéder le bulletin d'exemple");
  assert.ok(fs.existsSync(path.join(__dirname, '../../web/bulletins/CI/dernier.html')));
  assert.match(ACCUEIL, /\.btn-primary\{background:#E6BA6E;color:#0A1733/);
});

test("accueil : aucune preuve sociale inventée, et les exemples se disent exemples", () => {
  assert.ok(!/Le plus choisi/.test(ACCUEIL), 'pas de « plus choisi » sans clients pour le dire');
  assert.ok(!/anti-hallucination/.test(ACCUEIL));
  assert.match(ACCUEIL, /<span class="ticker-exemple">Exemples<\/span>/);
});

test('accueil : fiabilité, diffusion et questions fréquentes sont traduites en anglais', () => {
  for (const id of ['fiabilite', 'diffusion', 'faq']) assert.match(ACCUEIL, new RegExp('<section id="' + id + '"'));
  const dico = fs.readFileSync(path.join(__dirname, '../../web/js/dico-site-en.js'), 'utf8');
  for (const fr of ['Chaque fait est coté', 'Questions fréquentes', 'Que se passe-t-il après les 72 heures d\'essai ?', 'Voir le bulletin du jour']) {
    assert.ok(dico.includes(JSON.stringify(fr)) || dico.includes("'" + fr + "'"), 'traduction absente : ' + fr);
  }
});
