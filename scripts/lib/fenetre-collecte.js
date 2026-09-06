// Fenetre de collecte reelle du passage planifie.
//
// Le plafond (COLLECT_TIMEOUT_MS, 11 min) est raccourci si le passage a deja
// consomme son budget avant meme de commencer a collecter. Le workflow fixe
// COLLECTE_ECHEANCE_EPOCH (secondes Unix) apres l'installation du navigateur ;
// on reserve 90 s pour publier et archiver, et on ne descend jamais sous deux
// minutes de collecte.
//
// POURQUOI : les 03 et 04/09/2026 (passages n° 812 et 814), le telechargement
// de Chromium a pris plus de 7 min au lieu de 30 s. Avec 11 min de collecte
// derriere, le job a depasse sa garde de 18 min et a ete tue AVANT de
// publier : un cycle entier perdu, et perdu en silence (« annule » n'est pas
// « echoue »). Avec une echeance absolue, la collecte raccourcit d'elle-meme
// et publie ce qu'elle a.
const COLLECTE_RESERVE_MS = 90 * 1000;
const COLLECTE_MINIMUM_MS = 2 * 60 * 1000;

function fenetreCollecteMs(plafondMs, echeanceEpochSec, maintenantMs) {
  const echeance = Number(echeanceEpochSec || 0) * 1000;
  if (!echeance) return plafondMs;
  const budget = echeance - maintenantMs - COLLECTE_RESERVE_MS;
  return Math.max(COLLECTE_MINIMUM_MS, Math.min(plafondMs, budget));
}

module.exports = { fenetreCollecteMs, COLLECTE_RESERVE_MS, COLLECTE_MINIMUM_MS };
