import { useTranslation } from 'react-i18next';
import { dashboardStats } from '@/mocks/dashboard';

export default function StatsCards() {
  const { t } = useTranslation();

  const cards = [
    {
      label: t('dashboard.stats.activeAlerts'),
      value: dashboardStats.activeAlerts,
      icon: 'ri-alarm-warning-line',
      color: 'text-red-500',
      bgColor: 'bg-red-50',
    },
    {
      label: t('dashboard.stats.newFeeds24h'),
      value: dashboardStats.newFeeds24h,
      icon: 'ri-rss-line',
      color: 'text-sentiqs-blue',
      bgColor: 'bg-blue-50',
    },
    {
      label: t('dashboard.stats.countriesInAlert'),
      value: dashboardStats.countriesInAlert,
      icon: 'ri-map-pin-line',
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
    },
    {
      label: t('dashboard.stats.correlations'),
      value: dashboardStats.correlationsDetected,
      icon: 'ri-git-merge-line',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg ${card.bgColor} flex items-center justify-center flex-shrink-0`}>
            <i className={`${card.icon} ${card.color} text-lg`} />
          </div>
          <div>
            <p className="text-xl font-bold text-sentiqs-navy">{card.value}</p>
            <p className="text-[10px] font-semibold tracking-[0.1em] text-sentiqs-gray-text uppercase mt-0.5">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}