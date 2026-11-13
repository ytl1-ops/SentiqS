// Demande de YORO, 13/11/2026 : « Réduis la taille des boutons les plus gros,
// tous les boutons doivent être cliquables et renvoyer aux données ou actus
// qui les concernent, le choix de pays doit se faire automatiquement et avec
// fluidité. »
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { HTML, tranche, bac } = require('./_bac.js');

// Faux DOM minimal : des éléments par id, et des modules affichés ou non.
function fauxDocument(affiches) {
  const els = {};
  const el = (id) => (els[id] = els[id] || { id, value: '', textContent: '', options: { length: 55 }, classList: { contains: (c) => c === 'on' && affiches.includes(id.replace(/^v-/, '')) } });
  return { getElementById: (id) => el(id), els };
}

function contextePays(affiches) {
  const rendus = [];
  const stock = {};
  const c = bac();
  Object.assign(c, {
    PAYS_INFO: { CI: { name: "Côte d'Ivoire" }, ML: { name: 'Mali' } },
    LANG: 'fr',
    document: fauxDocument(affiches),
    sessionStorage: { setItem: (k, v) => { stock[k] = v; }, getItem: (k) => stock[k] },
    _rendreOuSignaler: (nom) => rendus.push(nom),
    renderFeed() {}, renderRecherche() {}, updSynthese() {}, renderAgenda() {}, renderDashboard() {}, renderCyList() {},
    recalcAlertes() { rendus.push('recalcAlertes'); }, majLibelleRapport() {}, updateGlobalFilterBadge() {},
  });
  vm.runInContext("var GLOBAL_CY_FILTER='all', fCy='all', fGeo='all', fSeCy='all', fChronoCy='all', fSyCy='all', fSyZone='all', fAgCy='all', fAgZone='all', fRapportCy='all', fRapportZone='all';", c);
  vm.runInContext(tranche('// Un seul choix de pays, pour tous les modules', '\nfunction clearGlobalCountryFilter'), c);
  return { c, rendus, stock };
}

test('changer de pays ne redessine que le module affiché', () => {
  const { c, rendus } = contextePays(['flux']);
  c.applyGlobalCountryFilter('CI');
  assert.deepStrictEqual(rendus, ['renderFeed'], 'redessinés : ' + rendus.join(', '));
  const t = contextePays(['analyse']);
  t.c.applyGlobalCountryFilter('CI');
  assert.deepStrictEqual(t.rendus, ['updSynthese']);
});

test('un seul choix de pays : le bouton du Flux, la recherche et la chronologie suivent', () => {
  const { c, stock } = contextePays(['flux']);
  c.applyGlobalCountryFilter('ML');
  assert.deepStrictEqual(JSON.parse(vm.runInContext('JSON.stringify([fCy, fGeo, fSeCy, fChronoCy, fSyCy, fAgCy, fRapportCy])', c)), ['ML', 'ML', 'ML', 'ML', 'ML', 'ML', 'ML']);
  assert.strictEqual(c.document.els.geoLbl.textContent, 'Mali');
  assert.strictEqual(c.document.els.cySelectTop.value, 'ML');
  assert.strictEqual(stock.sentinel_pays_choisi, 'ML', 'le choix est repris pendant la session');
});

