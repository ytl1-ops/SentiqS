import { useTranslation } from 'react-i18next';
import StatsCards from '@/pages/dashboard/components/StatsCards';
import AlertsTable from '@/pages/dashboard/components/AlertsTable';
import ActivityChart from '@/pages/dashboard/components/ActivityChart';
import Timeline from '@/pages/dashboard/components/Timeline';
import CountryRisk from '@/pages/dashboard/components/CountryRisk';
import FeedsList from '@/pages/dashboard/components/FeedsList';

export default function DashboardOverview() {
  const { t } = useTranslation();

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div>
        <h1 className="text-lg font-bold text-sentiqs-navy">{t('dashboard.welcome')}</h1>
        <p className="text-xs text-sentiqs-gray-text mt-0.5">{t('dashboard.welcomeSub')}</p>
        <p className="text-[10px] text-sentiqs-gray-text mt-1 font-medium">{today}</p>
      </div>

      {/* Stats */}
      <StatsCards />

      {/* Two columns */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="xl:col-span-2 space-y-4">
          <AlertsTable />
          <ActivityChart />
        </div>
        <div className="space-y-4">
          <Timeline />
          <CountryRisk />
          <FeedsList />
        </div>
      </div>
    </div>
  );
}