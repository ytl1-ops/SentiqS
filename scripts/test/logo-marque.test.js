// Logo de l'organisation dans l'identite d'envoi — 20/10/2026.
//
// L'editeur a precise que l'identite d'envoi d'un rapport, c'est le nom ET le
// logo de l'organisation qui l'envoie. Ces tests gardent :
//   - la regle du plan : un compte gratuit n'imprime jamais de logo ;
//   - le format : seule une image PNG/JPEG en data URL est acceptee (le logo
//     est insere tel quel dans des documents HTML) ;
//   - l'enregistrement de la personnalisation, qui reconstruit tout l'objet,
//     ne doit pas effacer un logo deja enregistre.
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac } = require('./_bac');

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function bacLogo(payant, marque) {
  const ctx = bac(tranche("const LOGO_MARQUE_MAX_PX", '// identitesMarquePerso(m)'));
  Object.assign(ctx, { fonctionnalitePayante: () => payant, getMarquePerso: () => marque });
  return ctx;
}

test('un compte gratuit n imprime jamais de logo', () => {
  assert.strictEqual(bacLogo(false, { logoMarque: PNG }).logoMarqueActuelle(), null);
  const l = bacLogo(true, { logoMarque: PNG, logoMarqueRatio: 2 }).logoMarqueActuelle();
  assert.strictEqual(l.dataUrl, PNG);
  assert.strictEqual(l.ratio, 2);
});

test('seule une image PNG ou JPEG en data URL est acceptee', () => {
  for (const mauvais of ['https://x.org/logo.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,abc"><script>', '']) {
    assert.strictEqual(bacLogo(true, { logoMarque: mauvais }).logoMarqueActuelle(), null, mauvais);
  }
});

test('enregistrer la personnalisation garde le logo deja enregistre', () => {
  let enregistre = null;
  const champs = { marqueIdentiteActive: '1', marqueNom: 'Groupe', marqueIdentite1: 'DS', marqueIdentite2: '', marqueIdentite3: '' };
  const ctx = bac(tranche('let _marqueLogoBrouillon;', "// ── Identite d'envoi PAR MODULE"));
  Object.assign(ctx, {
    LANG: 'fr',
    fonctionnalitePayante: () => true,
    getMarquePerso: () => ({ nomMarque: 'Groupe', identite1: 'DS', logoMarque: PNG, logoMarqueRatio: 1.5 }),
    saveMarquePerso: (m) => { enregistre = m; },
    logoMarqueValide: (l) => l === PNG,
    document: { getElementById: (id) => ({ value: champs[id] }) },
    identitesModulesMarquePerso: () => ({}), lireIdentitesModulesParams: () => ({}),
    renderIdentitesModulesParams() {}, renderIdentitesModules() {}, pmMsg() {},
  });
  ctx.pmSaveMarquePerso();
  assert.strictEqual(enregistre.logoMarque, PNG);
  assert.strictEqual(enregistre.logoMarqueRatio, 1.5);
  ctx.retirerLogoMarque();
  ctx.pmSaveMarquePerso();
  assert.strictEqual(enregistre.logoMarque, undefined, 'retirer le logo doit l effacer');
});
