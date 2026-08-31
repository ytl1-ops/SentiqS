import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { reports } from '@/mocks/dashboard';
import ShareModal from '@/components/feature/ShareModal';
import ReportViewer from './components/ReportViewer';
import ScheduledReportsPanel from './components/ScheduledReports';
import EmptyState from '@/components/base/EmptyState';
import { generatePdfReport, generatePdfBatch } from './utils/pdfGenerator';
import { formatDateTime } from '@/utils/timeFormat';

type ReportType = typeof reports[0];
type TypeFilter = string;
type RegionFilter = string;
type FormatFilter = string;

export default function ReportsPage() {
  const { t, i18n } = useTranslation();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [search, setSearch] = useState('');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<ReportType | null>(null);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerReport, setViewerReport] = useState<ReportType | null>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Date filter state
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

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
    // Date filter
    const now = new Date();
    if (dateFilter === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      rs = rs.filter((r) => new Date(r.generatedAt) >= todayStart);
    } else if (dateFilter === 'this_week') {
      const dayOfWeek = now.getDay();
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((dayOfWeek + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      rs = rs.filter((r) => new Date(r.generatedAt) >= monday);
    } else if (dateFilter === 'this_month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      rs = rs.filter((r) => new Date(r.generatedAt) >= monthStart);
    } else if (dateFilter === 'custom') {
      if (customStart) {
        const start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
        rs = rs.filter((r) => new Date(r.generatedAt) >= start);
      }
      if (customEnd) {
        const end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        rs = rs.filter((r) => new Date(r.generatedAt) <= end);
      }
    }
    return rs;
  }, [typeFilter, regionFilter, formatFilter, search, dateFilter, customStart, customEnd]);

  const counts = useMemo(() => {
    return {
      total: reports.length,
      ready: reports.filter((r) => r.status === 'ready').length,
      generating: reports.filter((r) => r.status === 'generating').length,
    };
  }, []);

  const readyFilteredIds = useMemo(() => {
    return new Set(filteredReports.filter((r) => r.status === 'ready').map((r) => r.id));
  }, [filteredReports]);

  const allFilteredReadySelected = useMemo(() => {
    if (readyFilteredIds.size === 0) return false;
    return Array.from(readyFilteredIds).every((id) => selectedIds.has(id));
  }, [selectedIds, readyFilteredIds]);

  const selectedReports = useMemo(() => {
    return reports.filter((r) => selectedIds.has(r.id) && r.status === 'ready');
  }, [selectedIds]);



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

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allFilteredReadySelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(readyFilteredIds));
    }
  }, [allFilteredReadySelected, readyFilteredIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleDownloadSingle = useCallback((rpt: ReportType, fmt: string) => {
    if (fmt === 'pdf') {
      try {
        generatePdfReport(rpt);
        const msg = `"${rpt.id}" — PDF ${t('dashboard.reports.toast.downloaded')}`;
        setDownloadToast(msg);
      } catch {
        setDownloadToast(t('dashboard.reports.toast.error'));
      }
    } else {
      const msg = `"${rpt.id}" — ${fmt.toUpperCase()} ${t('dashboard.reports.toast.downloaded')}`;
      setDownloadToast(msg);
    }
    setTimeout(() => setDownloadToast(null), 2500);
  }, [t]);

  const handleBatchExport = useCallback(() => {
    if (selectedReports.length === 0) return;
    try {
      generatePdfBatch(selectedReports);
      const msg = `${selectedReports.length} ${t('dashboard.reports.toast.batchDownloaded')}`;
      setDownloadToast(msg);
    } catch {
      setDownloadToast(t('dashboard.reports.toast.error'));
    }
    setTimeout(() => setDownloadToast(null), 2500);
  }, [selectedReports, t]);

  const handleShare = (rpt: ReportType) => {
    setShareTarget(rpt);
    setShareModalOpen(true);
  };

  const handleOpenViewer = (rpt: ReportType) => {
    setViewerReport(rpt);
    setViewerOpen(true);
  };

  const handleViewerDownload = useCallback((rpt: ReportType) => {
    try {
      generatePdfReport(rpt);
      const msg = `"${rpt.id}" — PDF ${t('dashboard.reports.toast.downloaded')}`;
      setDownloadToast(msg);
    } catch {
      setDownloadToast(t('dashboard.reports.toast.error'));
    }
    setTimeout(() => setDownloadToast(null), 2500);
  }, [t]);

  const selectionCount = selectedIds.size;

  return (
    <div className="space-y-5">
      {/* Download toast */}
      {downloadToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-sentiqs-navy text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300">
          <i className="ri-check-line text-emerald-400 text-sm" />
          {downloadToast}
        </div>
      )}

      {/* Report Viewer */}
      <ReportViewer
        open={viewerOpen}
        onClose={() => { setViewerOpen(false); setViewerReport(null); }}
        onDownload={(rpt) => handleViewerDownload(rpt)}
        report={viewerReport}
      />

      {/* Share Modal */}
      {shareTarget && (
        <ShareModal
          open={shareModalOpen}
          onClose={() => { setShareModalOpen(false); setShareTarget(null); }}
          itemTitle={shareTarget.title}
          itemType={`${t('dashboard.reports')} ${shareTarget.id}`}
        />
      )}

      {/* Batch actions bar */}
      {selectionCount > 0 && (
        <div className="sticky top-0 z-40 bg-sentiqs-navy text-white rounded-lg px-4 py-3 flex items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-200 shadow-lg">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={clearSelection}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-white/15 hover:bg-white/25 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-sm" />
            </button>
            <span className="text-xs font-semibold">
              {selectionCount} {selectionCount > 1 ? t('dashboard.reports.multi.selected') : t('dashboard.reports.multi.selectedOne')}
            </span>
          </div>
          <button
            type="button"
            onClick={handleBatchExport}
            disabled={selectedReports.length === 0}
            className="px-4 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-download-line" />
            {t('dashboard.reports.multi.exportPdf')} ({selectedReports.length})
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 anim-entry-down">
        <div>
          <h1 className="text-lg font-bold text-sentiqs-navy">{t('dashboard.reports.title')}</h1>
          <p className="text-xs text-sentiqs-gray-text mt-0.5">{t('dashboard.reports.subtitle')}</p>
        </div>
        <button
          type="button"
          className="text-[10px] font-semibold text-sentiqs-navy bg-white border border-gray-200 hover:border-sentiqs-navy/30 hover:bg-sentiqs-navy/5 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <i className="ri-add-line text-xs" /> {t('dashboard.reports.generateNew')}
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-gray-100 p-3 anim-entry-scale" style={{ animationDelay: '100ms' }}>
          <div className="text-2xl font-bold text-sentiqs-navy">{counts.total}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mt-0.5">{t('dashboard.reports.total')}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-3 anim-entry-scale" style={{ animationDelay: '180ms' }}>
          <div className="text-2xl font-bold text-emerald-600">{counts.ready}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mt-0.5">{t('dashboard.reports.ready')}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-3 anim-entry-scale" style={{ animationDelay: '260ms' }}>
          <div className="text-2xl font-bold text-amber-500">{counts.generating}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mt-0.5">{t('dashboard.reports.generating')}</div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex-1 min-w-[200px]">
          <i className="ri-search-line text-sentiqs-gray-text text-sm mr-2" />
          <input
            type="text"
            placeholder={t('dashboard.reports.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-sentiqs-navy placeholder:text-gray-400 focus:outline-none w-full"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 bg-white text-sentiqs-gray-text focus:outline-none focus:border-sentiqs-navy whitespace-nowrap"
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
          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 bg-white text-sentiqs-gray-text focus:outline-none focus:border-sentiqs-navy whitespace-nowrap"
        >
          <option value="all">{t('dashboard.reports.allRegions')}</option>
          {regions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <select
          value={formatFilter}
          onChange={(e) => setFormatFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 bg-white text-sentiqs-gray-text focus:outline-none focus:border-sentiqs-navy whitespace-nowrap"
        >
          <option value="all">{t('dashboard.reports.allFormats')}</option>
          <option value="pdf">PDF</option>
          <option value="word">Word</option>
          <option value="excel">Excel</option>
        </select>

        {/* Date filter */}
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 bg-white text-sentiqs-gray-text focus:outline-none focus:border-sentiqs-navy whitespace-nowrap"
        >
          <option value="all">{t('dashboard.reports.dateFilter.all')}</option>
          <option value="today">{t('dashboard.reports.dateFilter.today')}</option>
          <option value="this_week">{t('dashboard.reports.dateFilter.thisWeek')}</option>
          <option value="this_month">{t('dashboard.reports.dateFilter.thisMonth')}</option>
          <option value="custom">{t('dashboard.reports.dateFilter.custom')}</option>
        </select>

        {/* Custom date inputs */}
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-sentiqs-gray-text">{t('dashboard.reports.dateFilter.start')}</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 bg-white text-sentiqs-navy focus:outline-none focus:border-sentiqs-navy"
            />
            <span className="text-[10px] font-semibold text-sentiqs-gray-text">{t('dashboard.reports.dateFilter.end')}</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 bg-white text-sentiqs-navy focus:outline-none focus:border-sentiqs-navy"
            />
          </div>
        )}

        {/* Select all toggle */}
        <button
          type="button"
          onClick={toggleSelectAll}
          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 bg-white text-sentiqs-gray-text hover:border-sentiqs-navy/30 hover:bg-sentiqs-navy/5 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
        >
          <i className={allFilteredReadySelected ? 'ri-checkbox-circle-fill text-sentiqs-navy' : 'ri-checkbox-blank-circle-line'} />
          {allFilteredReadySelected ? t('dashboard.reports.multi.deselectAll') : t('dashboard.reports.multi.selectAll')}
        </button>
      </div>

      {/* Reports list */}
      <div className="space-y-2">
        {filteredReports.map((rpt, idx) => {
          const isExpanded = expandedReport === rpt.id;
          const fmt = formatIcon(rpt.format);
          const hasContent = !!rpt.content;
          const isReady = rpt.status === 'ready';
          const isNew = (new Date().getTime() - new Date(rpt.generatedAt).getTime()) < 24 * 60 * 60 * 1000;
          const isSelected = selectedIds.has(rpt.id);

          return (
            <div
              key={rpt.id}
              className="bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors anim-entry-right"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {/* Row */}
              <div className="flex items-center gap-3 p-4">
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => isReady && toggleSelect(rpt.id)}
                  disabled={!isReady}
                  className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-sentiqs-navy text-white'
                      : isReady
                        ? 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-sentiqs-navy'
                        : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <i className={isSelected ? 'ri-check-line text-sm' : 'ri-checkbox-blank-line text-sm'} />
                </button>

                {/* Format icon */}
                <div className="flex-shrink-0">
                  <i className={`${fmt.icon} text-2xl ${fmt.color}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[10px] text-sentiqs-gray-text">{rpt.id}</span>
                    {isNew && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 animate-pulse flex items-center gap-1">
                        <i className="ri-sparkling-2-line text-[11px]" />
                        {t('dashboard.reports.newBadge')}
                      </span>
                    )}
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
                  <p className="text-xs font-semibold text-sentiqs-navy line-clamp-1">{rpt.title}</p>
                  <div className="flex items-center gap-4 mt-1.5 text-[10px] text-sentiqs-gray-text flex-wrap">
                    <span><i className="ri-user-line text-xs mr-0.5" />{rpt.author}</span>
                    <span><i className="ri-map-pin-line text-xs mr-0.5" />{rpt.region}</span>
                    <span>{rpt.countries.length} {t('dashboard.reports.countries').toLowerCase()}</span>
                    <span>{rpt.alertCount} {t('dashboard.reports.alertsIncluded').toLowerCase()} · {rpt.corrCount} {t('dashboard.reports.corrsIncluded').toLowerCase()}</span>
                    <span>{formatDateTime(rpt.generatedAt, i18n.language, true)}</span>
                    {rpt.size && rpt.size !== '--' && <span className="text-[10px]">{rpt.size}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* View report */}
                  <button
                    type="button"
                    onClick={() => handleOpenViewer(rpt)}
                    disabled={!hasContent}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-sentiqs-navy/5 text-sentiqs-navy hover:bg-sentiqs-navy/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title={t('dashboard.reports.viewer.title')}
                  >
                    <i className="ri-eye-line text-base" />
                  </button>
                  {/* PDF export */}
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(rpt, 'pdf')}
                    disabled={!isReady}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="PDF"
                  >
                    <i className="ri-file-pdf-2-line text-base" />
                  </button>
                  {/* Word export */}
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(rpt, 'word')}
                    disabled={!isReady}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Word"
                  >
                    <i className="ri-file-word-2-line text-base" />
                  </button>
                  {/* Excel export */}
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(rpt, 'excel')}
                    disabled={!isReady}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Excel"
                  >
                    <i className="ri-file-excel-2-line text-base" />
                  </button>
                  {/* Share */}
                  <button
                    type="button"
                    onClick={() => handleShare(rpt)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-sentiqs-gray-text hover:bg-gray-100 hover:text-sentiqs-navy transition-colors cursor-pointer"
                    title={t('share.title')}
                  >
                    <i className="ri-share-forward-line text-base" />
                  </button>
                  {/* Expand toggle */}
                  <button
                    type="button"
                    onClick={() => setExpandedReport(isExpanded ? null : rpt.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-sentiqs-gray-text hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <i className={isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-50 pt-3">
                  <p className="text-xs text-sentiqs-navy leading-relaxed mb-3">{rpt.summary}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                    <div>
                      <span className="font-semibold uppercase tracking-wider text-sentiqs-gray-text block mb-0.5">{t('dashboard.reports.type')}</span>
                      <span className="text-sentiqs-navy">{t(`dashboard.reports.types.${rpt.type}`)}</span>
                    </div>
                    <div>
                      <span className="font-semibold uppercase tracking-wider text-sentiqs-gray-text block mb-0.5">{t('dashboard.reports.format')}</span>
                      <span className="text-sentiqs-navy uppercase">{rpt.format}</span>
                    </div>
                    <div>
                      <span className="font-semibold uppercase tracking-wider text-sentiqs-gray-text block mb-0.5">{t('dashboard.reports.countries')}</span>
                      <span className="text-sentiqs-navy">{rpt.countries.join(', ')}</span>
                    </div>
                    <div>
                      <span className="font-semibold uppercase tracking-wider text-sentiqs-gray-text block mb-0.5">{t('dashboard.reports.author')}</span>
                      <span className="text-sentiqs-navy">{rpt.author}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredReports.length === 0 && (
          <EmptyState
            icon="ri-file-chart-line"
            title={t('dashboard.reports.empty')}
          />
        )}
      </div>

      {/* Scheduled Reports Section */}
      <ScheduledReportsPanel />
    </div>
  );
}