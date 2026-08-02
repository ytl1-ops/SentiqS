import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useAlertLevels } from '@/hooks/useAlertLevels';
import { useSupabaseStats } from '@/hooks/useSupabaseStats';
import { formatTimeSince } from '@/utils/timeFormat';
import AfricaHeatmap from '@/components/base/AfricaHeatmap';
import StatsCards from '@/pages/dashboard/components/StatsCards';
import Timeline from '@/pages/dashboard/components/Timeline';
import FeedsList from '@/pages/dashboard/components/FeedsList';

export default function DashboardOverview() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { alertLevels, loading: levelsLoading, stats: alertStats } = useAlertLevels();
  const { stats, loading: statsLoading } = useSupabaseStats();
  const [latestChange, setLatestChange] = useState<{ country: string; oldLevel: string; newLevel: string; at: string } | null>(null);

  const currentLang = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  const today = new Date().toLocaleDateString(currentLang, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  useEffect(() => {
    supabase
      .from('posture_history')
      .select('country_name, old_level, new_level, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setLatestChange({
            country: data[0].country_name,
            oldLevel: data[0].old_level,
            newLevel: data[0].new_level,
            at: data[0].created_at,
          });
        }
      });
  }, []);

  const levelCounts = useMemo(() => {
    const c = { rouge: 0, orange: 0, jaune: 0, vert: 0 };
    alertLevels.forEach((l) => { if (l.level in c) c[l.level]++; });
    return c;
  }, [alertLevels]);

  const criticalCountries = useMemo(() => {
    return alertLevels.filter((l) => l.level === 'rouge').slice(0, 5);
  }, [alertLevels]);

  const highRiskCountries = useMemo(() => {
    return alertLevels.filter((l) => l.level === 'orange').slice(0, 5);
  }, [alertLevels]);

  const recentEscalations = useMemo(() => {
    return alertLevels
      .filter((l) => l.level === 'rouge' || l.level === 'orange')
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [alertLevels]);

  const overallStatus = useMemo(() => {
    if (levelCounts.rouge >= 3) return { labelKey: 'dashboard.status.critical', color: 'bg-red-700 text-white', pulse: 'anim-pulse-red' };
    if (levelCounts.rouge >= 1) return { labelKey: 'dashboard.status.veryTense', color: 'bg-red-600 text-white', pulse: 'anim-pulse-red' };
    if (levelCounts.orange >= 5) return { labelKey: 'dashboard.status.tense', color: 'bg-orange-600 text-white', pulse: 'anim-pulse-orange' };
    if (levelCounts.orange >= 1) return { labelKey: 'dashboard.status.degraded', color: 'bg-yellow-500 text-yellow-950', pulse: '' };
    return { labelKey: 'dashboard.status.stable', color: 'bg-emerald-600 text-white', pulse: '' };
  }, [levelCounts]);

  const formatTimeRel = (iso: string): string => formatTimeSince(iso, i18n.language);

  return (
    <div className="space-y-5">
      {/* ===== WELCOME + OVERALL STATUS BANNER ===== */}
      <div className="anim-entry-down space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-sentiqs-navy dark:text-white">{t('dashboard.welcome')}</h1>
            <p className="text-xs text-sentiqs-gray-text dark:text-gray-400 mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${overallStatus.color} ${overallStatus.pulse} text-xs font-bold`}>
              <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
              {t('dashboard.riskContext', { count: levelCounts.rouge + levelCounts.orange })}
            </span>
            <span className="text-[10px] text-sentiqs-gray-text dark:text-gray-400">
              {stats.activeAlerts} {t('dashboard.activeAlerts')} · {levelCounts.rouge + levelCounts.orange} {t('dashboard.countriesAtRisk')}
            </span>
          </div>
        </div>
      </div>

      {/* ===== WAR ROOM COUNTERS — BIG RED/ORANGE ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard/alerts?filter=rouge')}
          className="relative overflow-hidden rounded-xl border-2 border-red-600 bg-gradient-to-br from-red-700 to-red-800 p-4 text-left hover:scale-[1.02] transition-transform cursor-pointer group"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/20 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="text-3xl md:text-4xl font-black text-white font-mono tracking-tight">{levelCounts.rouge}</div>
            <div className="text-[11px] font-bold text-red-200 mt-1 uppercase tracking-widest">{t('dashboard.level.red')}</div>
            <div className="text-[9px] text-red-300 mt-0.5">{t('dashboard.level.redDesc')}</div>
          </div>
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <i className="ri-arrow-right-line text-white text-sm" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/dashboard/alerts?filter=orange')}
          className="relative overflow-hidden rounded-xl border-2 border-orange-500 bg-gradient-to-br from-orange-600 to-orange-700 p-4 text-left hover:scale-[1.02] transition-transform cursor-pointer group"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-orange-400/20 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="text-3xl md:text-4xl font-black text-white font-mono tracking-tight">{levelCounts.orange}</div>
            <div className="text-[11px] font-bold text-orange-200 mt-1 uppercase tracking-widest">{t('dashboard.level.orange')}</div>
            <div className="text-[9px] text-orange-300 mt-0.5">{t('dashboard.level.orangeDesc')}</div>
          </div>
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <i className="ri-arrow-right-line text-white text-sm" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/dashboard/alerts?filter=jaune')}
          className="relative overflow-hidden rounded-xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-500 to-yellow-600 p-4 text-left hover:scale-[1.02] transition-transform cursor-pointer group"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-300/20 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="text-3xl md:text-4xl font-black text-yellow-950 font-mono tracking-tight">{levelCounts.jaune}</div>
            <div className="text-[11px] font-bold text-yellow-900 mt-1 uppercase tracking-widest">{t('dashboard.level.yellow')}</div>
            <div className="text-[9px] text-yellow-800 mt-0.5">{t('dashboard.level.yellowDesc')}</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/dashboard/alerts?filter=vert')}
          className="relative overflow-hidden rounded-xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-600 to-emerald-700 p-4 text-left hover:scale-[1.02] transition-transform cursor-pointer group"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-400/20 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="text-3xl md:text-4xl font-black text-white font-mono tracking-tight">{levelCounts.vert}</div>
            <div className="text-[11px] font-bold text-emerald-200 mt-1 uppercase tracking-widest">{t('dashboard.level.green')}</div>
            <div className="text-[9px] text-emerald-300 mt-0.5">{t('dashboard.level.greenDesc')}</div>
          </div>
        </button>
      </div>

      {/* ===== LATEST POSTURE CHANGE ALERT ===== */}
      {latestChange && latestChange.oldLevel !== latestChange.newLevel && (
        <div className={`rounded-lg border p-3 flex items-center gap-3 ${
          (latestChange.newLevel === 'rouge' || latestChange.newLevel === 'orange')
            ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
            : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
        }`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            latestChange.newLevel === 'rouge' ? 'bg-red-700' :
            latestChange.newLevel === 'orange' ? 'bg-orange-600' :
            'bg-yellow-500'
          }`}>
            <i className={`text-white text-lg ${
              (latestChange.newLevel === 'rouge' || latestChange.newLevel === 'orange') ? 'ri-arrow-up-line' : 'ri-arrow-down-line'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-gray-900 dark:text-white">
              {t('dashboard.postureChange')} — {latestChange.country}
              <span className="mx-1.5">:</span>
              <span className="uppercase font-black">{latestChange.oldLevel}</span>
              <i className="ri-arrow-right-line mx-1 text-gray-400" />
              <span className="uppercase font-black">{latestChange.newLevel}</span>
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">{formatTimeRel(latestChange.at)}</div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/situation')}
            className="px-3 py-1.5 bg-sentiqs-navy dark:bg-red-700 text-white rounded-lg text-[10px] font-semibold hover:opacity-90 whitespace-nowrap"
          >
            {t('dashboard.viewSituation')}
            <i className="ri-arrow-right-line ml-1" />
          </button>
        </div>
      )}

      {/* ===== MAIN GRID: Heatmap + Threat List + Timeline ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Heatmap preview */}
        <div className="xl:col-span-2 bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-[#1e293b] overflow-hidden" style={{ minHeight: '420px' }}>
          <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1e293b] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-sentiqs-navy dark:text-white">{t('dashboard.operationalMap')}</h3>
              <p className="text-[10px] text-sentiqs-gray-text dark:text-gray-400 mt-0.5">{t('dashboard.operationalMapSubtitle')}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const el = document.querySelector('[data-heatmap-full]');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-[10px] font-semibold text-sentiqs-navy dark:text-gray-300 hover:underline whitespace-nowrap"
            >
              {t('dashboard.fullscreen')}
              <i className="ri-external-link-line ml-1" />
            </button>
          </div>
          <div style={{ height: 'calc(420px - 53px)' }}>
            <AfricaHeatmap levels={alertLevels} />
          </div>
        </div>

        {/* Right column: Threat list + Stats */}
        <div className="space-y-4">
          {/* Critical threats */}
          {criticalCountries.length > 0 && (
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-red-200 dark:border-red-900/60 p-4">
              <h3 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {t('dashboard.criticalThreats')}
              </h3>
              <div className="space-y-2">
                {criticalCountries.map((c) => (
                  <button
                    key={c.countryCode}
                    type="button"
                    onClick={() => navigate(`/dashboard/alerts/country/${c.countryCode}`)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left cursor-pointer"
                  >
                    <span className="w-7 h-7 rounded bg-red-700 text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                      {c.countryCode}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-900 dark:text-white">{c.country}</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">
                        Score {c.score}/100 · {c.incidents} {t('dashboard.incidents')}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-red-600 whitespace-nowrap">
                      {c.incidentsBySeverity.critical} {t('common.criticalShort')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* High risk threats */}
          {highRiskCountries.length > 0 && (
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-orange-200 dark:border-orange-900/60 p-4">
              <h3 className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                {t('dashboard.highRiskThreats')}
              </h3>
              <div className="space-y-2">
                {highRiskCountries.map((c) => (
                  <button
                    key={c.countryCode}
                    type="button"
                    onClick={() => navigate(`/dashboard/alerts/country/${c.countryCode}`)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-left cursor-pointer"
                  >
                    <span className="w-7 h-7 rounded bg-orange-600 text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                      {c.countryCode}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-900 dark:text-white">{c.country}</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">
                        Score {c.score}/100 · {c.incidents} {t('common.short')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-[#1e293b] p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 bg-gray-50 dark:bg-[#1a2232] rounded-lg">
                <div className="text-lg font-bold text-sentiqs-navy dark:text-white">{alertStats.totalIncidents}</div>
                <div className="text-[9px] text-sentiqs-gray-text dark:text-gray-400">Incidents</div>
              </div>
              <div className="text-center p-2 bg-gray-50 dark:bg-[#1a2232] rounded-lg">
                <div className="text-lg font-bold text-sentiqs-navy dark:text-white">{alertStats.totalVerified}</div>
                <div className="text-[9px] text-sentiqs-gray-text dark:text-gray-400">{t('common.verifiedCount')}</div>
              </div>
              <div className="text-center p-2 bg-gray-50 dark:bg-[#1a2232] rounded-lg">
                <div className="text-lg font-bold text-sentiqs-navy dark:text-white">{stats.newFeeds24h}</div>
                <div className="text-[9px] text-sentiqs-gray-text dark:text-gray-400">{t('dashboard.feeds24h')}</div>
              </div>
              <div className="text-center p-2 bg-gray-50 dark:bg-[#1a2232] rounded-lg">
                <div className="text-lg font-bold text-sentiqs-navy dark:text-white">{stats.countriesInAlert}</div>
                <div className="text-[9px] text-sentiqs-gray-text dark:text-gray-400">{t('dashboard.countriesConcerned')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM: Timeline + Feeds ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Timeline />
        </div>
        <div>
          <FeedsList />
        </div>
      </div>

      {/* ===== RECENT ESCALATIONS ===== */}
      {recentEscalations.length > 0 && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-[#1e293b] p-4">
          <div className="flex items-center gap-2 mb-3">
            <i className="ri-bar-chart-grouped-line text-red-500" />
            <h3 className="text-sm font-bold text-sentiqs-navy dark:text-white">{t('dashboard.topTenseCountries')}</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {recentEscalations.map((c) => (
              <button
                key={c.countryCode}
                type="button"
                onClick={() => navigate(`/dashboard/alerts/country/${c.countryCode}`)}
                className={`rounded-lg border p-3 text-left hover:shadow-sm transition-all cursor-pointer ${
                  c.level === 'rouge' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10' : 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold text-gray-900 dark:text-white">{c.countryCode}</span>
                  <span className={`px-1 py-0.5 rounded text-[8px] font-bold uppercase ${
                    c.level === 'rouge' ? 'bg-red-700 text-white' : 'bg-orange-600 text-white'
                  }`}>{c.level}</span>
                </div>
                <div className="text-lg font-black font-mono text-gray-900 dark:text-white">{c.score}</div>
                <div className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">{c.incidents} {t('common.short')} · {c.incidentsBySeverity.critical} {t('common.criticalShort')}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}