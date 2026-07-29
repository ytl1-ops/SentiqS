import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useVeille, alertes } from '@/lib/veille';

const severityBadge: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-amber-100 text-amber-700',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-gray-100 text-gray-600',
};

const statusBadge: Record<string, string> = {
  active: 'bg-red-50 text-red-600 border border-red-100',
};

/** La vue d'ensemble n'affiche qu'un aperçu — la liste complète est sur /dashboard/alerts. */
const APERCU = 8;

export default function AlertsTable() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('all');
  const { articles, loading } = useVeille();
  const dashboardAlerts = alertes(articles);

  const filteredAlerts = (filter === 'all'
    ? dashboardAlerts
    : dashboardAlerts.filter((a) => a.severity === filter)
  ).slice(0, APERCU);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div className="bg-white rounded-xl border border-gray-100 h-72 animate-pulse" />;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-sentiqs-navy">{t('dashboard.alerts.latest')}</h3>
        <div className="flex items-center gap-1">
          {['all', 'critical', 'high'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${
                filter === f
                  ? 'bg-sentiqs-navy text-white'
                  : 'bg-gray-50 text-sentiqs-gray-text hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? 'Tout' : t(`dashboard.severity.${f}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="px-4 py-2 text-left text-[9px] font-bold tracking-[0.1em] text-sentiqs-gray-text uppercase">{t('dashboard.alerts.id')}</th>
              <th className="px-4 py-2 text-left text-[9px] font-bold tracking-[0.1em] text-sentiqs-gray-text uppercase">{t('dashboard.alerts.severity')}</th>
              <th className="px-4 py-2 text-left text-[9px] font-bold tracking-[0.1em] text-sentiqs-gray-text uppercase">{t('dashboard.alerts.country')}</th>
              <th className="px-4 py-2 text-left text-[9px] font-bold tracking-[0.1em] text-sentiqs-gray-text uppercase hidden md:table-cell">{t('dashboard.alerts.title')}</th>
              <th className="px-4 py-2 text-left text-[9px] font-bold tracking-[0.1em] text-sentiqs-gray-text uppercase">{t('dashboard.alerts.time')}</th>
              <th className="px-4 py-2 text-left text-[9px] font-bold tracking-[0.1em] text-sentiqs-gray-text uppercase hidden sm:table-cell">{t('dashboard.alerts.status')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlerts.map((alert) => (
              <tr
                key={alert.id}
                className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
              >
                <td className="px-4 py-2.5 text-[11px] font-mono text-sentiqs-gray-text max-w-[90px] truncate">{alert.id}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold ${severityBadge[alert.severity] || severityBadge.low}`}>
                    {t(`dashboard.severity.${alert.severity}`)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-sentiqs-navy font-medium">{alert.country}</td>
                <td className="px-4 py-2.5 text-xs text-sentiqs-gray-text hidden md:table-cell max-w-[280px] truncate">{alert.title}</td>
                <td className="px-4 py-2.5 text-[11px] text-sentiqs-gray-text">{formatTime(alert.timestamp)}</td>
                <td className="px-4 py-2.5 hidden sm:table-cell">
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold ${statusBadge[alert.status] || statusBadge.monitoring}`}>
                    {t(`dashboard.status.${alert.status}`)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredAlerts.length === 0 && (
          <p className="text-xs text-sentiqs-gray-text py-8 text-center">
            Aucune alerte critique ou élevée dans la collecte en cours.
          </p>
        )}
      </div>

      <div className="px-4 py-2 border-t border-gray-100">
        <Link
          to="/dashboard/alerts"
          className="text-xs text-sentiqs-blue hover:text-sentiqs-blue-dark transition-colors font-medium"
        >
          {t('dashboard.alerts.viewAll')} →
        </Link>
      </div>
    </div>
  );
}