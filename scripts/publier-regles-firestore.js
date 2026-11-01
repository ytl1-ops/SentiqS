// Publie firebase/firestore.rules sur le projet de la page, par l'API REST
// Firebase Rules, avec le compte de service du secret FIREBASE_SERVICE_ACCOUNT.
//
// Pourquoi pas `firebase deploy --only firestore:rules` : le 01/11/2026 la CLI
// a échoué (403) AVANT de toucher aux règles, en vérifiant par Service Usage
// que l'API Firestore est activée — un droit que le compte firebase-adminsdk
// n'a pas d'office. L'API Rules, elle, est couverte par son rôle par défaut.
// Sans ces règles, la lecture publique du cache est refusée et la page ne voit
// aucune actu.
const fs = require('fs');
const path = require('path');
const ecr = require('./lib/cache-firestore-ecriture');

const RACINE = path.join(__dirname, '..');
const PORTEE = 'https://www.googleapis.com/auth/cloud-platform';

function projetDeLaPage() {
  const src = fs.readFileSync(path.join(RACINE, 'web', 'js', 'firebase-config.js'), 'utf8');
  return (src.match(/projectId:\s*'([^']+)'/) || [])[1] || '';
}

async function publierRegles(compte, projet, source, fetchFn) {
  const jeton = await ecr.jetonAcces(compte, fetchFn, PORTEE);
  const h = { authorization: 'Bearer ' + jeton, 'content-type': 'application/json' };
  const base = 'https://firebaserules.googleapis.com/v1/projects/' + projet;
  const r1 = await fetchFn(base + '/rulesets', {
    method: 'POST', headers: h,
    body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: source }] } }),
  });
  const d1 = await r1.json().catch(() => ({}));
  if (!r1.ok || !d1.name) throw new Error('création du jeu de règles refusée (HTTP ' + r1.status + ') : ' + ((d1.error && d1.error.message) || ''));
  const nomRelease = 'projects/' + projet + '/releases/cloud.firestore';
  const r2 = await fetchFn(base + '/releases/cloud.firestore', {
    method: 'PATCH', headers: h,
    body: JSON.stringify({ release: { name: nomRelease, rulesetName: d1.name } }),
  });
  if (r2.status === 404) {
    // Première publication : la release n'existe pas encore.
    const r3 = await fetchFn(base + '/releases', { method: 'POST', headers: h, body: JSON.stringify({ name: nomRelease, rulesetName: d1.name }) });
    if (!r3.ok) throw new Error('création de la release refusée (HTTP ' + r3.status + ')');
  } else if (!r2.ok) {
    const d2 = await r2.json().catch(() => ({}));
    throw new Error('publication refusée (HTTP ' + r2.status + ') : ' + ((d2.error && d2.error.message) || ''));
  }
  return d1.name;
}

async function main() {
  const compte = ecr.lireCompte(process.env.FIREBASE_SERVICE_ACCOUNT || '');
  if (!compte) { console.error('FIREBASE_SERVICE_ACCOUNT absent ou illisible.'); process.exit(1); }
  const projet = projetDeLaPage();
  if (compte.project_id !== projet) {
    console.error('La clé vient du projet « ' + compte.project_id + ' », la page utilise « ' + projet + ' ».');
    process.exit(1);
  }
  const source = fs.readFileSync(path.join(RACINE, 'firebase', 'firestore.rules'), 'utf8');
  try {
    const nom = await publierRegles(compte, projet, source, fetch);
    console.log('✓ Règles Firestore publiées sur ' + projet + ' (' + nom + ').');
  } catch (e) {
    console.error('✗ ' + e.message);
    console.error('  → Donner au compte ' + compte.client_email + ' le rôle « Administrateur Firebase Rules »');
    console.error('    (IAM et administration > IAM), ou coller firebase/firestore.rules dans Firestore > Règles > Publier.');
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { publierRegles, projetDeLaPage };
