// Chargement du Flux, erreurs repetees, zone de lecture et regroupement des
// boutons — 21/10/2026.
//
// Mesure qui a motive la passe (Chromium, 2 600 articles dans la fenetre) : le
// Flux ecrivait toutes les cartes d'un coup — 112 742 noeuds DOM, 7 Mo de HTML,
// 871 images, 3,2 s de gel sur ordinateur (1,9 s sur mobile). Apres : 40
// cartes, 1 944 noeuds, 129 ms. Un test qui ne verifierait que « le bouton
// existe » passerait aussi sur la version qui rend tout : celui-ci exige que
// le rendu soit borne ET que le total reste annonce.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { HTML, tranche } = require('./_bac');

test('le Flux ne rend qu\'une page d\'articles, pas toute la liste', () => {
  const f = tranche('async function renderFeed() {', '\nconst renderFeedDebounced');
  assert.match(f, /const artsTous = getFiltered\(\)/, 'la liste complete doit rester disponible pour les totaux');
  assert.match(f, /const arts = artsTous\.slice\(0, _fluxLimite\)/, 'le rendu doit etre borne a la page courante');
  assert.match(f, /preTraduireRapport\(arts\.flatMap/, 'la traduction ne doit porter que sur la page rendue');
  assert.doesNotMatch(f, /preTraduireRapport\(artsTous/, 'traduire 2 600 titres avant le premier rendu est le gel lui-meme');
});

test('la taille d\'une page reste raisonnable', () => {
  const m = HTML.match(/const FLUX_PAGE = (\d+);/);
  assert.ok(m, 'FLUX_PAGE introuvable');
  const n = +m[1];
  assert.ok(n >= 20 && n <= 60, 'une page de ' + n + ' cartes : trop petite (on ne lit plus) ou trop grande (le gel revient)');
});

test('« Afficher plus » annonce le reste, et un changement de filtre repart de la premiere page', () => {
  const f = tranche('async function renderFeed() {', '\nconst renderFeedDebounced');
  assert.match(f, /onclick="fluxPlus\(\)"/);
  assert.match(f, /artsTous\.length - arts\.length/, 'le reste a afficher doit etre calcule sur le total filtre');
  assert.match(f, /_sig !== _fluxSignature[^}]*_fluxLimite = FLUX_PAGE/, 'un filtre ou un tri qui change doit remettre la limite a une page');
  // Les totaux affiches ne doivent pas se mettre a mentir : « 40 articles » alors qu'il y en a 2 600.
  assert.match(f, /artsTous\.length\+' article'/, 'le bandeau pays doit annoncer le total filtre, pas la page');
  assert.match(f, /const totalPays = artsCeTous\.length/, 'le total du pays doit venir de la liste complete');
});

test('« A la une » se choisit dans toute la liste, pas dans la page', () => {
  assert.match(HTML, /choisirALaUne\(artsTous, 4\)/);
});

test('la garde d\'erreurs repetees se declenche a la troisieme erreur en dix secondes', () => {
  const src = tranche('const GARDE_ERREURS_MAX', 'function reessayerAffichage');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src + '\nthis.erreurRepetee = erreurRepetee; this.reset = () => { _erreursRecentes = []; };', ctx);
  assert.strictEqual(ctx.erreurRepetee(1000), false);
  assert.strictEqual(ctx.erreurRepetee(2000), false);
  assert.strictEqual(ctx.erreurRepetee(3000), true, 'trois erreurs en 2 s : l\'ecran ne repond plus');
  ctx.reset();
  assert.strictEqual(ctx.erreurRepetee(0), false);
  assert.strictEqual(ctx.erreurRepetee(20000), false);
  assert.strictEqual(ctx.erreurRepetee(40000), false, 'des erreurs espacees de vingt secondes ne sont pas une rafale');
});

