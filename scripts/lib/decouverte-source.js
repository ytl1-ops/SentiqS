// ============================================================
// SentiqS — Découverte du meilleur flux RSS pour une source candidate
//
// POURQUOI CE FICHIER EXISTE
//
// Né d'une liste de 20 sources panafricaines proposée par le propriétaire du
// produit pour enrichir la collecte, avec la demande explicite d'en tirer un
// outil réutilisable ("un agent... pour une utilisation max"), pas un
// traitement à usage unique.
//
// Vérification manuelle de ces 20 sources : 16 étaient déjà dans SRCS (voir
// web/SentiqS_Web.html), avec un flux natif RSS/RDF/Atom réel et à jour pour
// chacune (AllAfrica par pays, BBC Afrique, RFI Afrique, France 24, Jeune
// Afrique, The Africa Report, Africanews, ISS Africa, Africa Center, Crisis
// Group, ReliefWeb, UN OCHA, Union Africaine, CEDEAO). Ce constat -- la
// grande majorité des sources sérieuses publient déjà un flux, même quand
// ça ne saute pas aux yeux -- est le principe derrière cet outil : chercher
// SYSTÉMATIQUEMENT le flux natif avant d'envisager quoi que ce soit de plus
// lourd.
//
// CE QUE CET OUTIL NE FAIT PAS, ET POURQUOI
//
// Pas de scraping HTML générique. Un "agent" qui extrairait des titres
// d'articles depuis la mise en page d'un site, sans flux structuré, casse
// silencieusement à chaque refonte du site cible -- ce projet a déjà
// scripts/verifier-decouverte-flux.js pour détecter exactement ce genre de
// dérive sur des flux existants ; ajouter une deuxième source de fragilité
// (page scrapée dont la structure change sans préavis) irait à l'encontre
// de ce que ce contrôle protège. Et pour les résidus de la liste de 20 sans
// flux trouvé (Reuters/AP -- RSS public abandonné par les deux agences
// depuis plusieurs années, pas une lacune de cet outil ; Africa
// Intelligence -- contenu payant, un scraper contournerait un paywall) le
// scraping ne serait de toute façon pas la bonne réponse, indépendamment de
// sa fragilité.
//
// Si un site précis s'avère un jour assez précieux pour justifier un
// extracteur dédié à SA structure HTML (pas un scraper générique), ce sera
// un fichier séparé, mesuré et justifié au cas par cas -- pas ajouté ici.
//
// CE QUE CET OUTIL FAIT
//
// Pour une URL de page d'accueil donnée, dans l'ordre (le premier qui
// aboutit gagne) :
//   1. Autodiscovery (scripts/lib/decouverte-flux.js) : le site déclare
//      lui-même son flux dans le <head> -- la méthode la plus fiable,
//      c'est l'éditeur qui désigne son propre flux "officiel".
//   2. Chemins RSS conventionnels (/feed, /rss.xml, etc.) : beaucoup de
//      sites (WordPress, Blogger...) exposent un flux sans le déclarer
//      dans le head.
//   3. Sinon : signalé comme candidat SANS flux, jamais comme une erreur --
//      voir fetchRespectueux, dont c'est déjà la philosophie : une source
//      qui échoue est un résultat normal à agréger, jamais une exception.
//
// Aucune fonction ici ne lève d'exception nn-capturée : un site injoignable,
// un chemin RSS absent (404), un timeout, une redirection cassée -- tout
// remonte comme un résultat structuré (`trouve:false`), jamais comme un
// crash qui interromprait le traitement du reste d'un lot de sources.
// ============================================================

const { fetchRespectueux } = require('./fetch-respectueux');
const { decouvrirFlux } = require('./decouverte-flux');

// Chemins RSS conventionnels les plus répandus, dans un ordre qui privilégie
// les plus courants (WordPress domine le web éditorial) pour limiter le
// nombre moyen de requêtes par source testée.
const CHEMINS_CONNUS = [
  '/feed/',
  '/feed',
  '/rss.xml',
  '/rss/',
  '/rss',
  '/atom.xml',
  '/index.xml',
  '/feed.xml',
  '/feeds/posts/default', // Blogger
];

// ressembleAUnFlux(texte) : heuristique minimale, jamais un vrai parseur XML
// -- il ne s'agit que d'écarter une page HTML 200 OK renvoyée par erreur à
// la place d'un flux (comportement fréquent : certains sites redirigent un
// chemin RSS inconnu vers leur page d'accueil au lieu de répondre 404).
function ressembleAUnFlux(texte) {
  if (!texte) return false;
  const debut = texte.slice(0, 1000).toLowerCase();
  return /<rss[\s>]/.test(debut) || /<feed[\s>]/.test(debut) || /<rdf:rdf[\s>]/.test(debut);
}

// essayerCheminsConnus(urlPage) : {url, methode} du premier chemin
// conventionnel qui répond avec un contenu qui ressemble à un flux, ou null.
// S'arrête au premier succès -- inutile de tester les huit chemins si le
// deuxième fonctionne déjà.
async function essayerCheminsConnus(urlPage) {
  let origine;
  try {
    origine = new URL(urlPage).origin;
  } catch (_) {
    return null;
  }
  for (const chemin of CHEMINS_CONNUS) {
    const url = origine + chemin;
    const reponse = await fetchRespectueux(url);
    if (reponse.ok && ressembleAUnFlux(reponse.texte)) {
      return { url, methode: 'chemin conventionnel (' + chemin + ')' };
    }
  }
  return null;
}

// decouvrirMeilleurFlux(urlPage) : point d'entrée principal.
//   trouvé  : { trouve: true, url, methode, alternatives: string[] }
//   échec   : { trouve: false, essais: string[] } -- essais = journal lisible
//             de ce qui a été tenté, pour un rapport humain, jamais une
//             raison d'interrompre le traitement d'un lot.
async function decouvrirMeilleurFlux(urlPage) {
  const essais = [];

  const page = await fetchRespectueux(urlPage);
  if (page.ok) {
    const flux = decouvrirFlux(page.texte, urlPage);
    if (flux.length) {
      return {
        trouve: true,
        url: flux[0].href,
        methode: 'autodiscovery (declare par la page)',
        alternatives: flux.slice(1).map((f) => f.href),
      };
    }
    essais.push("autodiscovery : aucun <link alternate> de type flux dans le <head>");
  } else {
    essais.push("page d'accueil injoignable : " + page.raison);
  }

  const parChemin = await essayerCheminsConnus(urlPage);
  if (parChemin) {
    return { trouve: true, url: parChemin.url, methode: parChemin.methode, alternatives: [] };
  }
  essais.push('aucun chemin RSS conventionnel valide (' + CHEMINS_CONNUS.join(', ') + ')');

  return { trouve: false, essais };
}

module.exports = { decouvrirMeilleurFlux, essayerCheminsConnus, ressembleAUnFlux, CHEMINS_CONNUS };
