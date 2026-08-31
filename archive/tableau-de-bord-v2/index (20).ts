import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLinkStatus, type FeedLinkStatus } from '@/hooks/useLinkStatus';

function formatDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LinkCheckerPanel() {
  const { t, i18n } = useTranslation();
  const isFr = i18n.language.startsWith('fr');

  function statusBadge(status: FeedLinkStatus['source_status']) {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
            <i className="ri-checkbox-circle-line text-[9px]" />
            {t('feeds.linkStatus.activeBadge')}
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">
            <i className="ri-alert-line text-[9px]" />
            {t('feeds.linkStatus.warningBadge')}
          </span>
        );
      case 'dead':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-red-50 text-red-700 border-red-200">
            <i className="ri-close-circle-line text-[9px]" />
            {t('feeds.linkStatus.deadBadge')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-gray-50 text-gray-500 border-gray-200">
            <i className="ri-question-line text-[9px]" />
            {t('feeds.linkStatus.uncheckedBadge')}
          </span>
        );
    }
  }

  const {
    deadLinks,
    warningLinks,
    uncheckedLinks,
    loading,
    scanning,
    error,
    lastScan,
    counts,
    scanSummary,
    schedule,
    scheduleLoading,
    runScan,
    toggleSchedule,
    setScheduleInterval,
  } = useLinkStatus();

  const [filter, setFilter] = useState<'all' | 'dead' | 'warning' | 'unchecked'>('dead');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list: FeedLinkStatus[] = [];
    if (filter === 'dead') list = deadLinks;
    else if (filter === 'warning') list = warningLinks;
    else if (filter === 'unchecked') list = uncheckedLinks;
    else {
      list = [...deadLinks, ...warningLinks, ...uncheckedLinks].sort((a, b) => {
        const score = { dead: 3, warning: 2, unchecked: 1, active: 0 };
        return (score[b.source_status] || 0) - (score[a.source_status] || 0);
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.source.toLowerCase().includes(q) ||
          f.source_url.toLowerCase().includes(q) ||
          f.country.toLowerCase().includes(q),
      );
    }
    return list;
  }, [deadLinks, warningLinks, uncheckedLinks, filter, search]);

  return (
    <div className="space-y-5">
      {/* Header + scan button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-sentiqs-navy">{t('dashboard.settings.links.title')}</h2>
          <p className="text-[10px] text-sentiqs-gray-text mt-0.5">{t('dashboard.settings.links.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={runScan}
          disabled={scanning}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sentiqs-navy text-white text-xs font-semibold hover:bg-sentiqs-navy/90 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scanning ? (
            <>
              <i className="ri-loader-4-line animate-spin text-xs" />
              {t('dashboard.settings.links.scanning')}
            </>
          ) : (
            <>
              <i className="ri-shield-check-line text-xs" />
              {t('dashboard.settings.links.scanNow')}
            </>
          )}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="text-[10px] text-sentiqs-gray-text mb-1">{t('dashboard.settings.links.totalChecked')}</div>
          <div className="text-xl font-bold text-sentiqs-navy">{counts.active + counts.warning + counts.dead}</div>
        </div>
        <div className="bg-white rounded-lg border border-emerald-200 p-3">
          <div className="text-[10px] text-emerald-700 mb-1">{t('dashboard.settings.links.rssValidated')}</div>
          <div className="text-xl font-bold text-emerald-700">{counts.rss_validated}</div>
          <div className="text-[9px] text-emerald-600 mt-0.5">{t('dashboard.settings.links.rssValidatedDesc')}</div>
        </div>
        <div className="bg-white rounded-lg border border-amber-200 p-3">
          <div className="text-[10px] text-amber-700 mb-1">{t('dashboard.settings.links.articlesIndexed')}</div>
          <div className="text-xl font-bold text-amber-700">{counts.total_articles.toLocaleString('fr-FR')}</div>
          <div className="text-[9px] text-amber-600 mt-0.5">{t('dashboard.settings.links.articlesDetectedDesc')}</div>
        </div>
        <div className="bg-white rounded-lg border border-red-200 p-3">
          <div className="text-[10px] text-red-700 mb-1">{t('dashboard.settings.links.deadLinks')}</div>
          <div className="text-xl font-bold text-red-700">{counts.dead}</div>
        </div>
      </div>

      {/* Schedule controls */}
      <div className="bg-white rounded-lg border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
              <i className="ri-timer-line text-teal-600 text-lg" />
            </div>
            <div>
              <div className="text-xs font-bold text-sentiqs-navy">
                {isFr ? 'Scan automatique programmé' : 'Scheduled Auto-Scan'}
              </div>
              <p className="text-[10px] text-sentiqs-gray-text mt-0.5">
                {isFr
                  ? 'Lance un scan complet automatiquement à intervalle régulier'
                  : 'Automatically runs a full scan at regular intervals'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Interval selector */}
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-full p-1">
              {[6, 12, 24].map((h) => (
                <button
                  key={h}
                  type="button"
                  disabled={!schedule.enabled || scheduleLoading}
                  onClick={() => setScheduleInterval(h)}
                  className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    schedule.interval_hours === h
                      ? 'bg-white text-sentiqs-navy shadow-sm'
                      : 'text-sentiqs-gray-text hover:text-sentiqs-navy'
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>

            {/* Toggle */}
            <button
              type="button"
              disabled={scheduleLoading}
              onClick={() => toggleSchedule(!schedule.enabled)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                schedule.enabled ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  schedule.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Schedule status line */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap text-[10px]">
          {schedule.enabled ? (
            <>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                <i className="ri-checkbox-circle-line text-[9px]" />
                {isFr ? 'Activé' : 'Active'}
              </span>
              <span className="text-sentiqs-gray-text">
                {isFr ? 'Prochain scan :' : 'Next scan:'}{' '}
                <strong className="text-sentiqs-navy">
                  {schedule.next_run ? formatDate(schedule.next_run) : '—'}
                </strong>
              </span>
              <span className="text-sentiqs-gray-text">
                ·
              </span>
              <span className="text-sentiqs-gray-text">
                {isFr ? 'Toutes les' : 'Every'}{' '}
                <strong className="text-sentiqs-navy">{schedule.interval_hours}h</strong>
              </span>
              {schedule.is_due && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                  <i className="ri-timer-flash-line text-[9px]" />
                  {isFr ? 'Scan dû — sera lancé automatiquement' : 'Due — will run automatically'}
                </span>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">
              <i className="ri-pause-circle-line text-[9px]" />
              {isFr ? 'Désactivé — scan manuel uniquement' : 'Disabled — manual scan only'}
            </span>
          )}
          {schedule.last_run && (
            <>
              <span className="text-sentiqs-gray-text">·</span>
              <span className="text-sentiqs-gray-text">
                {isFr ? 'Dernier scan auto :' : 'Last auto-scan:'}{' '}
                <strong className="text-sentiqs-navy">{formatDate(schedule.last_run)}</strong>
              </span>
            </>
          )}
        </div>

        {/* Auto-scan just ran notification */}
        {scanSummary && schedule.enabled && (
          <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <i className="ri-sparkling-line text-emerald-600 text-xs" />
            <span className="text-[10px] text-emerald-700 font-semibold">
              {isFr
                ? `Scan automatique terminé : ${scanSummary.active} actifs, ${scanSummary.warning} warnings, ${scanSummary.dead} morts`
                : `Auto-scan complete: ${scanSummary.active} active, ${scanSummary.warning} warnings, ${scanSummary.dead} dead`}
            </span>
          </div>
        )}
      </div>

      {/* Anti-hallucination info banner */}
      <div className="bg-primary-50/60 border border-primary-200/60 rounded-lg px-4 py-3 flex items-start gap-3">
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
          <i className="ri-shield-check-line text-primary-700 text-sm" />
        </div>
        <div>
          <div className="text-[11px] font-semibold text-primary-800 mb-0.5">{t('dashboard.settings.links.antiHallucinationTitle')}</div>
          <p className="text-[10px] text-primary-700 leading-relaxed">
            {t('dashboard.settings.links.antiHallucinationDesc')}
          </p>
        </div>
      </div>

      {/* Last scan info */}
      <div className="flex items-center gap-2 text-[10px] text-sentiqs-gray-text">
        <i className="ri-time-line text-[10px]" />
        {t('dashboard.settings.links.lastCheck')} : {lastScan ? formatDate(lastScan) : t('dashboard.settings.links.never')}
        {scanSummary && (
          <span className="text-primary-700 font-semibold ml-2">
            — {t('dashboard.settings.links.scanComplete', {
              active: scanSummary.active,
              warning: scanSummary.warning,
              dead: scanSummary.dead,
            })}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700">
          <i className="ri-error-warning-line mr-1.5" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !scanning && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex-1 min-w-[200px]">
          <i className="ri-search-line text-sentiqs-gray-text text-sm mr-2" />
          <input
            type="text"
            placeholder={t('dashboard.settings.links.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-sentiqs-navy placeholder:text-gray-400 focus:outline-none w-full"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['dead', 'unchecked', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                filter === f
                  ? 'bg-sentiqs-navy text-white border-sentiqs-navy'
                  : 'bg-white text-sentiqs-gray-text border-gray-200 hover:border-gray-300'
              }`}
            >
              {f === 'dead' && t('dashboard.settings.links.deadFilter', { count: counts.dead })}
              {f === 'unchecked' && t('feeds.linkStatus.unchecked') + ` (${counts.unchecked})`}
              {f === 'all' && t('dashboard.settings.links.allIssues')}
            </button>
          ))}
        </div>
      </div>

      {/* Results table */}
      <div className="bg-white rounded-lg border border-gray-100 divide-y divide-gray-50">
        {filtered.length === 0 && !loading && (
          <div className="py-8 text-center text-sentiqs-gray-text text-xs">
            <i className="ri-check-double-line text-2xl block mb-2 text-emerald-500" />
            {filter === 'dead'
              ? t('dashboard.settings.links.noDead')
              : filter === 'unchecked'
              ? t('dashboard.settings.links.allVerified')
              : t('dashboard.settings.links.noIssues')}
          </div>
        )}

        {filtered.map((feed) => (
          <div key={feed.id} className="px-5 py-3 hover:bg-gray-50/50 transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-lg bg-sentiqs-navy/5 flex items-center justify-center">
                  <i className="ri-link-m text-sentiqs-navy text-sm" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {statusBadge(feed.source_status)}
                  {feed.rss_validated && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                      <i className="ri-rss-line text-[9px]" />
                      {t('dashboard.settings.links.rssValidatedBadge')}
                    </span>
                  )}
                  {feed.nb_articles_last_check != null && feed.nb_articles_last_check > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border bg-gray-50 text-gray-600 border-gray-200">
                      {t('dashboard.settings.links.articlesBadge', { count: feed.nb_articles_last_check })}
                    </span>
                  )}
                  {feed.link_check_error && (
                    <span className="text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      {feed.link_check_error.length > 60 ? feed.link_check_error.substring(0, 60) + '…' : feed.link_check_error}
                    </span>
                  )}
                  <span className="text-[10px] text-sentiqs-gray-text">
                    {formatDate(feed.last_link_check)}
                  </span>
                </div>
                <a
                  href={feed.source_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-sm font-semibold text-sentiqs-navy leading-relaxed hover:text-sentiqs-blue transition-colors cursor-pointer block"
                >
                  {feed.title}
                  <i className="ri-external-link-line text-[11px] ml-1.5 align-middle text-sentiqs-gray-text" />
                </a>
                <div className="flex items-center gap-3 mt-1 flex-wrap text-[10px] text-sentiqs-gray-text">
                  <span>{feed.source}</span>
                  <span>{feed.country}</span>
                  <span className="font-mono text-[9px] text-gray-400 truncate max-w-[300px]">
                    {feed.source_url}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}