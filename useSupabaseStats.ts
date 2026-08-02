import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface VerifiedFeed {
  id: string;
  title: string;
  title_en?: string;
  source: string;
  source_url: string;
  timestamp: string;
  category: string;
  country: string;
  department?: string;
  locality?: string;
  verification_status: 'verified' | 'confirmed' | 'unverified' | 'rumor';
  hallucination_score: number;
  summary?: string;
  verified_at?: string;
  source_status?: 'active' | 'warning' | 'dead' | 'unchecked';
  last_link_check?: string;
  link_check_error?: string;
  translated_title?: string;
  translated_summary?: string;
  translation_lang?: string;
  translated_at?: string;
}

export function useVerifiedFeeds(limit?: number) {
  const [feeds, setFeeds] = useState<VerifiedFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeeds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('feeds')
        .select('*')
        .not('source_url', 'is', null)
        .order('timestamp', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Filter out hallucinated feeds (score > 0.4)
      const verified = (data || []).filter(
        (f: VerifiedFeed) => (f.hallucination_score ?? 0) <= 0.4
      );

      setFeeds(verified);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchFeeds();

    // Realtime subscription
    const channel = supabase
      .channel('feeds-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feeds' },
        () => {
          fetchFeeds();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFeeds]);

  return { feeds, loading, error, refetch: fetchFeeds };
}

export async function verifyFeedWithAgent(feedId: string): Promise<{
  verified: boolean;
  hallucination_score: number;
  flags: string[];
}> {
  try {
    const { data, error: fnError } = await supabase.functions.invoke('verify-feed', {
      body: { feedId },
    });

    if (fnError) throw fnError;

    return {
      verified: data.verified,
      hallucination_score: data.hallucination_score,
      flags: data.flags || [],
    };
  } catch {
    return {
      verified: false,
      hallucination_score: 1.0,
      flags: ['verification_failed'],
    };
  }
}