import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface TranslationResult {
  feedId: string;
  translated: boolean;
  translation_lang: string;
  translated_title: string;
  translated_summary: string;
}

export function useFeedTranslation() {
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  const translateFeed = useCallback(async (feedId: string, targetLang: string = 'fr', force: boolean = false): Promise<TranslationResult | null> => {
    setTranslatingIds((prev) => new Set(prev).add(feedId));
    setBatchError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('translate-feed', {
        body: { feedId, targetLang, force },
      });

      if (fnError) throw fnError;
      return data as TranslationResult;
    } catch (err) {
      setBatchError((err as Error).message);
      return null;
    } finally {
      setTranslatingIds((prev) => {
        const next = new Set(prev);
        next.delete(feedId);
        return next;
      });
    }
  }, []);

  const translateFeedsBatch = useCallback(async (
    feedIds: string[],
    targetLang: string = 'fr',
    force: boolean = false,
    onProgress?: (done: number, total: number) => void,
  ): Promise<TranslationResult[]> => {
    setBatchProgress({ done: 0, total: feedIds.length });
    setBatchError(null);

    const results: TranslationResult[] = [];

    // Process in batches of 3 to avoid rate limiting
    const batchSize = 3;
    for (let i = 0; i < feedIds.length; i += batchSize) {
      const batch = feedIds.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (feedId) => {
          setTranslatingIds((prev) => new Set(prev).add(feedId));
          try {
            const { data, error: fnError } = await supabase.functions.invoke('translate-feed', {
              body: { feedId, targetLang, force },
            });
            if (fnError) throw fnError;
            return data as TranslationResult;
          } finally {
            setTranslatingIds((prev) => {
              const next = new Set(prev);
              next.delete(feedId);
              return next;
            });
          }
        })
      );

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });

      const done = Math.min(i + batchSize, feedIds.length);
      setBatchProgress({ done, total: feedIds.length });
      onProgress?.(done, feedIds.length);
    }

    return results;
  }, []);

  const isTranslating = useCallback((feedId: string) => translatingIds.has(feedId), [translatingIds]);

  return {
    translateFeed,
    translateFeedsBatch,
    isTranslating,
    translatingCount: translatingIds.size,
    batchProgress,
    batchError,
  };
}