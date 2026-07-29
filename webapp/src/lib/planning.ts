// Accès aux tables public.agenda_events et public.reports.
//
// Contrairement au tableau de bord, ces deux vues ne se dérivent de rien :
// un événement d'agenda ou un rapport est saisi par la cellule, pas déduit
// de la collecte. Ces hooks lisent donc directement les tables créées par
// supabase/migrations/20260729_agenda_reports_schema.sql.
//
// Les colonnes sont en snake_case côté base et exposées en camelCase ici,
// pour coller aux noms de champs déjà utilisés par les pages.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface AgendaEvent {
  id: string;
  date: string;
  title: string;
  type: string;
  priority: string;
  time: string;
  duration: string;
  location: string;
  country: string;
  organizer: string;
  participants: number;
  description: string;
}

export interface Rapport {
  id: string;
  title: string;
  type: string;
  format: string;
  region: string;
  countries: string[];
  alertCount: number;
  corrCount: number;
  status: string;
  size: string;
  author: string;
  summary: string;
  filePath: string | null;
  generatedAt: string | null;
}

interface EtatListe<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  recharger: () => void;
}

function useListe<T>(charger: () => Promise<T[]>): EtatListe<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const executer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await charger());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
      setData([]);
    } finally {
      setLoading(false);
    }
    // `charger` est recréé à chaque rendu par les appelants ci-dessous ; le
    // stabiliser n'apporterait rien, ces deux hooks ne chargent qu'au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    executer();
  }, [executer]);

  return { data, loading, error, recharger: executer };
}

export function useAgenda(): EtatListe<AgendaEvent> {
  return useListe(async () => {
    const { data, error } = await supabase
      .from('agenda_events')
      .select('*')
      .order('date', { ascending: true });
    if (error) throw new Error(error.message);

    return (data ?? []).map((e): AgendaEvent => ({
      id: String(e.id),
      date: e.date,
      title: e.title,
      type: e.type,
      priority: e.priority,
      time: e.time ?? '',
      duration: e.duration ?? '',
      location: e.location ?? '',
      country: e.country ?? '',
      organizer: e.organizer ?? '',
      participants: e.participants ?? 0,
      description: e.description ?? '',
    }));
  });
}

export function useRapports(): EtatListe<Rapport> {
  return useListe(async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('generated_at', { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);

    return (data ?? []).map((r): Rapport => ({
      id: String(r.id),
      title: r.title,
      type: r.type,
      format: r.format,
      region: r.region ?? '—',
      countries: Array.isArray(r.countries) ? r.countries : [],
      alertCount: r.alert_count ?? 0,
      corrCount: r.corr_count ?? 0,
      status: r.status,
      size: r.size ?? '—',
      author: r.author ?? '—',
      summary: r.summary ?? '',
      filePath: r.file_path ?? null,
      generatedAt: r.generated_at ?? null,
    }));
  });
}
