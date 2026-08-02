import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface LinkCheckResult {
  feed_id: string;
  status: 'active' | 'warning' | 'dead' | 'unchecked';
  status_code: number | null;
  error: string | null;
}

export interface LinkCheckSummary {
  total: number;
  active: number;
  warning: number;
  dead: number;
  checked_at: string;
  results: LinkCheckResult[];
}

export interface FeedLinkStatus {
  id: string;
  title: string;
  source_url: string;
  source: string;
  source_status: 'active' | 'warning' | 'dead' | 'unchecked';
  last_link_check: string | null;
  link_check_error: string | null;
  verification_status: string;
  category: string;
  country: string;
  nb_articles_last_check: number | null;
  rss_validated: boolean | null;
}

export interface ScanSchedule {
  enabled: boolean;
  interval_hours: number;
  last_run: string | null;
  next_run: string | null;
  is_due: boolean;
}

export function useLinkStatus() {
  const [deadLinks, setDeadLinks] = useState<FeedLinkStatus[]>([]);
  const [warningLinks, setWarningLinks] = useState<FeedLinkStatus[]>([]);
  const [uncheckedLinks, setUncheckedLinks] = useState<FeedLinkStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [counts, setCounts] = useState({ active: 0, warning: 0, dead: 0, unchecked: 0, rss_validated: 0, total_articles: 0 });
  const [scanSummary, setScanSummary] = useState<LinkCheckSummary | null>(null);

  // Schedule state
  const [schedule, setSchedule] = useState<ScanSchedule>({
    enabled: false,
    interval_hours: 6,
    last_run: null,
    next_run: null,
    is_due: false,
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const autoTriggered = useRef(false);

  const fetchStatuses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('feeds')
        .select('id, title, source_url, source, source_status, last_link_check, link_check_error, verification_status, category, country, nb_articles_last_check, rss_validated')
        .order('last_link_check', { ascending: false });

      if (dbError) throw new Error(dbError.message);

      const feeds = (data || []) as FeedLinkStatus[];
      setDeadLinks(feeds.filter((f) => f.source_status === 'dead'));
      setWarningLinks(feeds.filter((f) => f.source_status === 'warning'));
      setUncheckedLinks(feeds.filter((f) => !f.source_status || f.source_status === 'unchecked'));

      const c = { active: 0, warning: 0, dead: 0, unchecked: 0, rss_validated: 0, total_articles: 0 };
      feeds.forEach((f) => {
        const status = f.source_status || 'unchecked';
        c[status as keyof typeof c] = ((c[status as keyof typeof c] as number) || 0) + 1;
        if (f.rss_validated) c.rss_validated++;
        if (f.nb_articles_last_check) c.total_articles += f.nb_articles_last_check;
      });
      setCounts(c);

      const mostRecent = feeds
        .filter((f) => f.last_link_check)
        .sort((a, b) => new Date(b.last_link_check!).getTime() - new Date(a.last_link_check!).getTime())[0];
      setLastScan(mostRecent?.last_link_check || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('scan_schedule')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (dbError) throw dbError;

      if (data) {
        const now = new Date();
        const nextRun = data.next_run ? new Date(data.next_run) : null;
        setSchedule({
          enabled: data.enabled ?? false,
          interval_hours: data.interval_hours ?? 6,
          last_run: data.last_run ?? null,
          next_run: data.next_run ?? null,
          is_due: !nextRun || now >= nextRun,
        });
      }
    } catch {
      // Silently fail — schedule is a bonus feature
    }
  }, []);

  const toggleSchedule = useCallback(async (enabled: boolean) => {
    setScheduleLoading(true);
    try {
      const now = new Date();
      const { data: current } = await supabase
        .from('scan_schedule')
        .select('interval_hours')
        .eq('id', 1)
        .maybeSingle();

      const intervalHours = current?.interval_hours ?? 6;
      const nextRun = enabled ? new Date(now.getTime() + 3600 * 1000) : null; // first auto-scan in 1h

      await supabase
        .from('scan_schedule')
        .upsert({
          id: 1,
          enabled,
          interval_hours: intervalHours,
          next_run: nextRun?.toISOString() ?? null,
          updated_at: now.toISOString(),
        });

      setSchedule((prev) => ({
        ...prev,
        enabled,
        next_run: nextRun?.toISOString() ?? null,
        is_due: false,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  const setScheduleInterval = useCallback(async (hours: number) => {
    setScheduleLoading(true);
    try {
      const { data: current } = await supabase
        .from('scan_schedule')
        .select('enabled, last_run')
        .eq('id', 1)
        .maybeSingle();

      const now = new Date();
      const lastRun = current?.last_run ? new Date(current.last_run) : null;
      const nextRun = lastRun
        ? new Date(lastRun.getTime() + hours * 3600 * 1000)
        : new Date(now.getTime() + 3600 * 1000);

      await supabase
        .from('scan_schedule')
        .upsert({
          id: 1,
          enabled: current?.enabled ?? false,
          interval_hours: hours,
          next_run: nextRun.toISOString(),
          updated_at: now.toISOString(),
        });

      setSchedule((prev) => ({
        ...prev,
        interval_hours: hours,
        next_run: nextRun.toISOString(),
        is_due: now >= nextRun,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  const runScan = useCallback(async (silent = false) => {
    if (!silent) {
      setScanning(true);
      setError(null);
      setScanSummary(null);
    }
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('check-links', {
        body: {},
      });

      if (invokeError) throw new Error(invokeError.message || 'Link check failed');
      if (!result || !result.success) {
        throw new Error((result && result.error) || 'Link check failed');
      }

      if (!silent) {
        setScanSummary(result.summary || null);
      }
      await fetchStatuses();
      await fetchSchedule();
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!silent) setError(msg);
      return null;
    } finally {
      if (!silent) setScanning(false);
    }
  }, [fetchStatuses, fetchSchedule]);

  const checkAndRunScheduled = useCallback(async () => {
    if (autoTriggered.current) return;
    autoTriggered.current = true;

    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('scheduled-scan', {
        body: {},
      });

      if (invokeError) return;

      if (result && result.schedule) {
        setSchedule({
          enabled: result.schedule.enabled ?? false,
          interval_hours: result.schedule.interval_hours ?? 6,
          last_run: result.schedule.last_run ?? null,
          next_run: result.schedule.next_run ?? null,
          is_due: result.schedule.is_due ?? false,
        });
      }

      if (result && result.scan_performed) {
        // Auto-scan just ran — refresh feed statuses silently
        await fetchStatuses();
      }
    } catch {
      // Silently fail on auto-check
    }
  }, [fetchStatuses]);

  // Initial load
  useEffect(() => {
    fetchStatuses();
    fetchSchedule();
  }, [fetchStatuses, fetchSchedule]);

  // Auto-trigger check on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      checkAndRunScheduled();
    }, 2000);
    return () => clearTimeout(timer);
  }, [checkAndRunScheduled]);

  return {
    deadLinks,
    warningLinks,
    uncheckedLinks,
    loading,
    scanning,
    error,
    lastScan,
    counts,
    scanSummary,
    schedule,
    scheduleLoading,
    fetchStatuses,
    runScan,
    toggleSchedule,
    setScheduleInterval,
    fetchSchedule,
  };
}