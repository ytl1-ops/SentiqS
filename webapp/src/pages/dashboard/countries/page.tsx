import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useVeille, risquePays } from '@/lib/veille';
import ShareModal from '@/components/feature/ShareModal';

type RiskLevel = 'all' | 'critical' | 'high' | 'medium' | 'low';

export default function CountriesPage() {
  const { t } = useTranslation();
  const { articles, loading, error, recharger } = useVeille();
  // Seuls les pays effectivement remontés par la collecte apparaissent : la
  // liste n'est pas pré-remplie avec les 54 pays du référentiel.
  const countryRiskLevels = useMemo(() => risquePays(articles), [articles]);
  const [riskFilter, setRiskFilter] = useState<RiskLevel>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string } | null>(null);

  const regions = useMemo(() => {
    const r = new Set(countryRiskLevels.map((c) => c.region));
    return Array.from(r);
  }, [countryRiskLevels]);

  const filteredCountries = useMemo(() => {
    let countries = [...countryRiskLevels];
    if (riskFilter !== 'all') countries = countries.filter((c) => c.risk === riskFilter);
    if (regionFilter !== 'all') countries = countries.filter((c) => c.region === regionFilter);
    return countries;
  }, [countryRiskLevels, riskFilter, regionFilter]);

  const riskBadge = (risk: string) => {
    const map: Record<string, string> = {
      critical: 'bg-red-100 text-red-700 border-red-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
    return map[risk] || '';
  };

  const riskBarColor = (risk: string) => {
    const map: Record<string, string> = {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-emerald-500',
    };
    return map[risk] || 'bg-gray-300';
  };

  const riskWidth = (risk: string) => {
    const map: Record<string, string> = {
      critical: 'w-full',
      high: 'w-3/4',
      medium: 'w-2/4',
      low: 'w-1/4',
    };
    return map[risk] || 'w-0';
  };

  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0, total: countryRiskLevels.length };
    countryRiskLevels.forEach((co) => {
      if (co.risk in c) c[co.risk as keyof typeof c]++;
    });
    return c;
  }, [countryRiskLevels]);

  const selectedData = useMemo(() => {
    if (!selectedCountry) return null;
    return countryRiskLevels.find((c) => c.country === selectedCountry) || null;
  }, [countryRiskLevels, selectedCountry]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-100 h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-sentiqs-gray-text text-xs bg-white rounded-lg border border-gray-100">
        Impossible de charger la collecte : {error}
        <button type="button" onClick={recharger} className="ml-2 text-sentiqs-navy font-semibold underline cursor-pointer">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Share Modal */}
      {shareTarget && (
        <ShareModal
          open={shareModalOpen}
          onClose={() => { setShareModalOpen(false); setShareTarget(null); }}
          itemTitle={shareTarget.title}
          itemType={`Pays ${shareTarget.id}`}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-sentiqs-navy">{t('dashboard.countries')}</h1>
        <p className="text-xs text-sentiqs-gray-text mt-0.5">
          {filteredCountries.length} pays affiché{filteredCountries.length !== 1 ? 's' : ''} — {counts.total} sous surveillance
        </p>
      </div>

      {/* Risk summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: 'critical', label: t('dashboard.risk.critical'), color: 'bg-red-50 border-red-200 text-red-700', count: counts.critical },
          { key: 'high', label: t('dashboard.risk.high'), color: 'bg-orange-50 border-orange-200 text-orange-700', count: counts.high },
          { key: 'medium', label: t('dashboard.risk.medium'), color: 'bg-yellow-50 border-yellow-200 text-yellow-700', count: counts.medium },
          { key: 'low', label: t('dashboard.risk.low'), color: 'bg-emerald-50 border-emerald-200 text-emerald-700', count: counts.low },
        ] as const).map(({ key, label, color, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setRiskFilter(riskFilter === key ? 'all' : key)}
            className={`rounded-lg border p-3 text-left transition-colors ${color} ${riskFilter === key ? 'ring-2 ring-offset-1 ring-current' : 'hover:opacity-80'}`}
          >
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5">{label}</div>
          </button>
        ))}
      </div>

      {/* Region filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setRegionFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors whitespace-nowrap ${
            regionFilter === 'all'
              ? 'bg-sentiqs-navy text-white border-sentiqs-navy'
              : 'bg-white text-sentiqs-gray-text border-gray-200 hover:border-gray-300'
          }`}
        >
          Toutes les régions
        </button>
        {regions.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegionFilter(r)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors whitespace-nowrap ${
              regionFilter === r
                ? 'bg-sentiqs-navy text-white border-sentiqs-navy'
                : 'bg-white text-sentiqs-gray-text border-gray-200 hover:border-gray-300'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Countries grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredCountries.map((country) => (
          <button
            key={country.code}
            type="button"
            onClick={() => setSelectedCountry(selectedCountry === country.country ? null : country.country)}
            className={`bg-white rounded-lg border p-4 text-left transition-all ${
              selectedCountry === country.country
                ? 'border-sentiqs-navy ring-1 ring-sentiqs-navy/20'
                : 'border-gray-100 hover:border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-sentiqs-navy">{country.country}</span>
                  <span className="text-[10px] font-mono text-sentiqs-gray-text bg-gray-100 px-1.5 py-0.5 rounded">{country.code}</span>
                </div>
                <p className="text-[10px] text-sentiqs-gray-text mt-0.5">{country.region}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${riskBadge(country.risk)}`}>
                {t(`dashboard.risk.${country.risk}`)}
              </span>
            </div>

            {/* Risk bar */}
            <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${riskBarColor(country.risk)} ${riskWidth(country.risk)}`} />
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-sm font-bold text-sentiqs-navy">{country.alerts}</div>
                  <div className="text-[9px] text-sentiqs-gray-text uppercase">{t('dashboard.countries.alerts')}</div>
                </div>
                <div className="text-center">
                  <div className={`text-sm font-bold ${country.trend.startsWith('+') ? 'text-red-600' : country.trend.startsWith('-') ? 'text-emerald-600' : 'text-sentiqs-gray-text'}`}>
                    {country.trend}
                  </div>
                  <div className="text-[9px] text-sentiqs-gray-text uppercase">{t('dashboard.countries.trend')}</div>
                </div>
              </div>
              <i className={`text-sentiqs-gray-text text-sm transition-transform ${selectedCountry === country.country ? 'rotate-180' : ''}`}>&#x25BC;</i>
            </div>

            {/* Expanded detail */}
            {selectedCountry === country.country && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sentiqs-gray-text">Niveau de risque</span>
                  <span className={`font-semibold px-2 py-0.5 rounded border ${riskBadge(country.risk)}`}>
                    {t(`dashboard.risk.${country.risk}`)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sentiqs-gray-text">Alertes actives</span>
                  <span className="font-semibold text-sentiqs-navy">{country.alerts}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sentiqs-gray-text">Tendance 7 jours</span>
                  <span className={`font-semibold ${country.trend.startsWith('+') ? 'text-red-600' : country.trend.startsWith('-') ? 'text-emerald-600' : 'text-sentiqs-navy'}`}>
                    {country.trend.startsWith('+') ? `↗ ${country.trend}` : country.trend.startsWith('-') ? `↘ ${country.trend}` : `→ stable`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sentiqs-gray-text">Dernier rapport</span>
                  <span className="font-semibold text-sentiqs-navy">Aujourd'hui</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShareTarget({ id: country.code, title: country.country }); setShareModalOpen(true); }}
                  className="w-full mt-1 text-[10px] font-semibold text-sentiqs-navy hover:underline flex items-center justify-center gap-1 py-1"
                >
                  <i className="ri-share-forward-line text-xs" /> Partager
                </button>
              </div>
            )}
          </button>
        ))}
      </div>

      {filteredCountries.length === 0 && (
        <div className="py-12 text-center text-sentiqs-gray-text text-xs">
          {countryRiskLevels.length === 0
            ? "Aucun pays évalué : la collecte n'a encore remonté aucun signal. Lancez une collecte depuis la page Flux."
            : 'Aucun pays trouvé avec ces filtres.'}
        </div>
      )}
    </div>
  );
}