test('le bouton pays du Flux et les menus Recherche / chronologie passent par le choix global', () => {
  assert.match(HTML, /function setGeo\(code,name\)\{[^\n]*applyGlobalCountryFilter\(code\)/);
  assert.match(HTML, /function setSeCy\(v\)\s*\{ if \(v === 'all' \|\| PAYS_INFO\[v\]\) applyGlobalCountryFilter\(v\)/);
  assert.match(HTML, /function setChronoCy\(cy\) \{ if \(cy === 'all' \|\| PAYS_INFO\[cy\]\) \{ applyGlobalCountryFilter\(cy\)/);
  // Repris dans la session de l'onglet, jamais au-delà (un filtre oublié ferait paraître calme un pays).
  assert.match(HTML, /sessionStorage\.getItem\(PAYS_CHOISI_KEY\)/);
  assert.doesNotMatch(HTML, /localStorage\.setItem\(PAYS_CHOISI_KEY/);
});

function contextePastilles() {
  const rendus = [];
  const c = bac();
  Object.assign(c, {
    LANG: 'fr',
    escHtml: (s) => String(s),
    moduleAffiche: () => true,
    renderFeed: () => rendus.push('renderFeed'),
    document: { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} },
    balisesArticle: (a) => (a.tags || []).map((label) => ({ label })),
  });
  vm.runInContext("var fCat='all', fPastille=null; const CATS_FILTRABLES=['securite','humanitaire','politique','economique'];", c);
  vm.runInContext(tranche('// ═══ PASTILLES CLIQUABLES — 13/11/2026 ═══', "document.addEventListener('click', ev =>"), c);
  return { c, rendus };
}

test('une pastille de niveau ou de thème filtre le Flux sur ce qu\'elle dit', () => {
  const { c, rendus } = contextePastilles();
  c.actionPastille({ getAttribute: () => 'niveau:crit' });
  assert.strictEqual(vm.runInContext('fCat', c), 'crit');
  c.actionPastille({ getAttribute: () => 'balise:Terrorisme' });
  assert.deepStrictEqual(JSON.parse(vm.runInContext('JSON.stringify([fCat, fPastille.k, fPastille.v])', c)), ['all', 'balise', 'Terrorisme']);
  assert.strictEqual(c.correspondPastille({ tags: ['Terrorisme', 'Sahel'] }), true);
  assert.strictEqual(c.correspondPastille({ tags: ['Météo'] }), false);
  assert.strictEqual(rendus.length, 2);
});

test('seuls les niveaux critique et élevé sont des filtres (pas de puce pour les autres)', () => {
  const { c } = contextePastilles();
  assert.match(c.attrFiltreNiveau({ level: 'crit' }), /data-filtre="niveau:crit"/);
  assert.match(c.attrFiltreNiveau({ level: 'high' }), /role="button" tabindex="0"/);
  assert.strictEqual(c.attrFiltreNiveau({ level: 'mod' }), '');
});

test('les pastilles sont câblées sur les cartes, la synthèse, l\'agenda et les alertes', () => {
  assert.match(HTML, /'<div class="al"><span class="rpill '\+pl\[0\]\+'"'\+attrFiltreNiveau\(a\)\+'>'/);
  assert.match(HTML, /<span class="balise" data-famille="' \+ b\.famille \+ '"' \+ attrFiltre\('balise:'/);
  assert.match(HTML, /id="syCrit" data-filtre="niveau:crit"/);
  assert.match(HTML, /attrFiltre\('agtype:'/);
  assert.match(HTML, /data-filtre="alniv:' \+ k \+ '"/);
  // Un signal du jour ouvre son actu ; un incident vérifié, sans actu, reste inerte.
  assert.match(HTML, /const ouvreActu = e\.live && e\.id/);
  // Le filtre passe avant le clic de la carte : écouteur en phase de capture.
  assert.match(HTML, /closest\('\[data-filtre\]'\)[\s\S]{0,120}ev\.stopPropagation\(\); ev\.preventDefault\(\);[\s\S]{0,40}\}, true\);/);
  // La clé de rendu du Flux tient compte du filtre de pastille (sinon le Flux ne se redessine pas).
  assert.match(HTML, /fPastille \? fPastille\.k \+ ':' \+ fPastille\.v : ''/);
});

test('les plus gros boutons sont réduits', () => {
  assert.match(HTML, /html:not\(\.force-web\) \.tlbr \.tlbr-actu\{flex:0 0 auto;min-width:32px;min-height:32px/);
  assert.match(HTML, /html\.force-mobile \.tlbr \.tlbr-actu\{flex:0 0 auto;min-width:32px;min-height:32px/);
  assert.match(HTML, /\.kpi-tile \.kpi-v\{font-size:22px !important\}/);
  assert.doesNotMatch(HTML, /min-width:44px;min-height:40px/);
});
