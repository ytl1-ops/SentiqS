// Revision de presentation du 15/10/2026 : lisibilite, zones de clic, clavier.
//
// Mesure sur le DOM RENDU des 9 modules (clair/sombre, bureau/mobile), avant
// cette passe, cumulee sur les 36 combinaisons : 1 836 textes sous le seuil AA,
// 6 520 textes sous le plancher de 10px, 948 cliquables sans acces clavier,
// 1 274 cibles de clic sous 24px. Apres : 10 (boutons desactives), 0, 0, 8.
//
// Ces tests gardent les CAUSES, pas les chiffres (les chiffres se mesurent
// dans un navigateur : scripts/verifier-accessibilite-interface.js). Chacune
// a deja coute une regression silencieuse :
//   - une taille < 10px reintroduite dans une feuille de classes ;
//   - un nouveau niveau d'alerte dont le fond pastel n'a pas son equivalent
//     sombre (le texte eclairci du theme sombre se retrouvait sur un
//     rectangle clair : Alertes passait de 349 a 527 defauts) ;
//   - une carte du Flux qui perd son titre atteignable, ou qui reaffiche deux
//     fois la meme information (pastille « RSS », categorie).
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche, bac, exposer } = require('./_bac');

// La feuille de style principale, sans les blocs @media print (qui ont leurs
// propres tailles, en points, pour le papier).
const css = tranche('<style>\n:root{', '</style>');
function sansPrint(src) {
  let sortie = '', prof = 0, dans = false;
  for (const l of src.split('\n')) {
    if (!dans && l.trimStart().startsWith('@media print')) { dans = true; prof = 0; }
    if (dans) { prof += (l.match(/{/g) || []).length - (l.match(/}/g) || []).length; if (prof <= 0 && l.includes('}')) dans = false; continue; }
    sortie += l + '\n';
  }
  return sortie;
}
const cssEcran = sansPrint(css);
// Sans les commentaires : on ne juge que les declarations.
const declarations = cssEcran.replace(/\/\*[\s\S]*?\*\//g, '');

test('aucune declaration CSS de classe sous le plancher de 10px', () => {
  // (?!") : les SELECTEURS d'attribut du plancher en ligne contiennent le texte « font-size:7px" ».
  const trop = [...declarations.matchAll(/font-size:\s*(7|7\.5|8|8\.5|9|9\.5)px(?!")/g)];
  assert.strictEqual(trop.length, 0,
    trop.length + ' declaration(s) sous --fs-micro (10px). Utilisez var(--fs-micro), le plancher du systeme de jetons.');
});

test('le plancher de 10px couvre aussi les styles en ligne (hors <svg>)', () => {
  for (const px of ['7', '7.5', '8', '8.5', '9', '9.5']) {
    assert.ok(css.includes('[style*="font-size:' + px + 'px" i]:not(svg *)'),
      'le plancher en ligne doit couvrir font-size:' + px + 'px');
  }
  assert.match(css, /font-size:var\(--fs-micro\) !important}/, 'le plancher en ligne doit etre pose avec !important');
});

test('les trois jetons ajoutes sont declares dans :root ET dans le theme sombre', () => {
  const iRoot = css.indexOf(':root{');
  const clair = css.slice(iRoot, css.indexOf('}', iRoot));
  const iDark = css.indexOf('html[data-theme="dark"]{');
  const sombre = css.slice(iDark, css.indexOf('}', iDark));
  for (const jeton of ['--on-b', '--bleu-txt', '--violet-txt']) {
    assert.ok(clair.includes(jeton + ':'), jeton + ' manque a :root');
    assert.ok(sombre.includes(jeton + ':'), jeton + ' manque au theme sombre');
  }
});

test('chaque fond pastel de niveau d\'alerte a son equivalent sombre', () => {
  // NIV.bg / NIV.bgLight sont ecrits en dur dans des styles en ligne ET lus par
  // les exports (on ne les change donc pas) : c'est le CSS sombre qui les
  // retraduit. Un nouveau niveau, ou une nouvelle teinte, sans sa regle
  // reapparait comme un rectangle clair portant du texte clair.
  const niv = tranche('const NIV = {', '};');
  const fonds = [...new Set([...niv.matchAll(/\b(?:bg|bgLight):'(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1].toUpperCase()))];
  assert.ok(fonds.length >= 8, 'NIV doit exposer au moins 8 fonds, vus : ' + fonds.length);
  for (const h of fonds) {
    const re = new RegExp('html\\[data-theme="dark"\\] body \\[style\\*="background:' + h + '" i\\]', 'i');
    assert.match(css, re, 'le fond ' + h + ' (NIV) n\'a pas d\'equivalent en theme sombre');
  }
});

test('le texte sombre de gravite passe par les jetons, pas par une teinte fixe', () => {
  for (const jeton of ['var(--a)', 'var(--r)', 'var(--g)', 'var(--m)', 'var(--j-txt)']) {
    assert.ok(css.includes('{color:' + jeton + ' !important}'), 'aucune regle sombre ne cible ' + jeton);
  }
  assert.match(css, /html\[data-theme="dark"\] \.asum\{color:var\(--t2\) !important\}/,
    'le resume de carte (#4B5563 !important) doit etre retraduit en sombre');
});

test('couleurTexteSur choisit le texte le plus lisible', () => {
  const src = tranche('function couleurTexteSur(', '// balisesArticleHtml(a, pre)');
  const ctx = bac(src);
  const contraste = (a, b) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = (h) => { const n = parseInt(h.replace('#', ''), 16); return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
    const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  // Le blanc sur l'orange #F97316 ne faisait que 2,8:1 (mesure du 15/10/2026).
  for (const fond of ['#F97316', '#E5731B', '#CA8A04', '#D9A85C', '#8A5D1A', '#0F4F2A', '#4B5563', '#FDE047']) {
    const txt = ctx.couleurTexteSur(fond);
    const autre = txt === '#fff' ? '#1B1408' : '#FFFFFF';
    const txtPlein = txt === '#fff' ? '#FFFFFF' : txt;
    assert.ok(contraste(txtPlein, fond) >= contraste(autre, fond), fond + ' : ' + txt + ' n\'est pas le meilleur choix');
    assert.ok(contraste(txtPlein, fond) >= 4.5, fond + ' : contraste ' + contraste(txtPlein, fond).toFixed(2) + ' < 4,5');
  }
  assert.strictEqual(ctx.couleurTexteSur(undefined), '#fff', 'repli blanc si la couleur est illisible');
  assert.strictEqual(ctx.couleurTexteSur('var(--b)'), '#fff', 'repli blanc pour un jeton CSS');
});

// ── Carte du Flux ──
const carte = tranche('function renderOneArt(a){', '// ── Groupement par ville');

test('la carte ne repete pas « RSS » : une pastille generique en moins, une seule au pied', () => {
  assert.ok(!carte.includes('<span class="rtag">RSS</span>'), 'la pastille generique « RSS » de la ligne secondaire est revenue');
  const pieds = carte.match(/sb-rss/g) || [];
  assert.strictEqual(pieds.length, 1, 'le badge RSS du pied de carte doit exister une seule fois');
  assert.match(carte, /a\.fromRSS && a\._srcBadge\) \? ''/, 'le pied ne doit pas redire « RSS » quand la ligne secondaire porte deja le type de source');
});

test('la categorie n\'est ecrite qu\'une fois', () => {
  assert.match(carte, /const catDoublon = balArt\.some\(/, 'le doublon categorie/balise doit etre detecte');
  assert.match(carte, /\(catDoublon \? '' : '<span class="stag">'\+catFr\(a\.cat\)/, 'la puce de categorie doit disparaitre quand une balise la porte');
  assert.match(carte, /balisesArticleHtml\(a, balArt\)/, 'les balises sont calculees une fois par carte');
});

test('le titre de la carte est un arret de tabulation (et la carte entiere ne l\'est pas)', () => {
  assert.match(carte, /<div class="atit" id="trt-'\+a\.id\+'" role="button" tabindex="0">/);
  assert.ok(!/<div class="art l[^>]*tabindex/.test(carte), 'la carte entiere ne doit pas porter tabindex (elements interactifs imbriques)');
});

test('sous un en-tete de pays le nom reste lisible pour un lecteur d\'ecran', () => {
  assert.match(carte, /<span class="cy-nom">'\+cc\.name\+'<\/span>/, 'le nom du pays doit rester dans le DOM, dans .cy-nom');
  assert.match(css, /\.feed-pays-bloc \.art-top \.flagcy \.cy-nom\{position:absolute!important/, 'et n\'etre masque qu\'a l\'ecran');
});

test('l\'en-tete de pays du Flux est un bouton collant qui annonce critiques et eleves', () => {
  const rendu = tranche('// En-tete pays uniquement si on est en mode "Tous les pays"', 'villesTriees.forEach(ville => {\n      html += buildVilleBlock');
  assert.match(rendu, /class="feed-pays-hd" role="button" tabindex="0" onclick="ouvrirVuePays/);
  assert.match(rendu, /nCrit/); assert.match(rendu, /nHigh/);
  assert.match(rendu, /feed-pays-n/, 'le nombre d\'articles du pays doit rester affiche');
  assert.match(css, /\.feed-pays-hd\{position:sticky;top:0/, 'l\'en-tete doit etre collant');
  assert.ok(!rendu.includes('background:var(--b);color:#fff'), 'le bandeau bronze plein est revenu');
});

test('les regles mobiles du Flux existent sous .force-mobile ET sous la media query', () => {
  // Le bouton Web/Mobile duplique les regles mobiles : en oublier une moitie
  // fait diverger les deux affichages (deja arrive).
  for (const regle of ['.art{display:block}', '.art .sico{display:none}', '.feed-pays-hd{padding:var(--sp-2) var(--sp-3)}']) {
    assert.ok(css.includes('html:not(.force-web) ' + regle), 'media query : ' + regle + ' manque');
    assert.ok(css.includes('html.force-mobile ' + regle), '.force-mobile : ' + regle + ' manque');
  }
});

test('libelles du Flux ecrits avec leurs accents', () => {
  const barre = tranche('<div class="tlbr">', '<!-- Barre DL Flux -->');
  for (const mauvais of ['Plus recent<', 'Priorite<', 'Fiabilite<', '>Economique<', 'Rafraichir', 'donnees deja']) {
    assert.ok(!barre.includes(mauvais), 'libelle sans accent dans la barre du Flux : ' + mauvais);
  }
  for (const mauvais of ['Ville non precisee', 'Autres quartiers / non precise', '>ESTIME<', '(estime)']) {
    assert.ok(!HTML.includes(mauvais), 'libelle sans accent : ' + mauvais);
  }
  for (const bon of ['Plus récent', 'Priorité', 'Fiabilité', 'Économique', 'Ville non précisée', 'Recoupé · ', 'Source unique']) {
    assert.ok(HTML.includes(bon), 'libelle attendu : ' + bon);
  }
});

// ── Clavier ──
test('tout cliquable ecrit en <div onclick> est rendu atteignable, partout', () => {
  assert.match(HTML, /function accessibiliserCliquables\(racine\)/);
  assert.match(HTML, /new MutationObserver\(/, 'le rendu ajoute apres coup doit etre couvert (observateur)');
  const fn = tranche('function accessibiliserCliquables(racine) {', '(function demarrerAccessibiliteCliquables()');
  assert.match(fn, /closest\('#navTabs, svg'\)/, 'les onglets (tabindex glissant) et le SVG de la carte sont exclus');
  assert.match(fn, /position === 'fixed'/, 'un voile plein ecran ne devient pas un arret de tabulation');
  assert.match(fn, /SEL_TITRE_CARTE/, 'un conteneur qui contient deja des liens/boutons ne devient pas un arret : son titre, oui');
});

test('Entree et Espace activent une ligne de tableau cliquable, sans voler la frappe d\'un champ', () => {
  const fn = tranche('function clavierRolesBouton(ev) {', 'const SEL_TITRE_CARTE');
  assert.match(fn, /tr\[onclick\]\[tabindex="0"\]/);
  assert.match(fn, /ev\.target !== el && ev\.target\.closest/, 'une touche tapee dans un champ de la ligne ne doit pas declencher la ligne');
});

test('zones de clic : pseudo-element debordant, sans grossir la mise en page', () => {
  assert.match(css, /\.slink::after,\.flagcy::after,\.cy-niv-pill::after/);
  assert.match(css, /content:"";position:absolute;inset:-7px -4px\}/);
  assert.match(css, /\.atit\[role="button"\]::after\{content:"";position:absolute;inset:-4px 0\}/);
  assert.match(css, /\.view button:not\(\.tr-btn\):not\(\.share-trigger\)[^{]*\{min-height:24px\}/);
});
