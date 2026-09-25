import { useTranslation } from 'react-i18next';
import { useSupabaseStats } from '@/hooks/useSupabaseStats';

export default function StatsCards() {
  const { t } = useTranslation();
  const { stats, loading } = useSupabaseStats();

  const cards = [
    {
      labelKey: 'dashboard.stats.activeAlerts',
      value: loading ? '...' : stats.activeAlerts,
      icon: 'ri-alarm-warning-line',
      tone: 'red',
      badge: 'bg-red-500/10',
      iconColor: 'text-red-400',
    },
    {
      labelKey: 'dashboard.stats.newFeeds24h',
      value: loading ? '...' : stats.newFeeds24h,
      icon: 'ri-rss-line',
      tone: 'cyan',
      badge: 'bg-cyan-500/10',
      iconColor: 'text-cyan-300',
    },
    {
      labelKey: 'dashboard.stats.countriesInAlert',
      value: loading ? '...' : stats.countriesInAlert,
      icon: 'ri-global-line',
      tone: 'amber',
      badge: 'bg-amber-500/10',
      iconColor: 'text-amber-300',
    },
    {
      labelKey: 'dashboard.countries.title',
      value: loading ? '...' : stats.localitiesMonitored,
      icon: 'ri-building-2-line',
      tone: 'emerald',
      badge: 'bg-emerald-500/10',
      iconColor: 'text-emerald-300',
      subKey: 'dashboard.countryRisk.departmentGranularity',
    },
    {
      labelKey: 'dashboard.stats.correlations',
      value: loading ? '...' : stats.correlationsDetected,
      icon: 'ri-git-merge-line',
      tone: 'violet',
      badge: 'bg-violet-500/10',
      iconColor: 'text-violet-300',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
      {cards.map((card, idx) => (
        <div
          key={card.labelKey}
          className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 flex items-start gap-3 anim-entry-scale shadow-[0_12px_30px_rgba(2,6,23,0.2)]"
          style={{ animationDelay: `${idx * 80}ms` }}
        >
          <div className={`w-11 h-11 rounded-xl ${card.badge} flex items-center justify-center flex-shrink-0`}>
            <i className={`${card.icon} ${card.iconColor} text-lg`} />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{card.value}</p>
            <p className="text-[9px] font-semibold tracking-[0.08em] text-slate-400 uppercase mt-0.5">{t(card.labelKey)}</p>
            {card.subKey && (
              <p className="text-[8px] text-slate-500 mt-0.5">{t(card.subKey)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}





























