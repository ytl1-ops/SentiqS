#!/usr/bin/env node
// Refuse de laisser passer une page légale encore trouée.
//
// Ces pages sont livrées comme structures : chaque emplacement
// « [[À COMPLÉTER : … ]] » attend une information que seul l'éditeur connaît.
// Publier la structure telle quelle serait pire qu'une page absente — elle
// donnerait l'illusion de la conformité.
//
// Le contrôle n'est BLOQUANT que si les pages sont référencées depuis le site
// (pied de page ou sitemap) : tant qu'elles ne sont pas publiées, il se
// contente d'un rappel.
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..');
const dossier = path.join(racine, 'web', 'legal');
if (!fs.existsSync(dossier)) { console.log('Aucune page légale.'); process.exit(0); }

const pages = fs.readdirSync(dossier).filter((f) => f.endsWith('.html'));
const publiees = ['web/index.html', 'web/SentiqS_Web.html', 'web/sitemap.xml']
  .map((f) => path.join(racine, f))
  .filter((f) => fs.existsSync(f))
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n');

let trous = 0;
let bloquant = false;

for (const page of pages) {
  const contenu = fs.readFileSync(path.join(dossier, page), 'utf8');
  const n = (contenu.match(/À COMPLÉTER/g) || []).length;
  const referencee = publiees.includes('legal/' + page);
  trous += n;
  if (n === 0) { console.log(`✓ ${page} : complète`); continue; }
  if (referencee) {
    bloquant = true;
    console.error(`✗ ${page} : ${n} emplacement(s) non complété(s), ET la page est publiée.`);
  } else {
    console.log(`· ${page} : ${n} emplacement(s) à compléter (non publiée, non bloquant)`);
  }
}

if (bloquant) {
  console.error('\nUne page légale publiée ne doit contenir aucun emplacement vide.');
  console.error('Complétez-la, ou retirez son lien du site le temps de le faire.');
  process.exit(1);
}
console.log(`\n${trous} emplacement(s) restant(s) — voir web/legal/README.md.`);
