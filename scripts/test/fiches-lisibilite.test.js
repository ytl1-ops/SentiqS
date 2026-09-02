// Ce que le lecteur d'une fiche pays peut reellement lire, et dater.
//
// Trois defauts mesures le 02/09/2026 sur les neuf fiches publiques :
//
//  - la note « Sources » livree le matin meme utilisait var(--muted,#6b675f),
//    un jeton qui n'existe dans aucune de ces pages. Le repli s'appliquait
//    donc : un gris de theme clair sur un fond quasi noir, 3,57:1 ;
//  - --ink3 (date, fil d'Ariane, liens de pied) etait a 4,10:1 et --ink4
//    (texte de pied de page) a 2,29:1, tous deux sous le seuil AA ;
//  - cinq fiches ecrites hors du generateur ne portaient aucune date, ni
//    visible ni en donnees structurees. Mali et Burkina Faso en font partie.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const contraste = require('../lib/contraste.js');
const { jetonsOrphelins, contrastesInsuffisants, dateVisible } = require('../lib/fiches-pays.js');

const FICHES = path.join(__dirname, '..', '..', 'web', 'pays');
const slugs = fs.readdirSync(FICHES)
  .filter((f) => f.endsWith('.html') && f !== 'index.html')
  .map((f) => f.replace(/\.html$/, ''))
  .sort();

const HORS_GENERATEUR = ['burkina-faso', 'cote-divoire', 'guinee', 'liberia', 'mali'];

function lire(slug) {
  return fs.readFileSync(path.join(FICHES, slug + '.html'), 'utf8');
}

// --- la mesure elle-meme -----------------------------------------------------

test('le rapport de contraste suit la formule WCAG', () => {
  // Bornes exactes : noir sur blanc = 21:1, une couleur sur elle-meme = 1:1.
  assert.strictEqual(Math.round(contraste.rapport('#000000', '#ffffff') * 100) / 100, 21);
  assert.strictEqual(contraste.rapport('#7f7f7f', '#7f7f7f'), 1);
  // Symetrique : l'ordre des deux couleurs ne doit pas changer le resultat.
  assert.strictEqual(contraste.rapport('#05080B', '#6b675f'), contraste.rapport('#6b675f', '#05080B'));
});

test('une couleur semi-transparente est mesuree une fois posee sur son fond', () => {
  // rgba(245,247,250,.44) n'a pas de contraste en soi. Sur #05080B elle vaut
  // #6f7174, soit 4,10:1 — c'est ce que voyait le lecteur avant correction.
  const compose = contraste.composer('#f5f7fa', '#05080B', 0.44);
  assert.strictEqual(compose, '#6f7174');
  assert.ok(contraste.rapport(compose, '#05080B') < contraste.SEUIL_AA);
  // A .55, la meme couleur passe le seuil.
  assert.ok(contraste.rapport(contraste.composer('#f5f7fa', '#05080B', 0.55), '#05080B')
    >= contraste.SEUIL_AA);
});

test('lireRgba comprend la forme utilisee par les fiches', () => {
  assert.deepStrictEqual(contraste.lireRgba('rgba(245,247,250,.44)'), { hex: '#f5f7fa', alpha: 0.44 });
  assert.strictEqual(contraste.lireRgba('#101A22'), null);
});

// --- les regles, vues echouer sur le defaut qu'elles visent ------------------

const FOND = ':root{--bg:#05080B;--ink2:rgba(245,247,250,.68);--ink3:rgba(245,247,250,.55);}';

test('un jeton reference sans etre defini est signale', () => {
  // Le cas reel : var(--muted, #6b675f). Le repli rend une couleur du mauvais
  // theme sans provoquer la moindre erreur — rien ne le signalait.
  const casse = FOND + '.n{color:var(--muted,#6b675f)}';
  assert.deepStrictEqual(jetonsOrphelins(casse), ['--muted']);
  assert.deepStrictEqual(jetonsOrphelins(FOND + '.n{color:var(--ink2)}'), []);
});

test('un texte sous le seuil AA est signale, un texte au-dessus ne l\'est pas', () => {
  const faible = ':root{--bg:#05080B;--ink4:rgba(245,247,250,.28);}footer{color:var(--ink4)}';
  assert.deepStrictEqual(contrastesInsuffisants(faible), ['--ink4 (2.29:1)']);
  assert.deepStrictEqual(contrastesInsuffisants(FOND + 'p{color:var(--ink3)}'), []);
});

test('une couleur ecrite en dur est mesuree comme un jeton', () => {
  // La regle ne doit pas se contourner en ecrivant la couleur directement.
  // #6b675f est justement celle qui a ete livree en repli le 02/09/2026.
  const F = ':root{--bg:#05080B;}';
  assert.deepStrictEqual(contrastesInsuffisants(F + 'p{color:#6b675f}'), ['#6b675f (3.57:1)']);
  assert.deepStrictEqual(contrastesInsuffisants(F + 'p{color:#fff}'), []);
});

test('une fiche sans ligne de date est signalee', () => {
  assert.strictEqual(dateVisible('<h1>Mali</h1><p class="summary">…</p>'), null);
  // Une ligne presente mais sans date lisible ne compte pas : c'est le cas
  // qu'un contournement produirait naturellement.
  assert.strictEqual(dateVisible('<p class="meta-fresh">Actualisation continue</p>'), null);
  assert.match(dateVisible('<p class="meta-fresh">Rédigée le 21 juillet 2026</p>'), /21 juillet 2026/);
});

// --- l'etat reel des pages servies ------------------------------------------

test('aucune fiche publiee ne reference un jeton CSS inexistant', () => {
  for (const s of slugs) {
    assert.deepStrictEqual(jetonsOrphelins(lire(s)), [], s + ' : jeton(s) CSS non defini(s)');
  }
});

test('tout texte des fiches publiees atteint le seuil AA', () => {
  for (const s of slugs) {
    assert.deepStrictEqual(contrastesInsuffisants(lire(s)), [], s + ' : texte sous 4,5:1');
  }
});

test('toute fiche publiee porte une date lisible', () => {
  for (const s of slugs) {
    assert.ok(dateVisible(lire(s)), s + ' : aucune date lisible par le lecteur');
  }
});

test('les fiches ecrites hors du generateur avertissent qu\'elles ne sont pas sourcees', () => {
  // Elles portent un contenu securitaire precis — JNIM et EIGS pour le Mali,
  // les blocus de Djibo pour le Burkina — sans rien pour le verifier. La
  // mention est le seul honnete substitut a une source, tant qu'il n'y en a pas.
  for (const s of HORS_GENERATEUR) {
    const html = lire(s);
    assert.match(html, /<section class="sources">/, s + ' : section Sources absente');
    assert.match(html, /ne cite aucune source vérifiable/, s + ' : l\'avertissement a disparu');
    assert.match(dateVisible(html), /non révisée depuis/, s + ' : la fiche se presente comme a jour');
  }
});

test('le cliquet des fiches hors generateur reste aligne sur la realite', () => {
  // Meme discipline que les autres cliquets : la liste ne doit pas pouvoir
  // s'allonger pour faire taire le controle.
  const donnees = path.join(__dirname, '..', '..', 'data', 'pays');
  const reel = slugs.filter((s) => !fs.existsSync(path.join(donnees, s + '.json'))).sort();
  assert.deepStrictEqual(reel, HORS_GENERATEUR.slice().sort());
});
