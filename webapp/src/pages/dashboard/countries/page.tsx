import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCountryPosture, type PostureLevel } from '@/hooks/useCountryPosture';
import ShareModal from '@/components/feature/ShareModal';

type RiskLevel = 'all' | PostureLevel;

const formatRelative = (iso: string | null): string => {
  if (!iso) return 'Jamais';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
};

export default function CountriesPage() {
  const { t } = useTranslation();
  const { postures, loading, error, recharger } = useCountryPosture();
  const [riskFilter, setRiskFilter] = useState<RiskLevel>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string } | null>(null);

  const regions = useMemo(() => {
    const r = new Set(postures.map((c) => c.region));
    return Array.from(r);
  }, [postures]);

  const filteredCountries = useMemo(() => {
    let countries = [...postures];
    if (riskFilter !== 'all') countries = countries.filter((c) => c.level === riskFilter);
    if (regionFilter !== 'all') countries = countries.filter((c) => c.region === regionFilter);
    return countries;
  }, [postures, riskFilter, regionFilter]);

  const riskBadge = (risk: string) => {
    const map: Record<string, string> = {
      rouge: 'bg-red-100 text-red-700 border-red-200',
      orange: 'bg-orange-100 text-orange-700 border-orange-200',
      jaune: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      vert: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      non_cote: 'bg-gray-100 text-gray-500 border-gray-200',
    };
    return map[risk] || '';
  };

  const riskBarColor = (risk: string) => {
    const map: Record<string, string> = {
      rouge: 'bg-red-500',
      orange: 'bg-orange-500',
      jaune: 'bg-yellow-500',
      vert: 'bg-emerald-500',
      non_cote: 'bg-gray-300',
    };
    return map[risk] || 'bg-gray-300';
  };

  const riskWidth = (risk: string) => {
    const map: Record<string, string> = {
      rouge: 'w-full',
      orange: 'w-3/4',
      jaune: 'w-2/4',
      vert: 'w-1/4',
      non_cote: 'w-0',
    };
    return map[risk] || 'w-0';
  };

  const counts = useMemo(() => {
    const c = { rouge: 0, orange: 0, jaune: 0, vert: 0, non_cote: 0, total: postures.length };
    postures.forEach((co) => {
      if (co.level in c) c[co.level as keyof typeof c]++;
    });
    return c;
  }, [postures]);

  const selectedData = useMemo(() => {
    if (!selectedCountry) return null;
    return postures.find((c) => c.name === selectedCountry) || null;
  }, [postures, selectedCountry]);

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
        Impossible de charger country_posture_state : {error}
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {([
          { key: 'rouge', label: t('dashboard.posture.rouge'), color: 'bg-red-50 border-red-200 text-red-700', count: counts.rouge },
          { key: 'orange', label: t('dashboard.posture.orange'), color: 'bg-orange-50 border-orange-200 text-orange-700', count: counts.orange },
          { key: 'jaune', label: t('dashboard.posture.jaune'), color: 'bg-yellow-50 border-yellow-200 text-yellow-700', count: counts.jaune },
          { key: 'vert', label: t('dashboard.posture.vert'), color: 'bg-emerald-50 border-emerald-200 text-emerald-700', count: counts.vert },
          { key: 'non_cote', label: t('dashboard.posture.non_cote'), color: 'bg-gray-50 border-gray-200 text-gray-500', count: counts.non_cote },
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
            onClick={() => setSelectedCountry(selectedCountry === country.name ? null : country.name)}
            className={`bg-white rounded-lg border p-4 text-left transition-all ${
              selectedCountry === country.name
                ? 'border-sentiqs-navy ring-1 ring-sentiqs-navy/20'
                : 'border-gray-100 hover:border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-sentiqs-navy">{country.name}</span>
                  <span className="text-[10px] font-mono text-sentiqs-gray-text bg-gray-100 px-1.5 py-0.5 rounded">{country.code}</span>
                </div>
                <p className="text-[10px] text-sentiqs-gray-text mt-0.5">{country.region}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${riskBadge(country.level)}`}>
                {t(`dashboard.posture.${country.level}`)}
              </span>
            </div>

            {/* Risk bar */}
            <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${riskBarColor(country.level)} ${riskWidth(country.level)}`} />
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
              <i className={`text-sentiqs-gray-text text-sm transition-transform ${selectedCountry === country.name ? 'rotate-180' : ''}`}>&#x25BC;</i>
            </div>

            {/* Expanded detail */}
            {selectedCountry === country.name && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sentiqs-gray-text">Niveau de risque</span>
                  <span className={`font-semibold px-2 py-0.5 rounded border ${riskBadge(country.level)}`}>
                    {t(`dashboard.posture.${country.level}`)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sentiqs-gray-text">Score</span>
                  <span className="font-semibold text-sentiqs-navy">{country.score}/100</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sentiqs-gray-text">Incidents critiques + élevés (10 j)</span>
                  <span className="font-semibold text-sentiqs-navy">{country.alerts}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sentiqs-gray-text">Tendance (dernier calcul)</span>
                  <span className={`font-semibold ${country.trend.startsWith('+') ? 'text-red-600' : country.trend.startsWith('-') ? 'text-emerald-600' : 'text-sentiqs-navy'}`}>
                    {country.trend.startsWith('+') ? `↗ ${country.trend}` : country.trend.startsWith('-') ? `↘ ${country.trend}` : `→ stable`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sentiqs-gray-text">Sources consultées (10 j)</span>
                  <span className="font-semibold text-sentiqs-navy">{country.sourcesConsultedCount}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sentiqs-gray-text">Dernière collecte</span>
                  <span className="font-semibold text-sentiqs-navy">{formatRelative(country.lastCollectionAt)}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShareTarget({ id: country.code, title: country.name }); setShareModalOpen(true); }}
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
          {postures.length === 0
            ? 'Aucun pays évalué : country_posture_state est vide ou inaccessible.'
            : 'Aucun pays trouvé avec ces filtres.'}
        </div>
      )}
    </div>
  );
}
