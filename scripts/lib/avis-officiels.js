'use strict';
// Avis aux voyageurs du FCDO britannique, lus par l'API de contenu de gov.uk
// (audit du 15/11/2026). Second témoin de la confiance d'un niveau quand la
// collecte se tait : voir lectureAvisOfficiel dans web/js/noyau.js, qui seul
// décide de ce qu'un avis change à l'écran (la confiance, jamais le niveau).
//
// Ici : lire une réponse de l'API, garder l'ancien avis d'un pays qui ne
// répond pas (un silence ne doit pas effacer un témoin), et lister les pays
// où l'avis récent diverge du niveau affiché — la liste de relecture du socle.
const noyau = require('../../web/js/noyau.js');

const API = 'https://www.gov.uk/api/content/foreign-travel-advice/';

function slugFcdo(urlPublique) {
  const m = /foreign-travel-advice\/([a-z0-9-]+)/.exec(String(urlPublique || ''));
  return m ? m[1] : null;
}

// Une réponse de l'API → { statuts, revu, maj, url } ; null si illisible.
// `alert_status` vide veut dire « aucune restriction » : c'est un avis, pas
// une absence d'avis. Sans date lisible, l'avis ne peut rien attester.
function lireReponse(json, slug) {
  if (!json || typeof json !== 'object' || !json.details) return null;
  const statuts = Array.isArray(json.details.alert_status) ? json.details.alert_status.map(String) : [];
  const revu = json.details.reviewed_at || json.public_updated_at || null;
  const maj = json.public_updated_at || null;
  if (!revu || !isFinite(Date.parse(revu))) return null;
  return { statuts, revu, maj, url: 'https://www.gov.uk/foreign-travel-advice/' + slug };
}

function fusionner(ancien, nouveaux) {
  const pays = Object.assign({}, (ancien && ancien.pays) || {});
  Object.keys(nouveaux || {}).forEach((cy) => { if (nouveaux[cy]) pays[cy] = nouveaux[cy]; });
  return pays;
}

// Pays dont l'avis RÉCENT ne colle pas au niveau archivé. Un avis trop ancien
// ne témoigne de rien et n'y figure pas.
function divergences(pays, instantane, maintenant) {
  const out = [];
  ((instantane && instantane.pays) || []).forEach((p) => {
    const lu = noyau.lectureAvisOfficiel(pays[p.code], p.niveau, maintenant);
    if (lu && !lu.compatible) {
      out.push({ code: p.code, niveau: p.niveau, avis: lu.degre, libelle: noyau.AVIS_LIBELLES[lu.degre], revuIlYaJ: lu.ageJ });
    }
  });
  return out;
}

module.exports = { API, slugFcdo, lireReponse, fusionner, divergences };
