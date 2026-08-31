#!/usr/bin/env node
// Verifie que tout le JavaScript inline de web/SentiqS_Web.html parse.
// Le fichier de production n'a pas d'etape de build : une erreur de syntaxe
// n'y est decouverte qu'au chargement, dans le navigateur d'un visiteur.
const fs = require('node:fs');
const vm = require('node:vm');

const cible = process.argv[2] || 'web/SentiqS_Web.html';
const brut = fs.readFileSync(cible, 'utf8');

// Les commentaires HTML de ce fichier citent des balises <script> dans leur
// prose (notes d'audit sur la CSP) : sans les neutraliser d'abord, on prend
// du texte pour du code. On les remplace par des blancs de meme longueur
// pour que les numeros de ligne restent exacts.
const html = brut.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));

const blocs = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m => !/\bsrc=/i.test(m[1]))
  .filter(m => !/type=["'](?!text\/javascript|module)/i.test(m[1]));

let erreurs = 0;
blocs.forEach((m, i) => {
  const ligne = html.slice(0, m.index).split('\n').length;
  try {
    new vm.Script(m[2], { filename: `${cible}:<script #${i + 1}> (ligne ${ligne})` });
  } catch (e) {
    erreurs++;
    console.error(`✗ ${cible} — script #${i + 1} (ligne ~${ligne}) : ${e.message}`);
  }
});

if (erreurs) {
  console.error(`${erreurs} bloc(s) en erreur sur ${blocs.length}.`);
  process.exit(1);
}
console.log(`✓ ${cible} : ${blocs.length} bloc(s) <script> inline, syntaxe valide.`);
