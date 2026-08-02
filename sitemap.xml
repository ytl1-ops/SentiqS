import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import i18n from '@/i18n';
import { useAlertLevels } from '@/hooks/useAlertLevels';
import { useSupabaseStats } from '@/hooks/useSupabaseStats';
import { usePostureHistory } from '@/hooks/usePostureHistory';
import { LEVEL_BORDER, getPostureLabel, getDirection } from '@/utils/postureUtils';
import ErrorState from '@/components/base/ErrorState';
import EmptyState from '@/components/base/EmptyState';
import SituationHeader from './components/SituationHeader';
import CountryGrid from './components/CountryGrid';
import CriticalSituations from './components/CriticalSituations';
import MainCourante from './components/MainCourante';
import SituationMatrix from './components/SituationMatrix';
import PostureTimeline from './components/PostureTimeline';
import SituationCorrelations from './components/SituationCorrelations';

type Tab = 'overview' | 'matrix' | 'history' | 'correlations';

/* ═══════════════════════════════════════════════
   RecentTimeline — 6 derniers changements condensés
   ═══════════════════════════════════════════════ */
function formatTimeAgo(iso: string, isFr: boolean): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const loc = isFr ? 'fr-FR' : 'en-US';
  const timeStr = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  const dateStr = d.toLocaleDateString(loc, { day: '2-digit', month: 'short' });
  if (diffHours < 24) return `${timeStr} — ${isFr ? "aujourd'hui" : 'today'}`;
  if (diffDays === 1) return `${timeStr} — ${isFr ? 'hier' : 'yesterday'}`;
  if (diffDays < 7) return `${timeStr} — ${dateStr}`;
  return dateStr;
}

