import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface SupabaseCorrelation {
  id: string;
  alert_id: string;
  alert_title: string;
  alert_title_en?: string;
  alert_severity: string;
  country: string;
  region: string;
  type: string;
  strength: string;
  description: string;
  description_en?: string;
  related_countries: string[];
  detected_at: string;
  confidence: number;
  localities: string[] | null;
  created_at: string;
}

export function useSupabaseCorrelations() {
  const [correlations, setCorrelations] = useState<SupabaseCorrelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCorrelations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('correlations')
        .select('*')
        .order('detected_at', { ascending: false });

      if (fetchError) throw fetchError;

      setCorrelations((data || []) as SupabaseCorrelation[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCorrelations();

    const channel = supabase
      .channel('correlations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'correlations' }, () => {
        fetchCorrelations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCorrelations]);

  return { correlations, loading, error, refetch: fetchCorrelations };
}