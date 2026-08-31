import { CountryAlertLevel, LEVEL_BG, LEVEL_DOT, LEVEL_HEADER, LEVEL_HEADER_TEXT, LEVEL_COLORS } from '@/hooks/useAlertLevels';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { formatTimeSince } from '@/utils/timeFormat';
import { SEVERITY_DOT } from '@/utils/severityColors';

interface Props {
  data: CountryAlertLevel;
  compact?: boolean;
}

function formatShortDate(ts: string): string {
  const d = new Date(ts);
  const loc = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  return d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
}

export default function CountryAlertCard({ data, compact = false }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith('/preview') ? '/preview' : '/dashboard';
  const isFr = i18n.language.startsWith('fr');

  const handleClick = () => {
    navigate(`${base}/alerts/country/${data.countryCode}`);
  };

  // ── MODE COMPACT ──
  if (compact) {
    return (
      <div
        className={`rounded-lg border overflow-hidden flex flex-col ${LEVEL_BG[data.level] || 'bg-white border-gray-100'} anim-entry-up cursor-pointer hover:shadow-md transition-shadow`}
        onClick={handleClick}
      >
        <div className={`${LEVEL_HEADER[data.level] || 'bg-gray-500'} ${LEVEL_HEADER_TEXT[data.level] || 'text-white'} px-3 py-2 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-white/20 flex items-center justify-center text-[10px] font-bold tracking-wider">
              {data.countryCode}
            </div>
            <span className="text-xs font-bold truncate max-w-[100px]">{data.country}</span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider">{data.level}</span>
        </div>
        <div className="px-3 py-2 flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">{isFr ? 'Score' : 'Score'}</span>
            <span className="text-sm font-bold text-sentiqs-navy">
              {data.score.toFixed(1)}<span className="text-[9px] text-gray-400 font-normal">/100</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">{t('dashboard.incidents')}</span>
            <span className="text-[10px] font-semibold text-gray-700">{data.incidents}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">{t('common.verifiedCount')}</span>
            <span className="text-[10px] font-semibold text-emerald-600">{data.verifiedCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">{isFr ? 'Tendance' : 'Trend'}</span>
            <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${
              data.trend === 'up' ? 'text-red-600' : data.trend === 'down' ? 'text-emerald-600' : 'text-gray-400'
            }`}>
              <i className={`text-[9px] ${data.trend === 'up' ? 'ri-arrow-up-line' : data.trend === 'down' ? 'ri-arrow-down-line' : 'ri-subtract-line'}`} />
              {data.trendDelta !== 0 ? (data.trendDelta > 0 ? '+' : '') + data.trendDelta : '—'}
            </span>
          </div>
          {data.latestIncidentAt && (
            <p className="text-[9px] text-gray-400 truncate pt-0.5 border-t border-gray-100">
              {new Date(data.latestIncidentAt).toLocaleDateString(
                i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US',
                { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
              )}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── MODE DÉTAILLÉ ──
  const bgClass = LEVEL_BG[data.level];
  const headerBg = LEVEL_HEADER[data.level];
  const headerText = LEVEL_HEADER_TEXT[data.level];
  const badgeClass = LEVEL_COLORS[data.level];

  const incidents = data.triggeringIncidents;
  const showScroll = incidents.length > 8;

  const aggravantLabels: Record<string, string> = {
    humanitarian_break: isFr ? 'Rupture humanitaire' : 'Humanitarian disruption',
    capital_attack: isFr ? 'Attaque capitale' : 'Capital attack',
    diplomatic_break: isFr ? 'Rupture diplomatique' : 'Diplomatic breakdown',
    flooding: isFr ? 'Inondations' : 'Flooding',
  };

  return (
    <div className={`rounded-lg border overflow-hidden flex flex-col ${bgClass} anim-entry-up cursor-pointer hover:shadow-md transition-shadow`} onClick={handleClick}>
      {/* Header */}
      <div className={`${headerBg} ${headerText} px-4 py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-white/20 flex items-center justify-center text-xs font-bold tracking-wider">
              {data.countryCode}
            </div>
            <div>
              <h3 className="text-sm font-bold">{data.country}</h3>
              <p className="text-[10px] text-white/80 mt-0.5">
                {isFr ? 'Dernier incident suivi :' : 'Latest incident:'}{' '}
                {data.latestIncidentAt ? formatTimeSince(data.latestIncidentAt, i18n.language) : '—'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className={`inline-block px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
              {data.level.toUpperCase()}
            </span>
            <p className="text-[10px] text-white/80 mt-1 font-medium">{data.levelLabel}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[10px] text-white/70">
            {isFr ? 'Dernier incident vérifié/corroboré :' : 'Latest verified incident:'}{' '}
            {data.latestIncidentVerifiedAt
              ? new Date(data.latestIncidentVerifiedAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-US')
              : '—'}
          </p>
          <p className="text-sm font-bold">
            Score : <span className="text-white">{data.score.toFixed(1)}</span>/100
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-4 py-2 bg-white/60 border-b border-black/5 flex items-center gap-3 flex-wrap text-[10px]">
        <span className="font-semibold text-gray-700">{isFr ? 'Incidents :' : 'Incidents:'} <span className="text-sentiqs-navy">{data.incidents}</span></span>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-700">{t('common.verifiedCount')} : <span className="text-emerald-600">{data.verifiedCount}</span></span>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-700">Score : <span className="text-sentiqs-navy">{data.score.toFixed(1)}</span>/100</span>
      </div>

      {/* Content */}
      <div className="px-4 py-3 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Incidents déclencheurs */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
              {isFr ? `INCIDENTS DÉCLENCHEURS (${incidents.length})` : `TRIGGERING INCIDENTS (${incidents.length})`}
            </h4>
            <div className={`space-y-2 ${showScroll ? 'max-h-64 overflow-y-auto pr-1' : ''}`}>
              {incidents.map((inc) => (
                <div key={inc.id} className="flex items-start gap-2">
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${SEVERITY_DOT[inc.severity]}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-sentiqs-navy leading-snug break-words">
                      <span className="text-gray-400 mr-1">{formatShortDate(inc.timestamp)}</span>
                      {inc.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                        inc.verified ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {inc.verified ? t('common.verifiedBadge') : t('common.unverifiedBadge')}
                      </span>
                      <span className="text-[9px] text-gray-400">{inc.source}</span>
                      {inc.locality && (
                        <span className="text-[9px] text-gray-400">{inc.locality}</span>
                      )}
                      <span className="text-[9px] font-semibold text-gray-500 uppercase">{t(`dashboard.severity.${inc.severity}`)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {incidents.length === 0 && (
                <p className="text-[11px] text-gray-400 italic">{t('dashboard.countryCard.empty')}</p>
              )}
            </div>
          </div>

          {/* Mesures de protection */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
              {t('dashboard.countryCard.protectionMeasures')}
            </h4>
            <div className="space-y-3">
              <div>
                <h5 className="text-[10px] font-bold text-sentiqs-navy uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                  <i className="ri-user-star-line text-xs" />
                  {isFr ? 'EXPATRIÉS / ÉTRANGERS' : 'EXPATS / FOREIGNERS'}
                </h5>
                <ul className="space-y-1">
                  {data.protectionMeasures.slice(0, 3).map((m, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-700">
                      <i className="ri-check-line text-emerald-500 text-xs mt-0.5 flex-shrink-0" />
                      <span className="break-words">{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="text-[10px] font-bold text-sentiqs-navy uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                  <i className="ri-team-line text-xs" />
                  {isFr ? 'PERSONNEL LOCAL' : 'LOCAL STAFF'}
                </h5>
                <ul className="space-y-1">
                  {data.protectionMeasures.slice(3).map((m, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-700">
                      <i className="ri-check-line text-emerald-500 text-xs mt-0.5 flex-shrink-0" />
                      <span className="break-words">{m}</span>
                    </li>
                  ))}
                  {data.protectionMeasures.length <= 3 && (
                    <li className="flex items-start gap-1.5 text-[11px] text-gray-700">
                      <i className="ri-check-line text-emerald-500 text-xs mt-0.5 flex-shrink-0" />
                      <span className="break-words">{t('dashboard.countryCard.defaultMeasure')}</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* Facteurs aggravants */}
            {Object.keys(data.aggravatingFactorsBreakdown).length > 0 && (
              <div className="mt-3 pt-3 border-t border-black/5">
                <h5 className="text-[10px] font-bold text-red-700 uppercase tracking-wide mb-1.5">
                  {isFr ? 'FACTEURS AGGRAVANTS' : 'AGGRAVATING FACTORS'}
                </h5>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(data.aggravatingFactorsBreakdown).map(([factor, count]) => (
                    <span
                      key={factor}
                      className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded text-[9px] font-semibold"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT.rouge}`} />
                      {aggravantLabels[factor] || factor}
                      {count > 1 && <span className="text-red-400">×{count}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}