// L'accueil et les pages légales passent aussi en anglais.
//
// Suite du signalement du 21/10/2026 (« passage d'une langue à une autre pas
// possible ») : l'appli était corrigée, mais l'accueil et les pages légales
// restaient en français seul, sans sélecteur. Même moteur que l'appli
// (js/langue.js), table propre (js/dico-site-en.js), même choix mémorisé.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.join(__dirname, '..', '..', 'web');
const L = require(path.join(WEB, 'js', 'langue.js'));
global.SentiqLangue = L;
require(path.join(WEB, 'js', 'dico-site-en.js'));

const PAGES = {
  'index.html': 'js/',
  'legal/cgv.html': '../js/',
  'legal/confidentialite.html': '../js/',
  'legal/mentions-legales.html': '../js/',
};
const lire = (p) => fs.readFileSync(path.join(WEB, p), 'utf8');

test('chaque page charge le moteur, sa table puis le sélecteur, dans cet ordre', () => {
  for (const [p, rep] of Object.entries(PAGES)) {
    const h = lire(p);
    const pos = ['langue.js', 'dico-site-en.js', 'langue-site.js'].map((f) => h.indexOf('<script src="' + rep + f + '"></script>'));
    assert.ok(pos.every((i) => i > 0), p + ' : script manquant ' + pos);
    assert.ok(pos[0] < pos[1] && pos[1] < pos[2], p + ' : ordre de chargement');
  }
  for (const f of ['langue-site.js', 'dico-site-en.js']) assert.ok(fs.existsSync(path.join(WEB, 'js', f)), f);
});

test('chaque page porte un sélecteur FR/EN que le moteur ne traduit pas lui-même', () => {
  for (const p of Object.keys(PAGES)) {
    const h = lire(p);
    const i = h.indexOf('class="lang-switch"');
    assert.ok(i > 0, p + ' : sélecteur absent');
    const bloc = h.slice(i, h.indexOf('</div>', i));
    assert.match(bloc, /data-lang="fr"[^>]*translate="no"/, p);
    assert.match(bloc, /data-lang="en"[^>]*translate="no"/, p);
  }
});

test('les pages légales restent non indexées, non liées, et disent que le français fait foi', () => {
  for (const p of Object.keys(PAGES).filter((x) => x.startsWith('legal/'))) {
    const h = lire(p);
    assert.match(h, /<meta name="robots" content="noindex/, p);
    assert.ok(h.includes('[[À COMPLÉTER'), p + ' : les emplacements à compléter restent dans la source');
    assert.ok(h.includes('<p class="foi">La version française fait foi.</p>'), p);
    assert.match(h, /html\[lang="fr"\] \.foi \{ display: none; \}/, p);
  }
  // verifier-pages-legales.js bloque un lien vers une page incomplète :
  // ajouter le sélecteur ne doit pas en avoir créé un.
  assert.ok(!/href="legal\//.test(lire('index.html')));
  assert.strictEqual(L.traduire('La version française fait foi.'),
    'The French version is the legally binding one; this English version is provided for information only.');
});

test('la table traduit l\'accueil et les pages légales, nombres compris', () => {
  assert.strictEqual(L.traduire('Retour à l\'accueil'), 'Back to home');
  assert.strictEqual(L.traduire('Essai gratuit'), 'Free trial');
  assert.strictEqual(L.traduire('Renvoyer le lien dans 42 s'), 'Resend the link in 42 s');
  assert.strictEqual(L.traduire('7. Nature de l\'information et limites de responsabilité'),
    '7. Nature of the information and limits of liability');
  // Un emplacement à compléter reste signalé comme tel au lecteur anglophone.
  assert.strictEqual(L.traduire('[[À COMPLÉTER : date]]'), '[[TO BE COMPLETED: date]]');
  const fautes = [];
  for (const [fr, en] of Object.entries(L._dico)) {
    if ((en.match(/#/g) || []).length > (fr.match(/#/g) || []).length) fautes.push(fr);
  }
  assert.deepStrictEqual(fautes, [], 'nombre de « # » incohérent : ' + fautes.slice(0, 5).join(' | '));
});

// Faux DOM minimal : assez pour exécuter langue-site.js et observer ce qu'il fait.
function bac(choix) {
  const appels = [];
  const classe = () => { const s = new Set(); return { toggle: (c, on) => (on ? s.add(c) : s.delete(c)), contains: (c) => s.has(c) }; };
  const attributs = (init) => {
    const a = Object.assign({}, init);
    return { getAttribute: (k) => (k in a ? a[k] : null), setAttribute: (k, v) => { a[k] = String(v); }, hasAttribute: (k) => k in a };
  };
  const boutons = ['fr', 'en'].map((lg) => Object.assign(attributs({ 'data-lang': lg }), { classList: classe() }));
  const cellule = attributs({ 'data-l': 'Finalité' });
  let surClic = null;
  const document = {
    readyState: 'complete',
    documentElement: { lang: 'fr' },
    querySelectorAll: (s) => (s === '[data-l]' ? [cellule] : s.startsWith('.lang-btn') ? boutons : []),
    addEventListener: (t, f) => { if (t === 'click') surClic = f; },
  };
  const memoire = { sentinel_lang: choix };
  const SentiqLangue = {
    activer: (lg) => appels.push(lg),
    traduire: (t) => L.traduire(t),
    lireChoix: () => (memoire.sentinel_lang === 'en' ? 'en' : 'fr'),
    memoriser: (lg) => { memoire.sentinel_lang = lg; },
  };
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(WEB, 'js', 'langue-site.js'), 'utf8'), { window, document, SentiqLangue });
  const cliquer = (lg) => surClic({ target: { closest: () => boutons.find((b) => b.getAttribute('data-lang') === lg) } });
  return { appels, boutons, cellule, document, memoire, cliquer };
}

test('le choix mémorisé s\'applique au chargement, et un clic le change et le mémorise', () => {
  const b = bac('en');
  assert.deepStrictEqual(b.appels, ['en']);
  assert.strictEqual(b.document.documentElement.lang, 'en');
  assert.strictEqual(b.boutons[1].getAttribute('aria-pressed'), 'true');
  assert.ok(b.boutons[1].classList.contains('on'));
  // Les étiquettes des tableaux empilés sur mobile (lues par CSS dans data-l).
  assert.strictEqual(b.cellule.getAttribute('data-l'), 'Purpose');

  b.cliquer('fr');
  assert.strictEqual(b.memoire.sentinel_lang, 'fr');
  assert.deepStrictEqual(b.appels, ['en', 'fr']);
  assert.strictEqual(b.document.documentElement.lang, 'fr');
  assert.strictEqual(b.boutons[0].getAttribute('aria-pressed'), 'true');
  assert.strictEqual(b.cellule.getAttribute('data-l'), 'Finalité');

  // Sans choix mémorisé : français.
  assert.deepStrictEqual(bac(null).appels, ['fr']);
});
