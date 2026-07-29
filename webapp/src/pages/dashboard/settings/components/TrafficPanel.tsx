import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface TrafficLog {
  id: number;
  page_path: string;
  country: string;
  region: string;
  duration_seconds: number;
  timestamp: string;
}

const pageLabels: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/dashboard/alerts': 'Alertes',
  '/dashboard/feeds': 'Flux',
  '/dashboard/correlations': 'Corrélations',
  '/dashboard/countries': 'Pays',
  '/dashboard/reports': 'Rapports',
  '/dashboard/agenda': 'Agenda',
  '/dashboard/settings': 'Paramètres',
};

export default function TrafficPanel() {
  const [logs, setLogs] = useState<TrafficLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.from('traffic_logs').select('*').order('timestamp', { ascending: false }).limit(100);
      setLogs(data || []);
    } catch {
      setError('Impossible de charger les données de trafic.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const stats = useMemo(() => {
    const totalVisits = logs.length;
    const avgDuration = logs.length > 0 ? Math.round(logs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0) / logs.length) : 0;

    const countryCounts: Record<string, number> = {};
    logs.forEach((l) => {
      countryCounts[l.country] = (countryCounts[l.country] || 0) + 1;
    });
    const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

    const pageCounts: Record<string, number> = {};
    logs.forEach((l) => {
      pageCounts[l.page_path] = (pageCounts[l.page_path] || 0) + 1;
    });
    const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

    const regionCounts: Record<string, number> = {};
    logs.forEach((l) => {
      regionCounts[l.region] = (regionCounts[l.region] || 0) + 1;
    });
    const topRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);

    return { totalVisits, avgDuration, topCountries, topPages, topRegions };
  }, [logs]);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const maxCountryCount = stats.topCountries[0]?.[1] || 1;
  const maxPageCount = stats.topPages[0]?.[1] || 1;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-bold text-sentiqs-navy">Suivi du trafic</h2>
        <p className="text-[10px] text-sentiqs-gray-text mt-0.5">Analyse des visites par page, pays et région</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-100 p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-50 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-8 text-center text-sentiqs-gray-text text-xs bg-white rounded-lg border border-gray-100">
          {error}
          <button type="button" onClick={fetchLogs} className="ml-2 text-sentiqs-navy font-semibold underline cursor-pointer">Réessayer</button>
        </div>
      ) : (
        <>
          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-lg border border-gray-100 p-4">
              <div className="text-2xl font-bold text-sentiqs-navy">{stats.totalVisits}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mt-0.5">Visites (échantillon)</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-4">
              <div className="text-2xl font-bold text-emerald-600">{stats.avgDuration}s</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mt-0.5">Durée moyenne</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-4">
              <div className="text-2xl font-bold text-amber-500">{stats.topRegions.length}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mt-0.5">Régions actives</div>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Countries */}
            <div className="bg-white rounded-lg border border-gray-100 p-4">
              <h3 className="text-xs font-bold text-sentiqs-navy mb-3">Top pays consultés</h3>
              <div className="space-y-2">
                {stats.topCountries.map(([country, count]) => (
                  <div key={country} className="flex items-center gap-3">
                    <span className="text-[10px] font-semibold text-sentiqs-navy w-24 truncate whitespace-nowrap">{country}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sentiqs-navy rounded-full transition-all"
                        style={{ width: `${Math.max((count / maxCountryCount) * 100, 4)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-sentiqs-gray-text w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pages */}
            <div className="bg-white rounded-lg border border-gray-100 p-4">
              <h3 className="text-xs font-bold text-sentiqs-navy mb-3">Pages les plus visitées</h3>
              <div className="space-y-2">
                {stats.topPages.map(([page, count]) => (
                  <div key={page} className="flex items-center gap-3">
                    <span className="text-[10px] font-semibold text-sentiqs-navy w-24 truncate whitespace-nowrap">{pageLabels[page] || page}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.max((count / maxPageCount) * 100, 4)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-sentiqs-gray-text w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent visits log */}
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-sentiqs-navy">Dernières visites</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Date</th>
                    <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Page</th>
                    <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Pays</th>
                    <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Région</th>
                    <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Durée</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 20).map((l) => (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-2 text-sentiqs-gray-text font-mono whitespace-nowrap">{formatTime(l.timestamp)}</td>
                      <td className="px-4 py-2 font-semibold text-sentiqs-navy">{pageLabels[l.page_path] || l.page_path}</td>
                      <td className="px-4 py-2 text-sentiqs-gray-text">{l.country}</td>
                      <td className="px-4 py-2 text-sentiqs-gray-text">{l.region}</td>
                      <td className="px-4 py-2 text-sentiqs-gray-text text-right">{l.duration_seconds || 0}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}