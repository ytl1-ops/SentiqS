import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { reports } from '@/mocks/dashboard';
import ShareModal from '@/components/feature/ShareModal';

type ReportType = typeof reports[0];

type TypeFilter = string;
type RegionFilter = string;
type FormatFilter = string;

export default function ReportsPreviewPage() {
  const { t } = useTranslation();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [search, setSearch] = useState('');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<ReportType | null>(null);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  const regions = useMemo(() => {
    const set = new Set(reports.map((r) => r.region));
    return Array.from(set);
  }, []);

  const filteredReports = useMemo(() => {
    let rs = [...reports];
    if (typeFilter !== 'all') rs = rs.filter((r) => r.type === typeFilter);
    if (regionFilter !== 'all') rs = rs.filter((r) => r.region === regionFilter);
    if (formatFilter !== 'all') rs = rs.filter((r) => r.format === formatFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rs = rs.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.author.toLowerCase().includes(q) ||
          r.region.toLowerCase().includes(q),
      );
    }
    return rs;
  }, [typeFilter, regionFilter, formatFilter, search]);

  const counts = useMemo(() => {
    return {
      total: reports.length,
      ready: reports.filter((r) => r.status === 'ready').length,
      generating: reports.filter((r) => r.status === 'generating').length,
    };
  }, []);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const typeBadge = (tp: string) => {
    const map: Record<string, string> = {
      correlation: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      monthly: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      risk: 'bg-orange-100 text-orange-700 border-orange-200',
      executive: 'bg-violet-100 text-violet-700 border-violet-200',
      quarterly: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      data: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    return `px-2 py-0.5 rounded text-[10px] font-semibold border ${map[tp] || ''}`;
  };

  const formatIcon = (fmt: string) => {
    const map: Record<string, { icon: string; color: string }> = {
      pdf: { icon: 'ri-file-pdf-2-line', color: 'text-red-500' },
      word: { icon: 'ri-file-word-2-line', color: 'text-blue-500' },
      excel: { icon: 'ri-file-excel-2-line', color: 'text-emerald-600' },
    };
    return map[fmt] || { icon: 'ri-file-line', color: 'text-gray-400' };
  };

  const handleDownload = useCallback((rpt: ReportType, fmt: string) => {
    const msg = `"${rpt.id}" — ${fmt.toUpperCase()} ${t('dashboard.reports.toast.downloaded')}`;
    setDownloadToast(msg);
    setTimeout(() => setDownloadToast(null), 2500);
  }, [t]);

  const handleShare = useCallback((rpt: ReportType) => {
    setShareTarget(rpt);
    setShareModalOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-background-50">
      {/* Simple top bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-background-200">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
              <i className="ri-earth-line text-white text-base" />
            </div>
            <span className="text-sm font-bold text-foreground-950">SentiqS</span>
            <span className="text-[10px] text-foreground-600 font-medium ml-1">· Rapports</span>
          </div>
          <Link
            to="/dashboard"
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors whitespace-nowrap"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* Download toast */}
        {downloadToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-primary-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-lg">
            <i className="ri-check-line text-emerald-400 text-sm" />
            {downloadToast}
          </div>
        )}

        {/* Share Modal */}
        {shareTarget && (
          <ShareModal
            open={shareModalOpen}
            onClose={() => { setShareModalOpen(false); setShareTarget(null); }}
            itemTitle={shareTarget.title}
            itemType={`${t('dashboard.reports')} ${shareTarget.id}`}
          />
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-foreground-950">{t('dashboard.reports.title')}</h1>
            <p className="text-xs text-foreground-600 mt-0.5">{t('dashboard.reports.subtitle')}</p>
          </div>
          <span className="text-[10px] text-foreground-500 bg-background-100 px-2 py-1 rounded whitespace-nowrap">
            {t('dashboard.reports.previewMode') || 'Mode aperçu — connexion requise pour actions complètes'}
          </span>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border border-background-200/70 p-3">
            <div className="text-2xl font-bold text-foreground-950">{counts.total}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground-600 mt-0.5">{t('dashboard.reports.total')}</div>
          </div>
          <div className="bg-white rounded-lg border border-background-200/70 p-3">
            <div className="text-2xl font-bold text-emerald-600">{counts.ready}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground-600 mt-0.5">{t('dashboard.reports.ready')}</div>
          </div>
          <div className="bg-white rounded-lg border border-background-200/70 p-3">
            <div className="text-2xl font-bold text-amber-500">{counts.generating}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground-600 mt-0.5">{t('dashboard.reports.generating')}</div>
          </div>
        </div>

        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
          <div className="flex items-center bg-white border border-background-200/70 rounded-lg px-3 py-1.5 flex-1 min-w-[200px]">
            <i className="ri-search-line text-foreground-500 text-sm mr-2" />
            <input
              type="text"
              placeholder={t('dashboard.reports.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-xs text-foreground-950 placeholder:text-foreground-400 focus:outline-none w-full"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-background-200/70 bg-white text-foreground-600 focus:outline-none focus:border-primary-300 whitespace-nowrap"
          >
            <option value="all">{t('dashboard.reports.allTypes')}</option>
            <option value="correlation">{t('dashboard.reports.types.correlation')}</option>
            <option value="monthly">{t('dashboard.reports.types.monthly')}</option>
            <option value="risk">{t('dashboard.reports.types.risk')}</option>
            <option value="executive">{t('dashboard.reports.types.executive')}</option>
            <option value="quarterly">{t('dashboard.reports.types.quarterly')}</option>
            <option value="data">{t('dashboard.reports.types.data')}</option>
          </select>

          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-background-200/70 bg-white text-foreground-600 focus:outline-none focus:border-primary-300 whitespace-nowrap"
          >
            <option value="all">{t('dashboard.reports.allRegions')}</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-background-200/70 bg-white text-foreground-600 focus:outline-none focus:border-primary-300 whitespace-nowrap"
          >
            <option value="all">{t('dashboard.reports.allFormats')}</option>
            <option value="pdf">PDF</option>
            <option value="word">Word</option>
            <option value="excel">Excel</option>
          </select>
        </div>

        {/* Login CTA banner */}
        <div className="bg-primary-50 border border-primary-200/70 rounded-lg px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
              <i className="ri-lock-line text-primary-600 text-base" />
            </div>
            <div>
              <p className="text-xs font-bold text-primary-900">
                {t('dashboard.reports.previewMode') || 'Connectez-vous pour accéder à vos rapports'}
              </p>
              <p className="text-[10px] text-primary-700 mt-0.5">
                Vos rapports générés apparaîtront ici une fois connecté.
              </p>
            </div>
          </div>
          <a
            href="/dashboard"
            className="px-4 py-2 rounded-lg bg-primary-500 text-white text-xs font-semibold hover:bg-primary-600 transition-colors whitespace-nowrap flex-shrink-0"
          >
            Se connecter
          </a>
        </div>

        {/* Reports list */}
        <div className="space-y-2">
          {filteredReports.map((rpt) => {
            const isExpanded = expandedReport === rpt.id;
            const fmt = formatIcon(rpt.format);

            return (
              <div
                key={rpt.id}
                className="bg-white rounded-lg border border-background-200/70 hover:border-background-300/60 transition-colors"
              >
                {/* Row */}
                <div className="flex items-center gap-4 p-4">
                  {/* Format icon */}
                  <div className="flex-shrink-0">
                    <i className={`${fmt.icon} text-2xl ${fmt.color}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-[10px] text-foreground-500">{rpt.id}</span>
                      <span className={typeBadge(rpt.type)}>
                        {t(`dashboard.reports.types.${rpt.type}`)}
                      </span>
                      {rpt.status === 'generating' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                          <i className="ri-loader-4-line animate-spin" />
                          {t('dashboard.reports.status.generating')}
                        </span>
                      )}
                      {rpt.status === 'ready' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                          {t('dashboard.reports.status.ready')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-foreground-950 line-clamp-1">{rpt.title}</p>
                    <div className="flex items-center gap-4 mt-1.5 text-[10px] text-foreground-600 flex-wrap">
                      <span><i className="ri-user-line text-xs mr-0.5" />{rpt.author}</span>
                      <span><i className="ri-map-pin-line text-xs mr-0.5" />{rpt.region}</span>
                      <span>{rpt.countries.length} {t('dashboard.reports.countries').toLowerCase()}</span>
                      <span>{rpt.alertCount} {t('dashboard.reports.alertsIncluded').toLowerCase()} · {rpt.corrCount} {t('dashboard.reports.corrsIncluded').toLowerCase()}</span>
                      <span>{formatTime(rpt.generatedAt)}</span>
                      {rpt.size && rpt.size !== '--' && <span className="text-[10px]">{rpt.size}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownload(rpt, 'pdf')}
                      disabled={rpt.status !== 'ready'}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="PDF"
                    >
                      <i className="ri-file-pdf-2-line text-base" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(rpt, 'word')}
                      disabled={rpt.status !== 'ready'}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Word"
                    >
                      <i className="ri-file-word-2-line text-base" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(rpt, 'excel')}
                      disabled={rpt.status !== 'ready'}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Excel"
                    >
                      <i className="ri-file-excel-2-line text-base" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShare(rpt)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 text-foreground-500 hover:bg-background-200 hover:text-foreground-700 transition-colors"
                      title={t('share.title')}
                    >
                      <i className="ri-share-forward-line text-base" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedReport(isExpanded ? null : rpt.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-500 hover:bg-background-100 transition-colors"
                    >
                      <i className={isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-background-100 pt-3">
                    <p className="text-xs text-foreground-950 leading-relaxed mb-3">{rpt.summary}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                      <div>
                        <span className="font-semibold uppercase tracking-wider text-foreground-600 block mb-0.5">{t('dashboard.reports.type')}</span>
                        <span className="text-foreground-950">{t(`dashboard.reports.types.${rpt.type}`)}</span>
                      </div>
                      <div>
                        <span className="font-semibold uppercase tracking-wider text-foreground-600 block mb-0.5">{t('dashboard.reports.format')}</span>
                        <span className="text-foreground-950 uppercase">{rpt.format}</span>
                      </div>
                      <div>
                        <span className="font-semibold uppercase tracking-wider text-foreground-600 block mb-0.5">{t('dashboard.reports.countries')}</span>
                        <span className="text-foreground-950">{rpt.countries.join(', ')}</span>
                      </div>
                      <div>
                        <span className="font-semibold uppercase tracking-wider text-foreground-600 block mb-0.5">{t('dashboard.reports.author')}</span>
                        <span className="text-foreground-950">{rpt.author}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredReports.length === 0 && (
            <div className="py-12 text-center text-foreground-500 text-xs bg-white rounded-lg border border-background-200/70">
              {t('dashboard.reports.empty')}
            </div>
          )}
        </div>

        {/* Simple footer */}
        <div className="border-t border-background-200/70 pt-4 pb-6 text-center">
          <p className="text-[10px] text-foreground-500">
            SentiqS — Security Monitoring · 54 African Countries
          </p>
        </div>
      </main>
    </div>
  );
}