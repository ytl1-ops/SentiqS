import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAllPostureHistory } from '@/hooks/usePostureHistory';
import { AFRICA_54, COUNTRY_CODES } from '@/hooks/useAlertLevels';
import EmptyState from '@/components/base/EmptyState';
import { LEVEL_BG, LEVEL_DOT_BG, getPostureLabel, getDirection } from '@/utils/postureUtils';
import type { PostureHistoryEntry } from '@/hooks/usePostureHistory';

/** Couleurs SVG (hex) pour les dots du chart — restent locales car spécifiques au SVG */
const LEVEL_HEX: Record<string, string> = {
  rouge: '#dc2626',
  orange: '#ea580c',
  jaune: '#ca8a04',
  vert: '#059669',
  non_cote: '#9ca3af',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

interface ScoreChartProps {
  entries: PostureHistoryEntry[];
  countryCode: string;
}

function ScoreChart({ entries, countryCode }: ScoreChartProps) {
  const chartEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    // Build timeline: each entry gives us old_score (start) and new_score (end)
    const points: Array<{ label: string; score: number; level: string; date: string }> = [];

    sorted.forEach((entry, idx) => {
      if (idx === 0) {
        // First entry: show old_score as starting point
        points.push({
          label: 'Début',
          score: entry.old_score,
          level: entry.old_level,
          date: formatDate(entry.created_at),
        });
      }
      // Show new_score as the result
      points.push({
        label: entry.new_level.toUpperCase(),
        score: entry.new_score,
        level: entry.new_level,
        date: formatDate(entry.created_at),
      });
    });

    return points;
  }, [entries]);

  if (chartEntries.length < 2) return null;

  const maxScore = Math.max(100, ...chartEntries.map((p) => p.score));
  const chartHeight = 140;
  const paddingX = 40;
  const chartWidth = 100 - paddingX;

  return (
    <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-100">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">
        <i className="ri-line-chart-line mr-1" />
        Évolution du score
      </h4>

      {/* Y-axis labels */}
      <div className="relative" style={{ height: chartHeight }}>
        <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-[8px] text-gray-400 pr-1">
          <span>{maxScore}</span>
          <span>{Math.round(maxScore * 0.75)}</span>
          <span>{Math.round(maxScore * 0.5)}</span>
          <span>{Math.round(maxScore * 0.25)}</span>
          <span>0</span>
        </div>

        {/* Chart area */}
        <div className="ml-8 relative" style={{ height: chartHeight }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
            <div
              key={pct}
              className="absolute left-0 right-0 border-t border-gray-200"
              style={{ bottom: `${pct * 100}%` }}
            />
          ))}

          {/* Level threshold bands */}
          <div className="absolute left-0 right-0 bg-red-50/50" style={{ bottom: '70%', height: '30%' }} />
          <div className="absolute left-0 right-0 bg-orange-50/30" style={{ bottom: '40%', height: '30%' }} />
          <div className="absolute left-0 right-0 bg-yellow-50/20" style={{ bottom: '15%', height: '25%' }} />

          {/* Level labels */}
          <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-between text-[7px] font-bold opacity-30 pointer-events-none" style={{ paddingTop: '0%', paddingBottom: '0%' }}>
            <span style={{ position: 'absolute', top: '10%' }} className="text-red-600">ROUGE</span>
            <span style={{ position: 'absolute', top: '32%' }} className="text-orange-500">ORANGE</span>
            <span style={{ position: 'absolute', top: '58%' }} className="text-yellow-600">JAUNE</span>
            <span style={{ position: 'absolute', top: '82%' }} className="text-emerald-600">VERT</span>
          </div>

          {/* SVG line + dots */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            {chartEntries.length >= 2 && (() => {
              const points = chartEntries.map((p, i) => {
                const x = chartEntries.length <= 1 ? 50 : (i / (chartEntries.length - 1)) * 100;
                const y = 100 - (p.score / maxScore) * 100;
                return { x, y, level: p.level };
              });

              return (
                <>
                  <polyline
                    points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.7"
                  />
                  {points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r="4"
                      fill={LEVEL_HEX[p.level] || '#9ca3af'}
                      stroke="white"
                      strokeWidth="1.5"
                    />
                  ))}
                </>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="ml-8 mt-1 flex justify-between text-[8px] text-gray-400">
        {chartEntries.map((p, i) => (
          <span key={i} className="text-center whitespace-nowrap" title={p.date}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function PostureTimeline() {
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith('/preview') ? '/preview' : '/dashboard';

  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const { entries, loading } = useAllPostureHistory();

  // Build list of countries that have history entries
  const countriesWithHistory = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(e.country_code));
    return AFRICA_54.filter((c) => set.has(COUNTRY_CODES[c] || '')).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [entries]);

  // Default to first country with history
  const activeCountry = selectedCountry || (countriesWithHistory[0] ? (COUNTRY_CODES[countriesWithHistory[0]] || '') : '');

  // Filter entries for selected country
  const countryEntries = useMemo(() => {
    if (!activeCountry) return [];
    return entries.filter((e) => e.country_code === activeCountry);
  }, [entries, activeCountry]);

  const activeCountryName = useMemo(() => {
    if (!activeCountry) return '';
    const found = AFRICA_54.find((c) => COUNTRY_CODES[c] === activeCountry);
    return found || '';
  }, [activeCountry]);

  // All entries sorted by date for the full timeline
  const timelineEntries = useMemo(() => {
    return [...entries].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [entries]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
        <i className="ri-loader-4-line animate-spin text-gray-400 text-2xl mb-2 block" />
        <p className="text-xs text-gray-500">Chargement de l'historique complet...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Country filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">
          <i className="ri-filter-3-line mr-1" />
          Filtrer par pays :
        </label>
        <select
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:border-sentiqs-navy cursor-pointer min-w-[180px]"
        >
          <option value="">Tous les pays ({countriesWithHistory.length})</option>
          {countriesWithHistory.map((country) => {
            const code = COUNTRY_CODES[country] || '';
            return (
              <option key={code} value={code}>
                {country}
              </option>
            );
          })}
        </select>
        {activeCountry && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${LEVEL_DOT_BG[niveauActif(countryEntries)] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            {countryEntries.length} changement(s)
          </span>
        )}
      </div>

      {/* Per-country score evolution chart */}
      {activeCountry && countryEntries.length >= 2 && (
        <ScoreChart entries={countryEntries} countryCode={activeCountry} />
      )}

      {/* Full chronological timeline */}
      <div className="bg-white rounded-lg border border-gray-100">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600">
            <i className="ri-history-line mr-1.5 text-sentiqs-navy" />
            Chronologie complète
            <span className="ml-2 text-[10px] font-normal normal-case tracking-normal text-gray-400">
              ({timelineEntries.length} entrées)
            </span>
          </h3>
        </div>

        {timelineEntries.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Aucun changement de posture enregistré pour le moment."
            />
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {timelineEntries.map((entry, idx) => {
              const isLast = idx === timelineEntries.length - 1;
              const direction = getDirection(entry.old_level, entry.new_level);

              return (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`${base}/alerts/country/${entry.country_code}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`${base}/alerts/country/${entry.country_code}`); }}
                >
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center flex-shrink-0 pt-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${LEVEL_BG[entry.new_level] || 'bg-gray-400'} ring-2 ring-white`} />
                    {!isLast && <div className="w-px flex-1 min-h-[20px] bg-gray-200 mt-0.5" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-gray-400">
                        {formatDate(entry.created_at)}
                      </span>
                      <span className="text-xs font-bold text-gray-900">{entry.country_name}</span>
                      {entry.event_type === 'manual' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sentiqs-navy/10 text-sentiqs-navy">
                          MANUEL
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 text-xs flex-wrap">
                      <span className="font-semibold text-gray-600">Posture</span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${LEVEL_DOT_BG[entry.old_level] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {getPostureLabel(entry.old_level)}
                      </span>
                      <i className={`text-[10px] ${direction === 'escalation' ? 'ri-arrow-up-line text-red-500' : direction === 'deescalation' ? 'ri-arrow-down-line text-emerald-500' : 'ri-arrow-right-line text-gray-400'}`} />
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${LEVEL_DOT_BG[entry.new_level] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {getPostureLabel(entry.new_level)}
                      </span>
                    </div>

                    {entry.reason && (
                      <p className="mt-1 text-[11px] text-gray-600">{entry.reason}</p>
                    )}

                    <div className="mt-1 flex items-center gap-2 text-[9px] text-gray-400">
                      <span>Score : {entry.old_score} → {entry.new_score}</span>
                      <span>({direction === 'escalation' ? '+' : direction === 'deescalation' ? '−' : ''}{Math.abs(Math.round((entry.new_score - entry.old_score) * 10) / 10)} pts)</span>
                      {entry.analyst_initials && (
                        <>
                          <span>·</span>
                          <span className="font-semibold">{entry.analyst_initials}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function niveauActif(entries: PostureHistoryEntry[]): string {
  if (entries.length === 0) return 'non_cote';
  const latest = entries.reduce((a, b) =>
    new Date(a.created_at).getTime() > new Date(b.created_at).getTime() ? a : b
  );
  return latest.new_level;
}