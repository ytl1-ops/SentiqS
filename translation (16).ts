import { useNavigate, useLocation } from 'react-router-dom';
import type { CountryAlertLevel } from '@/hooks/useAlertLevels';
import EmptyState from '@/components/base/EmptyState';

interface CriticalSituationsProps {
  levels: CountryAlertLevel[];
}

function getRecommendation(level: CountryAlertLevel['level'], score: number): string {
  if (level === 'rouge') {
    if (score >= 70) return 'Évacuation immédiate ou confinement strict. Contact consulaire sous 1h.';
    return 'Déplacements interdits. Confinement recommandé.';
  }
  if (level === 'orange') {
    if (score >= 45) return 'Déplacements limités aux stricts besoins. Escorte armée obligatoire.';
    return 'Suspension des déplacements non essentiels. Vérification itinéraires.';
  }
  return '';
}

export default function CriticalSituations({ levels }: CriticalSituationsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith('/preview') ? '/preview' : '/dashboard';

  const rouges = levels.filter((l) => l.level === 'rouge');
  const oranges = levels.filter((l) => l.level === 'orange');
  const allCritical = [...rouges, ...oranges];

  if (allCritical.length === 0) {
    return (
      <EmptyState
        icon="ri-check-double-line"
        title="Aucune situation critique ou à haut risque actuellement."
        iconClassName="text-emerald-500"
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-sentiqs-navy flex items-center gap-2">
          <i className="ri-error-warning-line text-red-600" />
          Situations critiques & à risque
        </h2>
        <span className="text-[10px] font-semibold text-gray-400">
          {rouges.length} critiques · {oranges.length} risque élevé
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {allCritical.map((country) => {
          const isRouge = country.level === 'rouge';
          const rec = getRecommendation(country.level, country.score);
          const latestIncident = country.triggeringIncidents[0];
          const borderColor = isRouge ? 'border-red-200' : 'border-orange-200';
          const badgeBg = isRouge ? 'bg-red-700 text-white' : 'bg-orange-600 text-white';
          const badgeLabel = isRouge ? 'ACTION IMMÉDIATE' : 'SURVEILLANCE';
          const recBg = isRouge ? 'bg-red-50 border-red-100 text-red-800' : 'bg-orange-50 border-orange-100 text-orange-800';
          const dotBg = isRouge ? 'bg-red-700' : 'bg-orange-600';

          return (
            <div
              key={country.countryCode}
              className={`bg-white rounded-lg border ${borderColor} p-3 cursor-pointer hover:shadow-sm transition-shadow`}
              onClick={() => navigate(`${base}/alerts/country/${country.countryCode}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`${base}/alerts/country/${country.countryCode}`); }}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg ${dotBg} text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0`}>
                  {country.countryCode}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-900">{country.country}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${badgeBg}`}>{badgeLabel}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Score {country.score}/100 · {country.incidents} incidents ({country.incidentsBySeverity.critical} critiques)
                  </div>
                  {latestIncident && (
                    <div className={`text-[10px] mt-1 truncate ${isRouge ? 'text-red-700' : 'text-orange-700'}`}>
                      <i className="ri-time-line mr-1" />
                      {new Date(latestIncident.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} — {latestIncident.title}
                    </div>
                  )}
                  {rec && (
                    <div className={`mt-2 p-1.5 rounded border text-[10px] font-medium ${recBg}`}>
                      <i className="ri-shield-check-line mr-1" />
                      {rec}
                    </div>
                  )}
                  {isRouge && country.protectionMeasures.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {country.protectionMeasures.map((m, i) => (
                        <span key={i} className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded border border-red-200">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}