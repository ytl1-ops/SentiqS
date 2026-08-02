import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

export default function StatsSection() {
  const { t } = useTranslation();
  const [liveStats, setLiveStats] = useState({
    countries: 54,
    activeAlerts: 0,
    recentFeeds: 0,
    regions: 10,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchLiveStats() {
      try {
        const twentyFourH = new Date(Date.now() - 86400000).toISOString();

        const [activeRes, feedsRes] = await Promise.all([
          supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('feeds').select('*', { count: 'exact', head: true }).gte('timestamp', twentyFourH),
        ]);

        if (cancelled) return;

        setLiveStats({
          countries: 54,
          activeAlerts: activeRes.count || 0,
          recentFeeds: feedsRes.count || 0,
          regions: 10,
        });
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    }

    fetchLiveStats();
    return () => { cancelled = true; };
  }, []);

  const stats = [
    { value: liveStats.countries.toString(), label: t('landing.stats.countries'), icon: 'ri-global-line' },
    { value: loaded ? liveStats.activeAlerts.toString() : '...', label: t('landing.stats.alerts'), icon: 'ri-alarm-warning-line' },
    { value: loaded ? liveStats.recentFeeds.toString() : '...', label: t('landing.stats.feeds'), icon: 'ri-rss-line' },
    { value: liveStats.regions.toString(), label: t('landing.stats.regions'), icon: 'ri-map-pin-line' },
  ];

  return (
    <section id="stats" className="w-full bg-white border-b border-gray-100">
      <div className="w-full px-6 md:px-10 py-10 md:py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-sentiqs-gray-bg mb-3">
                <i className={`${s.icon} text-sentiqs-blue text-lg md:text-xl`} />
              </div>
              <p className="text-2xl md:text-3xl font-bold text-sentiqs-navy">{s.value}</p>
              <p className="text-xs md:text-sm text-sentiqs-gray-text mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {loaded && (
          <div className="mt-6 text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[10px] font-semibold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Données en temps réel — {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}