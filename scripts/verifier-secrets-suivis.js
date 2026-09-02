#!/usr/bin/env node
// Fichiers de secrets suivis par git.
//
// POURQUOI CE CONTROLE EXISTE
//
// .gitignore declare pourtant « .env » et « .env.* » sous le commentaire
// « Secrets et configuration locale — ne jamais versionner ». Mais un fichier
// deja suivi AVANT l'ajout d'une regle .gitignore le reste indefiniment : git
// n'ignore que ce qu'il ne suit pas encore. webapp/.env est dans ce cas.
//
// Le retirer demande d'abord de verifier que Netlify porte bien
// VITE_PUBLIC_SUPABASE_URL et VITE_PUBLIC_SUPABASE_ANON_KEY dans ses
// variables d'environnement : le retirer avant casserait le build. Cette
// verification passe par une console a laquelle ce depot n'a pas acces.
//
// D'ou un cliquet plutot qu'un correctif : la dette existante est nommee, et
// AUCUN nouveau fichier de secrets ne peut s'ajouter.
const { execFileSync } = require('node:child_process');

// Dette au 02/09/2026. Faite pour RETRECIR. Un ajout ici annulerait le
// controle.
const DETTE_SUIVIE = ['webapp/.env'];

// Les modeles sont faits pour etre versionnes : c'est meme leur seul interet.
const TOLERES = /(^|\/)\.env\.example$|(^|\/)\.env\.sample$|(^|\/)\.env\.template$/;

let suivis;
try {
  suivis = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
} catch (e) {
  console.log('· git indisponible : controle ignore.');
  process.exit(0);
}

const secrets = suivis.filter((f) => /(^|\/)\.env($|\.)/.test(f) && !TOLERES.test(f));
const nouveaux = secrets.filter((f) => !DETTE_SUIVIE.includes(f));
const resorbes = DETTE_SUIVIE.filter((f) => !secrets.includes(f));

console.log('Fichiers de secrets suivis par git : ' + secrets.length
  + (secrets.length ? ' (' + secrets.join(', ') + ')' : ''));

if (resorbes.length) {
  console.log('\n→ ' + resorbes.length + ' fichier(s) sorti(s) du suivi : ' + resorbes.join(', '));
  console.log('   Retirez-le(s) de DETTE_SUIVIE dans ce script pour verrouiller le gain.');
}

if (nouveaux.length) {
  console.error('\n✗ Nouveau(x) fichier(s) de secrets suivi(s) par git : ' + nouveaux.join(', '));
  console.error('\n   .gitignore ne protege que ce qui n\'est pas DEJA suivi. Pour retirer un');
  console.error('   fichier du suivi sans l\'effacer du disque :');
  console.error('       git rm --cached <fichier>');
  console.error('   Et si le fichier a deja ete pousse, considerez la valeur comme publique :');
  console.error('   il faut faire tourner la cle, pas seulement retirer le fichier.');
  process.exit(1);
}
console.log('\n✓ Aucun nouveau fichier de secrets n\'est entre dans le suivi.');
