// Revue de présentation des pages HORS APPLI (accueil, fiches pays, hub, pages
// légales) du 15/10/2026 : ce qui a été corrigé à la racine doit le rester.
//
// Ces contrôles lisent le code source (jetons, tailles, repères, attributs).
// Le rendu réel — contraste mesuré pixel par pixel sur chaque image de la
// vidéo de fond, cibles tactiles, débordement mobile — a été vérifié avec
// Playwright ; les chiffres avant/après sont dans CLAUDE.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8');
const accueil = lire('web', 'index.html');
const legales = fs.readdirSync(path.join(RACINE, 'web', 'legal')).filter((f) => f.endsWith('.html'));
const fiches = fs.readdirSync(path.join(RACINE, 'web', 'pays')).filter((f) => f.endsWith('.html'));

const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const compose = (fg, a, bg) => fg.map((v, i) => v * a + bg[i] * (1 - a));
const rapport = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

function jetonAlpha(html, nom) {
  const m = new RegExp('--' + nom + ':\\s*rgba\\(245,\\s*247,\\s*250,\\s*([0-9.]+)\\)').exec(html);
  assert.ok(m, 'jeton --' + nom + ' introuvable');
  return parseFloat(m[1]);
}

test('accueil : les trois niveaux de texte atténué tiennent 4,5:1 sur tous les fonds de la page', () => {
  const fonds = { bg: '#05080B', bg2: '#070C11', panel: '#101A22', 'panel-b': '#1C2E3D', navy: '#16212C', 'bande finale': '#24384A' };
  const encre = hex('#F5F7FA');
  for (const j of ['ink2', 'ink3', 'ink4']) {
    const a = jetonAlpha(accueil, j);
    for (const [nom, f] of Object.entries(fonds)) {
      const r = rapport(compose(encre, a, hex(f)), hex(f));
      assert.ok(r >= 4.5, `--${j} (${a}) sur ${nom} : ${r.toFixed(2)}:1`);
    }
  }
  // Hiérarchie conservée : chaque niveau reste plus discret que le précédent.
  assert.ok(jetonAlpha(accueil, 'ink2') > jetonAlpha(accueil, 'ink3') && jetonAlpha(accueil, 'ink3') > jetonAlpha(accueil, 'ink4'));
});

test('fiches pays, hub et gabarit : texte atténué lisible sur les cartes', () => {
  const carte = hex('#1C2E3D'), encre = hex('#F5F7FA');
  for (const f of [...fiches.map((n) => path.join('web', 'pays', n)), path.join('scripts', 'templates', 'fiche-country.template.html')]) {
    const html = lire(f);
    const m = /--ink4:\s*rgba\(245,\s*247,\s*250,\s*([0-9.]+)\)/.exec(html);
    if (!m) continue;
    const r = rapport(compose(encre, parseFloat(m[1]), carte), carte);
    assert.ok(r >= 4.5, `${f} : --ink4 ${m[1]} sur carte = ${r.toFixed(2)}:1`);
  }
  const hub = lire('web', 'pays', 'index.html');
  assert.doesNotMatch(hub, /footer a\{color:rgba\(245,247,250,\.44\)\}/, 'le pied de page du hub ne revient pas à .44 (4,1:1)');
});

