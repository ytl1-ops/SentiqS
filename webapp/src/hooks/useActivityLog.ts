import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ActivityLogEntry {
  id: number;
  type: 'auto_change' | 'manual_note' | 'alert_triggered' | 'stale_data';
  message: string;
  details: Record<string, unknown>;
  country_code: string | null;
  analyst_initials: string | null;
  created_at: string;
}

export function useActivityLog(limit = 50) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: supaError } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (supaError) throw supaError;

      setEntries((data || []) as ActivityLogEntry[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchEntries();

    const channel = supabase
      .channel('activity-log-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_log' },
        () => {
          fetchEntries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEntries]);

  const addEntry = useCallback(
    async (entry: Omit<ActivityLogEntry, 'id' | 'created_at'>) => {
      const { data, error: supaError } = await supabase
        .from('activity_log')
        .insert({
          type: entry.type,
          message: entry.message,
          details: entry.details,
          country_code: entry.country_code,
          analyst_initials: entry.analyst_initials,
        })
        .select()
        .single();

      if (supaError) throw supaError;
      return data as ActivityLogEntry;
    },
    []
  );

  return { entries, loading, error, refetch: fetchEntries, addEntry };
}