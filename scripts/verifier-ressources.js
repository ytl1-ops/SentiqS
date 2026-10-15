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
// Sans argument : l'application ET la page d'accueil (qui porte l'animation
// d'ouverture, js/intro.js et les deux videos — 2,7 Mo qu'un renommage oublie
// ferait disparaitre sans erreur visible).
const cibles = process.argv[2]
  ? [process.argv[2]]
  : [path.join(racine, 'SentiqS_Web.html'), path.join(racine, 'index.html')];

// Chemins relatifs vers des fichiers servis : 'assets/x.jpg', "pays/y.html",
// et le <script src="js/noyau.js"> dont depend TOUTE l'application — sans lui,
// la page se charge mais aucune fonction de decision n'existe.
const motif = /['"]((?:assets|js|pays|dashboard|legal)\/[A-Za-z0-9._\-/]+\.[a-z0-9]{2,5})['"]/g;

let echec = false;
for (const cible of cibles) {
  const brut = fs.readFileSync(cible, 'utf8');
  // Les commentaires citent des chemins en prose : on les neutralise d'abord.
  const html = brut
    .replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '');
  const refs = [...new Set([...html.matchAll(motif)].map((m) => m[1]))];
  const manquantes = refs.filter((r) => !fs.existsSync(path.join(racine, r)));

  console.log(`${path.relative(path.join(racine, '..'), cible)} — ressources relatives referencees : ${refs.length}`);
  refs.forEach((r) => console.log(`  ${fs.existsSync(path.join(racine, r)) ? '✓' : '✗'} web/${r}`));
  if (manquantes.length) {
    echec = true;
    console.error(`\n✗ ${manquantes.length} ressource(s) referencee(s) mais absente(s) de web/ :`);
    manquantes.forEach((r) => console.error(`   web/${r}`));
  }
}
if (echec) process.exit(1);
console.log('\n✓ Toutes les ressources referencees existent.');
