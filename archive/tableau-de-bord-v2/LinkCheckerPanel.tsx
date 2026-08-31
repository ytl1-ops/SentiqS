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
      color: 'text-red-500',
      bgColor: 'bg-red-50',
    },
    {
      labelKey: 'dashboard.stats.newFeeds24h',
      value: loading ? '...' : stats.newFeeds24h,
      icon: 'ri-rss-line',
      color: 'text-sentiqs-blue',
      bgColor: 'bg-blue-50',
    },
    {
      labelKey: 'dashboard.stats.countriesInAlert',
      value: loading ? '...' : stats.countriesInAlert,
      icon: 'ri-global-line',
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
    },
    {
      labelKey: 'dashboard.countries.title',
      value: loading ? '...' : stats.localitiesMonitored,
      icon: 'ri-building-2-line',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      subKey: 'dashboard.countryRisk.departmentGranularity',
    },
    {
      labelKey: 'dashboard.stats.correlations',
      value: loading ? '...' : stats.correlationsDetected,
      icon: 'ri-git-merge-line',
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
      {cards.map((card, idx) => (
        <div key={card.labelKey} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3 anim-entry-scale" style={{ animationDelay: `${idx * 80}ms` }}>
          <div className={`w-9 h-9 rounded-lg ${card.bgColor} flex items-center justify-center flex-shrink-0`}>
            <i className={`${card.icon} ${card.color} text-lg`} />
          </div>
          <div>
            <p className="text-xl font-bold text-sentiqs-navy">{card.value}</p>
            <p className="text-[9px] font-semibold tracking-[0.08em] text-sentiqs-gray-text uppercase mt-0.5">{t(card.labelKey)}</p>
            {card.subKey && (
              <p className="text-[8px] text-sentiqs-gray-text mt-0.5">{t(card.subKey)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}