function RecentTimeline() {
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n: i18nInstance } = useTranslation();
  const isFr = i18nInstance.language.startsWith('fr');
  const base = location.pathname.startsWith('/preview') ? '/preview' : '/dashboard';
  const { entries, loading } = usePostureHistory(6);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-100 p-4 text-center">
        <i className="ri-loader-4-line animate-spin text-gray-400 text-sm block mb-1" />
        <p className="text-[10px] text-gray-400">Chargement des derniers changements...</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon="ri-exchange-line"
        title="Aucun changement de posture récent."
        description="Les changements automatiques et manuels apparaîtront ici."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
          <i className="ri-exchange-line text-sentiqs-navy" />
          Derniers changements
          <span className="text-[10px] font-normal normal-case tracking-normal text-gray-400">
            ({entries.length})
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {entries.map((entry) => {
          const direction = getDirection(entry.old_level, entry.new_level);
          const borderColor = LEVEL_BORDER[entry.new_level] || 'border-l-gray-400';

          return (
            <div
              key={entry.id}
              className={`bg-white rounded-lg border border-gray-100 border-l-4 ${borderColor} p-2.5 cursor-pointer hover:shadow-sm transition-shadow`}
              onClick={() => navigate(`${base}/alerts/country/${entry.country_code}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`${base}/alerts/country/${entry.country_code}`); }}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] text-gray-400">{formatTimeAgo(entry.created_at, isFr)}</span>
                    <span className="text-[11px] font-bold text-gray-900">{entry.country_name}</span>
                    {entry.event_type === 'manual' && (
                      <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-sentiqs-navy/10 text-sentiqs-navy">M</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px]">
                    <span className="font-semibold text-gray-500">{getPostureLabel(entry.old_level)}</span>
                    <i className="ri-arrow-right-line text-gray-400 text-[9px]" />
                    <span className="font-bold text-gray-800">{getPostureLabel(entry.new_level)}</span>
                    <span className="text-[9px] text-gray-400 ml-0.5">{entry.old_score}→{entry.new_score}</span>
                  </div>
                </div>
                <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${
                  direction === 'escalation' ? 'bg-red-500' : direction === 'deescalation' ? 'bg-emerald-500' : 'bg-gray-300'
                }`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   PAGE PRINCIPALE
   ═══════════════════════════════════════════════ */
export default function SituationPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { t } = useTranslation();
  const { alertLevels, loading, error, stats, lastCalculatedAt } = useAlertLevels();
  const { stats: dashboardStats } = useSupabaseStats();
  const loc = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="anim-entry-down">
          <h1 className="text-lg font-bold text-sentiqs-navy">{t('dashboard.situation.title')}</h1>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center text-sentiqs-gray-text text-xs">
          <i className="ri-loader-4-line animate-spin text-2xl mb-2 block" />
          {t('dashboard.situation.loading')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-bold text-sentiqs-navy">{t('dashboard.situation.title')}</h1>
        <ErrorState
          message={error}
          onRetry={() => window.location.reload()}
          icon="ri-error-warning-line"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="anim-entry-down space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-bold text-sentiqs-navy">{t('dashboard.situation.title')}</h1>
          <span className="px-2 py-0.5 rounded-full bg-sentiqs-navy/10 text-sentiqs-navy text-[10px] font-bold">
            {t('dashboard.situation.badge.tool')}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
            <i className="ri-live-line mr-1" />
            {t('dashboard.situation.badge.realTime')}
          </span>
        </div>
        <p className="text-xs text-sentiqs-gray-text">
          {t('dashboard.situation.subtitle', { incidents: stats.totalIncidents })} ·{' '}
          {t('dashboard.situation.updated', {
            date: lastCalculatedAt
              ? new Date(lastCalculatedAt).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' })
              : '—',
            time: lastCalculatedAt
              ? new Date(lastCalculatedAt).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
              : '—',
          })}
        </p>
      </div>

      {/* Executive header */}
      <SituationHeader
        levels={alertLevels}
        lastUpdated={lastCalculatedAt}
        totalIncidents={stats.totalIncidents}
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-sentiqs-navy text-sentiqs-navy'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="ri-dashboard-line mr-1.5" />
          {t('dashboard.situation.tabOverview')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'matrix'
              ? 'border-sentiqs-navy text-sentiqs-navy'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="ri-table-line mr-1.5" />
          {t('dashboard.situation.tabMatrix')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('correlations')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'correlations'
              ? 'border-sentiqs-navy text-sentiqs-navy'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="ri-git-merge-line mr-1.5" />
          Relations
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-sentiqs-navy text-sentiqs-navy'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="ri-history-line mr-1.5" />
          {t('dashboard.situation.tabHistory')}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'correlations' ? (
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <SituationCorrelations />
        </div>
      ) : activeTab === 'history' ? (
        <PostureTimeline />
      ) : activeTab === 'overview' ? (
        <div className="space-y-5">
          {/* Country grid — organised by region */}
          <CountryGrid levels={alertLevels} />

          {/* Critical situations + Main courante — side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <CriticalSituations levels={alertLevels} />
            <MainCourante />
          </div>

          {/* Recent posture changes — compact timeline */}
          <RecentTimeline />

          {/* Decision support footer */}
          <div className="bg-sentiqs-navy rounded-lg p-4 text-white">
            <div className="flex items-center gap-2 mb-3">
              <i className="ri-lightbulb-line text-yellow-400" />
              <h3 className="text-sm font-bold">{t('dashboard.situation.decisionSupport.title')}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {alertLevels.filter((l) => l.level === 'rouge').length > 0 && (
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-red-300 mb-1">{t('dashboard.situation.decisionSupport.majorConflicts')}</div>
                  <p className="text-xs text-white/90">
                    {alertLevels.filter((l) => l.level === 'rouge').length} {t('dashboard.situation.decisionSupport.redRec')}
                  </p>
                </div>
              )}
              {alertLevels.filter((l) => l.level === 'orange').length > 0 && (
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-orange-300 mb-1">{t('dashboard.situation.decisionSupport.highRisks')}</div>
                  <p className="text-xs text-white/90">
                    {alertLevels.filter((l) => l.level === 'orange').length} {t('dashboard.situation.decisionSupport.orangeRec')}
                  </p>
                </div>
              )}
              {alertLevels.filter((l) => l.level === 'jaune').length > 0 && (
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-yellow-300 mb-1">{t('dashboard.situation.decisionSupport.precautions')}</div>
                  <p className="text-xs text-white/90">
                    {alertLevels.filter((l) => l.level === 'jaune').length} {t('dashboard.situation.decisionSupport.yellowRec')}
                  </p>
                </div>
              )}
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-300 mb-1">{t('dashboard.situation.decisionSupport.activeWatch')}</div>
                <p className="text-xs text-white/90">
                  {t('dashboard.situation.decisionSupport.watchRec', {
                    alerts: dashboardStats.activeAlerts,
                    feeds: dashboardStats.newFeeds24h,
                    countries: dashboardStats.countriesInAlert,
                  })}
                </p>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-blue-300 mb-1">{t('dashboard.situation.decisionSupport.sources')}</div>
                <p className="text-xs text-white/90">
                  {t('dashboard.situation.decisionSupport.sourcesRec', { verified: stats.totalVerified })}
                </p>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-gray-300 mb-1">{t('dashboard.situation.decisionSupport.methodology')}</div>
                <p className="text-xs text-white/90">
                  {t('dashboard.situation.decisionSupport.methodologyRec')}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <SituationMatrix levels={alertLevels} />
      )}
    </div>
  );
}