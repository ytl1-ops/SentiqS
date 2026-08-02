import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useSupabaseCorrelations, SupabaseCorrelation } from '@/hooks/useSupabaseCorrelations';
import { SEVERITY_BADGE_BORDERED } from '@/utils/severityColors';
import { formatDateTime } from '@/utils/timeFormat';
import EmptyState from '@/components/base/EmptyState';

export default function SituationCorrelations() {
  const { t } = useTranslation();
  const { correlations, loading } = useSupabaseCorrelations();

  const strengthBadge = (s: string) => {
    const map: Record<string, string> = {
      strong: 'bg-red-100 text-red-700 border-red-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      low: 'bg-gray-100 text-gray-500 border-gray-200',
    };
    return `px-2 py-0.5 rounded text-[10px] font-semibold border ${map[s] || ''}`;
  };

  const typeBadge = (tp: string) => {
    const map: Record<string, string> = {
      direct: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      cluster: 'bg-violet-100 text-violet-700 border-violet-200',
      pattern: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      chain: 'bg-amber-100 text-amber-700 border-amber-200',
    };
    return `px-2 py-0.5 rounded text-[10px] font-semibold border ${map[tp] || ''}`;
  };

  const stats = useMemo(() => {
    const c: Record<string, number> = { direct: 0, cluster: 0, pattern: 0, chain: 0, total: correlations.length };
    correlations.forEach((co) => {
      if (co.type in c) c[co.type]++;
    });
    return c;
  }, [correlations]);

  const topCorrelations = useMemo(() => {
    return [...correlations]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  }, [correlations]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-100 p-8 text-center">
        <i className="ri-loader-4-line animate-spin text-gray-400 text-lg block mb-2" />
        <p className="text-xs text-gray-400">Analyse des corrélations en cours...</p>
      </div>
    );
  }

  if (correlations.length === 0) {
    return (
      <EmptyState
        icon="ri-git-merge-line"
        title="Aucune corrélation détectée"
        description="Les corrélations entre alertes apparaîtront ici lorsque suffisamment de données seront disponibles."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {([
          { key: 'direct', label: t('dashboard.correlations.types.direct'), color: 'bg-indigo-50 border-indigo-200 text-indigo-700', count: stats.direct },
          { key: 'cluster', label: t('dashboard.correlations.types.cluster'), color: 'bg-violet-50 border-violet-200 text-violet-700', count: stats.cluster },
          { key: 'pattern', label: t('dashboard.correlations.types.pattern'), color: 'bg-cyan-50 border-cyan-200 text-cyan-700', count: stats.pattern },
          { key: 'chain', label: t('dashboard.correlations.types.chain'), color: 'bg-amber-50 border-amber-200 text-amber-700', count: stats.chain },
        ] as const).map(({ key, label, color, count }) => (
          <div key={key} className={`rounded-lg border p-2.5 ${color}`}>
            <div className="text-lg font-bold">{count}</div>
            <div className="text-[9px] font-semibold uppercase tracking-wide mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Top correlations list */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
          <i className="ri-git-merge-line text-sentiqs-navy" />
          {stats.total} {t('dashboard.correlations.totalDetected')}
        </h2>

        <div className="space-y-2">
          {topCorrelations.map((corr: SupabaseCorrelation) => (
            <div key={corr.id} className="bg-white rounded-lg border border-gray-100 p-3 hover:border-gray-200 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${SEVERITY_BADGE_BORDERED[corr.alert_severity] || ''}`}>
                      {t(`dashboard.severity.${corr.alert_severity}`)}
                    </span>
                    <span className={typeBadge(corr.type)}>
                      {t(`dashboard.correlations.types.${corr.type}`)}
                    </span>
                    <span className={strengthBadge(corr.strength)}>
                      {t(`dashboard.correlations.strengths.${corr.strength}`)}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-sentiqs-navy">{corr.alert_title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{corr.description}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <i className="ri-map-pin-line text-[9px]" /> {corr.country} ({corr.region})
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-links-line text-[9px]" /> {(corr.related_countries || []).join(', ')}
                    </span>
                    <span>{formatDateTime(corr.detected_at, i18n.language)}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-bold ${
                    corr.confidence >= 90 ? 'text-emerald-600' : corr.confidence >= 75 ? 'text-yellow-600' : 'text-orange-600'
                  }`}>{corr.confidence}%</div>
                  <div className="text-[9px] text-gray-400">{t('dashboard.correlations.confidence')}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {correlations.length > 10 && (
          <p className="text-center text-[10px] text-gray-400 py-1">
            + {correlations.length - 10} autres corrélations
          </p>
        )}
      </div>
    </div>
  );
}