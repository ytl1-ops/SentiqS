#!/usr/bin/env node
// Verifie que le cache partage a bien ete rafraichi par la collecte qui vient
// de tourner. Un job peut se terminer sans erreur tout en n'ayant rien publie
// (proxys rate-limites, publication refusee...) : on controle donc l'EFFET,
// pas seulement l'absence d'exception.
const fs = require('node:fs');
const path = require('node:path');

const AGE_MAX_MIN = Number(process.env.FRAICHEUR_MAX_MIN || 45);

// Le cache partage vit sur Firestore seul depuis le 15/11/2026 (Supabase
// retire). Sans compte de service, rien a verifier : echec explicite.
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('✗ FIREBASE_SERVICE_ACCOUNT absent : impossible de lire le cache Firestore.');
  process.exit(1);
}
{
  const cfgSrc = fs.readFileSync(path.join(__dirname, '../web/js/firebase-config.js'), 'utf8');
  const cfg = {
    projectId: (cfgSrc.match(/projectId:\s*'([^']+)'/) || [])[1],
    apiKey: (cfgSrc.match(/apiKey:\s*'([^']+)'/) || [])[1],
  };
  if (!cfg.projectId || !cfg.apiKey) {
    console.error('✗ Configuration Firebase introuvable dans web/js/firebase-config.js');
    process.exit(1);
  }
  // Lecture réservée aux comptes depuis le 13/11/2026 (firebase/firestore.rules) :
  // ce contrôle lit avec le compte de service, comme le job qui publie.
  const ecriture = require('./lib/cache-firestore-ecriture');
  const compte = ecriture.lireCompte(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (!compte) { console.error('✗ FIREBASE_SERVICE_ACCOUNT illisible.'); process.exit(1); }
  ecriture.jetonAcces(compte, fetch).then((jeton) => require('../web/js/cache-firestore.js').lireAnnonce(cfg,
    (url) => fetch(url.replace(/\?key=[^&]*$/, ''), { headers: { Authorization: 'Bearer ' + jeton } }))).then((a) => {
    if (!a) {
      console.error("✗ Aucune annonce 'global' dans Firestore — rien n'a jamais ete publie.");
      process.exit(1);
    }
    const ageMin = (Date.now() - new Date(a.updated_at).getTime()) / 60000;
    if (!Number.isFinite(ageMin) || ageMin > AGE_MAX_MIN) {
      console.error(`✗ Cache Firestore publie il y a ${Number.isFinite(ageMin) ? ageMin.toFixed(0) : '?'} min (seuil : ${AGE_MAX_MIN} min).`);
      process.exit(1);
    }
    console.log(`✓ Cache Firestore frais : publie il y a ${ageMin.toFixed(0)} min, ${a.nb} articles (seuil : ${AGE_MAX_MIN} min).`);
  }).catch((e) => { console.error('✗ ' + (e && e.message || e)); process.exit(1); });
}
