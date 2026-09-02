// ============================================================
// SentiqS — priorisation du travail humain restant.
//
// Deux calculs, extraits de leurs scripts pour etre testables sans navigateur
// ni instantane reel :
//
//   profilSeuil()   — ce que change chaque valeur du seuil de fiabilite
//   prioriteRevue() — par quel pays commencer la revue du socle fige
//
// Aucun des deux ne DECIDE quoi que ce soit. Ils rangent, pour qu'un humain
// decide dans le bon ordre.
// ============================================================

const RANG_NIVEAU = { vert: 0, jaune: 1, orange: 2, marron: 3, rouge: 4 };

// Un socle sans aucune date exploitable est traite comme tres ancien, pas
// comme neuf : l'absence de date est un probleme, pas une absence de probleme.
const AGE_SI_INCONNU_J = 200;

/**
 * Combien de sources d'alerte chaque pays aurait, a un seuil donne.
 *
 * `sources` : [{ cy, score }]. Les entrees sans pays ou marquees INT sont
 * ignorees — INT n'est pas un pays suivi.
 */
function profilSeuil(sources, seuil) {
  // UNE seule comparaison, et c'est deliberé. La premiere version en portait
  // deux — une pour le compte par pays, une pour le total — et une mutation a
  // montre qu'elles pouvaient diverger sans qu'aucun test ne le voie. Deux
  // ecritures de la meme regle finissent toujours par ne plus dire la meme
  // chose.
  const retenue = (s) => s && s.cy && s.cy !== 'INT' && (s.score || 0) >= seuil;
  const parPays = new Map();
  let total = 0;
  for (const s of sources || []) {
    if (!s || !s.cy || s.cy === 'INT') continue;
    if (!parPays.has(s.cy)) parPays.set(s.cy, 0);
    if (retenue(s)) { parPays.set(s.cy, parPays.get(s.cy) + 1); total += 1; }
  }
  const compte = [...parPays.values()].sort((a, b) => a - b);
  return {
    seuil,
    pays: compte.length,
    aveugles: compte.filter((n) => n === 0).length,
    uniques: compte.filter((n) => n === 1).length,
    mediane: compte.length ? compte[Math.floor(compte.length / 2)] : 0,
    sources: total,
  };
}

/**
 * Ce qu'une donnee perimee coute sur ce pays.
 *
 * Quatre facteurs, tous dans le meme sens : plus le niveau affiche est eleve,
 * plus le socle est ancien, plus il porte une grande part du score, et moins
 * la collecte peut le corriger — plus une erreur de saisie est chere.
 *
 * La collecte divise la priorite par deux plutot que de l'annuler : elle
 * corrige a la marge, elle ne remplace pas une revue.
 */
function prioriteRevue(pays) {
  const p = pays || {};
  const rang = RANG_NIVEAU[p.niveau] || 0;
  const age = (typeof p.plusRecentJours === 'number' && p.plusRecentJours >= 0)
    ? p.plusRecentJours : AGE_SI_INCONNU_J;
  const total = Number(p.total) || 0;
  const partSocle = total > 0 ? (Number(p.verifies) || 0) / total : 0;
  const attenuation = (Number(p.live) || 0) > 0 ? 0.5 : 1;
  return rang * age * partSocle * attenuation;
}

/**
 * Triage d'un incident vérifié.
 *
 * Deux questions, dans cet ordre :
 *
 *  1. Cet incident PORTE-t-il le niveau ? On le sait en le retirant : si le
 *     pays descend d'un cran, oui. Sinon il ne fait que s'ajouter a un socle
 *     deja suffisant, et le relire ne changerait rien a ce que voit
 *     l'utilisateur.
 *  2. Est-il ANCIEN ? Un incident porteur et recent est probablement encore
 *     vrai. Porteur et vieux de dix-huit mois, personne ne sait.
 *
 * Seule la combinaison des deux est urgente. C'est ce qui fait passer « relire
 * 172 incidents » a une liste qu'un analyste peut finir.
 */
const AGE_SUSPECT_J = 180;

function triageIncident(inc) {
  const i = inc || {};
  const porteur = !!i.niveauSans && i.niveauSans !== i.niveau;
  // Une date NON ANALYSABLE (null) compte comme ancienne : on ne sait pas,
  // donc on regarde. La traiter comme recente ferait disparaitre de la liste
  // les incidents les moins bien saisis.
  //
  // Un age NEGATIF est autre chose, et la premiere version les confondait.
  // dateEvenementMs resout une date imprecise (« Juin 2026 ») a un point qui
  // peut tomber un jour ou deux dans le futur : douze incidents porteurs
  // sortaient a -1 jour et etaient classes « urgents » alors qu'ils sont les
  // PLUS RECENTS du socle. Un age negatif vaut donc zero : c'est aujourd'hui.
  const brut = (typeof i.jours === 'number' && Number.isFinite(i.jours)) ? i.jours : null;
  const age = brut === null ? null : Math.max(0, brut);
  const ancien = age === null || age >= AGE_SUSPECT_J;
  if (!porteur) return 'differable';
  return ancien ? 'urgent' : 'porteur';
}

module.exports = {
  RANG_NIVEAU, AGE_SI_INCONNU_J, AGE_SUSPECT_J,
  profilSeuil, prioriteRevue, triageIncident,
};
