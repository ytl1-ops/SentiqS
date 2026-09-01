// Décide si l'accessibilité d'un cycle de collecte est acceptable.
//
// Isolé du job pour être testable : c'est une porte, et une porte qui ne
// s'ouvre jamais ou ne se ferme jamais est pire que pas de porte du tout.
//
// Le jugement ne porte QUE sur l'accessibilité — la part des sources tentées
// qui ont répondu. La fraîcheur (« combien ont publié depuis 12 h ») varie
// légitimement avec l'heure et la taille du pays ; un seuil posé dessus
// serait rouge en permanence ou jamais.
'use strict';

const SEUIL_PAR_DEFAUT = 20;

/**
 * @param {{joignables:number, tentees:number, mesurable:boolean}} mesure
 * @param {number} [seuilPct] part minimale de sources tentées devant répondre
 * @returns {{ok:boolean, code:string, message:string, tauxPct:number|null}}
 */
function evaluerAccessibilite(mesure, seuilPct) {
  const seuil = Number.isFinite(seuilPct) ? seuilPct : SEUIL_PAR_DEFAUT;
  const { joignables = 0, tentees = 0, mesurable = false } = mesure || {};

  // Registre de santé vide : le job tourne sur un navigateur neuf et n'a rien
  // relevé. On ne peut pas conclure — et on ne fabrique pas un échec sur une
  // absence de mesure.
  if (!mesurable || tentees <= 0) {
    return { ok: true, code: 'non_mesurable', tauxPct: null,
      message: 'accessibilité non mesurable : registre de santé des sources vide' };
  }

  const tauxPct = Math.round((joignables / tentees) * 100);

  if (joignables === 0) {
    return { ok: false, code: 'aucune_source', tauxPct,
      message: 'AUCUNE source n\'a répondu ce cycle. La collecte n\'a rien ramené du réseau.' };
  }
  if (tauxPct < seuil) {
    return { ok: false, code: 'effondrement', tauxPct,
      message: 'Accessibilité effondrée : ' + tauxPct + ' % des sources tentées ont répondu (seuil '
        + seuil + ' %). Le cache a été publié, mais sur une collecte très partielle.' };
  }
  return { ok: true, code: 'acceptable', tauxPct,
    message: tauxPct + ' % des sources tentées ont répondu.' };
}

module.exports = { evaluerAccessibilite, SEUIL_PAR_DEFAUT };
