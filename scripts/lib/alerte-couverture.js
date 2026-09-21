// ============================================================
// SentiqS — alerte sur les pays sans actualité fraîche, vers le même canal
// que les changements de niveau (voir alerte-sortante.js, dont ce fichier
// reprend le raisonnement).
//
// POURQUOI CE FICHIER EXISTE
//
// scripts/collecte-planifiee.js calcule et journalise couverture.paysSans-
// ArticleFrais à CHAQUE cycle — mais seulement dans les journaux GitHub
// Actions, que personne ne relit sauf à aller les chercher à la main.
// Mesure du 20/09/2026 : trois collectes réelles indépendantes, étalées sur
// quatre heures, donnent EXACTEMENT le même septuor (BI, BJ, ER, KM, LS, MR,
// SC) — un signal stable, pas un accident de collecte passager, et pourtant
// invisible tant que quelqu'un ne relit pas les journaux. C'est le pendant
// côté exploitation de ce que paysMuet() fait déjà côté interface (voir
// CLAUDE.md, « Silence n'est pas calme ») : l'absence de signal ne doit pas
// se confondre avec l'absence de problème.
//
// Volontairement PAS branché sur couverture.enVeille (sources en échec
// répété) : ce chiffre est mesuré volatile d'un cycle à l'autre selon la
// saturation des proxys CORS publics (43 -> 96 en quatre heures le
// 20/09/2026, sans rien de cassé entre les deux), et alerter dessus
// produirait exactement le canal qu'on finit par couper — voir la règle
// juste en dessous.
//
// Même discipline que l'alerte de niveau : on n'alerte QUE quand
// l'ENSEMBLE des pays sans actualité change — jamais à chaque cycle où il
// reste identique, sans quoi le job (5 à 15 passages par jour) noierait le
// canal. Contrairement à un changement de niveau, il n'y a pas de notion de
// « pays nouvellement suivi » à exclure ici : un pays sans actualité DÈS le
// premier signalement est une information utile, pas un faux départ.
// ============================================================

const URL_PRODUIT = 'https://ytl1-ops.github.io/SentiqS/SentiqS_Web.html';

/** Liste de codes pays -> clé stable, indépendante de l'ordre d'entrée. */
function cleEnsemble(codes) {
  return (codes || []).slice().sort().join(',');
}

/**
 * Le message à envoyer, ou null si l'ensemble des pays sans actualité
 * fraîche n'a pas changé depuis le dernier signalement.
 */
function construireMessage(paysSansArticleFrais, etatPrecedent, { url } = {}) {
  const codes = paysSansArticleFrais || [];
  const courant = cleEnsemble(codes);
  const precedent = (etatPrecedent && etatPrecedent.cle) || '';
  if (courant === precedent) return null;

  // Un ensemble vide qui succède à un ensemble non vide mérite d'être dit
  // aussi : la couverture s'est rétablie, et c'est aussi rare que le reste.
  if (!codes.length) {
    return { text: 'SentiqS — couverture rétablie : tous les pays suivis ont une actualité de moins de 12 h.' };
  }

  // Codes bruts, pas de nom de pays : c'est exactement le format déjà
  // journalisé par collecte-planifiee.js (« Pays sans actualité de moins de
  // 12 h : BI, BJ... ») — pas besoin d'un second lexique code->nom ici.
  const lignes = codes.slice().sort().map((c) => '• ' + c);

  return {
    text: [
      'SentiqS — ' + codes.length + ' pays sans actualité de moins de 12 h',
      '',
      ...lignes,
      '',
      "Un pays sans actualité fraîche n'est pas forcément un pays injoignable — détail : " + (url || URL_PRODUIT),
    ].join('\n'),
  };
}

/** L'état à persister après un run : l'ensemble annoncé, normalisé. */
function etatSuivant(paysSansArticleFrais) {
  const codes = (paysSansArticleFrais || []).slice().sort();
  return { cle: cleEnsemble(codes), pays: codes };
}

module.exports = { URL_PRODUIT, cleEnsemble, construireMessage, etatSuivant };
