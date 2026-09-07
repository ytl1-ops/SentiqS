// Un jeton de couleur utilise doit exister, et se lire.
//
// Audit d'interface du 07/09/2026. Ligne 100 de la feuille de style :
//
//     a--g:#0F4F2A;--gl:#F0FDF4;...
//
// Un « a » colle devant. La declaration est invalide, donc --g N'EXISTE PAS
// dans le theme clair — celui par defaut. Verifie dans le navigateur :
// getPropertyValue('--g') renvoie une chaine vide. Le theme sombre, lui, le
// definit correctement.
//
// Quatorze usages, sans valeur de repli. Le compteur « Recoupes » de la barre
// de collecte, ecrit color:var(--g), s'affichait donc en noir herite, a cote
// d'un compteur d'erreurs rouge et d'un compteur de nouveautes ambre qui,
// eux, marchaient. Le vert de gravite disparaissait sans que rien ne le dise.
//
// C'est la panne decrite dans l'en-tete de scripts/lib/contraste.js — « un
// var() avec repli ne signale rien » — en pire : sans repli, la propriete est
// simplement abandonnee.
const test = require('node:test');
const assert = require('node:assert');
const { HTML } = require('./_bac');
const { rapport, SEUIL_AA } = require('../lib/contraste.js');

// Les jetons declares dans :root (theme clair) et dans le bloc sombre.
function jetonsDeclares(bloc) {
  return new Set([...bloc.matchAll(/(?:^|[;{\s])(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]));
}
const iRoot = HTML.indexOf(':root{');
const clair = HTML.slice(iRoot, HTML.indexOf('}', iRoot));
const iDark = HTML.indexOf('html[data-theme="dark"]{');
const sombre = HTML.slice(iDark, HTML.indexOf('}', iDark));

test('tout jeton lu par var() est declare dans le theme clair', () => {
  const declares = jetonsDeclares(clair);
  const utilises = new Set([...HTML.matchAll(/var\((--[a-z0-9-]+)/gi)].map((m) => m[1]));
  const orphelins = [...utilises].filter((n) => !declares.has(n)).sort();
  assert.deepStrictEqual(orphelins, [],
    'ces jetons sont lus mais jamais declares dans :root — la propriete est abandonnee sans un mot : ' + orphelins.join(', '));
});

test('les cinq couleurs de gravite existent dans les deux themes', () => {
  // Elles portent l'affirmation la plus grave de l'outil. En perdre une en
  // silence, c'est afficher un niveau sans sa couleur.
  const declaresClair = jetonsDeclares(clair);
  const declaresSombre = jetonsDeclares(sombre);
  for (const n of ['--r', '--a', '--g', '--m', '--j']) {
    assert.ok(declaresClair.has(n), n + ' manque au theme clair');
    assert.ok(declaresSombre.has(n), n + ' manque au theme sombre');
  }
});

test('aucune declaration de jeton n\'est collee a un identifiant', () => {
  // La forme exacte du defaut : « a--g: » au lieu de « --g: ». CSS l'ignore
  // en silence, et rien ne le signale a la relecture.
  const collees = [...clair.matchAll(/[A-Za-z0-9_]+(--[a-z0-9-]+)\s*:/g)].map((m) => m[0]);
  assert.deepStrictEqual(collees, [], 'declarations invalides : ' + collees.join(', '));
});

test('les couleurs de TEXTE du theme clair passent le seuil AA sur leurs fonds', () => {
  // Mesure de l'audit : le gris secondaire #718096 (une centaine d'usages)
  // plafonnait a 4,02 sur blanc et 3,41 sur le fond de page, et le jaune de
  // gravite #CA8A04 tombait a 2,49 — une couleur d'ALERTE, portee par le
  // nombre « pays en tension », la seule tuile non nulle du tableau de bord.
  const lire = (n) => {
    const m = new RegExp('(?:^|[;{\\s])' + n + ':(#[0-9A-Fa-f]{6})').exec(clair);
    assert.ok(m, n + ' introuvable dans :root');
    return m[1];
  };
  const fonds = { blanc: '#FFFFFF', surface: lire('--sf'), page: lire('--page-bg'), bleuPale: lire('--bl') };
  for (const jeton of ['--lg', '--gr', '--t', '--t2']) {
    const c = lire(jeton);
    for (const [nomFond, f] of Object.entries(fonds)) {
      const r = rapport(c, f);
      assert.ok(r >= SEUIL_AA,
        jeton + ' (' + c + ') sur ' + nomFond + ' (' + f + ') : ' + r.toFixed(2) + ':1, seuil ' + SEUIL_AA);
    }
  }
});
