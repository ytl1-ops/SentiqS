import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useVerifiedFeeds } from '@/hooks/useVerifiedFeeds';
import { normalizeCountryName } from '@/hooks/useAlertLevels';
import { formatTimeSince } from '@/utils/timeFormat';
import { categorySeverityStyle } from '@/utils/categoryColors';
import EmptyState from '@/components/base/EmptyState';

export default function NewsHeroFeed() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { feeds, loading } = useVerifiedFeeds();

  const latestFeeds = useMemo(() => {
    return [...feeds]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12);
  }, [feeds]);

  const statsCards = useMemo(() => {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const feeds24h = feeds.filter((f) => new Date(f.timestamp) >= last24h);
    const africanCountries = new Set<string>();
    feeds.forEach((f) => {
      const canonical = normalizeCountryName(f.country);
      if (canonical) africanCountries.add(canonical);
    });
    const sources = new Set(feeds.map((f) => f.source));
    const securiteFeeds = feeds.filter((f) =>
      ['Sécurité', 'Terrorisme', 'Défense', 'Trafics illicites'].includes(f.category),
    );

    return {
      total24h: feeds24h.length,
      countriesCovered: africanCountries.size,
      activeSources: sources.size,
      securityAlerts: securiteFeeds.filter((f) => new Date(f.timestamp) >= last24h).length,
    };
  }, [feeds]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
        <div className="h-5 bg-gray-100 rounded w-48 mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-50 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-sentiqs-navy flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {t('dashboard.newsHero.title')}
          </h2>
          <p className="text-[10px] text-sentiqs-gray-text mt-0.5">
            {t('dashboard.newsHero.subtitle', { countries: statsCards.countriesCovered, sources: statsCards.activeSources })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard/feeds')}
          className="px-4 py-2 rounded-lg bg-sentiqs-navy text-white text-xs font-semibold hover:bg-sentiqs-navy/90 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
        >
          <i className="ri-article-line" />
          {t('dashboard.newsHero.allFeeds', { count: feeds.length })}
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-red-50/60 rounded-lg p-3 border border-red-100/60">
          <p className="text-lg font-bold text-red-700">{statsCards.securityAlerts}</p>
          <p className="text-[9px] font-semibold text-red-600 uppercase tracking-wide">{t('dashboard.newsHero.secAlerts24h')}</p>
        </div>
        <div className="bg-sentiqs-navy/5 rounded-lg p-3 border border-sentiqs-navy/10">
          <p className="text-lg font-bold text-sentiqs-navy">{statsCards.total24h}</p>
          <p className="text-[9px] font-semibold text-sentiqs-gray-text uppercase tracking-wide">{t('dashboard.newsHero.dispatches24h')}</p>
        </div>
        <div className="bg-emerald-50/60 rounded-lg p-3 border border-emerald-100/60">
          <p className="text-lg font-bold text-emerald-700">54</p>
          <p className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wide">{t('dashboard.newsHero.africanCountries')}</p>
        </div>
        <div className="bg-amber-50/60 rounded-lg p-3 border border-amber-100/60">
          <p className="text-lg font-bold text-amber-700">{statsCards.activeSources}</p>
          <p className="text-[9px] font-semibold text-amber-600 uppercase tracking-wide">{t('common.activeSourcesLabel')}</p>
        </div>
      </div>

      {/* Feed grid */}
      {latestFeeds.length === 0 ? (
        <EmptyState
          icon="ri-newspaper-line"
          title={t('dashboard.newsHero.emptyTitle')}
          description={t('dashboard.newsHero.emptyDesc')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {latestFeeds.map((feed, idx) => {
            const sev = categorySeverityStyle(feed.category);
            return (
              <div
                key={feed.id}
                className="group bg-white rounded-lg border border-gray-100 p-4 hover:border-gray-200 transition-all cursor-pointer anim-entry-scale"
                style={{ animationDelay: `${idx * 40}ms` }}
                onClick={() => window.open(feed.source_url, '_blank', 'noopener,noreferrer')}
              >
                <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${sev.ring}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                    {sev.label}
                  </span>
                  {idx === 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700 border border-red-200">
                      <i className="ri-flashlight-line text-[8px]" />
                      {t('dashboard.newsHero.urgent')}
                    </span>
                  )}
                  <span className="text-[9px] text-sentiqs-gray-text ml-auto whitespace-nowrap">
                    {formatTimeSince(feed.timestamp, i18n.language)}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-sentiqs-navy leading-snug mb-2 group-hover:text-sentiqs-blue transition-colors">
                  {feed.title}
                </h3>

                {feed.summary && (
                  <p className="text-xs text-sentiqs-gray-text leading-relaxed mb-2.5 line-clamp-3">
                    {feed.summary}
                  </p>
                )}

                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-50">
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sentiqs-navy bg-sentiqs-navy/5 px-2 py-0.5 rounded whitespace-nowrap">
                    <i className="ri-global-line text-[9px]" />
                    {feed.country}
                  </span>
                  {feed.locality && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-sentiqs-gray-text whitespace-nowrap">
                      <i className="ri-map-pin-line text-[9px]" />
                      {feed.locality}
                    </span>
                  )}
                  <span className="text-[10px] text-sentiqs-blue font-medium whitespace-nowrap ml-auto">
                    {feed.source} →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom CTA */}
      <div className="flex items-center justify-between bg-sentiqs-navy/5 rounded-lg px-4 py-3 border border-sentiqs-navy/10">
        <div className="flex items-center gap-2">
          <i className="ri-rss-line text-sentiqs-navy" />
          <span className="text-xs text-sentiqs-navy font-semibold">
            {t('dashboard.newsHero.indexedCount', { count: feeds.length })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard/feeds')}
          className="px-3 py-1.5 rounded-md bg-sentiqs-navy text-white text-[10px] font-semibold hover:bg-sentiqs-navy/90 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
        >
          <i className="ri-arrow-right-line" />
          {t('dashboard.newsHero.exploreAll')}
        </button>
      </div>
    </div>
  );
}