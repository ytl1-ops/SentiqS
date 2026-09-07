// On doit pouvoir changer de module au clavier.
//
// Audit d'interface du 07/09/2026, parcours reel avec la touche Tab dans
// Chromium : quatorze arrets, et AUCUN n'etait un onglet. On atteignait
// FR/EN, WEB/MOBILE, Actualiser, Sombre, Diagnostic, un menu pays,
// Cartogramme/Radar/Profil, puis l'e-mail du pied de page. Flux, Alertes et
// Tableau de bord etaient hors d'atteinte : les huit modules sont des
// <div onclick> sans role ni tabindex. Sur 130 elements cliquables, 118
// etaient invisibles au clavier.
//
// Le cliquet d'accessibilite du depot etait vert pendant ce temps : il mesure
// les NOMS accessibles des champs, une propriete plus etroite que la
// pilotabilite au clavier. Le controle ne mentait pas, il mesurait autre
// chose.
//
// Les reperes sont poses en ATTRIBUTS, jamais en changeant les balises : le
// CSS de cette page est entierement indexe sur les classes.
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche } = require('./_bac');

const nav = tranche('<div class="nav" id="navTabs"', '</div>\n</div>');
const onglets = [...nav.matchAll(/<div class="ntab[^"]*"([^>]*)>/g)].map((m) => m[1]);

test('les huit modules sont annonces comme des onglets', () => {
  assert.ok(onglets.length >= 8, 'au moins huit onglets attendus, vus : ' + onglets.length);
  assert.match(HTML, /id="navTabs"[^>]*role="tablist"/, 'la barre doit etre une liste d\'onglets');
  for (const attrs of onglets) {
    assert.match(attrs, /role="tab"/, 'onglet sans role="tab" : ' + attrs.slice(0, 70));
    assert.match(attrs, /aria-selected="(true|false)"/, 'onglet sans aria-selected : ' + attrs.slice(0, 70));
    assert.match(attrs, /tabindex="(0|-1)"/, 'onglet sans tabindex : ' + attrs.slice(0, 70));
  }
});

test('un seul onglet est dans l\'ordre de tabulation, et c\'est l\'actif', () => {
  // Motif standard du « tabindex glissant » : la barre est UN arret, les
  // fleches circulent dedans. Neuf arrets de plus n'aideraient personne.
  const zero = onglets.filter((a) => /tabindex="0"/.test(a));
  assert.strictEqual(zero.length, 1, 'un seul onglet doit porter tabindex="0", vus : ' + zero.length);
  assert.match(zero[0], /aria-selected="true"/, 'l\'onglet atteignable doit etre l\'onglet actif');
});

test('la touche Entree et les fleches pilotent la barre', () => {
  assert.match(HTML, /function clavierOnglets\(/, 'un gestionnaire clavier doit exister');
  const g = tranche('function clavierOnglets(', '\n}');
  for (const touche of ['Enter', ' ', 'ArrowRight', 'ArrowLeft', 'Home', 'End']) {
    assert.ok(g.includes("'" + touche + "'"), 'touche non geree : ' + JSON.stringify(touche));
  }
  assert.match(HTML, /addEventListener\('keydown', clavierOnglets\)/, 'le gestionnaire doit etre branche');
});

test('switchView tient aria-selected et le tabindex a jour', () => {
  // Un onglet visuellement actif mais annonce « non selectionne » dit deux
  // choses contraires selon qu'on regarde ou qu'on ecoute.
  const sv = tranche('function switchView(name,el){', '\n}');
  assert.match(sv, /aria-selected/, 'switchView doit mettre aria-selected a jour');
  assert.match(sv, /tabIndex|tabindex/, 'switchView doit deplacer le tabindex glissant');
});

test('les liens ecrits en <span onclick> sont activables au clavier', () => {
  // « Demander un acces », « Mot de passe oublie ? », « Bulletin public
  // gratuit »... : cliquables a la souris, inexistants au clavier.
  const spans = [...HTML.matchAll(/<span([^>]*\sonclick=[^>]*)>/g)].map((m) => m[1]);
  const muets = spans.filter((a) => !/tabindex=/.test(a) || !/role=/.test(a));
  assert.deepStrictEqual(muets.map((a) => a.slice(0, 60)), [],
    'ces <span onclick> n\'ont ni role ni tabindex : ' + muets.length);
});
