import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertLevels, LEVEL_COLORS } from '@/hooks/useAlertLevels';
import AlertsUnifiedView from './components/AlertsUnifiedView';
import ErrorState from '@/components/base/ErrorState';
import i18n from '@/i18n';

type LevelFilter = 'all' | 'rouge' | 'orange' | 'jaune' | 'vert';

const LEVELS_CONFIG: { key: LevelFilter; labelKey: string; descKey: string; color: string }[] = [
  { key: 'rouge', labelKey: 'dashboard.level.rouge', descKey: 'dashboard.level.rougeDesc', color: 'bg-red-700 text-white border-red-800' },
  { key: 'orange', labelKey: 'dashboard.level.orange', descKey: 'dashboard.level.orangeDesc', color: 'bg-orange-600 text-white border-orange-700' },
  { key: 'jaune', labelKey: 'dashboard.level.jaune', descKey: 'dashboard.level.jauneDesc', color: 'bg-yellow-500 text-yellow-950 border-yellow-600' },
  { key: 'vert', labelKey: 'dashboard.level.vert', descKey: 'dashboard.level.vertDesc', color: 'bg-emerald-600 text-white border-emerald-700' },
];

// Static region mapping for filtering
const COUNTRY_REGION: Record<string, string> = {
  'Afrique du Sud': 'Afrique australe', Algérie: 'Afrique du Nord', Angola: 'Afrique centrale',
  Bénin: 'Afrique de l\'Ouest', Botswana: 'Afrique australe',
  'Burkina Faso': 'Afrique de l\'Ouest', Burundi: 'Afrique de l\'Est',
  Cameroun: 'Afrique centrale', 'Cap-Vert': 'Afrique de l\'Ouest',
  Centrafrique: 'Afrique centrale', Comores: 'Afrique de l\'Est',
  Congo: 'Afrique centrale', 'Côte d\'Ivoire': 'Afrique de l\'Ouest',
  Djibouti: 'Afrique de l\'Est', Égypte: 'Afrique du Nord',
  Érythrée: 'Afrique de l\'Est', Éthiopie: 'Afrique de l\'Est',
  Gabon: 'Afrique centrale', Gambie: 'Afrique de l\'Ouest',
  Ghana: 'Afrique de l\'Ouest', Guinée: 'Afrique de l\'Ouest',
  'Guinée-Bissau': 'Afrique de l\'Ouest', 'Guinée Équatoriale': 'Afrique centrale',
  Kenya: 'Afrique de l\'Est', Lesotho: 'Afrique australe',
  Libéria: 'Afrique de l\'Ouest', Libye: 'Afrique du Nord',
  Madagascar: 'Afrique australe', Malawi: 'Afrique australe',
  Mali: 'Afrique de l\'Ouest', Maroc: 'Afrique du Nord',
  Maurice: 'Afrique australe', Mauritanie: 'Afrique de l\'Ouest',
  Mozambique: 'Afrique australe', Namibie: 'Afrique australe',
  Niger: 'Afrique de l\'Ouest', Nigeria: 'Afrique de l\'Ouest',
  Ouganda: 'Afrique de l\'Est', RDC: 'Afrique centrale',
  Rwanda: 'Afrique de l\'Est', 'Sao Tomé-et-Principe': 'Afrique centrale',
  Sénégal: 'Afrique de l\'Ouest', Seychelles: 'Afrique de l\'Est',
  'Sierra Leone': 'Afrique de l\'Ouest', Somalie: 'Afrique de l\'Est',
  Soudan: 'Afrique du Nord', 'Soudan du Sud': 'Afrique de l\'Est',
  Éswatini: 'Afrique australe', Tanzanie: 'Afrique de l\'Est',
  Tchad: 'Afrique centrale', Togo: 'Afrique de l\'Ouest',
  Tunisie: 'Afrique du Nord', Zambie: 'Afrique australe',
  Zimbabwe: 'Afrique australe',
};

