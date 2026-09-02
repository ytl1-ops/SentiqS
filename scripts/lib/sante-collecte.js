// ============================================================
// SentiqS — mémoire inter-runs du job de collecte planifiée
//
// Chaque run du job démarre un navigateur VIERGE (localStorage vide) : les
// deux caches d'auto-apprentissage du moteur de collecte côté client —
// SRC_HEALTH (santé par SOURCE, voir recordSrcOk/recordSrcFail dans
// web/SentiqS_Web.html) et PROXY_HEALTH_PAYS (meilleur proxy CORS appris par
// PAYS, voir meilleurProxyPourPays) — repartent donc de zéro à CHAQUE run,
// alors qu'ils sont conçus pour s'affiner au fil du temps chez un vrai
// visiteur dont le navigateur persiste entre deux visites. Mesuré le
// 02/09/2026 : « Sources en veille : 0 » sur un run planifié récent, alors
// que le mécanisme de mise en veille (SRC_FAIL_THRESHOLD = 3 échecs
// consécutifs) existe précisément pour éviter de re-tenter des sources
// mortes — il ne peut simplement jamais se déclencher en une seule
// exécution de ~8 min, faute d'historique.
//
// Persister ces deux caches NE PASSE PAS par un commit git : voir la mise
// en garde explicite dans historique.js — « le job tourne cinq à quinze
// fois par jour ; enregistrer chaque passage produirait [...] un commit
// toutes les vingt minutes », exactement le bruit que ce dépôt a déjà choisi
// d'éviter pour l'archive des niveaux. Ça ne passe pas non plus par
// Supabase : un changement de schéma en production est hors périmètre sans
// le propriétaire (voir CLAUDE.md, « Ce qui ne se fait pas sans le
// propriétaire »). Le cache GitHub Actions (actions/cache) est fait pour
// exactement ce besoin : un petit état qui doit survivre entre exécutions
// éphémères sans toucher au dépôt ni à Supabase — voir la clé glissante
// `sante-collecte-<run-id>` / `restore-keys: sante-collecte-` dans
// collecte-planifiee.yml.
//
// Ce module ne fait que lire/écrire ce fichier local, hors dépôt (répertoire
// listé dans .gitignore). C'est collecte-planifiee.js qui orchestre QUAND
// l'injecter (page.addInitScript, AVANT navigation, pour que le script
// inline de la page le lise à son propre démarrage) et quand le relire
// (après la collecte, via page.evaluate) — jamais ce module directement.
// ============================================================

const fs = require('fs');
const path = require('path');

function cheminSante(racine) {
  return path.join(racine, 'sante-collecte.json');
}

// Tolérant par construction : fichier absent (premier run, ou cache GitHub
// Actions pas encore chaud), vide, ou corrompu -> état vierge. Ce cache est
// un bonus d'efficacité, jamais une dépendance dont l'absence doit bloquer
// la collecte.
function lireSante(racine) {
  const vide = { srcHealth: {}, proxyHealthPays: {} };
  try {
    const brut = fs.readFileSync(cheminSante(racine), 'utf8');
    const d = JSON.parse(brut);
    return {
      srcHealth: (d && typeof d.srcHealth === 'object' && d.srcHealth) || {},
      proxyHealthPays: (d && typeof d.proxyHealthPays === 'object' && d.proxyHealthPays) || {},
    };
  } catch (_) {
    return vide;
  }
}

function ecrireSante(racine, etat) {
  fs.mkdirSync(racine, { recursive: true });
  const propre = {
    srcHealth: (etat && etat.srcHealth) || {},
    proxyHealthPays: (etat && etat.proxyHealthPays) || {},
  };
  fs.writeFileSync(cheminSante(racine), JSON.stringify(propre) + '\n');
}

function compterCles(obj) {
  return obj && typeof obj === 'object' ? Object.keys(obj).length : 0;
}

module.exports = { cheminSante, lireSante, ecrireSante, compterCles };
