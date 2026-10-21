// Le passage FR ⇄ EN doit être possible partout, et complet.
//
// Signalement du 21/10/2026 : « les traductions des pages sont incorrectes,
// passage d'une langue à une autre pas possible ». Mesure dans Chromium : le
// sélecteur n'existait que sur l'écran de connexion ; une fois connecté, plus
// aucun moyen de changer de langue, et en anglais 1 044 textes restaient en
// français (800 libellés écrits en dur dans les rendus, 377 phrases de données
// saisies : agenda, incidents vérifiés, facteurs).
//
// La réponse est une table FR → EN unique (web/js/dico-en.js) appliquée au DOM
// rendu par web/js/langue.js. Ces tests gardent ses règles : ce qui se traduit,
// ce qui ne se traduit jamais (le contenu des sources), et l'accès au sélecteur.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { HTML } = require('./_bac.js');

const WEB = path.join(__dirname, '..', '..', 'web');
const L = require(path.join(WEB, 'js', 'langue.js'));
global.SentiqLangue = L;
require(path.join(WEB, 'js', 'dico-en.js'));

test('le sélecteur de langue est dans la barre du haut, pas seulement sur la connexion', () => {
  const barre = HTML.indexOf('lang-switch-tb');
  assert.ok(barre > 0, 'sélecteur absent de la barre du haut');
  const bloc = HTML.slice(barre, HTML.indexOf('</div>', barre));
  assert.match(bloc, /setLang\('fr'\)/);
  assert.match(bloc, /setLang\('en'\)/);
  // translate="no" : le libellé « FR » ne doit pas être traduit lui-même.
  assert.match(bloc, /translate="no"/);
});

test('les deux scripts se chargent dans l\'en-tête et la langue mémorisée s\'applique avant le rendu', () => {
  const tete = HTML.slice(0, HTML.indexOf('</head>'));
  assert.ok(tete.includes('<script src="js/langue.js"></script>'));
  assert.ok(tete.indexOf('js/langue.js') < tete.indexOf('js/dico-en.js'), 'la table se charge avant le moteur');
  assert.match(tete, /SentiqLangue\.lireChoix\(\) === 'en'[\s\S]{0,200}SentiqLangue\.activer\('en'\)/);
  for (const f of ['langue.js', 'dico-en.js']) assert.ok(fs.existsSync(path.join(WEB, 'js', f)), f + ' manquant');
});

test('setLang mémorise le choix et applique la table en protégeant le contenu des sources', () => {
  const i = HTML.indexOf('function setLang(lang)');
  const corps = HTML.slice(i, HTML.indexOf('\n}\n', i));
  assert.match(corps, /SentiqLangue\.memoriser\(LANG\)/);
  assert.match(corps, /SentiqLangue\.activer\(LANG, \{ ignorer: estContenuSource \}\)/);
  // Une valeur stockée inattendue ne doit pas laisser l'appli sans langue.
  assert.match(HTML, /let LANG = .{0,40}getItem\('sentinel_lang'\) === 'en' \? 'en' : 'fr'.{0,40}return 'fr'/);
});

test('accents, casse et espaces sont indifférents ; la casse de sortie suit la source', () => {
  assert.strictEqual(L.traduire('Paramètres'), 'Settings');
  assert.strictEqual(L.traduire('PARAMETRES'), 'SETTINGS');
  assert.strictEqual(L.traduire('  Tableau  de bord '), '  Dashboard ');
  // Une clé ne garde qu'une valeur : « JAUNE » et « Jaune » la partagent.
  assert.strictEqual(L.traduire('JAUNE'), 'YELLOW');
  assert.strictEqual(L.traduire('Jaune'), 'Yellow');
});

test('les nombres sont reportés dans l\'ordre, et le singulier est respecté', () => {
  const t = L.traduire('Interdiction de 12 groupes de musique Famo lies a des gangs rivaux et deploiement de l armee ; soldats accuses d avoir torture quatre personnes et tue deux autres');
  assert.match(t, /^Ban on 12 Famo music groups/);
  assert.strictEqual(L.traduire('69e sommet ordinaire de la CEDEAO, du 12 au 19 juillet 2026 — premier sommet CEDEAO jamais accueilli en Sierra Leone.'),
    '69th ordinary ECOWAS summit, 12 to 19 July 2026 — the first ECOWAS summit ever hosted in Sierra Leone.');
  assert.strictEqual(L.traduire('il y a 1 mois'), '1 month ago');
  assert.strictEqual(L.traduire('il y a 3 mois'), '3 months ago');
});

test('une phrase composée se traduit par segments, sans couper une parenthèse qui lui appartient', () => {
  assert.strictEqual(L.traduire('Dakar (estimé)'), 'Dakar (estimated)');
  L.ajouter({ Maroc: 'Morocco' });
  assert.strictEqual(L.traduire('Maroc — Finale de la Coupe d\'Afrique des Nations (CAN 2025)'),
    'Morocco — Africa Cup of Nations final (AFCON 2025)');
  assert.strictEqual(L.traduire('aggravation de 1 cran : jaune le 2026-09-12 → orange le 2026-10-21 (30 relevés)'),
    'worsened by 1 level: yellow on 2026-09-12 → orange on 2026-10-21 (30 readings)');
});

test('un texte inconnu reste tel quel : on ne devine jamais une traduction', () => {
  const titre = 'Attaque armée contre un convoi militaire près de Kaya : 12 morts';
  assert.strictEqual(L.traduire(titre), titre);
  assert.strictEqual(L.connu(titre), false);
});

test('la table ne contient aucun titre d\'actu des sources', () => {
  // Le contenu des sources reste dans sa langue : une entrée qui le
  // traduirait ferait passer un titre pour une donnée de l'outil.
  const dico = fs.readFileSync(path.join(WEB, 'js', 'dico-en.js'), 'utf8');
  assert.ok(!/plusieurs officiers arrêtés/.test(dico));
  // Chaque « # » de la valeur répond à un nombre de la clé française.
  const fautes = [];
  for (const [fr, en] of Object.entries(L._dico)) {
    const n = (en.match(/#/g) || []).length;
    if (n > (fr.match(/#/g) || []).length) fautes.push(fr);
  }
  assert.deepStrictEqual(fautes, [], 'nombre de « # » incohérent : ' + fautes.slice(0, 5).join(' | '));
});

test('le choix de langue se lit et se mémorise, toute valeur inattendue vaut français', () => {
  const memoire = {};
  const stockage = { getItem: (k) => (k in memoire ? memoire[k] : null), setItem: (k, v) => { memoire[k] = String(v); } };
  assert.strictEqual(L.lireChoix(stockage), 'fr');
  L.memoriser('en', stockage);
  assert.strictEqual(memoire.sentinel_lang, 'en');
  assert.strictEqual(L.lireChoix(stockage), 'en');
  memoire.sentinel_lang = 'de';
  assert.strictEqual(L.lireChoix(stockage), 'fr');
  const casse = { getItem: () => { throw new Error('refusé'); }, setItem: () => { throw new Error('refusé'); } };
  assert.strictEqual(L.lireChoix(casse), 'fr');
  assert.doesNotThrow(() => L.memoriser('en', casse));
});

test('la note du Flux dit dans les deux langues que les actus sont traduites', () => {
  // Consigne du 21/10/2026 : une seule langue à l'écran (voir une-langue.test.js).
  assert.match(HTML, /note_flux:'Feed:.{0,300}translated automatically into English/);
  assert.match(HTML, /note_flux:'Flux opérationnel.{0,300}traduits automatiquement en français/);
});
