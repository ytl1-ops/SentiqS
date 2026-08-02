import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface SupabaseAlert {
  id: string;
  severity: string;
  title: string;
  title_en?: string;
  country: string;
  region: string;
  department: string;
  locality: string;
  timestamp: string;
  source: string;
  category: string;
  status: string;
  impact: string;
  verification_status: string;
  created_at: string;
}

export function useSupabaseAlerts(options?: {
  limit?: number;
  severity?: string;
  status?: string;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}) {
  const [alerts, setAlerts] = useState<SupabaseAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('alerts')
        .select('*')
        .order(options?.orderBy || 'timestamp', { ascending: options?.orderDir === 'asc' });

      if (options?.severity) {
        query = query.eq('severity', options.severity);
      }
      if (options?.status) {
        query = query.eq('status', options.status);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      setAlerts((data || []) as SupabaseAlert[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [options?.limit, options?.severity, options?.status, options?.orderBy, options?.orderDir]);

  useEffect(() => {
    fetchAlerts();

    const channel = supabase
      .channel('alerts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        fetchAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAlerts]);

  return { alerts, loading, error, refetch: fetchAlerts };
}

export function useSupabaseCriticalAlerts() {
  const [criticalAlerts, setCriticalAlerts] = useState<SupabaseAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCritical = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('alerts')
        .select('*')
        .eq('severity', 'critical')
        .eq('status', 'active')
        .in('verification_status', ['verified', 'confirmed'])
        .order('timestamp', { ascending: false });

      if (fetchError) throw fetchError;

      setCriticalAlerts((data || []) as SupabaseAlert[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCritical();

    const channel = supabase
      .channel('critical-alerts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts', filter: 'severity=eq.critical' }, () => {
        fetchCritical();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCritical]);

  return { criticalAlerts, loading, error, refetch: fetchCritical };
}