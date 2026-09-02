// Accessibilite — les reperes de structure et les libellés de formulaire.
//
// Le controle qui fait foi est scripts/verifier-accessibilite-interface.js :
// il mesure le DOM APRES rendu, parce que l'essentiel de cette interface est
// construit par JavaScript. Ces tests-ci verifient ce qui est verifiable sans
// navigateur, pour que la suite echoue vite quand un repere disparait.
const test = require('node:test');
const assert = require('node:assert');
const { HTML } = require('./_bac.js');

test('le document declare sa langue', () => {
  assert.match(HTML, /<html[^>]*\blang="fr"/);
});

test('la page porte un titre de niveau 1', () => {
  // Mesure du 02/09/2026 : zero <h1> dans le DOM rendu. La page n'annoncait
  // pas ce qu'elle etait.
  assert.match(HTML, /<h1[^>]*>.*SentiqS.*<\/h1>/);
});

test('un lien d evitement precede le contenu', () => {
  assert.match(HTML, /class="saut-contenu" href="#contenuPrincipal"/);
  assert.match(HTML, /\.saut-contenu:focus\{left:0;\}/,
    'il ne doit apparaitre qu\'au clavier, sinon il encombre l\'ecran');
});

test('le lien d evitement pointe sur une cible qui existe', () => {
  // Un lien d'evitement casse est pire que pas de lien : il promet un
  // raccourci et ne va nulle part.
  assert.match(HTML, /id="contenuPrincipal"/);
});

test('les reperes principal et navigation sont poses', () => {
  assert.match(HTML, /class="main" id="contenuPrincipal" role="main"/);
  assert.match(HTML, /class="nav-wrap" role="navigation" aria-label="[^"]+"/);
});

test('le titre de niveau 1 reste lisible par un lecteur d ecran', () => {
  // .sr-only le sort de l'ecran sans le sortir de l'arbre d'accessibilite :
  // display:none le rendrait invisible AUSSI pour le lecteur d'ecran.
  assert.match(HTML, /\.sr-only\{[^}]*position:absolute/);
  assert.doesNotMatch(HTML, /\.sr-only\{[^}]*display:none/);
});

test('les libelles existants sont relies a leur champ', () => {
  // 28 <label> portaient un texte visible sans attribut for : le libelle
  // etait a l'ecran, mais pas dans l'arbre d'accessibilite.
  const relies = (HTML.match(/<label[^>]*\bfor="/g) || []).length;
  assert.ok(relies >= 28, 'seulement ' + relies + ' libelles relies, 28 attendus au minimum');
});

test('les champs sans libelle visible portent un aria-label', () => {
  for (const id of ['sortSel', 'seScope', 'rpPeriode', 'chronoCy', 'tgl18h', 'tglScore']) {
    const m = new RegExp('<(?:select|input|textarea)\\b[^>]*id="' + id + '"[^>]*>');
    const balise = (HTML.match(m) || [''])[0];
    assert.ok(/aria-label="[^"]{4,}"/.test(balise), id + ' n\'a pas de nom accessible : ' + balise.slice(0, 90));
  }
});

test('les libelles poses reprennent le texte deja visible a l ecran', () => {
  // Regle qui compte : un libelle INVENTE est pire qu'un libelle absent — il
  // decrit a l'utilisateur un autre controle que celui qu'il manipule. Ces
  // trois-la ont ete repris mot pour mot du texte affiche a cote.
  assert.match(HTML, /id="tgl18h"[^>]*aria-label="Filtre 12h automatique"/);
  assert.match(HTML, /id="tglAutoRefresh"[^>]*aria-label="Actualisation automatique \(15 min\)"/);
  assert.match(HTML, /id="tglScore"[^>]*aria-label="Afficher le niveau de fiabilite"/);
  for (const t of ['Filtre 12h automatique', 'Actualisation automatique (15 min)', 'Afficher le niveau de fiabilite']) {
    assert.ok(HTML.includes('>' + t + '<'), 'le texte « ' + t + ' » doit rester affiche a l\'ecran');
  }
});

test('le mouvement reduit reste respecte', () => {
  assert.match(HTML, /prefers-reduced-motion/);
});