test('le bandeau d\'erreur propose « Réessayer » et ne bloque jamais l\'appli', () => {
  const f = tranche('function reessayerAffichage', 'function _gererErreurGlobale');
  assert.match(f, /reessayerAffichage\(\)/);
  assert.match(f, /R\\u00e9essayer/);
  assert.match(f, /role', 'alert'/);
  assert.match(f, /be-fermer/, 'le bandeau doit pouvoir se fermer');
  const g = tranche('function _gererErreurGlobale', 'function srcIsSkippable');
  assert.match(g, /error', \(e\)[\s\S]*_gererErreurGlobale\(\)/);
  assert.match(g, /unhandledrejection[\s\S]*_gererErreurGlobale\(\)/);
});

test('thème, diagnostic et format d\'affichage sont regroupés dans le menu « Plus »', () => {
  const tb = tranche('<div class="tb">', '<!-- BANDEAU PROXY -->');
  const menu = tb.slice(tb.indexOf('<details class="tb-more"'), tb.indexOf('</details>'));
  assert.ok(menu.length > 100, 'menu Plus introuvable');
  for (const id of ['id="dispSwitch"', 'id="themeBtn"', 'id="diagBtn"']) {
    assert.ok(menu.includes(id), id + ' doit vivre dans le menu Plus');
  }
  assert.ok(!tb.slice(0, tb.indexOf('<details class="tb-more"')).includes('id="themeBtn"'), 'le bouton de theme ne doit plus etre en barre');
  assert.ok(tb.includes('id="actuBtn"') && tb.indexOf('id="actuBtn"') < tb.indexOf('<details class="tb-more"'),
    'Actualiser reste l\'action principale, visible, avant le menu');
});

test('les barres d\'export sont repliees derriere un seul bouton « Exporter »', () => {
  const f = tranche('function initBarresExport() {', 'document.addEventListener(\'click\'');
  assert.match(f, /aria-expanded/);
  assert.match(f, /classList\.add\('dl-replie'\)/);
  assert.match(HTML, /\.dl-toolbar\.dl-replie>\*:not\(\.dl-toggle\)\{display:none !important\}/);
});

test('les regles mobiles du Flux sont ecrites pour l\'ecran etroit ET pour le mode mobile force', () => {
  for (const r of ['.proxy-bar{flex-direction:row', '.tlbr .srch{flex:1 1 100%}', '.tlbr .tlbr-actu span{display:none}', '.tlbr .chips{flex:1 1 100%;flex-wrap:nowrap']) {
    assert.ok(HTML.includes('html:not(.force-web) ' + r), 'ecran etroit : ' + r);
    assert.ok(HTML.includes('html.force-mobile ' + r), 'mobile force : ' + r);
  }
  // Un selecteur a virgule non prefixe fuit sur le bureau (rencontre ici : le tri s'etirait sur 1360 px).
  assert.doesNotMatch(HTML, /html\.force-mobile [^{}\n]*,\.tlbr/, 'selecteur a virgule non prefixe');
  assert.match(HTML, /class="tlbr-actu" aria-label=/, 'le bouton dont le libelle est masque garde un nom accessible');
});

// ── Reclassement des articles : 15,8 s pour 2 600 articles, a chaque lecture ──
function bacRehydratation(scripts) {
  const appels = { classify: 0, pays: 0 };
  const ctx = {
    SRCS: [{ id: 's1', cy: 'CI', sc: 'national', score: 90 }],
    classify: () => { appels.classify++; return { lvl: 'high', cat: 'securite' }; },
    detectPaysFromText: () => { appels.pays++; return 'CI'; },
    srcTypeBadge: () => ({}),
    document: { scripts },
    performance: { now: () => Date.now() },
    ALL: [], setTimeout: () => {},
  };
  vm.createContext(ctx);
  vm.runInContext(tranche('let _signatureCode = null;', '// Rehydratation du navigateur'), ctx);
  return { ctx, appels };
}
const art = (extra) => Object.assign({ id: 'a', title: 'Titre', analysis: 'Corps', primary: 's1', cy: 'CI', level: 'mod', cat: 'politique' }, extra);

test('un article deja classe par ce code n\'est pas reclasse', () => {
  const { ctx, appels } = bacRehydratation([{ textContent: 'code v1' }]);
  const sig = vm.runInContext('signatureCode()', ctx);
  assert.ok(sig, 'signature vide');
  const a = art({ _rv: sig });
  vm.runInContext('rehydrateArticles', ctx)([a]);
  assert.strictEqual(appels.classify, 0, 'classify rappelee sur un article a jour : le gel de 15 s revient');
  assert.strictEqual(appels.pays, 0);
});

test('un article classe par un autre code est reclasse, puis estampille', () => {
  const { ctx, appels } = bacRehydratation([{ textContent: 'code v1' }]);
  const a = art({ _rv: 'ancien' });
  const sans = art();
  vm.runInContext('rehydrateArticles', ctx)([a, sans]);
  assert.strictEqual(appels.classify, 2, 'apres un deploiement, le correctif de lexique doit prendre effet');
  assert.strictEqual(a.level, 'high');
  assert.strictEqual(a._rv, vm.runInContext('signatureCode()', ctx));
  vm.runInContext('rehydrateArticles', ctx)([a, sans]);
  assert.strictEqual(appels.classify, 2, 'le second passage ne doit rien recalculer');
});

test('la signature change des qu\'une ligne du script change', () => {
  const s1 = bacRehydratation([{ textContent: 'const CK = ["a"];' }]);
  const s2 = bacRehydratation([{ textContent: 'const CK = ["b"];' }]);
  assert.notStrictEqual(vm.runInContext('signatureCode()', s1.ctx), vm.runInContext('signatureCode()', s2.ctx));
});

test('le budget laisse le reste a plus tard, sans l\'estampiller ni le perdre', () => {
  const { ctx, appels } = bacRehydratation([{ textContent: 'code v1' }]);
  const arts = [art(), art({ id: 'b' })];
  const f = vm.runInContext('rehydrateArticles', ctx);
  f(arts, { budgetMs: -1 });
  assert.strictEqual(f.reste, 2);
  assert.strictEqual(appels.classify, 0);
  assert.strictEqual(arts[0]._rv, undefined, 'un article non traite ne doit pas se dire a jour');
  f(arts);
  assert.strictEqual(f.reste, 0);
  assert.strictEqual(appels.classify, 2);
});

test('les deux analyseurs de flux estampillent les articles qu\'ils produisent', () => {
  assert.strictEqual((HTML.match(/_rv: signatureCode\(\),/g) || []).length, 2);
});

test('les chemins du navigateur rehydratent par tranches, le job et la publication en entier', () => {
  assert.match(tranche('function _appliquerArticlesPartages', 'synchroniserTousLesModules();'), /rehydraterParLots\(ALL\)/);
  assert.match(tranche('const existantsRecents = ', 'dedupliquerArticles'), /rehydrateArticles\(fusionnes\)/);
});

test('fmtAge n\'instancie plus un formateur Intl par appel, et garde son format', () => {
  const f = tranche('function fmtAge(ts) {', '\nfunction fmtFull');
  assert.doesNotMatch(f.replace(/\/\/.*$/gm, ''), /toLocaleTimeString|toLocaleDateString/);
  const ctx = { localeRapport: () => 'fr-FR', LANG: 'fr' };
  vm.createContext(ctx);
  vm.runInContext(f + '\nthis.fmtAge = fmtAge;', ctx);
  const il = Date.now() - 5 * 60000;
  const attendu = new Date(il).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  assert.strictEqual(ctx.fmtAge(il), 'Il y a 5 min · ' + attendu);
  const ancien = Date.now() - 5 * 86400000, d = new Date(ancien);
  assert.strictEqual(ctx.fmtAge(ancien),
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
  assert.strictEqual(ctx.fmtAge(0), '—');
});
