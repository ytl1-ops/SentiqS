// Direction visuelle « Salle de veille » du 20/10/2026 (modeles : palantir.com,
// lacoste.com). Le chrome (barre du haut, rail des modules, scene de
// connexion) passe a l'encre ; l'action devient l'encre en clair et le blanc
// casse en sombre ; le bronze --sig n'est plus qu'une signature.
//
// Ces tests gardent ce qui pourrait casser sans bruit :
//   - les cinq couleurs de gravite ne bougent pas avec la palette (sinon un
//     pays parait plus ou moins dangereux qu'il ne l'est) ;
//   - le chrome sombre REDEFINIT les jetons localement : si cette
//     redefinition disparait, le texte des boutons de la barre du haut
//     redevient fonce sur fond d'encre, illisible ;
//   - les couples texte/fond des jetons tiennent le seuil AA (4,5:1).
const test = require('node:test');
const assert = require('node:assert');
const { tranche } = require('./_bac');

const css = tranche('<style>\n:root{', '</style>').replace(/\/\*[\s\S]*?\*\//g, '');
const racine = css.slice(0, css.indexOf('}'));
const sombre = (() => { const i = css.indexOf('html[data-theme="dark"]{'); return css.slice(i, css.indexOf('}', i)); })();
const jeton = (bloc, nom) => {
  const m = bloc.match(new RegExp('--' + nom + ':\\s*(#[0-9A-Fa-f]{6})'));
  assert.ok(m, 'jeton --' + nom + ' introuvable');
  return m[1];
};
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };

test('les couleurs de gravite du theme clair sont inchangees', () => {
  assert.deepStrictEqual(
    ['r', 'a', 'g', 'm', 'j'].map((n) => jeton(racine, n).toUpperCase()),
    ['#8B1A1A', '#7C4A00', '#0F4F2A', '#78350F', '#CA8A04'],
  );
});

test('le chrome encre redefinit localement les jetons de texte et d action', () => {
  const m = css.match(/\.tb,\.nav-wrap\{([^}]*)\}/);
  assert.ok(m, 'bloc .tb,.nav-wrap absent');
  for (const nom of ['w', 'sf', 'bd', 't', 't2', 'lg', 'b', 'bl', 'on-b']) {
    assert.match(m[1], new RegExp('--' + nom + ':'), '--' + nom + ' non redefini dans le chrome');
  }
});

test('texte du chrome lisible sur l encre (AA)', () => {
  const encre = jeton(racine, 'ink');
  assert.ok(ratio(jeton(racine, 'ink-txt'), encre) >= 4.5);
  assert.ok(ratio(jeton(racine, 'ink-mute'), encre) >= 4.5);
});

test('jetons de texte et d action au seuil AA, clair et sombre', () => {
  for (const bloc of [racine, sombre]) {
    const fonds = ['w', 'sf', 'page-bg'].map((n) => jeton(bloc, n));
    for (const texte of ['t', 't2', 'lg', 'gr', 'b']) {
      for (const f of fonds) {
        const r = ratio(jeton(bloc, texte), f);
        assert.ok(r >= 4.5, '--' + texte + ' sur ' + f + ' : ' + r.toFixed(2) + ':1');
      }
    }
  }
});
