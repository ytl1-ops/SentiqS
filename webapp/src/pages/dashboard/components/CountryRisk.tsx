import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVeille, risquePays } from '@/lib/veille';

const riskBadge: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-amber-100 text-amber-700',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-emerald-100 text-emerald-700',
};

const riskDot: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-amber-500',
  medium: 'bg-sentiqs-blue',
  low: 'bg-emerald-400',
};

export default function CountryRisk() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { articles, loading } = useVeille();
  const countryRiskLevels = risquePays(articles);

  if (loading) {
    return <div className="bg-white rounded-xl border border-gray-100 p-4 h-64 animate-pulse" />;
  }

  const display = expanded ? countryRiskLevels : countryRiskLevels.slice(0, 6);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h3 className="text-sm font-bold text-sentiqs-navy mb-3">{t('dashboard.countries.title')}</h3>
      {countryRiskLevels.length === 0 && (
        <p className="text-xs text-sentiqs-gray-text py-6 text-center">
          Aucun pays évalué : la collecte n'a encore remonté aucun signal.
        </p>
      )}
      <div className="space-y-2">
        {display.map((c) => (
          <div key={c.code} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
            <div className="flex-shrink-0">
              <div className={`w-2 h-2 rounded-full ${riskDot[c.risk]}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sentiqs-navy truncate">{c.country}</p>
              <p className="text-[9px] text-sentiqs-gray-text">{c.region}</p>
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${riskBadge[c.risk]}`}>
              {t(`dashboard.risk.${c.risk}`)}
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
        {expanded ? 'Réduire ▲' : `Voir tout (${countryRiskLevels.length}) ▼`}
      </button>
    </div>
  );
}