#!/usr/bin/env node
// Diagnostic du compte de service Firebase — 01/11/2026.
//
// La collecte du 01/11/2026 écrivait sur Firestore et recevait « HTTP 403 »
// sans autre détail, pendant que la lecture publique du cache recevait elle
// aussi un 403. Deux causes différentes, deux corrections différentes, et
// toutes deux dans la console (pas dans le code) :
//   · lecture publique refusée  -> règles Firestore pas encore publiées ;
//   · compte de service refusé  -> rôle IAM manquant, ou clé d'un autre projet.
// Ce script les sépare et dit quoi faire, en français. Il ne lit que
// l'annonce du cache (quelques octets) et n'écrit qu'un document de test,
// `collecte_partagee/diagnostic`, que personne ne lit.
//
//   FIREBASE_SERVICE_ACCOUNT='{...}' node scripts/diagnostic-firebase.js
const fs = require('node:fs');
const path = require('node:path');
const ecriture = require('./lib/cache-firestore-ecriture');
const commun = require('../web/js/cache-firestore.js');

function configPublique() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'js', 'firebase-config.js'), 'utf8');
  return {
    projectId: (src.match(/projectId:\s*'([^']+)'/) || [])[1],
    apiKey: (src.match(/apiKey:\s*'([^']+)'/) || [])[1],
  };
}

async function main() {
  const cfg = configPublique();
  let ok = true;
  console.log('Projet de la page : ' + cfg.projectId);

  // 1. Lecture publique (ce que fait chaque visiteur).
  try {
    const a = await commun.lireAnnonce(cfg, fetch);
    console.log('✓ Lecture publique du cache : autorisée' + (a ? ' (publié le ' + a.updated_at + ', ' + a.nb + ' articles)' : ' (rien de publié pour l\'instant)') + '.');
  } catch (e) {
    ok = false;
    console.log('✗ Lecture publique du cache refusée : ' + e.message);
    console.log('  → Les règles Firestore de la console ne sont pas celles du dépôt. Recoller');
    console.log('    firebase/firestore.rules dans Firestore > Règles > Publier (ou laisser le');
    console.log('    workflow de déploiement le faire, une fois le rôle IAM accordé).');
  }

  // 2. Compte de service (ce que fait le job de collecte).
  const compte = ecriture.lireCompte(process.env.FIREBASE_SERVICE_ACCOUNT || '');
  if (!compte) {
    console.log('✗ Secret FIREBASE_SERVICE_ACCOUNT absent ou illisible (JSON de compte de service attendu).');
    process.exitCode = 1;
    return;
  }
  console.log('Compte de service : ' + compte.client_email + ' (projet ' + compte.project_id + ')');
  if (compte.project_id !== cfg.projectId) {
    console.log('✗ La clé vient du projet « ' + compte.project_id + ' », la page utilise « ' + cfg.projectId + ' ».');
    console.log('  → Regénérer la clé depuis la console du projet ' + cfg.projectId + '.');
    process.exitCode = 1;
    return;
  }
  let jeton;
  try {
    jeton = await ecriture.jetonAcces(compte, fetch);
    console.log('✓ Jeton Google obtenu.');
  } catch (e) {
    console.log('✗ ' + e.message + ' — clé révoquée ou mal copiée : en regénérer une.');
    process.exitCode = 1;
    return;
  }
  try {
    await ecriture.ecrireDocument({ projectId: compte.project_id }, fetch, jeton, 'diagnostic', {
      verifie_le: { stringValue: new Date().toISOString() },
    });
    console.log('✓ Écriture par le compte de service : autorisée.');
  } catch (e) {
    ok = false;
    console.log('✗ Écriture par le compte de service refusée : ' + e.message);
    console.log('  → Google Cloud > IAM (projet ' + compte.project_id + ') > ' + compte.client_email);
    console.log('    > Modifier > Ajouter un rôle « Administrateur Firebase » (roles/firebase.admin).');
  }
  if (!ok) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
