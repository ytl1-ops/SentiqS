import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface AgendaEvent {
  id: string;
  title: string;
  title_en?: string;
  date: string;
  time: string;
  type: string;
  priority: string;
  country: string;
  location: string;
  duration: string;
  organizer: string;
  participants: string;
  description: string;
  description_en?: string;
  created_at: string;
  updated_at: string;
}

export function useAgendaEvents() {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('agenda_events')
        .select('*')
        .order('date', { ascending: true });

      if (fetchError) throw fetchError;

      setEvents((data || []) as AgendaEvent[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel('agenda-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_events' }, () => {
        fetchEvents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
}