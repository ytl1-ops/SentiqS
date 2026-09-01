// Défauts trouvés en AUDITANT l'interface réellement servie, le 1er septembre
// 2026, avec les 512 articles du cache de production. Chacun portait sur ce
// qu'un responsable sûreté a sous les yeux — pas sur le code.
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche, bac, exposer } = require('./_bac.js');

const { classify } = exposer(
  bac(tranche('const CK_CRIT', '//  FIABILITÉ & ANTI-HALLUCINATION')), 'classify');
const src = (cy, cat) => ({ cy: cy || 'SN', cat: cat || 'securite' });

// ── Classification ────────────────────────────────────────────────────────
// « Olive Ngobo Elok attaque Joseph Fouda en justice » ouvrait la liste des
// actualités à traiter, classée CRITIQUE, au-dessus d'une levée de blocus
// djihadiste au Mali. Le mot déclencheur était « attaque ».
test('attaquer en justice n\'est pas une attaque', () => {
  assert.notStrictEqual(classify('Olive Ngobo Elok attaque Joseph Fouda en justice', src('CM')).lvl,
    'crit', 'un litige entre deux personnes privées ne doit pas être un incident critique');
  assert.notStrictEqual(classify('La société attaque son concurrent en justice', src('CI')).lvl, 'crit');
  assert.notStrictEqual(classify('Le ministre porte plainte contre le journal', src('SN')).lvl, 'crit');
});

// La garde doit rester ÉTROITE : un procès pour terrorisme reste un signal.
test('un procès pour attentat reste critique', () => {
  assert.strictEqual(classify('Le procureur attaque en justice les auteurs de l\'attentat', src('ML')).lvl,
    'crit', 'neutraliser la tournure judiciaire ne doit pas effacer les autres mots-clés');
});

test('un incendie est élevé, pas au même rang qu\'un attentat', () => {
  assert.strictEqual(classify('Une centaine de familles évacuées face à la propagation de l\'incendie', src('TN')).lvl,
    'high');
  // Mais un incendie qui accompagne un acte violent garde ses propres mots.
  assert.strictEqual(classify('Incendie criminel a l\'ambassade, explosion entendue', src('ML')).lvl, 'crit');
  assert.strictEqual(classify('Attentat a la bombe : 12 morts dans un incendie', src('ML')).lvl, 'crit');
});

// ── Restitution ───────────────────────────────────────────────────────────
test('la liste de triage porte la provenance et la confiance', () => {
  const panel = tranche('async function renderPanelATraiter', 'function setDashCartoMode');
  assert.match(panel, /sourcesVisibles\(\)/,
    'la source doit apparaître dans la liste de triage — un analyste ne hiérarchise pas sans savoir qui parle');
  assert.match(panel, /confiance \$\{a\.score\}%/,
    'le score de confiance doit apparaître : c\'est lui qui permet de trier les faux positifs restants');
});

test('le compteur de sources dit l\'accessibilité, pas la fraîcheur', () => {
  const dash = tranche('  // KPI globaux', '<!-- Actualités a traiter');
  assert.match(dash, /SRC_HEALTH/,
    'l\'accessibilité doit être lue dans SRC_HEALTH — « la source a-t-elle répondu ? »');
  assert.doesNotMatch(dash, /'Sources actives'/,
    'le libellé « sources actives » faisait lire la fraîcheur comme la santé du réseau');
});

test('« pays en tension » porte sa définition à l\'écran', () => {
  const dash = tranche('  // KPI globaux', '<!-- Actualités a traiter');
  assert.match(dash, /Niveau orange, marron ou rouge/,
    'un chiffre qu\'un professionnel ne peut pas définir, il ne peut pas le citer');
});

test('le score pays est affiché sans décimale', () => {
  // Six pays affichaient exactement 22,1 : la décimale annonçait une mesure
  // continue là où il n'y a qu'une dizaine de paliers.
  const carto = tranche('const zonePanel = (zc) =>', 'return `<div class="ops-carto-grid"');
  assert.match(carto, /Math\.round\(s\.score\)/, 'fausse précision : le score n\'a pas la résolution d\'une décimale');
});

test('aucun horodatage de repli n\'est une fausse date crédible', () => {
  const m = HTML.match(/id="tbTime"[^>]*>([^<]*)</);
  assert.ok(m, 'tbTime introuvable');
  assert.doesNotMatch(m[1], /\d{2}\/\d{2}\/\d{4}/,
    'un outil temps réel doit afficher un tiret, jamais une date plausible et fausse');
});

test('l\'actualité internationale ne passe plus devant les 54 pays', () => {
  const f = tranche('function getArticlesATraiter', 'function marquerArticleTraite');
  assert.match(f, /a\.cy === 'INT' \? 1 : 0/,
    'à niveau égal, un incident hors Afrique doit passer après les pays couverts');
});

// ── Autorisation ──────────────────────────────────────────────────────────
test('sans session, le rôle de repli est le plus faible', () => {
  const f = tranche('function getSession()', '\n');
  assert.doesNotMatch(f, /role:\s*'admin'/,
    'repli fail-open : un visiteur non authentifié était traité comme administrateur');
  assert.match(f, /role:\s*'reader'/, 'un repli d\'autorisation qui échoue doit fermer, pas ouvrir');
});

test('le cache partagé reste utilisable au-delà d\'un cycle de collecte', () => {
  const m = HTML.match(/const COLLECTE_PARTAGEE_LECTURE_MAX_MS = ([^;]+);/);
  assert.ok(m, 'COLLECTE_PARTAGEE_LECTURE_MAX_MS introuvable');
  const ms = Function('return ' + m[1])();
  assert.ok(ms >= 3 * 3600 * 1000,
    'la cadence réelle observée est de 3 h 24 à 5 h 51 : une fenêtre plus courte renvoie '
    + 'chaque visiteur vers les proxys publics la plupart du temps');
  assert.ok(ms <= 12 * 3600 * 1000, 'au-delà de la fenêtre temps réel de 12 h, le cache ne veut plus rien dire');
});

test('le bandeau d\'accueil ne nomme plus des proxys, dont un refusé', () => {
  assert.doesNotMatch(HTML, /rss2json, allorigins, corsproxy/,
    'texte périmé (rss2json est refusé par le job) et exposition de la plomberie à l\'utilisateur');
});

// Un correctif de classification qui n'agit qu'à la collecte suivante laisse
// jusqu'à 12 h de faux positifs à l'écran. Le pays était déjà recalculé à la
// réhydratation ; le niveau ne l'était pas.
test('le niveau est recalculé à la réhydratation, comme le pays', () => {
  const f = tranche('function rehydrateArticles', 'if (a._isSocial !== undefined) return;');
  assert.match(f, /classify\(texteClass, src\)/,
    'sans recalcul, un article en cache garde le verdict de la version qui l\'a collecté');
  assert.match(f, /a\.level = r\.lvl/, 'le niveau recalculé doit remplacer celui du cache');
});
