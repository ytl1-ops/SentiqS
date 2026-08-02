import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface SupabaseCountryRisk {
  id: number;
  country: string;
  code: string;
  region: string;
  risk: string;
  alerts_count: number;
  trend: string;
  departments_detail: Array<{
    name: string;
    risk: string;
    alerts: number;
    trend: string;
  }> | null;
  updated_at: string;
}

export function useSupabaseCountryRisks() {
  const [countries, setCountries] = useState<SupabaseCountryRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCountries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('country_risks')
        .select('*')
        .order('risk', { ascending: true })
        .order('alerts_count', { ascending: false });

      if (fetchError) throw fetchError;

      setCountries((data || []) as SupabaseCountryRisk[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCountries();

    const channel = supabase
      .channel('country-risks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'country_risks' }, () => {
        fetchCountries();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCountries]);

  return { countries, loading, error, refetch: fetchCountries };
}