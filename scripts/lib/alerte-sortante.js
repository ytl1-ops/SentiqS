// ============================================================
// SentiqS — sortie d'alerte vers un canal externe.
//
// POURQUOI CE FICHIER EXISTE
//
// Le produit détectait, affichait, et s'arrêtait là. Un professionnel de la
// sûreté ne regarde pas un écran en continu : il veut être joint. L'audit
// sur cinquante axes a noté cette sortie à zéro — aucun webhook, aucune
// notification hors navigateur — et c'était l'écart le plus large de la
// grille pour l'un des coûts les plus faibles.
//
// TROIS CHOIX QUI EXPLIQUENT LA FORME DU CODE
//
// 1. L'envoi part du JOB, pas du navigateur. Une notification côté client ne
//    part que si quelqu'un a l'onglet ouvert — c'est-à-dire précisément pas
//    la nuit, pas le week-end, pas quand elle sert. Et Slack comme Teams
//    refusent l'appel depuis un navigateur (CORS).
//
// 2. On n'annonce QUE les changements de niveau, jamais l'état. Envoyer la
//    situation à chaque cycle, cinq à quinze fois par jour, produirait un
//    canal que plus personne ne lit au bout d'une semaine — et une alerte
//    qu'on ne lit plus est pire qu'une alerte absente.
//
// 3. La référence est un état persisté à côté de l'archive
//    (web/historique/dernier-signale.json), pas la mémoire du processus :
//    le job repart de zéro à chaque run, et un dédoublonnage en mémoire
//    aurait tout réenvoyé quinze fois par jour.
//
//    Cet état retient le dernier niveau ANNONCÉ, pas le dernier niveau
//    observé. La nuance compte : un pays qui redescend puis remonte doit
//    être annoncé une seconde fois — c'est un événement, pas un doublon.
//
// La charge utile est volontairement le plus petit dénominateur commun,
// { "text": "..." } — accepté tel quel par Slack, par Teams et par la
// plupart des relais e-mail. Rien à configurer côté SentiqS que l'URL.
// ============================================================

const { NIVEAUX_ORDRE } = require('../../web/js/noyau.js');

const URL_PRODUIT = 'https://ytl1-ops.github.io/SentiqS/SentiqS_Web.html';

/** L'état { code: niveau } déduit d'un instantané d'archive. */
function etatDepuis(instantane) {
  const etat = {};
  for (const p of (instantane && instantane.pays) || []) etat[p.code] = p.niveau;
  return etat;
}

/**
 * Les pays dont le niveau a bougé depuis le dernier état annoncé.
 *
 * `montees` : ce qui déclenche un envoi. `descentes` : compté, jamais
 * détaillé — une amélioration n'a pas à réveiller quelqu'un.
 *
 * Un pays absent de l'état précédent n'est PAS un changement : c'est un pays
 * nouvellement suivi, et l'annoncer comme une aggravation serait faux dès le
 * premier jour d'une extension de couverture. Au tout premier run, l'état
 * est vide et RIEN ne part — c'est voulu : personne ne veut recevoir les 54
 * pays d'un coup pour inaugurer son canal.
 */
function changements(etatPrecedent, courant) {
  const avant = new Map(Object.entries(etatPrecedent || {}));
  const montees = [];
  let descentes = 0;

  for (const p of (courant && courant.pays) || []) {
    if (!avant.has(p.code)) continue;
    const de = avant.get(p.code);
    const rangDe = NIVEAUX_ORDRE.indexOf(de);
    const rangVers = NIVEAUX_ORDRE.indexOf(p.niveau);
    if (rangDe < 0 || rangVers < 0 || rangDe === rangVers) continue;
    if (rangVers > rangDe) montees.push({ code: p.code, de, vers: p.niveau, crans: rangVers - rangDe });
    else descentes++;
  }

  // Le plus grave d'abord : c'est l'ordre dans lequel on veut lire un canal
  // d'alerte, pas l'ordre alphabétique.
  montees.sort((a, b) => (NIVEAUX_ORDRE.indexOf(b.vers) - NIVEAUX_ORDRE.indexOf(a.vers))
    || (b.crans - a.crans) || a.code.localeCompare(b.code));
  return { montees, descentes };
}

/**
 * Le message, ou null s'il n'y a rien à dire.
 *
 * Retourner null plutôt qu'un message « rien à signaler » est délibéré :
 * c'est ce qui garde le canal lisible.
 */
function construireMessage({ montees, descentes }, { jour, noms, url } = {}) {
  if (!montees || !montees.length) return null;

  const nom = (c) => (noms && noms[c]) || c;
  const lignes = montees.map((m) => '• ' + nom(m.code) + ' : ' + m.de + ' → ' + m.vers
    + ' (' + (m.crans > 0 ? '+' : '') + m.crans + ')');

  const entete = 'SentiqS — ' + montees.length + ' pays en aggravation'
    + (jour ? ' (' + jour + ')' : '');
  const pied = descentes
    ? descentes + ' pays en amélioration, non détaillés.'
    : null;

  return {
    text: [entete, '', ...lignes, '', pied, 'Détail : ' + (url || URL_PRODUIT)]
      .filter((l) => l !== null).join('\n'),
  };
}

/**
 * Poste la charge utile. `poster` est injectable pour que les tests
 * n'atteignent jamais le réseau.
 *
 * Ne lève jamais : une sortie d'alerte en échec ne doit pas faire tomber une
 * collecte qui, elle, a réussi — la collecte est le service, l'alerte est le
 * confort.
 */
async function envoyer(url, charge, poster) {
  if (!url) return { ok: false, raison: 'aucune URL configurée' };
  const p = poster || ((u, o) => fetch(u, o));
  try {
    const r = await p(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(charge),
    });
    if (r && r.ok) return { ok: true, statut: r.status };
    return { ok: false, raison: 'HTTP ' + ((r && r.status) || '?'), statut: r && r.status };
  } catch (e) {
    return { ok: false, raison: (e && e.message) || String(e) };
  }
}

/**
 * L'état à persister après un run : le dernier niveau annoncé pour chaque
 * pays. Les descentes y sont enregistrées elles aussi, sans être annoncées,
 * pour qu'une remontée ultérieure le soit.
 */
function etatSuivant(etatPrecedent, courant) {
  const suivant = Object.assign({}, etatPrecedent || {});
  for (const p of (courant && courant.pays) || []) {
    if (NIVEAUX_ORDRE.indexOf(p.niveau) >= 0) suivant[p.code] = p.niveau;
  }
  return suivant;
}

module.exports = { URL_PRODUIT, etatDepuis, changements, etatSuivant, construireMessage, envoyer };
