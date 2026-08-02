import { useTranslation } from 'react-i18next';
import { useSupabaseStats } from '@/hooks/useSupabaseStats';

const eventIcon: Record<string, string> = {
  alert: 'ri-alarm-warning-line',
  feed: 'ri-rss-line',
  correlation: 'ri-git-merge-line',
  update: 'ri-refresh-line',
};

const eventColor: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-amber-500',
  medium: 'bg-sentiqs-blue',
  low: 'bg-gray-300',
};

export default function Timeline() {
  const { t } = useTranslation();
  const { timelineEvents, loading } = useSupabaseStats();

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-sm font-bold text-sentiqs-navy mb-3">{t('dashboard.timeline.title')}</h3>
        <p className="text-xs text-sentiqs-gray-text text-center py-4">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-sentiqs-navy">{t('dashboard.timeline.title')}</h3>
          <p className="text-[9px] text-sentiqs-gray-text mt-0.5">{t('dashboard.activity.loading')}</p>
        </div>
        <span className="text-[10px] font-semibold text-sentiqs-gray-text uppercase tracking-wider">{t('dashboard.timeline.today')}</span>
      </div>
      <div className="space-y-3">
        {timelineEvents.map((event, index) => (
          <div key={event.id} className="flex items-start gap-3 anim-entry-right" style={{ animationDelay: `${index * 90}ms` }}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-2 h-2 rounded-full ${eventColor[event.severity] || eventColor.low}`} />
              {index < timelineEvents.length - 1 && (
                <div className="w-px h-8 bg-gray-100 mt-1" />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-sentiqs-gray-text">{event.time}</span>
                <i className={`${eventIcon[event.type] || eventIcon.feed} text-xs text-sentiqs-gray-text`} />
                {event.locality && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-sentiqs-navy bg-sentiqs-navy/5 px-1.5 py-0.5 rounded whitespace-nowrap">
                    <i className="ri-map-pin-line text-[8px]" />
                    {event.locality}
                  </span>
                )}
              </div>
              <p className="text-xs text-sentiqs-navy mt-0.5 truncate">{event.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}