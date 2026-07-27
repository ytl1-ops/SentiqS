// Port de lireCollectePartagee/publierCollectePartagee (web/SentiqS_Web.html
// ~L12701-12782) — meme logique de fusion (jamais d'ecrasement, dedup par
// id, purge des entrees >12h) pour que plusieurs collectes successives
// accumulent la couverture au lieu de se remplacer l'une l'autre.

import { supabase } from '@/lib/supabase';
import type { RealArticle } from './fetchRss';

const COLLECTE_PARTAGEE_ID = 'global';
const DOUZE_HEURES_MS = 12 * 60 * 60 * 1000;

export async function publierCollectePartagee(
  articles: RealArticle[],
): Promise<{ ok: true; nbArticles: number } | { ok: false; raison: string }> {
  if (!articles.length) return { ok: false, raison: 'Aucun article à publier' };

  const { data: existant, error: erreurLecture } = await supabase
    .from('collecte_partagee')
    .select('articles, updated_at')
    .eq('id', COLLECTE_PARTAGEE_ID)
    .maybeSingle();

  if (erreurLecture) return { ok: false, raison: erreurLecture.message };

  const parId = new Map<string, RealArticle>();
  const existantsRecents: RealArticle[] = (
    (existant?.articles as RealArticle[] | null) ?? []
  ).filter((a) => a?.pubDate && Date.now() - a.pubDate < DOUZE_HEURES_MS);
  existantsRecents.forEach((a) => parId.set(a.id, a));
  articles.forEach((a) => parId.set(a.id, a));
  const fusionnes = [...parId.values()];

  const { error } = await supabase.from('collecte_partagee').upsert({
    id: COLLECTE_PARTAGEE_ID,
    articles: fusionnes,
    updated_at: new Date().toISOString(),
  });

  if (error) return { ok: false, raison: error.message };
  return { ok: true, nbArticles: fusionnes.length };
}