test('plancher de 10 px sur toutes les pages hors appli', () => {
  const pages = ['web/index.html', ...fiches.map((n) => 'web/pays/' + n), ...legales.map((n) => 'web/legal/' + n), 'scripts/templates/fiche-country.template.html'];
  for (const p of pages) {
    const html = lire(p);
    for (const m of html.matchAll(/font-size\s*:\s*([0-9.]+)px(?!")/g)) {
      assert.ok(parseFloat(m[1]) >= 10, `${p} : font-size ${m[0]}`);
    }
  }
});

test('accueil : les boutons « fantôme » ne prennent plus le gris du navigateur', () => {
  // <button class="btn btn-ghost"> héritait de #EFEFEF avec un texte blanc (1,1:1) sur 3 forfaits sur 4.
  const btn = /\.btn\{[^}]*\}/.exec(accueil);
  assert.ok(btn && /background:transparent/.test(btn[0]), '.btn doit réinitialiser son fond');
  assert.ok(accueil.indexOf(btn[0]) < accueil.indexOf('.btn-primary{'), 'le fond transparent précède .btn-primary qui le surcharge');
  assert.match(accueil, /\.plan-badge\{[^}]*color:#fff/, 'badge « Recommandé » : texte blanc sur bleu (le texte sombre tombait à 2,9:1)');
});

test('accueil : texte lisible sur la vidéo — voile local, mot clé en bleu ciel, ombre portée', () => {
  assert.match(accueil, /\.hero-content::before\{[^}]*radial-gradient\([^)]*closest-side/, 'voile radial derrière le texte');
  assert.match(accueil, /\.hero-content\{[^}]*isolation:isolate/);
  assert.match(accueil, /\.hero h1 em\{[^}]*color:var\(--sky\)/, 'mot clé du titre en bleu ciel (le bleu marine tombait à 1,0:1)');
  assert.doesNotMatch(accueil, /\.hero h1 em\{[^}]*color:var\(--navy\)/);
  assert.match(accueil, /\.hero h1\{text-shadow:/);
  assert.match(accueil, /\.hero \.btn-ghost\{background:rgba\(5,8,11,/, 'bouton secondaire de l\'accueil lisible sur toute la vidéo');
});

test('accueil : repère principal, lien d\'évitement, hiérarchie de titres sans saut', () => {
  assert.match(accueil, /<a class="skip-link" href="#main">/);
  assert.match(accueil, /<main id="main" tabindex="-1">[\s\S]*<\/main>\s*<footer>/);
  const niveaux = [...accueil.matchAll(/<h([1-6])[\s>]/g)].map((m) => +m[1]);
  assert.equal(niveaux.filter((n) => n === 1).length, 1, 'un seul h1');
  niveaux.forEach((n, i) => { if (i) assert.ok(n - niveaux[i - 1] <= 1, `saut de h${niveaux[i - 1]} à h${n}`); });
  assert.match(accueil, /a:focus-visible,button:focus-visible/, 'anneau de focus global');
  assert.match(accueil, /prefers-reduced-motion:reduce\)\{html\{scroll-behavior:auto\}/);
});

test('accueil : zones tactiles ≥ 24 px — navigation, pied de page, fermeture du formulaire', () => {
  assert.match(accueil, /\.nav-links a,\.foot-col a,\.foot-bottom a\{padding:6px 3px;margin:-6px -3px\}/);
  assert.match(accueil, /\.modal-close\{min-width:36px;min-height:36px/);
});

test('fiches pays : le teaser d\'alertes flouté est masqué aux lecteurs d\'écran, partout où il est produit', () => {
  const sources = [
    ...fiches.map((n) => 'web/pays/' + n),
    'scripts/generate-country-fiche.js',
  ];
  for (const f of sources) {
    const t = lire(f);
    for (const m of t.matchAll(/<div class="alert-blur-item"([^>]*)>/g)) {
      assert.match(m[1], /aria-hidden="true"/, f + ' : un item d\'alerte flouté est lisible par les lecteurs d\'écran');
    }
  }
  assert.doesNotMatch(lire('scripts', 'templates', 'fiche-country.template.html'), /<div class="alert-blur-item">/);
});

test('fiches pays et hub : focus visible, zones tactiles, défilement doux coupé', () => {
  for (const n of [...fiches.map((x) => 'web/pays/' + x), 'scripts/templates/fiche-country.template.html']) {
    const t = lire(n);
    assert.match(t, /a:focus-visible,button:focus-visible\{outline:2px solid var\(--sky\)/, n);
    assert.match(t, /\.breadcrumb a,footer a\{padding:5px 3px;margin:-5px -3px\}/, n);
    assert.match(t, /prefers-reduced-motion:reduce\)\{html\{scroll-behavior:auto\}\}/, n);
  }
});

test('pages légales : repère principal, mode sombre lisible, tableaux empilés sur mobile', () => {
  for (const n of legales) {
    const t = lire('web', 'legal', n);
    assert.match(t, /<main>[\s\S]*<\/main>\s*<footer>/, n + ' : <main> manquant');
    assert.match(t, /prefers-color-scheme: dark\) \{ :root \{ --maj: #a8b5c8; --lien: #8ab4f8/, n + ' : jetons du mode sombre');
    assert.match(t, /a:focus-visible/, n);
    // Les gris/bleus du mode clair ne repassent pas en dur (3,4:1 sur fond sombre).
    assert.doesNotMatch(t, /a \{ color: #2563eb; \}/, n);
    if (/<table>/.test(t)) {
      assert.match(t, /td\[data-l\]::before/, n);
      for (const tr of t.match(/<tr>(?:(?!<\/tr>)[\s\S])*<\/tr>/g) || []) {
        if (/<td/.test(tr)) assert.doesNotMatch(tr, /<td(?![^>]*data-l=)/, n + ' : cellule sans étiquette de colonne');
      }
    }
  }
  // Ratio des jetons sombres sur le fond sombre par défaut du navigateur (#121212).
  const fond = [18, 18, 18];
  for (const c of ['#a8b5c8', '#8ab4f8']) assert.ok(rapport(hex(c), fond) >= 4.5, c);
  for (const c of ['#475569', '#1d4ed8']) assert.ok(rapport(hex(c), [255, 255, 255]) >= 4.5, c + ' sur blanc');
});

test('contenu légal intact : les emplacements « À COMPLÉTER » n\'ont ni bougé ni disparu', () => {
  // La revue touche la structure et le style, jamais le texte juridique.
  const attendus = { 'cgv.html': null, 'confidentialite.html': null, 'mentions-legales.html': null };
  for (const n of legales) assert.ok(n in attendus, 'page légale inattendue : ' + n);
  const t = lire('web', 'legal', 'confidentialite.html');
  assert.ok((t.match(/À COMPLÉTER/g) || []).length >= 8);
  assert.match(t, /<meta name="robots" content="noindex,nofollow">/, 'noindex conservé tant que la page est trouée');
});
