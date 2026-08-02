import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface PostureHistoryEntry {
  id: number;
  country_code: string;
  country_name: string;
  old_level: string;
  new_level: string;
  old_score: number;
  new_score: number;
  reason: string | null;
  event_type: 'auto' | 'manual';
  analyst_initials: string | null;
  created_at: string;
}

export interface CountryPostureState {
  id: number;
  country_code: string;
  country_name: string;
  level: string;
  score: number;
  updated_at: string;
}

export function usePostureHistory(limit = 20) {
  const [entries, setEntries] = useState<PostureHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: supaError } = await supabase
        .from('posture_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (supaError) throw supaError;

      setEntries((data || []) as PostureHistoryEntry[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchEntries();

    const channel = supabase
      .channel('posture-history-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posture_history' },
        () => {
          fetchEntries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEntries]);

  return { entries, loading, error, refetch: fetchEntries };
}

export function usePostureState() {
  const [states, setStates] = useState<CountryPostureState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: supaError } = await supabase
        .from('country_posture_state')
        .select('*')
        .order('score', { ascending: false });

      if (supaError) throw supaError;

      setStates((data || []) as CountryPostureState[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStates();
  }, [fetchStates]);

  return { states, loading, error, refetch: fetchStates };
}

export async function syncPostureChanges(
  levels: Array<{ country_code: string; country_name: string; level: string; score: number }>
): Promise<{ success: boolean; changes: number; message: string }> {
  try {
    const response = await supabase.functions.invoke('sync-posture-changes', {
      body: { levels },
    });

    if (response.error) {
      console.error('sync-posture-changes error:', response.error);
      return { success: false, changes: 0, message: response.error.message || 'Erreur de synchronisation' };
    }

    return response.data as { success: boolean; changes: number; message: string };
  } catch (err) {
    console.error('sync-posture-changes exception:', err);
    return { success: false, changes: 0, message: (err as Error).message };
  }
}

export function useAllPostureHistory() {
  const [entries, setEntries] = useState<PostureHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: supaError } = await supabase
        .from('posture_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (supaError) throw supaError;

      setEntries((data || []) as PostureHistoryEntry[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel('posture-history-all-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posture_history' },
        () => {
          fetchAll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  return { entries, loading, error, refetch: fetchAll };
}