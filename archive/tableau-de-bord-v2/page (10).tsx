import { useTranslation } from 'react-i18next';
import { useVerifiedFeeds } from '@/hooks/useVerifiedFeeds';
import { categoryBadgeClasses } from '@/utils/categoryColors';

export default function FeedsList() {
  const { t } = useTranslation();
  const { feeds, loading } = useVerifiedFeeds(8);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-sentiqs-navy">{t('dashboard.feeds.latest')}</h3>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2.5 pb-2.5 border-b border-gray-50 last:border-0 last:pb-0 animate-pulse">
              <div className="w-7 h-7 rounded-md bg-gray-100 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-2 bg-gray-50 rounded w-full" />
                <div className="h-2 bg-gray-50 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-sentiqs-navy">{t('dashboard.feeds.latest')}</h3>
          <p className="text-[9px] text-sentiqs-gray-text mt-0.5">
            {feeds.length} {t('common.activeSourceDesc')}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 bg-primary-50 border border-primary-200 rounded-full px-2 py-0.5 text-[9px] font-semibold text-primary-700 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
          {t('common.activeSourcesLabel')}
        </span>
      </div>
      <div className="space-y-3">
        {feeds.map((feed, idx) => (
          <div
            key={feed.id}
            className="flex items-start gap-2.5 pb-2.5 border-b border-gray-50 last:border-0 last:pb-0 anim-entry-right"
            style={{ animationDelay: `${idx * 25}ms` }}
          >
            <div className="w-7 h-7 rounded-md bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-newspaper-line text-sentiqs-gray-text text-xs" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold border ${categoryBadgeClasses(feed.category)}`}>
                  {feed.category}
                </span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                  <i className="ri-shield-check-line text-[7px]" />
                  {t('common.verifiedBadge')}
                </span>
              </div>

              {/* Titre + lien source cliquable */}
              <a
                href={feed.source_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-xs text-sentiqs-navy leading-snug hover:text-sentiqs-blue transition-colors cursor-pointer block"
                title={`${t('dashboard.feeds.readSource')} : ${feed.source}`}
              >
                {feed.title}
                <i className="ri-external-link-line text-[9px] ml-1 align-middle text-sentiqs-gray-text" />
              </a>

              {feed.summary && (
                <p className="text-[10px] text-sentiqs-gray-text mt-0.5 leading-relaxed break-words">
                  {feed.summary}
                </p>
              )}

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {feed.locality && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-sentiqs-navy bg-sentiqs-navy/5 px-1.5 py-0.5 rounded whitespace-nowrap">
                    <i className="ri-map-pin-line text-[8px]" />
                    {feed.locality}
                  </span>
                )}
                <a
                  href={feed.source_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-[9px] text-sentiqs-blue hover:underline cursor-pointer whitespace-nowrap"
                >
                  {feed.source}
                </a>
                <span className="text-[9px] text-sentiqs-gray-text">•</span>
                <span className="text-[9px] text-sentiqs-gray-text whitespace-nowrap">{formatTime(feed.timestamp)}</span>
                <span className="text-[9px] text-sentiqs-gray-text">•</span>
                <span className="text-[9px] font-medium text-sentiqs-blue whitespace-nowrap">{feed.country}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-gray-50">
        <a
          href="/dashboard/feeds"
          className="text-xs text-sentiqs-blue hover:text-sentiqs-blue-dark transition-colors font-medium"
        >
          {t('dashboard.feeds.viewAll')} →
        </a>
      </div>
    </div>
  );
}