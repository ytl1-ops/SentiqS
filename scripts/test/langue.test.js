// Le bouton « English » doit traduire toute l'interface, pas la moitie.
//
// Mesure du 03/09/2026 : 56 libelles traduits, 79 textes statiques restes en
// francais en dur (53 boutons, 34 champs, 10 libelles). Un bouton qui promet
// une interface anglaise et n'en livre que la moitie nuit a la credibilite
// de l'outil aupres des lecteurs anglophones — Nigeria, Ghana, Kenya, soit
// 41 % du flux.
//
// Ce test est un cliquet : aucun bouton, aucun champ du HTML statique ne
// doit repartir en francais en dur. Les jetons identiques dans les deux
// langues (EN, FR, PDF, ✕…) sont exemptes nommement.
const test = require('node:test');
const assert = require('node:assert');
const { HTML } = require('./_bac.js');

const EXEMPTES = new Set(['EN', 'FR', 'WEB', 'MOBILE', 'CSV', 'PDF', 'Excel', 'Word', '✕', 'MaJ', '-12h',
  // Le libelle du bouton de theme est resynchronise par appliquerTheme(), pas par le dictionnaire.
  'Sombre']);
const STATIQUE = HTML.replace(/<script\b[\s\S]*?<\/script>/g, '');

test('chaque bouton du HTML statique porte une accroche de traduction', () => {
  const restes = [];
  for (const m of STATIQUE.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    if (/data-i18n/.test(m[1] + m[2])) continue;
    const texte = m[2].replace(/<[^>]+>/g, '').trim();
    if (!texte || EXEMPTES.has(texte)) continue;
    restes.push(texte);
  }
  assert.deepStrictEqual(restes, [], 'boutons sans data-i18n : ' + restes.join(' | '));
});

test('chaque champ du HTML statique porte une accroche de traduction pour son placeholder', () => {
  const restes = [];
  for (const m of STATIQUE.matchAll(/<(?:input|textarea)\b([^>]*)>/g)) {
    const ph = /placeholder="([^"]+)"/.exec(m[1]);
    if (!ph || /data-i18n-ph=/.test(m[1])) continue;
    restes.push(ph[1]);
  }
  assert.deepStrictEqual(restes, [], 'placeholders sans data-i18n-ph : ' + restes.join(' | '));
});

test('toute accroche renvoie a une cle presente dans les deux langues', () => {
  const cles = new Set();
  for (const m of STATIQUE.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)) cles.add(m[1]);
  const dico = HTML.slice(HTML.indexOf('const I18N = {'), HTML.indexOf('function setLang'));
  const fr = dico.slice(dico.indexOf('  fr: {'), dico.indexOf('  en: {'));
  const en = dico.slice(dico.indexOf('  en: {'));
  // Le dictionnaire ecrit plusieurs cles par ligne : on cherche la cle
  // precedee d'un debut de ligne, d'une virgule ou d'une accolade.
  const porte = (bloc, k) => new RegExp('(^|[\\s{,])' + k + '\\s*:').test(bloc);
  const manquantes = [...cles].filter((k) => !porte(fr, k) || !porte(en, k));
  assert.deepStrictEqual(manquantes, [], 'accroches sans entree fr+en : ' + manquantes.join(', '));
});
