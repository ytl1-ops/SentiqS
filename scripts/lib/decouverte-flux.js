// ============================================================
// SentiqS — Découverte de flux RSS/Atom par autodiscovery
//
// POURQUOI CE FICHIER EXISTE
//
// Technique standard depuis les débuts du format RSS : une page HTML bien
// formée déclare son propre flux dans son <head> via
// <link rel="alternate" type="application/rss+xml|atom+xml|rdf+xml"
// href="...">. Ça permet de vérifier, pour une source de SRCS (voir
// web/SentiqS_Web.html), si le flux configuré (champ `rss:`) correspond
// toujours à ce que le site annonce lui-même aujourd'hui — voir
// scripts/verifier-decouverte-flux.js pour l'usage réel.
//
// Écrit ici plutôt qu'importé d'un paquet existant : les deux
// implémentations Node les plus connues du même principe se sont révélées
// inutilisables en pratique — hughrun/feedfinder l'annonce dans son propre
// README ("NO LONGER MAINTAINED AND HAS DEPRECATED DEPENDENCIES"),
// danmactough/node-rssdiscovery n'a plus été touché depuis sa release
// v0.0.1 de 2014. Ajouter une dépendance non maintenue pour ~40 lignes de
// regex, dans un produit de sûreté, n'a pas de sens — et va à l'encontre
// de scripts/lib/ existant, deja zero-dependance (voir fetch-respectueux.js,
// sante-collecte.js).
//
// Pas de parsing DOM complet (pas de dépendance jsdom/cheerio) : une regex
// bornée au <head> suffit, la balise doit s'y trouver par convention.
// ============================================================

const TYPES_FLUX = [
  'application/rss+xml',
  'application/atom+xml',
  'application/rdf+xml',
];

// extraireHead(html) : le contenu du <head>, ou les 20000 premiers
// caractères du document si aucune balise de fermeture n'est trouvée
// (best-effort — un <head> mal formé ou absent ne doit jamais faire
// planter la découverte, juste réduire ses chances de trouver quelque
// chose).
function extraireHead(html) {
  const m = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html || '');
  return m ? m[1] : (html || '').slice(0, 20000);
}

// decouvrirFlux(html, urlPage) : tableau de {href, type, titre} pour
// chaque <link rel="alternate"> de type flux trouvé dans le <head>, href
// résolu en URL absolue par rapport à urlPage (gère aussi bien un href
// relatif qu'absolu). Ordre de déclaration préservé dans la page — le
// premier est conventionnellement le flux principal du site, mais rien ne
// le garantit : à l'appelant de décider quoi faire de plusieurs résultats.
// Ne jette jamais : HTML absent, vide, ou malformé renvoie simplement un
// tableau vide.
function decouvrirFlux(html, urlPage) {
  const head = extraireHead(html);
  const resultats = [];
  const reLien = /<link\b([^>]*)>/gi;
  let m;
  while ((m = reLien.exec(head))) {
    const attrs = m[1];
    if (!/\brel\s*=\s*["']alternate["']/i.test(attrs)) continue;
    const typeM = /\btype\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const type = typeM ? typeM[1].toLowerCase().trim() : '';
    if (!TYPES_FLUX.includes(type)) continue;
    const hrefM = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!hrefM) continue;
    let href;
    try { href = new URL(hrefM[1], urlPage).href; } catch (_) { continue; }
    const titreM = /\btitle\s*=\s*["']([^"']+)["']/i.exec(attrs);
    resultats.push({ href, type, titre: titreM ? titreM[1] : null });
  }
  return resultats;
}

module.exports = { decouvrirFlux, extraireHead, TYPES_FLUX };
