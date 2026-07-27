import { useTranslation } from 'react-i18next';
import { dashboardFeeds } from '@/mocks/dashboard';

export default function FeedsList() {
  const { t } = useTranslation();

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-sentiqs-navy">{t('dashboard.feeds.latest')}</h3>
      </div>
      <div className="space-y-3">
        {dashboardFeeds.map((feed) => (
          <div key={feed.id} className="flex items-start gap-2.5 pb-2.5 border-b border-gray-50 last:border-0 last:pb-0">
            <div className="w-7 h-7 rounded-md bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-newspaper-line text-sentiqs-gray-text text-xs" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-sentiqs-navy leading-snug">{feed.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-sentiqs-gray-text">{feed.source}</span>
                <span className="text-[9px] text-sentiqs-gray-text">•</span>
                <span className="text-[9px] text-sentiqs-gray-text">{formatTime(feed.timestamp)}</span>
                <span className="text-[9px] text-sentiqs-gray-text">•</span>
                <span className="text-[9px] font-medium text-sentiqs-blue">{feed.country}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-gray-50">
        <a
          href="#"
          className="text-xs text-sentiqs-blue hover:text-sentiqs-blue-dark transition-colors font-medium"
          onClick={(e) => e.preventDefault()}
        >
          {t('dashboard.feeds.viewAll')} →
        </a>
      </div>
    </div>
  );
}