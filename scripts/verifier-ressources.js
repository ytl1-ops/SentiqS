#!/usr/bin/env node
// Verifie que chaque ressource referencee par un chemin relatif dans le
// fichier de production existe vraiment dans web/.
//
// Pourquoi : les captures du mode d'emploi vivaient en base64 DANS le
// fichier — 240 Ko imposes a chaque visiteur pour deux images qui ne servent
// qu'a un export PDF. Sorties dans web/assets/, elles gagnent en poids de
// page ce qu'elles perdent en garantie : un fichier renomme ou oublie dans
// un commit ne casse plus rien de visible au chargement, seulement l'export,
// et seulement au moment ou quelqu'un l'essaie. Ce controle rend la rupture
// immediate.
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..', 'web');
const cible = process.argv[2] || path.join(racine, 'SentiqS_Web.html');
const brut = fs.readFileSync(cible, 'utf8');
// Les commentaires citent des chemins en prose : on les neutralise d'abord.
const html = brut
  .replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '))
  .replace(/^\s*\/\/.*$/gm, '');

// Chemins relatifs vers des fichiers servis : 'assets/x.jpg', "pays/y.html"...
const motif = /['"]((?:assets|pays|dashboard|legal)\/[A-Za-z0-9._\-/]+\.[a-z0-9]{2,5})['"]/g;
const refs = [...new Set([...html.matchAll(motif)].map((m) => m[1]))];

const manquantes = refs.filter((r) => !fs.existsSync(path.join(racine, r)));

console.log(`Ressources relatives referencees : ${refs.length}`);
refs.forEach((r) => console.log(`  ${fs.existsSync(path.join(racine, r)) ? '✓' : '✗'} web/${r}`));

if (manquantes.length) {
  console.error(`\n✗ ${manquantes.length} ressource(s) referencee(s) mais absente(s) de web/ :`);
  manquantes.forEach((r) => console.error(`   web/${r}`));
  process.exit(1);
}
console.log('\n✓ Toutes les ressources referencees existent.');
