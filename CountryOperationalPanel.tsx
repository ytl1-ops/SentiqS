import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LEVEL_BADGES } from '@/utils/postureUtils';
import type { CountryAlertLevel } from '@/hooks/useAlertLevels';

type SortKey = 'score' | 'incidents' | 'critical' | 'country';
type SortDir = 'asc' | 'desc';

interface SituationMatrixProps {
  levels: CountryAlertLevel[];
}

export default function SituationMatrix({ levels }: SituationMatrixProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith('/preview') ? '/preview' : '/dashboard';
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  const sorted = useMemo(() => {
    let filtered = levels;
    if (levelFilter !== 'all') {
      filtered = levels.filter((l) => l.level === levelFilter);
    }

    return [...filtered].sort((a, b) => {
      let valA: number | string;
      let valB: number | string;

      switch (sortKey) {
        case 'score': valA = a.score; valB = b.score; break;
        case 'incidents': valA = a.incidents; valB = b.incidents; break;
        case 'critical': valA = a.incidentsBySeverity.critical; valB = b.incidentsBySeverity.critical; break;
        case 'country': valA = a.country; valB = b.country; break;
        default: valA = a.score; valB = b.score;
      }

      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
      }
      return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [levels, sortKey, sortDir, levelFilter]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function SortIcon({ colKey }: { colKey: SortKey }) {
    if (sortKey !== colKey) return <i className="ri-arrow-up-down-line text-gray-300 text-[10px]" />;
    return sortDir === 'asc' ? <i className="ri-arrow-up-line text-sentiqs-navy text-[10px]" /> : <i className="ri-arrow-down-line text-sentiqs-navy text-[10px]" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-sm font-bold text-sentiqs-navy flex items-center gap-2">
          <i className="ri-table-line text-sentiqs-blue" />
          Matrice de situation — 54 pays
        </h2>
        <div className="flex items-center gap-1.5">
          {['all', 'rouge', 'orange', 'jaune', 'vert'].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevelFilter(levelFilter === lvl ? 'all' : lvl)}
              className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wide border transition-colors whitespace-nowrap ${
                levelFilter === lvl
                  ? lvl === 'all' ? 'bg-sentiqs-navy text-white border-sentiqs-navy' : `${LEVEL_BADGES[lvl].bg} ${LEVEL_BADGES[lvl].text} border-transparent`
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {lvl === 'all' ? 'Tous' : LEVEL_BADGES[lvl].label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  <button type="button" onClick={() => toggleSort('country')} className="flex items-center gap-1 hover:text-sentiqs-navy transition-colors">
                    Pays <SortIcon colKey="country" />
                  </button>
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Niveau</th>
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  <button type="button" onClick={() => toggleSort('score')} className="flex items-center gap-1 hover:text-sentiqs-navy transition-colors">
                    Score <SortIcon colKey="score" />
                  </button>
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                  <button type="button" onClick={() => toggleSort('incidents')} className="flex items-center gap-1 hover:text-sentiqs-navy transition-colors">
                    Incidents <SortIcon colKey="incidents" />
                  </button>
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                  <button type="button" onClick={() => toggleSort('critical')} className="flex items-center gap-1 hover:text-sentiqs-navy transition-colors">
                    Critiques <SortIcon colKey="critical" />
                  </button>
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Sévérités</th>
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide hidden xl:table-cell">Dernier incident</th>
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((country) => {
                const badge = LEVEL_BADGES[country.level];
                const latest = country.triggeringIncidents[0];

                return (
                  <tr
                    key={country.countryCode}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`${base}/alerts/country/${country.countryCode}`)}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded bg-gray-100 text-gray-600 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                          {country.countryCode}
                        </span>
                        <span className="text-xs font-semibold text-gray-900">{country.country}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              country.level === 'rouge' ? 'bg-red-600' : country.level === 'orange' ? 'bg-orange-500' : country.level === 'jaune' ? 'bg-yellow-400' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${Math.min(100, (country.score / 95) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-700">{country.score}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <span className="text-xs text-gray-600">{country.incidents}</span>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <span className={`text-xs font-bold ${country.incidentsBySeverity.critical > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {country.incidentsBySeverity.critical}
                      </span>
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      <div className="flex items-center gap-1">
                        {country.incidentsBySeverity.critical > 0 && (
                          <span className="w-2 h-2 rounded-full bg-red-600" title={`${country.incidentsBySeverity.critical} critiques`} />
                        )}
                        {country.incidentsBySeverity.high > 0 && (
                          <span className="w-2 h-2 rounded-full bg-orange-500" title={`${country.incidentsBySeverity.high} élevés`} />
                        )}
                        {country.incidentsBySeverity.medium > 0 && (
                          <span className="w-2 h-2 rounded-full bg-yellow-400" title={`${country.incidentsBySeverity.medium} modérés`} />
                        )}
                        {country.incidentsBySeverity.low > 0 && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" title={`${country.incidentsBySeverity.low} faibles`} />
                        )}
                        {country.incidents === 0 && <span className="text-[10px] text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden xl:table-cell">
                      {latest ? (
                        <span className="text-[10px] text-gray-500">
                          {new Date(latest.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`${base}/alerts/country/${country.countryCode}`);
                        }}
                        className="text-[10px] text-sentiqs-blue hover:text-sentiqs-navy font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
                      >
                        <i className="ri-eye-line" />
                        Détail
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t border-gray-100 text-[10px] text-gray-400">
          {sorted.length} pays affichés · Tri: {sortKey === 'score' ? 'Score' : sortKey === 'incidents' ? 'Incidents' : sortKey === 'critical' ? 'Critiques' : 'Pays'} ({sortDir === 'desc' ? '↓' : '↑'})
        </div>
      </div>
    </div>
  );
}