import { CountryAlertLevel, TriggeringIncident, LEVEL_BADGE_BORDERED } from '@/hooks/useAlertLevels';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import CountryAlertCard from './CountryAlertCard';
import EmptyState from '@/components/base/EmptyState';
import { SEVERITY_STRIPE, SEVERITY_BADGE } from '@/utils/severityColors';

interface Props {
  levels: CountryAlertLevel[];
  levelFilter: string;
}

function formatDateLong(ts: string): string {
  const d = new Date(ts);
  const isFr = i18n.language.startsWith('fr');
  const loc = isFr ? 'fr-FR' : 'en-US';
  return d.toLocaleDateString(loc, { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  const loc = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
}

export default function AlertsUnifiedView({ levels, levelFilter }: Props) {
  const { t } = useTranslation();

  const filtered = levelFilter === 'all'
    ? levels
    : levels.filter((l) => l.level === levelFilter);

  // ── Timeline : collecter tous les incidents des pays filtrés ──
  const allIncidents: (TriggeringIncident & { country: string; level: string; score: number })[] = [];
  filtered.forEach((l) => {
    l.triggeringIncidents.forEach((inc) => {
      allIncidents.push({ ...inc, country: l.country, level: l.level, score: l.score });
    });
  });
  allIncidents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Grouper par date
  const byDate = new Map<string, typeof allIncidents>();
  allIncidents.forEach((inc) => {
    const dateKey = new Date(inc.timestamp).toISOString().split('T')[0];
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(inc);
  });
  const sortedDates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon="ri-shield-check-line"
        title={t('dashboard.noCountriesLevel')}
        description=""
      />
    );
  }

  const featured = filtered.filter((l) => l.level === 'rouge' || l.level === 'orange').slice(0, 4);
  const showFeatured = levelFilter === 'all' && featured.length > 0;
  const remaining = showFeatured ? filtered.filter((l) => !featured.includes(l)) : filtered;

  return (
    <div className="space-y-6">
      {/* ── Section 1 : Pays en alerte critique (top 4) ── */}
      {showFeatured && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <i className="ri-fire-line text-red-500 text-sm" />
            <span className="text-xs font-bold text-sentiqs-navy">{t('dashboard.top4Sensitive')}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {featured.map((level) => (
              <CountryAlertCard key={`featured-${level.country}`} data={level} compact />
            ))}
          </div>
        </div>
      )}

      {/* ── Section 2 : Grille complète des pays ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <i className="ri-map-pin-2-line text-sentiqs-navy text-sm" />
          <span className="text-xs font-bold text-sentiqs-navy">
            {showFeatured
              ? `${t('dashboard.otherCountries')} (${remaining.length})`
              : `${t('dashboard.allCountries')} (${filtered.length})`}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {remaining.map((level) => (
            <CountryAlertCard key={level.country} data={level} compact />
          ))}
        </div>
      </div>

      {/* ── Section 3 : Chronologie des incidents ── */}
      {sortedDates.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
            <i className="ri-time-line text-sentiqs-navy text-sm" />
            <span className="text-xs font-bold text-sentiqs-navy">
              {t('dashboard.alerts.chronology')} ({allIncidents.length} {t('dashboard.incidents').toLowerCase()})
            </span>
          </div>

          <div className="space-y-5">
            {sortedDates.slice(0, 10).map((dateKey) => {
              const incidents = byDate.get(dateKey)!;
              const isToday = dateKey === new Date().toISOString().split('T')[0];
              return (
                <div key={dateKey}>
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className="w-7 h-7 rounded-full bg-sentiqs-navy text-white flex items-center justify-center text-[10px] font-bold">
                      {new Date(dateKey).getDate()}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-sentiqs-navy">
                        {isToday ? t('dashboard.alertChronology.today') : formatDateLong(dateKey)}
                      </h3>
                      <p className="text-[9px] text-gray-400">{incidents.length} incident{incidents.length > 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="space-y-1.5 ml-3.5 border-l-2 border-gray-100 pl-3.5">
                    {incidents.map((inc) => (
                      <div
                        key={`${inc.country}-${inc.id}`}
                        className={`bg-white rounded-lg border border-gray-100 p-2.5 ${SEVERITY_STRIPE[inc.severity]}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${LEVEL_BADGE_BORDERED[inc.level]}`}>
                                {inc.level.toUpperCase()}
                              </span>
                              <span className="text-[9px] font-semibold text-sentiqs-navy">{inc.country}</span>
                              <span className="text-[9px] text-gray-400">{formatTime(inc.timestamp)}</span>
                              <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-semibold ${
                                inc.verified ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-500'
                              }`}>
                                {inc.verified ? t('common.verifiedBadge') : t('common.unverifiedBadge')}
                              </span>
                            </div>
                            <p className="text-[11px] text-sentiqs-navy mt-1 break-words leading-relaxed">
                              {inc.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-[9px] text-gray-400">{inc.source}</span>
                              {inc.locality && (
                                <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
                                  <i className="ri-map-pin-line text-[8px]" />
                                  {inc.locality}
                                </span>
                              )}
                              <span className={`text-[8px] font-semibold px-1 py-0.5 rounded ${SEVERITY_BADGE[inc.severity]}`}>
                                {t(`common.severity.${inc.severity}`)}
                              </span>
                              <span className="text-[9px] text-gray-400">{t('dashboard.alertChronology.countryScore', { score: inc.score.toFixed(1) })}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {sortedDates.length > 10 && (
              <p className="text-center text-[10px] text-gray-400 py-2">
                + {allIncidents.length - sortedDates.slice(0, 10).reduce((sum, d) => sum + (byDate.get(d)?.length || 0), 0)} incidents {t('dashboard.alerts.older')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}