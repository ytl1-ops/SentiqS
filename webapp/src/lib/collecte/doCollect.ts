// Port simplifie de doCollect (web/SentiqS_Web.html ~L7848) : parcourt les
// 495 sources reelles par lots (traitement parallele au sein d'un lot,
// lots successifs), classe chaque article via le meme moteur (classify),
// filtre via antiHalluFilter, puis publie sur collecte_partagee (fusion,
// pas d'ecrasement).
//
// Simplifications assumees (disclosed) : pas de suivi de sante par source
// (skip des sources en echec repete), pas de taille de lot adaptative
// selon la fiabilite du proxy courant, pas de second passage cible sur les
// pays non couverts par ce cycle. Le comportement de fond (mêmes sources,
// même moteur de classification, même politique anti-hallucination, même
// fusion cote base) reste fidele.

import { SOURCES, type Source } from './sources';
import { proxyFetch, parseJSON, parseRSS, type RealArticle } from './fetchRss';
import { antiHalluFilter } from './antiHallu';
import { publierCollectePartagee } from './publish';

const BATCH_SIZE = 30;

export interface CollecteProgress {
  traitees: number;
  total: number;
  ok: number;
  erreurs: number;
  articlesTrouves: number;
}

async function collectOne(src: Source): Promise<RealArticle[]> {
  const result = await proxyFetch(src.rss);
  if (result.type === 'json') return parseJSON(result.data as { items?: Array<Record<string, string>> }, src);
  return parseRSS(result.data, src);
}

export async function doCollect(onProgress?: (p: CollecteProgress) => void): Promise<{
  articlesReels: RealArticle[];
  progress: CollecteProgress;
  publication: { ok: true; nbArticles: number } | { ok: false; raison: string };
}> {
  const progress: CollecteProgress = { traitees: 0, total: SOURCES.length, ok: 0, erreurs: 0, articlesTrouves: 0 };
  const brut: RealArticle[] = [];

  for (let i = 0; i < SOURCES.length; i += BATCH_SIZE) {
    const lot = SOURCES.slice(i, i + BATCH_SIZE);
    const resultats = await Promise.allSettled(lot.map((src) => collectOne(src)));
    for (const r of resultats) {
      progress.traitees++;
      if (r.status === 'fulfilled') {
        progress.ok++;
        progress.articlesTrouves += r.value.length;
        brut.push(...r.value);
      } else {
        progress.erreurs++;
      }
    }
    onProgress?.({ ...progress });
  }

  // Dedup par id (une meme actualite peut apparaitre via plusieurs
  // sources/pages) — le plus recent traite l'emporte, meme principe que
  // publierCollectePartagee cote fusion.
  const parId = new Map<string, RealArticle>();
  brut.forEach((a) => parId.set(a.id, a));
  const articlesReels = antiHalluFilter([...parId.values()]);

  const publication = await publierCollectePartagee(articlesReels);

  return { articlesReels, progress, publication };
}
