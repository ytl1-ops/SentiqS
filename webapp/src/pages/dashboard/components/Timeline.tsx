import { useTranslation } from 'react-i18next';
import { useVeille, chronologie } from '@/lib/veille';

const eventIcon: Record<string, string> = {
  alert: 'ri-alarm-warning-line',
  feed: 'ri-rss-line',
  correlation: 'ri-git-merge-line',
};

const eventColor: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-amber-500',
  medium: 'bg-sentiqs-blue',
  low: 'bg-gray-300',
};

export default function Timeline() {
  const { t } = useTranslation();
  const { articles, loading } = useVeille();
  const timelineEvents = chronologie(articles);

  if (loading) {
    return <div className="bg-white rounded-xl border border-gray-100 p-4 h-64 animate-pulse" />;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-sentiqs-navy">{t('dashboard.timeline.title')}</h3>
        <span className="text-[10px] font-semibold text-sentiqs-gray-text uppercase tracking-wider">{t('dashboard.timeline.today')}</span>
      </div>
      {timelineEvents.length === 0 && (
        <p className="text-xs text-sentiqs-gray-text py-6 text-center">
          Aucun signal collecté pour l'instant. Lancez une collecte depuis la page Flux.
        </p>
      )}
      <div className="space-y-3">
        {timelineEvents.map((event, index) => (
          <div key={event.id} className="flex items-start gap-3">
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
              </div>
              <p className="text-xs text-sentiqs-navy mt-0.5 truncate">{event.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}