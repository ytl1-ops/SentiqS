// Mobile : le contenu d'abord — 22/10/2026.
//
// Capture de YORO sur téléphone (texte agrandi par le navigateur) : les
// bandeaux du haut (« Cliquez sur Actualiser », collecte, flash info, filtre
// pays, onglets, en-tête de module) et du bas (note d'aide, pied de page en
// capitales sur neuf lignes) ne laissaient qu'une bande de contenu. Cause : la
// page etait une coque de hauteur fixe (body 100dvh, overflow:hidden) dont
// seule la zone centrale defilait. Ces gardes exigent que, sur mobile, la page
// defile d'un bloc et que les bandeaux redondants restent replies.
const test = require('node:test');
const assert = require('node:assert');
const { HTML } = require('./_bac');

const DEBUT = '/* ═══ MOBILE : LE CONTENU D\'ABORD';
function bloc() {
  const i = HTML.indexOf(DEBUT);
  assert.ok(i > 0, 'bloc « MOBILE : LE CONTENU D\'ABORD » introuvable');
  return HTML.slice(i, HTML.indexOf('</style>', i));
}
function regles(prefixe) {
  return bloc().split('\n').map((l) => l.trim())
    .filter((l) => l.startsWith(prefixe + ' '))
    .map((l) => l.split(prefixe + ' ').join(''));
}

test('les regles mobiles sont ecrites a l\'identique pour l\'ecran etroit et le mode mobile force', () => {
  const etroit = regles('html:not(.force-web)');
  const force = regles('html.force-mobile');
  assert.ok(etroit.length >= 10, 'bloc mobile vide : ' + etroit.length + ' regle(s)');
  assert.deepStrictEqual(force, etroit);
});

test('chaque selecteur d\'une liste porte son prefixe mobile (sinon la regle fuit sur le bureau)', () => {
  for (const l of bloc().split('\n').map((x) => x.trim()).filter((x) => x.includes('{') && !x.startsWith('@') && !x.startsWith('/*'))) {
    const sel = l.slice(0, l.indexOf('{'));
    for (const s of sel.split(',')) {
      assert.match(s.trim(), /^html(:not\(\.force-web\)|\.force-mobile) /, 'selecteur sans prefixe mobile : ' + s);
    }
  }
});

test('sur mobile la page defile d\'un bloc, hors du mode plein ecran d\'un module', () => {
  const r = regles('html.force-mobile').join('\n');
  assert.match(r, /body:not\(\.plein-ecran-module\)\{height:auto;[^}]*overflow:visible\}/,
    'le body doit perdre sa hauteur fixe et son overflow:hidden');
  assert.match(r, /> \.layout > \.main[^{]*\{flex:none;[^}]*overflow:visible\}/, 'la zone centrale ne doit plus etre le seul defilement');
  assert.match(r, /body:not\(\.plein-ecran-module\) > \.tb\{position:sticky;top:0/, 'la barre du haut (Actualiser, langue, compte) reste accessible');
  // Un overflow sur le body en ferait un conteneur de defilement : la barre
  // collee ne collerait plus (mesure du 22/10/2026, tbTop = -700 apres defilement).
  assert.doesNotMatch(r, /body:not\(\.plein-ecran-module\)\{[^}]*overflow-y:auto/);
});

test('les bandeaux redondants sont replies sur mobile, jamais sur le bureau', () => {
  const r = regles('html.force-mobile').join('\n');
  assert.match(r, /^\.proxy-bar\{display:none\}$/m, 'le bandeau « Cliquez sur Actualiser » redouble le bouton de la barre du haut');
  assert.match(r, /^\.view-note\{display:none\}$/m);
  assert.match(r, /^\.stbar\{position:static;[^}]*text-transform:none/m, 'le pied de page ne doit plus etre colle ni en capitales');
  assert.match(r, /^\.tb-r\{flex:0 1 auto;min-width:0\}$/m, 'la barre du haut ne doit plus deborder a droite');
});

test('sans photo ni video, aucun cadre de visuel ne s\'affiche, dans tous les modules', () => {
  // Consigne du 23/10/2026 : le repli de marque occupait la place d'une image
  // absente. Une seule regle, hors media query : bureau et mobile, Flux, A la
  // une, faits du jour et detail d'une actu passent tous par visuelActu().
  assert.match(HTML, /\n\.vact\.sans-img:not\(\.vact-video\)\{display:none\}/);
  assert.match(HTML, /\n\.det-visuel:has\(> \.vact\.sans-img:not\(\.vact-video\)\)\{display:none\}/);
  // L'image qui echoue au chargement doit poser sans-img, sinon un cadre vide reste.
  assert.match(HTML, /onerror="this\.parentElement\.classList\.add\(\\'sans-img\\'\);this\.remove\(\)"/);
});

test('sur mobile l\'en-tete du tableau de bord, redondant avec l\'onglet, est masque', () => {
  assert.match(HTML, /<div id="dashEntete"/);
  assert.match(regles('html.force-mobile').join('\n'), /^#dashEntete\{display:none\}$/m);
});
