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
  medium: 'bg-cyan-400',
  low: 'bg-slate-500',
};

export default function Timeline() {
  const { t } = useTranslation();
  const { timelineEvents, loading } = useSupabaseStats();

  if (loading) {
    return (
      <div className="bg-slate-900/80 rounded-2xl border border-slate-700/80 p-4">
        <h3 className="text-sm font-bold text-white mb-3">{t('dashboard.timeline.title')}</h3>
        <p className="text-xs text-slate-400 text-center py-4">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-700/80 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-white">{t('dashboard.timeline.title')}</h3>
          <p className="text-[9px] text-slate-400 mt-0.5">{t('dashboard.activity.loading')}</p>
        </div>
        <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">{t('dashboard.timeline.today')}</span>
      </div>
      <div className="space-y-3">
        {timelineEvents.map((event, index) => (
          <div key={event.id} className="flex items-start gap-3 anim-entry-right" style={{ animationDelay: `${index * 90}ms` }}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-2 h-2 rounded-full ${eventColor[event.severity] || eventColor.low}`} />
              {index < timelineEvents.length - 1 && (
                <div className="w-px h-8 bg-slate-700 mt-1" />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-400">{event.time}</span>
                <i className={`${eventIcon[event.type] || eventIcon.feed} text-xs text-slate-400`} />
                {event.locality && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-cyan-200 bg-cyan-500/10 px-1.5 py-0.5 rounded whitespace-nowrap border border-cyan-500/20">
                    <i className="ri-map-pin-line text-[8px]" />
                    {event.locality}
                  </span>
                )}
              </div>
              <p className="text-xs text-white mt-0.5 truncate">{event.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



