export default function AlertsPage() {
  const { t } = useTranslation();
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const { alertLevels, loading, error, stats, recalculate } = useAlertLevels();

  const regions = useMemo(() => {
    const r = new Set<string>();
    alertLevels.forEach((l) => {
      const region = COUNTRY_REGION[l.country];
      if (region) r.add(region);
    });
    return Array.from(r).sort();
  }, [alertLevels]);

  const filteredLevels = useMemo(() => {
    let result = [...alertLevels];
    if (levelFilter !== 'all') result = result.filter((l) => l.level === levelFilter);
    if (regionFilter !== 'all') result = result.filter((l) => COUNTRY_REGION[l.country] === regionFilter);
    return result;
  }, [alertLevels, levelFilter, regionFilter]);

  // Recalculate region-filtered stats
  const filteredStats = useMemo(() => {
    const counts: Record<string, number> = { rouge: 0, orange: 0, jaune: 0, vert: 0, totalIncidents: 0, totalVerified: 0 };
    filteredLevels.forEach((l) => {
      counts[l.level]++;
      counts.totalIncidents += l.incidents;
      counts.totalVerified += l.verifiedCount;
    });
    return counts;
  }, [filteredLevels]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="anim-entry-down">
          <h1 className="text-lg font-bold text-sentiqs-navy">{t('dashboard.alerts')}</h1>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center text-sentiqs-gray-text text-xs">
          <i className="ri-loader-4-line animate-spin text-2xl mb-2 block" />
          {t('dashboard.alerts.loadingLevels')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-bold text-sentiqs-navy">{t('dashboard.alerts')}</h1>
        <ErrorState
          message={error}
          onRetry={() => window.location.reload()}
          retryLabel={t('common.retry')}
          icon="ri-error-warning-line"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="anim-entry-down space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-bold text-sentiqs-navy">{t('dashboard.alerts.alertLevels')}</h1>
          <span className="px-2 py-0.5 rounded-full bg-sentiqs-navy/10 text-sentiqs-navy text-[10px] font-bold">
            {t('dashboard.alerts.africanCountries')}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
            Feed-driven
          </span>
        </div>
        <p className="text-xs text-sentiqs-gray-text">
          {t('dashboard.alerts.verifiedIncidents', { count: stats.totalIncidents })} {t('dashboard.alerts.overCountries')} ·{' '}
          {t('dashboard.alerts.cappedScore')} ·{' '}
          {filteredLevels.length !== alertLevels.length
            ? `${filteredLevels.length}/${alertLevels.length} pays affichés`
            : `${alertLevels.length} pays`}
        </p>
      </div>

      {/* Level filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setLevelFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors whitespace-nowrap ${
            levelFilter === 'all'
              ? 'bg-sentiqs-navy text-white border-sentiqs-navy'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          {t('dashboard.alerts.allLevels')}
        </button>
        {LEVELS_CONFIG.map((lvl) => (
          <button
            key={lvl.key}
            type="button"
            onClick={() => setLevelFilter(levelFilter === lvl.key ? 'all' : lvl.key)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors whitespace-nowrap ${
              levelFilter === lvl.key
                ? `${lvl.color} ring-2 ring-offset-1 ring-gray-300`
                : `${lvl.color} opacity-60 hover:opacity-100`
            }`}
          >
            {t(lvl.labelKey)} — {t(lvl.descKey)}
          </button>
        ))}
      </div>

      {/* Region filter pills */}
      {regions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setRegionFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors whitespace-nowrap ${
              regionFilter === 'all'
                ? 'bg-sentiqs-navy text-white border-sentiqs-navy'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            Toutes les régions
          </button>
          {regions.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegionFilter(regionFilter === r ? 'all' : r)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors whitespace-nowrap ${
                regionFilter === r
                  ? 'bg-sentiqs-navy text-white border-sentiqs-navy'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="text-[10px] text-gray-400">
          {filteredStats.totalIncidents} {t('dashboard.incidents').toLowerCase()} · {filteredStats.totalVerified} vérifiés
        </span>
        <button
          type="button"
          onClick={recalculate}
          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors whitespace-nowrap flex items-center gap-1.5"
        >
          <i className="ri-refresh-line" />
          {t('dashboard.alerts.recalculate')}
        </button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {LEVELS_CONFIG.map((lvl) => {
          const count = filteredStats[lvl.key] || 0;
          return (
            <button
              key={lvl.key}
              type="button"
              onClick={() => setLevelFilter(levelFilter === lvl.key ? 'all' : lvl.key)}
              className={`rounded-lg border p-2.5 text-left transition-all ${
                levelFilter === lvl.key ? 'ring-2 ring-offset-1 ring-gray-300' : ''
              }`}
              style={{ backgroundColor: lvl.key === 'rouge' ? '#fef2f2' : lvl.key === 'orange' ? '#fff7ed' : lvl.key === 'jaune' ? '#fefce8' : '#ecfdf5', borderColor: lvl.key === 'rouge' ? '#fecaca' : lvl.key === 'orange' ? '#fed7aa' : lvl.key === 'jaune' ? '#fef08a' : '#a7f3d0' }}
            >
              <div className="text-lg font-bold" style={{ color: lvl.key === 'rouge' ? '#b91c1c' : lvl.key === 'orange' ? '#c2410c' : lvl.key === 'jaune' ? '#a16207' : '#047857' }}>
                {count}
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: lvl.key === 'rouge' ? '#dc2626' : lvl.key === 'orange' ? '#ea580c' : lvl.key === 'jaune' ? '#ca8a04' : '#059669' }}>
                {t(lvl.labelKey)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Vue unifiée : grille pays + timeline */}
      <AlertsUnifiedView levels={filteredLevels} levelFilter={levelFilter} />

      {/* Methodology footer */}
      <div className="bg-white rounded-lg border border-gray-100 p-4 space-y-2">
        <h3 className="text-sm font-bold text-sentiqs-navy flex items-center gap-2">
          <i className="ri-brain-line text-sentiqs-blue" />
          {t('dashboard.methodology.title')}
        </h3>
        <p className="text-xs text-gray-600 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: t('dashboard.methodology.coverage') }} />
        <p className="text-xs text-gray-600 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: t('dashboard.methodology.scoring') }} />
        <p className="text-xs text-gray-600 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: t('dashboard.methodology.cap') }} />
        <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-50">
          {t('dashboard.methodology.semantic')}
        </p>
      </div>
    </div>
  );
}