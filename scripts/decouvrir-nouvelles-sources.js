#!/usr/bin/env node
// Vérifie une liste de sources candidates et trouve, pour chacune, le
// meilleur flux RSS disponible (voir scripts/lib/decouverte-source.js pour
// la méthode et pourquoi elle ne scrape jamais une page à l'aveugle).
//
// Sert de rapport avant intégration dans SRCS (web/SentiqS_Web.html) --
// n'écrit jamais dans SRCS lui-même, une source ajoutée sans relecture
// humaine du niveau de fiabilité (score) et de la fréquence de publication
// serait pire que pas de source du tout.
//
// ATTENTION -- NÉCESSITE UN ACCÈS RÉSEAU RÉEL, comme
// scripts/verifier-decouverte-flux.js : inutilisable depuis un bac à sable
// à liste blanche réseau restreinte, à lancer depuis un poste avec accès
// internet complet.
//
// Usage :
//   node scripts/decouvrir-nouvelles-sources.js <fichier.txt>
//   node scripts/decouvrir-nouvelles-sources.js https://exemple.org https://autre.org
// <fichier.txt> : une URL par ligne, lignes vides et commentaires (#) ignorés.
const fs = require('node:fs');
const { decouvrirMeilleurFlux } = require('./lib/decouverte-source');

function lireUrls(argv) {
  if (!argv.length) return [];
  const premier = argv[0];
  if (/^https?:\/\//i.test(premier)) return argv.filter((a) => /^https?:\/\//i.test(a));
  if (!fs.existsSync(premier)) {
    console.error('Fichier introuvable : ' + premier);
    process.exit(1);
  }
  return fs
    .readFileSync(premier, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

const urls = lireUrls(process.argv.slice(2));
if (!urls.length) {
  console.error('Usage : node scripts/decouvrir-nouvelles-sources.js <fichier.txt | url...>');
  process.exit(1);
}

(async () => {
  const trouves = [];
  const echecs = [];

  for (const url of urls) {
    // Chaque source est traitée indépendamment : l'échec d'une ne doit
    // jamais interrompre le traitement des suivantes (même philosophie que
    // fetchRespectueux -- une source en échec est un résultat, pas un crash).
    let resultat;
    try {
      resultat = await decouvrirMeilleurFlux(url);
    } catch (e) {
      resultat = { trouve: false, essais: ['erreur inattendue : ' + (e && e.message)] };
    }
    if (resultat.trouve) {
      trouves.push({ url, ...resultat });
      console.log('✓ ' + url);
      console.log('  flux : ' + resultat.url + ' (' + resultat.methode + ')');
    } else {
      echecs.push({ url, ...resultat });
      console.log('✗ ' + url);
      resultat.essais.forEach((e) => console.log('  - ' + e));
    }
  }

  console.log('');
  console.log('Sources vérifiées : ' + urls.length);
  console.log('  flux trouvé (candidat direct pour SRCS) : ' + trouves.length);
  console.log('  aucun flux trouvé (candidat scraping dédié, à évaluer au cas par cas -- voir l\'en-tête de scripts/lib/decouverte-source.js) : ' + echecs.length);

  if (echecs.length) {
    console.log('\nSans flux :');
    echecs.forEach((e) => console.log('  - ' + e.url));
  }

  console.log(
    "\nRappel : un flux trouvé n'est qu'un CANDIDAT -- vérifier la fiabilité "
    + 'et la fréquence de publication avant de l\'ajouter à SRCS avec un score '
    + 'et une catégorie pertinents. Cet outil ne modifie jamais SRCS lui-même.'
  );
})();
