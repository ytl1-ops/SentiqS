#!/usr/bin/env node
// Verifie que le dictionnaire I18N reste symetrique entre francais et anglais.
//
// t(cle) retombe silencieusement sur le francais quand une cle manque en
// anglais : `(I18N[LANG] && I18N[LANG][cle]) || I18N.fr[cle] || cle`. Une cle
// ajoutee du seul cote francais n'echoue donc nulle part — elle affiche
// simplement du francais a un utilisateur anglophone, sans que personne le
// voie avant qu'un client le signale.
//
// Etat au 01/09/2026 : 56 cles de chaque cote, aucun ecart. Cette symetrie
// tient au soin de ceux qui editent le fichier, et rien ne la defend.
const fs = require('node:fs');
const path = require('node:path');

const cible = process.argv[2] || path.join(__dirname, '../web/SentiqS_Web.html');
const HTML = fs.readFileSync(cible, 'utf8');

const debut = HTML.indexOf('const I18N = {');
if (debut === -1) { console.error('✗ I18N introuvable dans ' + cible); process.exit(1); }

// Delimite le litteral par comptage d'accolades : plus sur qu'une expression
// reguliere sur un objet imbrique de plusieurs centaines de lignes.
function corpsAccolades(texte, depuis) {
  const ouvre = texte.indexOf('{', depuis);
  let n = 0;
  for (let i = ouvre; i < texte.length; i++) {
    if (texte[i] === '{') n++;
    else if (texte[i] === '}') { n--; if (n === 0) return texte.slice(ouvre + 1, i); }
  }
  return null;
}

const bloc = corpsAccolades(HTML, debut);
if (bloc === null) { console.error('✗ litteral I18N mal ferme'); process.exit(1); }

function cles(langue) {
  const m = new RegExp('\\b' + langue + '\\s*:\\s*\\{').exec(bloc);
  if (!m) return null;
  const corps = corpsAccolades(bloc, m.index);
  if (corps === null) return null;
  return new Set([...corps.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)].map((x) => x[1]));
}

const fr = cles('fr');
const en = cles('en');
if (!fr || !en) { console.error('✗ section fr ou en introuvable dans I18N'); process.exit(1); }

const sansEn = [...fr].filter((c) => !en.has(c)).sort();
const sansFr = [...en].filter((c) => !fr.has(c)).sort();

const communes = [...fr].filter((c) => en.has(c)).length;
console.log(`Dictionnaire I18N : ${fr.size} cle(s) en francais, ${en.size} en anglais, ${communes} commune(s).`);

if (sansEn.length) {
  console.error(`\n✗ ${sansEn.length} cle(s) sans traduction anglaise — un anglophone verra du francais :`);
  sansEn.forEach((c) => console.error('   ' + c));
}
if (sansFr.length) {
  console.error(`\n✗ ${sansFr.length} cle(s) sans equivalent francais :`);
  sansFr.forEach((c) => console.error('   ' + c));
}
if (sansEn.length || sansFr.length) {
  console.error('\nAjoutez les cles manquantes dans I18N (web/SentiqS_Web.html).');
  process.exit(1);
}
console.log('✓ Les deux langues couvrent exactement les memes cles.');
