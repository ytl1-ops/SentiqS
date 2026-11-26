// Mouvement et fluidité (26/11/2026, voir CLAUDE.md).
//
// Demande de YORO : un site animé, agréable et fluide. Les règles viennent du
// skill « design-motion-principles » (MIT, .claude/skills) : on n'anime que ce
// qui a un but, jamais une navigation au clavier, jamais sous
// prefers-reduced-motion, et une image ne doit jamais rester masquée.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { HTML, tranche, bac, exposer } = require('./_bac');

const CSS = HTML.slice(HTML.indexOf('/* ═══ MOUVEMENT ET FLUIDITÉ'), HTML.indexOf("/* ═══ MOBILE : LE CONTENU D'ABORD"));
const SRC = tranche('function mouvementReduit()', 'function squelettesFluxHtml()');

// Faux DOM minimal : des cartes avec une position verticale.
function carte(id, top) {
  const cls = new Set(['art']);
  const ecouteurs = {};
  return {
    style: {},
    getAttribute: (n) => (n === 'data-id' ? id : null),
    getBoundingClientRect: () => ({ top }),
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
    addEventListener: (t, f) => { ecouteurs[t] = f; },
    finir: () => ecouteurs.animationend && ecouteurs.animationend(),
    a: (c) => cls.has(c),
  };
}
function contexte({ reduit = false, clavier = false } = {}) {
  const racineCls = new Set(clavier ? ['nav-clavier'] : []);
  const ecouteurs = [];
  const document = {
    documentElement: { classList: { add: (c) => racineCls.add(c), remove: (c) => racineCls.delete(c), contains: (c) => racineCls.has(c) } },
    addEventListener: (t, f) => ecouteurs.push([t, f]),
    querySelectorAll: () => [],
  };
  const window = { innerHeight: 800, matchMedia: () => ({ matches: reduit }) };
  const ctx = bac();
  ctx.document = document; ctx.window = window;
  vm(ctx);
  return { ctx, racineCls, ecouteurs };
}
function vm(ctx) { require('vm').runInContext(SRC, ctx); exposer(ctx, '_cartesVues'); }
const racine = (cartes) => ({ querySelectorAll: () => cartes });

test('la tranche contient bien le code visé', () => {
  for (const m of ['function animerEntreeCartes', "addEventListener('load'", "classList.add('mvt-images')", 'CARTES_ANIMEES_MAX'])
    assert.ok(SRC.includes(m), 'absent de la tranche : ' + m);
});

test('une actu ne s’anime qu’à sa première apparition, et jamais hors de l’écran', () => {
  const { ctx } = contexte();
  const c = [carte('a', 10), carte('b', 200), carte('loin', 3000)];
  ctx.animerEntreeCartes(racine(c));
  assert.ok(c[0].a('entre') && c[1].a('entre'));
  assert.ok(!c[2].a('entre'), 'une carte sous la ligne de flottaison n’a personne pour la voir arriver');
  assert.strictEqual(c[1].style.animationDelay, '28ms');
  c[0].finir();
  assert.ok(!c[0].a('entre'), 'la classe part en fin d’animation');
  // Second rendu (filtre, cycle de collecte) : les mêmes actus ne rejouent rien.
  const d = [carte('a', 10), carte('b', 200)];
  ctx.animerEntreeCartes(racine(d));
  assert.ok(!d[0].a('entre') && !d[1].a('entre'));
});

test('dix cartes animées au plus par rendu', () => {
  const { ctx } = contexte();
  const c = Array.from({ length: 30 }, (_, i) => carte('x' + i, i));
  ctx.animerEntreeCartes(racine(c));
  assert.strictEqual(c.filter((x) => x.a('entre')).length, 10);
});

test('rien ne s’anime sous prefers-reduced-motion ni au clavier', () => {
  for (const o of [{ reduit: true }, { clavier: true }]) {
    const { ctx } = contexte(o);
    const c = [carte('a', 10)];
    ctx.animerEntreeCartes(racine(c));
    assert.ok(!c[0].a('entre'), JSON.stringify(o));
  }
});

test('l’écouteur de chargement des images est posé avant de masquer les images', () => {
  // Masquer d'abord ferait rester à 0 une image chargée entre les deux.
  const i = SRC.indexOf("addEventListener('load'");
  const j = SRC.indexOf("classList.add('mvt-images')");
  const k = SRC.indexOf('i.complete');
  assert.ok(i > 0 && k > i && j > k, 'ordre attendu : écouteur, images déjà chargées, puis marqueur');
  assert.match(CSS, /html\.mvt-images \.vact img\{opacity:0/);
  assert.match(CSS, /html\.mvt-images \.vact img\.img-pret\{opacity:1\}/);
});

test('une garde globale coupe tout mouvement sous prefers-reduced-motion', () => {
  const m = CSS.match(/@media \(prefers-reduced-motion:reduce\)\{([\s\S]*?)\n\}/);
  assert.ok(m, 'garde absente');
  assert.match(m[1], /\*,\*::before,\*::after\{animation-duration:\.01ms !important;animation-iteration-count:1 !important;transition-duration:\.01ms !important/);
});

test('aucune couleur de gravité dans le bloc de mouvement', () => {
  for (const v of ['--r)', '--a)', '--m)', '--g)', '--j)', '#B91C1C', '#CA8A04'])
    assert.ok(!CSS.includes(v), 'le mouvement ne doit pas toucher aux niveaux : ' + v);
});

test('le skill de référence est présent, avec sa licence et sans script', () => {
  const d = path.join(__dirname, '../../.claude/skills/design-motion-principles');
  assert.match(fs.readFileSync(path.join(d, 'LICENSE'), 'utf8'), /^MIT License/);
  assert.ok(fs.existsSync(path.join(d, 'SKILL.md')));
  const tous = (r) => fs.readdirSync(r, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tous(path.join(r, e.name)) : [path.join(r, e.name)]));
  for (const f of tous(d)) {
    assert.ok(/\.(md|html)$|LICENSE$/.test(f), 'fichier inattendu : ' + f);
    assert.ok(!/<script/i.test(fs.readFileSync(f, 'utf8')), 'script dans ' + f);
  }
});
