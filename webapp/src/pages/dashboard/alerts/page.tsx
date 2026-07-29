import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useVeille, alertes } from '@/lib/veille';
import ShareModal from '@/components/feature/ShareModal';

// Les alertes descendent de la collecte réelle : par construction elles sont
// critiques ou élevées, et n'ont pas de cycle de vie (voir VeilleAlerte.status).
// Le filtre par statut a donc disparu, il ne discriminait plus rien.
type Severity = 'all' | 'critical' | 'high';

export default function AlertsPage() {
  const { t } = useTranslation();
  const { articles, loading, error, recharger } = useVeille();
  const dashboardAlerts = useMemo(() => alertes(articles), [articles]);
  const [severityFilter, setSeverityFilter] = useState<Severity>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string } | null>(null);

  const filteredAlerts = useMemo(() => {
    let alerts = [...dashboardAlerts];
    if (severityFilter !== 'all') alerts = alerts.filter((a) => a.severity === severityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      alerts = alerts.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.country.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q),
      );
    }
    alerts.sort((a, b) => {
      const va = String(a[sortKey as keyof typeof a] ?? '');
      const vb = String(b[sortKey as keyof typeof b] ?? '');
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return alerts;
  }, [dashboardAlerts, severityFilter, search, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, total: dashboardAlerts.length, pays: 0 };
    const pays = new Set<string>();
    dashboardAlerts.forEach((a) => {
      if (a.severity === 'critical') c.critical++;
      else if (a.severity === 'high') c.high++;
      pays.add(a.country);
    });
    c.pays = pays.size;
    return c;
  }, [dashboardAlerts]);

  const severityBadge = (s: string) => {
    const map: Record<string, string> = {
      critical: 'bg-red-100 text-red-700 border-red-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
    return `px-2 py-0.5 rounded text-[10px] font-semibold border ${map[s] || ''}`;
  };

  const severityColor = (s: string) => {
    const map: Record<string, string> = {
      critical: 'text-red-600',
      high: 'text-orange-600',
      medium: 'text-yellow-600',
      low: 'text-emerald-600',
    };
    return map[s] || '';
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

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
          itemType={`Alerte ${shareTarget.id}`}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-sentiqs-navy">{t('dashboard.alerts')}</h1>
        <p className="text-xs text-sentiqs-gray-text mt-0.5">
          {filteredAlerts.length} alerte{filteredAlerts.length !== 1 ? 's' : ''} trouvée{filteredAlerts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Severity quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: 'critical', label: t('dashboard.severity.critical'), color: 'bg-red-50 border-red-200 text-red-700', count: counts.critical },
          { key: 'high', label: t('dashboard.severity.high'), color: 'bg-orange-50 border-orange-200 text-orange-700', count: counts.high },
          { key: 'all', label: 'Total', color: 'bg-gray-50 border-gray-200 text-sentiqs-navy', count: counts.total },
          { key: 'pays', label: 'Pays concernés', color: 'bg-blue-50 border-blue-200 text-blue-700', count: counts.pays },
        ] as const).map(({ key, label, color, count }) => (
          <button
            key={key}
            type="button"
            disabled={key === 'pays'}
            onClick={() => key !== 'pays' && setSeverityFilter(severityFilter === key ? 'all' : (key as Severity))}
            className={`rounded-lg border p-3 text-left transition-colors ${color} ${severityFilter === key ? 'ring-2 ring-offset-1 ring-current' : 'hover:opacity-80'}`}
          >
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5">{label}</div>
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex-1 min-w-[200px]">
          <i className="ri-search-line text-sentiqs-gray-text text-sm mr-2" />
          <input
            type="text"
            placeholder="Rechercher par ID, titre, pays..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-sentiqs-navy placeholder:text-gray-400 focus:outline-none w-full"
          />
        </div>

      </div>

      {/* Alerts table */}
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {[
                  { key: 'id', label: t('dashboard.alerts.id'), w: 'w-[160px]' },
                  { key: 'severity', label: t('dashboard.alerts.severity'), w: 'w-[90px]' },
                  { key: 'country', label: t('dashboard.alerts.country'), w: 'w-[130px]' },
                  { key: 'title', label: t('dashboard.alerts.title'), w: '' },
                  { key: 'category', label: 'Catégorie', w: 'w-[130px]' },
                  { key: 'timestamp', label: t('dashboard.alerts.time'), w: 'w-[140px]' },
                ].map((col) => (
                  <th
                    key={col.key}
                    className={`text-left px-4 py-2.5 font-semibold text-sentiqs-gray-text text-[10px] uppercase tracking-wider ${col.w} cursor-pointer hover:text-sentiqs-navy select-none`}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        <i className={`${sortDir === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-xs`} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((alert) => (
                <>
                  <tr
                    key={alert.id}
                    onClick={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
                    className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-[10px] text-sentiqs-navy">{alert.id}</td>
                    <td className="px-4 py-3">
                      <span className={severityBadge(alert.severity)}>
                        {t(`dashboard.severity.${alert.severity}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-sentiqs-navy">{alert.country}</td>
                    <td className="px-4 py-3 text-sentiqs-navy pr-6">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${severityColor(alert.severity)} bg-current`} />
                        <span className="line-clamp-1">{alert.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sentiqs-gray-text">{alert.category}</td>
                    <td className="px-4 py-3 text-sentiqs-gray-text whitespace-nowrap">{formatTime(alert.timestamp)}</td>
                  </tr>
                  {expandedId === alert.id && (
                    <tr key={`${alert.id}-detail`} className="bg-gray-50/70">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Région</span>
                            <p className="text-sentiqs-navy mt-1">{alert.region}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Source</span>
                            <p className="text-sentiqs-navy mt-1">{alert.source}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Impact</span>
                            <p className="text-sentiqs-navy mt-1">{alert.impact}</p>
                          </div>
                          <div className="sm:col-span-3">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Article source</span>
                            {alert.url ? (
                              <a
                                href={alert.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 text-sentiqs-blue hover:underline break-all"
                              >
                                {alert.url}
                              </a>
                            ) : (
                              <span className="ml-2 text-sentiqs-gray-text">Lien indisponible</span>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <button type="button" className="text-[10px] font-semibold text-sentiqs-navy hover:underline flex items-center gap-1">
                            <i className="ri-file-copy-line text-sm" /> Copier le rapport
                          </button>
                          <button type="button" onClick={() => { setShareTarget({ id: alert.id, title: alert.title }); setShareModalOpen(true); }} className="text-[10px] font-semibold text-sentiqs-navy hover:underline flex items-center gap-1">
                            <i className="ri-share-forward-line text-sm" /> Partager
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {filteredAlerts.length === 0 && (
          <div className="py-12 text-center text-sentiqs-gray-text text-xs">
            {dashboardAlerts.length === 0
              ? "La collecte n'a remonté aucune alerte critique ou élevée. Lancez une collecte depuis la page Flux."
              : 'Aucune alerte trouvée avec ces filtres.'}
          </div>
        )}
      </div>
    </div>
  );
}