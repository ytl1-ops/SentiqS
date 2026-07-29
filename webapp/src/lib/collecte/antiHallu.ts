// Port de antiHalluFilter (web/SentiqS_Web.html ~L7014) — n'affiche jamais
// un article sans date de publication reelle, ni trop ancien.
//
// Simplification assumee (disclosed) : saute estimeEvenementAncien()
// (inference de la date de SURVENANCE reelle depuis des indices textuels
// — "hier", "il y a N jours", noms de jour...) : un raffinement qui
// rattrape les flux qui re-datent du vieux contenu comme "aujourd'hui",
// pas la garantie de base (pubDate present, recent, source identifiee,
// titre non vide) conservee ici a l'identique.

import type { RealArticle } from './fetchRss';

const DOUZE_HEURES_MS = 12 * 60 * 60 * 1000;

export function antiHalluFilter(arts: RealArticle[], maxAgeMs = DOUZE_HEURES_MS): RealArticle[] {
  const now = Date.now();
  return arts.filter(
    (a) => a.pubDate && now - a.pubDate < maxAgeMs && !!a.primary && !!a.title && a.title.length >= 8,
  );
}
