import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ReportContent {
  executiveSummary: string;
  sections: Array<{ title: string; text: string }>;
  stats: Array<{ label: string; value: string | number }>;
  alertsIncluded: Array<{
    id: string;
    title: string;
    severity: string;
    locality: string;
    department: string;
  }>;
  correlationsIncluded: Array<{
    id: string;
    type: string;
    strength: string;
    confidence: number;
    description: string;
  }>;
  charts: Array<{ label: string; values: number[]; max: number }>;
}

interface ReportViewerProps {
  open: boolean;
  onClose: () => void;
  onDownload: (report: ReportViewerProps['report'] & { id: string }) => void;
  report: {
    id: string;
    title: string;
    titleEn?: string;
    type: string;
    format: string;
    region: string;
    countries: string[];
    localities?: string[];
    alertCount: number;
    corrCount: number;
    generatedAt: string;
    status: string;
    size: string;
    author: string;
    summary: string;
    content?: ReportContent;
  } | null;
}

const severityColor = (s: string) => {
  if (s === 'critical') return 'bg-red-50 text-red-700 border-red-200';
  if (s === 'high') return 'bg-orange-50 text-orange-700 border-orange-200';
  if (s === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-gray-50 text-gray-600 border-gray-200';
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

const correlationTypeLabel = (tp: string) => {
  const map: Record<string, string> = {
    direct: 'Directe',
    cluster: 'Cluster',
    chain: 'Chaîne',
    pattern: 'Schéma',
  };
  return map[tp] || tp;
};

export default function ReportViewer({ open, onClose, onDownload, report }: ReportViewerProps) {
  const { t, i18n } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showExportMenu) {
          setShowExportMenu(false);
        } else {
          onClose();
        }
      }
    };
    const handleClick = (e: MouseEvent) => {
      if (
        showExportMenu &&
        exportBtnRef.current &&
        !exportBtnRef.current.contains(e.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
      document.body.style.overflow = '';
    };
  }, [open, onClose, showExportMenu]);

  if (!open || !report) return null;

  const fmt = formatIcon(report.format);
  const content = report.content;
  const genDate = new Date(report.generatedAt).toLocaleDateString(
    i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  );

  const handleExportFormat = (fmtKey: string) => {
    setShowExportMenu(false);
    if (fmtKey === 'pdf' && report) {
      onDownload(report as ReportViewerProps['report'] & { id: string });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-3xl h-full bg-white flex flex-col animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex-shrink-0">
            <i className={`${fmt.icon} text-3xl ${fmt.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-[10px] text-gray-400">{report.id}</span>
              <span className={typeBadge(report.type)}>
                {t(`dashboard.reports.types.${report.type}`)}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                {t('dashboard.reports.status.ready')}
              </span>
            </div>
            <h2 className="text-sm font-bold text-sentiqs-navy leading-snug">{report.title}</h2>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-sentiqs-gray-text flex-wrap">
              <span><i className="ri-user-line mr-0.5" />{report.author}</span>
              <span><i className="ri-map-pin-line mr-0.5" />{report.region}</span>
              <span>{report.countries.join(', ')}</span>
              <span><i className="ri-calendar-line mr-0.5" />{genDate}</span>
              <span>{report.size}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-sentiqs-gray-text hover:bg-gray-100 transition-colors flex-shrink-0 cursor-pointer"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Executive summary */}
          {content && (
            <div className="bg-sentiqs-navy/5 border border-sentiqs-navy/10 rounded-lg p-4">
              <h3 className="text-xs font-bold text-sentiqs-navy mb-2 flex items-center gap-1.5">
                <i className="ri-file-list-3-line" />
                {t('dashboard.reports.viewer.executiveSummary')}
              </h3>
              <p className="text-xs text-sentiqs-navy/80 leading-relaxed">{content.executiveSummary}</p>
            </div>
          )}

          {/* Stats grid */}
          {content && content.stats.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {content.stats.map((s, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-sentiqs-navy">{s.value}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Sections */}
          {content && content.sections.map((sec, i) => (
            <div key={i}>
              <h3 className="text-xs font-bold text-sentiqs-navy mb-2">{sec.title}</h3>
              <p className="text-xs text-foreground-700 leading-relaxed whitespace-pre-line">{sec.text}</p>
            </div>
          ))}

          {/* Charts */}
          {content && content.charts.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-sentiqs-navy mb-3 flex items-center gap-1.5">
                <i className="ri-bar-chart-box-line" />
                {t('dashboard.reports.viewer.charts')}
              </h3>
              <div className="space-y-4">
                {content.charts.map((chart, ci) => (
                  <div key={ci} className="bg-white border border-gray-100 rounded-lg p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-3">{chart.label}</div>
                    <div className="flex items-end gap-1.5 h-28">
                      {chart.values.map((v, vi) => {
                        const pct = (v / chart.max) * 100;
                        return (
                          <div key={vi} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className="w-full bg-sentiqs-navy/80 rounded-t transition-all duration-500"
                              style={{ height: `${pct}%` }}
                            />
                            <span className="text-[9px] text-sentiqs-gray-text font-mono">{v}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerts included */}
          {content && content.alertsIncluded.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-sentiqs-navy mb-3 flex items-center gap-1.5">
                <i className="ri-alarm-warning-line" />
                {t('dashboard.reports.viewer.alertsIncluded')}
              </h3>
              <div className="space-y-2">
                {content.alertsIncluded.map((alt) => (
                  <div key={alt.id} className="flex items-start gap-3 bg-white border border-gray-100 rounded-lg p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border flex-shrink-0 ${severityColor(alt.severity)}`}>
                      {t(`dashboard.reports.viewer.severity.${alt.severity}`)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-sentiqs-navy">{alt.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-sentiqs-gray-text flex-wrap">
                        <span className="font-mono">{alt.id}</span>
                        <span>{alt.locality}, {alt.department}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correlations included */}
          {content && content.correlationsIncluded.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-sentiqs-navy mb-3 flex items-center gap-1.5">
                <i className="ri-links-line" />
                {t('dashboard.reports.viewer.correlationsIncluded')}
              </h3>
              <div className="space-y-2">
                {content.correlationsIncluded.map((cor) => (
                  <div key={cor.id} className="flex items-start gap-3 bg-white border border-gray-100 rounded-lg p-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <i className="ri-links-line text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-[10px] text-gray-400">{cor.id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200">
                          {correlationTypeLabel(cor.type)}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          cor.strength === 'strong'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {t(`dashboard.reports.viewer.strength.${cor.strength === 'strong' ? 'strong' : 'medium'}`)}
                        </span>
                      </div>
                      <p className="text-xs text-sentiqs-navy">{cor.description}</p>
                      <div className="text-[10px] text-sentiqs-gray-text mt-1">{t('dashboard.reports.viewer.confidence')}: {cor.confidence}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Simple summary fallback if no content */}
          {!content && (
            <div>
              <h3 className="text-xs font-bold text-sentiqs-navy mb-2">{t('dashboard.reports.viewer.summary')}</h3>
              <p className="text-xs text-foreground-700 leading-relaxed">{report.summary}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {/* Export dropdown */}
            <div className="relative">
              <button
                ref={exportBtnRef}
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-3 py-2 text-xs font-semibold text-white bg-sentiqs-navy rounded-lg hover:bg-sentiqs-navy/90 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-download-line" />
                {t('dashboard.reports.viewer.export')}
                <i className={showExportMenu ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />
              </button>

              {showExportMenu && (
                <div className="absolute bottom-full left-0 mb-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-[60] animate-in slide-in-from-bottom-2 duration-150">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {t('dashboard.reports.viewer.exportAs')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExportFormat('pdf')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-file-pdf-2-line text-red-500 text-base" />
                    PDF — {t('dashboard.reports.viewer.realPdfHint')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportFormat('word')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-file-word-2-line text-blue-500 text-base" />
                    Word
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportFormat('excel')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-file-excel-2-line text-emerald-600 text-base" />
                    Excel
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-sentiqs-gray-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              {t('share.close')}
            </button>
          </div>
          <span className="text-[10px] text-sentiqs-gray-text">
            SentiqS · {genDate}
          </span>
        </div>
      </div>
    </div>
  );
}