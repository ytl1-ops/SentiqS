import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface DashboardStats {
  activeAlerts: number;
  newFeeds24h: number;
  countriesInAlert: number;
  localitiesMonitored: number;
  correlationsDetected: number;
  totalMonitored: number;
  responseTime: string;
}

interface ActivityDay {
  day: string;
  alerts: number;
  feeds: number;
}

interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  type: string;
  severity: string;
  locality?: string;
  department?: string;
}

interface LocalIntelSummary {
  totalLocalities: number;
  totalDepartments: number;
  localitiesMonitoredToday: number;
  departmentsWithActiveAlerts: number;
  topHotspots: Array<{
    name: string;
    alerts: number;
    trend: string;
    severity: string;
  }>;
  localCoverage: Record<string, {
    departments: number;
    localities: number;
    activeNow: number;
  }>;
}

export function useSupabaseStats() {
  const [stats, setStats] = useState<DashboardStats>({
    activeAlerts: 0,
    newFeeds24h: 0,
    countriesInAlert: 0,
    localitiesMonitored: 0,
    correlationsDetected: 0,
    totalMonitored: 54,
    responseTime: '--',
  });
  const [activityData, setActivityData] = useState<ActivityDay[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [localIntel, setLocalIntel] = useState<LocalIntelSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        { count: activeCount },
        { count: feeds24hCount },
        { data: countriesData },
        { data: localitiesData },
        { count: corrCount },
        { data: activityAlerts },
        { data: activityFeeds },
        { data: recentAlerts },
        { data: recentFeeds },
        { data: hotspotsData },
        { data: coverageData },
      ] = await Promise.all([
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('feeds').select('*', { count: 'exact', head: true }).gte('timestamp', new Date(Date.now() - 86400000).toISOString()),
        supabase.from('alerts').select('country').eq('status', 'active'),
        supabase.from('alerts').select('locality'),
        supabase.from('correlations').select('*', { count: 'exact', head: true }),
        supabase.from('alerts').select('timestamp').gte('timestamp', new Date(Date.now() - 7 * 86400000).toISOString()).order('timestamp', { ascending: true }),
        supabase.from('feeds').select('timestamp').gte('timestamp', new Date(Date.now() - 7 * 86400000).toISOString()).order('timestamp', { ascending: true }),
        supabase.from('alerts').select('id,title,severity,locality,department,timestamp').eq('status', 'active').order('timestamp', { ascending: false }).limit(12),
        supabase.from('feeds').select('id,title,source,timestamp,country,locality,department').order('timestamp', { ascending: false }).limit(12),
        // Top hotspots: localities with most alerts in last 7 days
        supabase.from('alerts').select('locality,department,country,severity').gte('timestamp', new Date(Date.now() - 7 * 86400000).toISOString()).eq('status', 'active'),
        // Coverage: all alerts for region breakdown
        supabase.from('alerts').select('region,department,locality,status'),
      ]);

      // Unique countries in alert
      const uniqueCountries = new Set((countriesData || []).map((a: { country: string }) => a.country));
      const uniqueLocalities = new Set((localitiesData || []).map((a: { locality: string }) => a.locality));

      // Hotspots computation
      const localityMap = new Map<string, { name: string; severity: string; alerts: number }>();
      (hotspotsData || []).forEach((a: { locality: string; department: string; country: string; severity: string }) => {
        const key = a.locality || 'Inconnu';
        if (!localityMap.has(key)) {
          localityMap.set(key, { name: `${key} (${a.department || ''}, ${a.country || ''})`, severity: a.severity, alerts: 0 });
        }
        const entry = localityMap.get(key)!;
        entry.alerts += 1;
        if (a.severity === 'critical' && entry.severity !== 'critical') entry.severity = 'critical';
        else if (a.severity === 'high' && entry.severity !== 'critical' && entry.severity !== 'high') entry.severity = 'high';
      });
      const topHotspots = Array.from(localityMap.values())
        .sort((a, b) => b.alerts - a.alerts)
        .slice(0, 10)
        .map((h, i) => ({ ...h, trend: i === 0 ? '+5' : h.alerts >= 5 ? '+3' : h.alerts >= 3 ? '+1' : '0' }));

      // Coverage by region
      const regionMap = new Map<string, { departments: Set<string>; localities: Set<string>; activeNow: number }>();
      (coverageData || []).forEach((a: { region: string; department: string; locality: string; status: string }) => {
        const regionKey = a.region || 'Autre';
        if (!regionMap.has(regionKey)) {
          regionMap.set(regionKey, { departments: new Set(), localities: new Set(), activeNow: 0 });
        }
        const entry = regionMap.get(regionKey)!;
        if (a.department) entry.departments.add(a.department);
        if (a.locality) entry.localities.add(a.locality);
        if (a.status === 'active') entry.activeNow += 1;
      });

      const regionCoverage: Record<string, { departments: number; localities: number; activeNow: number }> = {};
      regionMap.forEach((v, k) => {
        regionCoverage[k] = {
          departments: v.departments.size,
          localities: v.localities.size,
          activeNow: v.activeNow,
        };
      });

      // Activity data: group by day of week
      const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      const today = new Date();
      const alertByDay: Record<string, number> = {};
      const feedByDay: Record<string, number> = {};

      (activityAlerts || []).forEach((a: { timestamp: string }) => {
        const d = new Date(a.timestamp);
        const key = dayNames[d.getDay()];
        alertByDay[key] = (alertByDay[key] || 0) + 1;
      });
      (activityFeeds || []).forEach((f: { timestamp: string }) => {
        const d = new Date(f.timestamp);
        const key = dayNames[d.getDay()];
        feedByDay[key] = (feedByDay[key] || 0) + 1;
      });

      // Create activity for last 7 days
      const activity: ActivityDay[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = dayNames[d.getDay()];
        activity.push({
          day: key,
          alerts: alertByDay[key] || 0,
          feeds: feedByDay[key] || 0,
        });
      }
      setActivityData(activity);

      // Timeline: combine recent alerts and feeds
      const alertEvents: TimelineEvent[] = (recentAlerts || []).map((a: { id: string; title: string; severity: string; locality: string; department: string; timestamp: string }) => ({
        id: `ALT-${a.id}`,
        time: new Date(a.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        title: `Alerte ${a.severity === 'critical' ? 'critique' : a.severity === 'high' ? 'majeure' : ''} — ${a.title}`,
        type: 'alert',
        severity: a.severity,
        locality: a.locality,
        department: a.department,
      }));
      const feedEvents: TimelineEvent[] = (recentFeeds || []).slice(0, 8).map((f: { id: string; title: string; timestamp: string; locality: string; department: string }) => ({
        id: `FLX-${f.id}`,
        time: new Date(f.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        title: `Flux — ${f.title}`,
        type: 'feed',
        severity: 'low',
        locality: f.locality,
        department: f.department,
      }));

      const allEvents = [...alertEvents, ...feedEvents]
        .sort((a, b) => b.time.localeCompare(a.time))
        .slice(0, 10);

      setTimelineEvents(allEvents);

      // Active today
      const todayISO = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const activeTodaySet = new Set<string>();
      (coverageData || []).forEach((a: { locality: string; timestamp?: string }) => {
        if (a.locality) activeTodaySet.add(a.locality);
      });

      // Departments with active alerts
      const deptActiveSet = new Set<string>();
      (coverageData || []).forEach((a: { department: string; status: string }) => {
        if (a.department && a.status === 'active') deptActiveSet.add(a.department);
      });

      setLocalIntel({
        totalLocalities: uniqueLocalities.size,
        totalDepartments: deptActiveSet.size,
        localitiesMonitoredToday: activeTodaySet.size,
        departmentsWithActiveAlerts: deptActiveSet.size,
        topHotspots,
        localCoverage: regionCoverage,
      });

      setStats({
        activeAlerts: activeCount || 0,
        newFeeds24h: feeds24hCount || 0,
        countriesInAlert: uniqueCountries.size,
        localitiesMonitored: uniqueLocalities.size,
        correlationsDetected: corrCount || 0,
        totalMonitored: 54,
        responseTime: '2.3min',
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, activityData, timelineEvents, localIntel, loading, error, refetch: fetchStats };
}