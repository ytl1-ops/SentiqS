// Socle commun aux tests qui exercent du code encore inline dans
// web/SentiqS_Web.html.
//
// Le noyau logique (web/js/noyau.js) est un vrai module : on le charge par
// require, comme la page le charge par <script src>. Le reste — classify(),
// l'attribution pays, le score de confiance — vit encore dans les 20 000
// lignes inline, et doit donc etre extrait par marqueurs. Ce socle fait les
// deux, et evite que chaque fichier de test rebricole son propre montage.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CHEMIN_HTML = path.join(__dirname, '../../web/SentiqS_Web.html');
const HTML = fs.readFileSync(CHEMIN_HTML, 'utf8');
const noyau = require('../../web/js/noyau.js');

// tranche(debut, fin) : le texte du fichier de production entre deux
// marqueurs. Echoue bruyamment si l'un des deux a disparu — un test muet
// vaut moins que pas de test du tout.
function tranche(debut, fin) {
  const i = HTML.indexOf(debut);
  assert.ok(i !== -1, 'marqueur introuvable dans le fichier de production : ' + debut);
  const j = HTML.indexOf(fin, i);
  assert.ok(j !== -1, 'fin introuvable apres « ' + debut + ' » : ' + fin);
  return HTML.slice(i, j);
}

// bac(...tranches) : un contexte vm ou le noyau est deja pose, exactement
// comme dans le navigateur, puis ou l'on evalue les tranches demandees.
function bac(...tranches) {
  const contexte = { console, Date };
  Object.assign(contexte, noyau);
  vm.createContext(contexte);
  for (const src of tranches) vm.runInContext(src, contexte);
  return contexte;
}

// exposer(contexte, ...noms) : recupere des liaisons `const` declarees dans
// une tranche. Une declaration `const` n'atterrit pas sur l'objet de
// contexte ; il faut la lui affecter explicitement.
function exposer(contexte, ...noms) {
  vm.runInContext(noms.map((n) => `this.${n} = ${n};`).join('\n'), contexte);
  return contexte;
}

module.exports = { HTML, CHEMIN_HTML, noyau, tranche, bac, exposer };
