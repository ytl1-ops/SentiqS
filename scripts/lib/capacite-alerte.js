// Une source « capable d'alerter » : ce que le registre dit ET ce que la page
// en fait reellement.
//
// Le seuil de fiabilite (70, lu dans getLiveAlertEvents) est la condition
// visible. Il en existe une seconde, structurelle, qui ne se lit nulle part
// dans le registre : `sourceDateNonFiable` ecarte tout article issu d'une
// requete Google News de RECHERCHE (news.google.com/rss/search) — ces flux
// sont classes par pertinence, pas par date, et un article de six mois peut
// y ressortir comme neuf. `estRecentReel` les refuse donc, ALL ne les
// contient jamais, le cache publie non plus, et getLiveAlertEvents ne les
// voit pas.
//
// Mesure du 07/09/2026 sur la collecte n° 850 : 331 requetes de recherche au
// registre, dont 50 notees 70 ou plus (AIP 90, ACLED 95, Crisis Group 93,
// ISS 91, AIB 88, AMAP 85, MAP 82, TAP 81...), et ZERO article issu d'une
// requete Google News dans le cache publie — ni avant ni apres. Experience
// hors ligne sur la vraie page : le flux Google News de Punch, 8 articles
// lus, 0 retenu comme actualite. Les deux controles de registre comptaient
// pourtant ces 50 requetes comme des sources d'alerte : treize pays
// paraissaient couverts par une source qui ne peut rien signaler.
//
// Cette fonction est le seul endroit ou la regle est ecrite pour les
// scripts ; un test verifie qu'elle dit la meme chose que la page.
function estRequeteGoogleNews(source) {
  let hote = '', chemin = '';
  try { const u = new URL(String((source && source.rss) || '')); hote = u.hostname; chemin = u.pathname; }
  catch (_) { return false; }
  return hote === 'news.google.com' && /^\/rss\/search/.test(chemin);
}

function peutAlerter(source, seuil) {
  if (!source) return false;
  if ((Number(source.score) || 0) < seuil) return false;
  return !estRequeteGoogleNews(source);
}

module.exports = { estRequeteGoogleNews, peutAlerter };
