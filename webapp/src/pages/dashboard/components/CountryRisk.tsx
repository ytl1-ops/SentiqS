import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCountryPosture } from '@/hooks/useCountryPosture';

const riskBadge: Record<string, string> = {
  rouge: 'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  jaune: 'bg-amber-100 text-amber-700',
  vert: 'bg-emerald-100 text-emerald-700',
  non_cote: 'bg-gray-100 text-gray-500',
};

const riskDot: Record<string, string> = {
  rouge: 'bg-red-500',
  orange: 'bg-orange-500',
  jaune: 'bg-amber-500',
  vert: 'bg-emerald-400',
  non_cote: 'bg-gray-300',
};

export default function CountryRisk() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { postures, loading } = useCountryPosture();

  if (loading) {
    return <div className="bg-white rounded-xl border border-gray-100 p-4 h-64 animate-pulse" />;
  }

  const display = expanded ? postures : postures.slice(0, 6);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h3 className="text-sm font-bold text-sentiqs-navy mb-3">{t('dashboard.countries.title')}</h3>
      {postures.length === 0 && (
        <p className="text-xs text-sentiqs-gray-text py-6 text-center">
          Aucun pays évalué : country_posture_state est vide ou inaccessible.
        </p>
      )}
      <div className="space-y-2">
        {display.map((c) => (
          <div key={c.code} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
            <div className="flex-shrink-0">
              <div className={`w-2 h-2 rounded-full ${riskDot[c.level]}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sentiqs-navy truncate">{c.name}</p>
              <p className="text-[9px] text-sentiqs-gray-text">{c.region}</p>
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${riskBadge[c.level]}`}>
              {t(`dashboard.posture.${c.level}`)}
            </span>
            <span className="text-[10px] font-mono text-sentiqs-gray-text w-5 text-center">{c.alerts}</span>
            <span className={`text-[10px] font-bold w-6 text-right ${
              c.trend.startsWith('+') ? 'text-red-500' : c.trend.startsWith('-') ? 'text-emerald-500' : 'text-sentiqs-gray-text'
            }`}>
              {c.trend}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full mt-2 text-[10px] text-sentiqs-blue hover:text-sentiqs-blue-dark font-medium text-center py-1 transition-colors"
      >
        {expanded ? 'Réduire ▲' : `Voir tout (${postures.length}) ▼`}
      </button>
    </div>
  );
}
