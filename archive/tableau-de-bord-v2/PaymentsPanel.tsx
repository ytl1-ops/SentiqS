import { useTranslation } from 'react-i18next';
import { useSupabaseStats } from '@/hooks/useSupabaseStats';

export default function ActivityChart() {
  const { t } = useTranslation();
  const { activityData, loading } = useSupabaseStats();

  const maxValue = activityData.length > 0 ? Math.max(...activityData.map((d) => d.alerts + d.feeds), 1) : 1;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 anim-entry-scale" style={{ animationDelay: '300ms' }}>
      <h3 className="text-sm font-bold text-sentiqs-navy mb-4">{t('dashboard.activity.title')}</h3>
      {loading ? (
        <div className="h-40 flex items-center justify-center text-xs text-sentiqs-gray-text">Chargement...</div>
      ) : (
        <div className="flex items-end gap-2 h-40">
          {activityData.map((day) => {
            const alertHeight = maxValue > 0 ? (day.alerts / maxValue) * 100 : 0;
            const feedHeight = maxValue > 0 ? (day.feeds / maxValue) * 100 : 0;
            return (
              <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 h-32 items-end">
                  <div
                    className="flex-1 bg-sentiqs-navy rounded-t-sm min-w-[4px] transition-all"
                    style={{ height: `${alertHeight}%` }}
                    title={`${day.alerts} alertes`}
                  />
                  <div
                    className="flex-1 bg-sentiqs-blue/40 rounded-t-sm min-w-[4px] transition-all"
                    style={{ height: `${feedHeight}%` }}
                    title={`${day.feeds} flux`}
                  />
                </div>
                <span className="text-[9px] text-sentiqs-gray-text font-medium">{day.day}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-sentiqs-navy" />
          <span className="text-[10px] text-sentiqs-gray-text">Alertes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-sentiqs-blue/40" />
          <span className="text-[10px] text-sentiqs-gray-text">Flux</span>
        </div>
      </div>
    </div>
  );
}