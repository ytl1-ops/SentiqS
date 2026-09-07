// Quand la barre de modules deborde, on doit pouvoir en sortir.
//
// Audit d'interface du 07/09/2026, mesure sur la page rendue :
//
//   390 px : barre 757 px pour 334 visibles — Geopolitique, Rapports,
//            Alertes et Tableau de bord hors champ. Fleches presentes.
//   768 px : barre 823 px pour 768 visibles — Tableau de bord hors champ,
//            et AUCUNE fleche : la regle qui les affiche vit dans
//            @media (max-width:760px), donc elle ne s'applique pas.
//
// Entre 761 et ~830 px, les deux modules les plus importants d'un outil de
// surete etaient hors de vue sans que rien ne l'indique. Une largeur d'ecran
// ne dit pas si une barre deborde : seule la mesure le dit.
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche } = require('./_bac');

test('le debordement est MESURE, pas deduit d\'une largeur d\'ecran', () => {
  assert.match(HTML, /function majDebordementOnglets\(/,
    'une fonction doit mesurer scrollWidth contre clientWidth');
  const f = tranche('function majDebordementOnglets(', '\n}');
  assert.match(f, /scrollWidth/);
  assert.match(f, /clientWidth/);
  assert.match(f, /nav-deborde/, 'la classe doit refleter la mesure');
});

test('la mesure est refaite quand la fenetre change de taille', () => {
  // Passer du portrait au paysage change la largeur sans recharger la page :
  // une mesure faite une fois au demarrage se perime aussitot.
  assert.match(HTML, /addEventListener\('resize', majDebordementOnglets\)/);
});

test('les fleches apparaissent des que la barre deborde, quelle que soit la largeur', () => {
  assert.match(HTML, /\.nav-wrap\.nav-deborde \.nav-arrow\{display:flex/,
    'une regle doit afficher les fleches sur la seule foi de la mesure');
  // Elle doit l'emporter sur la regle qui les cache en mode « WEB » force :
  // si la barre deborde, la sortie doit rester visible.
  const iMesure = HTML.indexOf('.nav-wrap.nav-deborde .nav-arrow{display:flex');
  const iForce = HTML.indexOf('html.force-web .nav-arrow{display:none');
  assert.ok(iMesure !== -1 && iForce !== -1, 'les deux regles doivent exister');
  assert.match(HTML.slice(iMesure, iMesure + 160), /!important/,
    'la regle mesuree doit pouvoir l\'emporter sur les regles de mode force');
});

test('un bord estompe montre que la barre continue', () => {
  // Deux fleches grises aux extremites se lisent comme des boutons inertes.
  // Un degrade dit « il y a la suite », c'est ce que l'oeil cherche.
  assert.match(HTML, /\.nav-wrap\.nav-deborde \.nav\{/, 'la barre doit porter un indice visuel de continuite');
  assert.match(HTML, /\.nav-wrap\.nav-deborde \.nav\{[^}]*mask-image|\.nav-wrap\.nav-deborde \.nav\{[^}]*linear-gradient/);
});
