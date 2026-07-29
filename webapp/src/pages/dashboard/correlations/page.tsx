import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useVeille, correlations as derivedCorrelations, alertes, risquePays, type VeilleCorrelation } from '@/lib/veille';
import ShareModal from '@/components/feature/ShareModal';

type CorrType = VeilleCorrelation;
// Le type 'pattern' n'existe plus : les corrélations réelles se classent par
// le nombre de sources concordantes (voir veille.correlations).
type TypeFilter = 'all' | 'direct' | 'cluster' | 'chain';
type StrengthFilter = 'all' | 'strong' | 'medium' | 'low';
type RegionFilter = string;
type SeverityFilter = string;

interface GraphNode {
  id: string;
  label: string;
  type: 'alert' | 'country';
  x: number;
  y: number;
  severity?: string;
  risk?: string;
  country?: string;
  alertId?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  strength: string;
  corrId: string;
}

export default function CorrelationsPage() {
  const { t } = useTranslation();
  const { articles, loading, error, recharger } = useVeille();
  const correlations = useMemo(() => derivedCorrelations(articles), [articles]);
  const dashboardAlerts = useMemo(() => alertes(articles), [articles]);
  const countryRiskLevels = useMemo(() => risquePays(articles), [articles]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [strengthFilter, setStrengthFilter] = useState<StrengthFilter>('all');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredCorr, setHoveredCorr] = useState<string | null>(null);
  const [expandedCorr, setExpandedCorr] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fsScale, setFsScale] = useState(1.6);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string } | null>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const GRAPH_WIDTH = 680;
  const GRAPH_HEIGHT = 460;

  const regions = useMemo(() => {
    const set = new Set(correlations.map((c) => c.region));
    return Array.from(set);
  }, [correlations]);

  const enterFullscreen = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scaleX = (vw * 0.92) / GRAPH_WIDTH;
    const scaleY = (vh * 0.88) / GRAPH_HEIGHT;
    setFsScale(Math.min(scaleX, scaleY, 2.2));
    setFullscreen(true);
    document.body.style.overflow = 'hidden';
  }, [GRAPH_WIDTH, GRAPH_HEIGHT]);

  const exitFullscreen = useCallback(() => {
    setFullscreen(false);
    document.body.style.overflow = '';
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitFullscreen();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [fullscreen, exitFullscreen]);

  const filteredCorrelations = useMemo(() => {
    let cs = [...correlations];
    if (typeFilter !== 'all') cs = cs.filter((c) => c.type === typeFilter);
    if (strengthFilter !== 'all') cs = cs.filter((c) => c.strength === strengthFilter);
    if (regionFilter !== 'all') cs = cs.filter((c) => c.region === regionFilter);
    if (severityFilter !== 'all') cs = cs.filter((c) => c.alertSeverity === severityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      cs = cs.filter(
        (c) =>
          c.alertTitle.toLowerCase().includes(q) ||
          c.country.toLowerCase().includes(q) ||
          c.region.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q),
      );
    }
    return cs;
  }, [correlations, typeFilter, strengthFilter, regionFilter, severityFilter, search]);

  const { graphNodes, graphEdges } = useMemo(() => {
    const nodes: GraphNode[] = [];
    const nodeMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    // Fixed layout positions — countries arranged in a grid-like map
    const countryPositions: Record<string, { x: number; y: number }> = {
      'Maroc': { x: 80, y: 50 },
      'Algérie': { x: 180, y: 70 },
      'Mauritanie': { x: 60, y: 130 },
      'Mali': { x: 160, y: 150 },
      'Niger': { x: 260, y: 160 },
      'Tchad': { x: 340, y: 170 },
      'Soudan': { x: 420, y: 150 },
      'Sénégal': { x: 30, y: 200 },
      'Guinée': { x: 80, y: 240 },
      'Burkina Faso': { x: 160, y: 230 },
      'Nigeria': { x: 260, y: 250 },
      'Cameroun': { x: 300, y: 290 },
      'Côte d\'Ivoire': { x: 130, y: 310 },
      'Ghana': { x: 170, y: 330 },
      'Guinée Équatoriale': { x: 260, y: 350 },
      'RDC': { x: 380, y: 340 },
      'Ouganda': { x: 480, y: 290 },
      'Rwanda': { x: 450, y: 340 },
      'Burundi': { x: 460, y: 370 },
      'Kenya': { x: 540, y: 300 },
      'Éthiopie': { x: 540, y: 200 },
      'Somalie': { x: 580, y: 240 },
      'Tanzanie': { x: 540, y: 380 },
      'Yémen': { x: 620, y: 200 },
    };

    // Collect unique countries from filtered correlations
    const countrySet = new Set<string>();
    const alertSet = new Set<string>();
    filteredCorrelations.forEach((c) => {
      countrySet.add(c.country);
      alertSet.add(c.alertId);
    });

    // Create country nodes
    countrySet.forEach((cname) => {
      const risk = countryRiskLevels.find((r) => r.country === cname);
      const pos = countryPositions[cname] || { x: Math.random() * 560 + 60, y: Math.random() * 340 + 50 };
      const node: GraphNode = {
        id: `country-${cname}`,
        label: cname,
        type: 'country',
        x: pos.x,
        y: pos.y,
        risk: risk?.risk || 'low',
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    });

    // Create alert nodes (positioned near their primary country)
    alertSet.forEach((aid) => {
      const alert = dashboardAlerts.find((a) => a.id === aid);
      if (!alert) return;
      const countryPos = countryPositions[alert.country] || { x: 320, y: 220 };
      const existingForCountry = nodes.filter((n) => n.type === 'alert' && n.country === alert.country).length;
      const offsetX = (existingForCountry % 3 - 1) * 55;
      const offsetY = Math.floor(existingForCountry / 3) * 40 - 20;
      const node: GraphNode = {
        id: `alert-${aid}`,
        label: alert.country,
        type: 'alert',
        x: countryPos.x + offsetX,
        y: countryPos.y + offsetY + 30,
        severity: alert.severity,
        country: alert.country,
        alertId: aid,
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    });

    // Create edges based on correlations
    filteredCorrelations.forEach((c) => {
      const alertNodeId = `alert-${c.alertId}`;
      const primaryCountryNodeId = `country-${c.country}`;

      // Edge from alert to its primary country
      if (nodeMap.has(alertNodeId) && nodeMap.has(primaryCountryNodeId)) {
        edges.push({
          from: alertNodeId,
          to: primaryCountryNodeId,
          strength: c.strength,
          corrId: c.id,
        });
      }

    });

    return { graphNodes: nodes, graphEdges: edges };
  }, [filteredCorrelations, dashboardAlerts, countryRiskLevels]);

  const selectedCorrelations = useMemo(() => {
    if (!selectedNode) return [];
    const isAlert = selectedNode.startsWith('alert-');
    const alertId = selectedNode.replace('alert-', '');
    const countryName = selectedNode.replace('country-', '');

    if (isAlert) {
      return filteredCorrelations.filter((c) => c.alertId === alertId);
    }
    return filteredCorrelations.filter(
      (c) => c.country === countryName,
    );
  }, [selectedNode, filteredCorrelations]);

  const typeCounts = useMemo(() => {
    const c = { direct: 0, cluster: 0, chain: 0, total: correlations.length };
    correlations.forEach((co) => {
      if (co.type in c) c[co.type as keyof typeof c]++;
    });
    return c;
  }, [correlations]);

  const nodeColor = (node: GraphNode) => {
    if (node.type === 'alert') {
      const map: Record<string, string> = {
        critical: '#dc2626',
        high: '#ea580c',
        medium: '#ca8a04',
        low: '#16a34a',
      };
      return map[node.severity || 'medium'] || '#64748b';
    }
    const map: Record<string, string> = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#ca8a04',
      low: '#16a34a',
    };
    return map[node.risk || 'low'] || '#64748b';
  };

  const nodeBorderColor = (node: GraphNode) => {
    if (selectedNode === node.id) return '#1a2d4a';
    if (node.type === 'alert') return nodeColor(node);
    return nodeColor(node);
  };

  const edgeColor = (strength: string) => {
    const map: Record<string, string> = {
      strong: 'rgba(220,38,38,0.35)',
      medium: 'rgba(234,179,8,0.3)',
      low: 'rgba(100,116,139,0.2)',
    };
    return map[strength] || 'rgba(100,116,139,0.2)';
  };

  const edgeWidth = (strength: string) => {
    const map: Record<string, string> = {
      strong: '2.5',
      medium: '1.5',
      low: '0.8',
    };
    return map[strength] || '0.8';
  };

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

  const severityBadgeSmall = (s: string) => {
    const map: Record<string, string> = {
      critical: 'bg-red-100 text-red-700 border-red-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
    return `px-2 py-0.5 rounded text-[10px] font-semibold border ${map[s] || ''}`;
  };

  const confidenceColor = (v: number) => {
    if (v >= 90) return 'text-emerald-600';
    if (v >= 75) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const isNodeConnected = (nodeId: string) => {
    if (!selectedNode) return false;
    return graphEdges.some(
      (e) =>
        (e.from === selectedNode && e.to === nodeId) ||
        (e.to === selectedNode && e.from === nodeId),
    );
  };

  const isEdgeHighlighted = (corrId: string) => {
    if (hoveredCorr) return corrId === hoveredCorr;
    if (selectedNode) {
      return selectedCorrelations.some((c) => c.id === corrId);
    }
    return false;
  };

  const isNodeHighlighted = (nodeId: string) => {
    if (selectedNode && nodeId === selectedNode) return true;
    if (selectedNode && isNodeConnected(nodeId)) return true;
    if (!selectedNode && !hoveredCorr) return true;
    if (hoveredCorr) {
      const corr = correlations.find((c) => c.id === hoveredCorr);
      if (!corr) return false;
      return (
        nodeId === `alert-${corr.alertId}` ||
        nodeId === `country-${corr.country}` ||
        false
      );
    }
    return true;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-100 h-20 animate-pulse" />
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
          itemType={`Corrélation ${shareTarget.id}`}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-sentiqs-navy">{t('dashboard.correlations.title')}</h1>
          <p className="text-xs text-sentiqs-gray-text mt-0.5">
            {filteredCorrelations.length} {t('dashboard.correlations.totalDetected')}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-sentiqs-gray-text">
          <span className="w-3 h-3 rounded-full bg-red-500" /> Alertes &nbsp;
          <span className="w-3 h-3 rounded-full bg-sentiqs-navy border-2 border-current" /> Pays
        </div>
      </div>

      {/* Type quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: 'direct', label: t('dashboard.correlations.types.direct'), color: 'bg-indigo-50 border-indigo-200 text-indigo-700', count: typeCounts.direct },
          { key: 'cluster', label: t('dashboard.correlations.types.cluster'), color: 'bg-violet-50 border-violet-200 text-violet-700', count: typeCounts.cluster },
          { key: 'chain', label: t('dashboard.correlations.types.chain'), color: 'bg-amber-50 border-amber-200 text-amber-700', count: typeCounts.chain },
        ] as const).map(({ key, label, color, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTypeFilter(typeFilter === key ? 'all' : key)}
            className={`rounded-lg border p-3 text-left transition-colors ${color} ${typeFilter === key ? 'ring-2 ring-offset-1 ring-current' : 'hover:opacity-80'}`}
          >
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5">{label}</div>
          </button>
        ))}
      </div>

      {/* Link Graph */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-sentiqs-navy">{t('dashboard.correlations.graph')}</h2>
          <div className="flex items-center gap-2">
            {selectedNode && (
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="text-[10px] font-semibold text-sentiqs-navy hover:underline flex items-center gap-1"
              >
                <i className="ri-close-circle-line text-xs" /> {t('dashboard.correlations.clearSelection')}
              </button>
            )}
            <button
              type="button"
              onClick={enterFullscreen}
              className="text-[10px] font-semibold text-sentiqs-gray-text hover:text-sentiqs-navy flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-sentiqs-navy/30 transition-colors whitespace-nowrap"
            >
              <i className="ri-fullscreen-line text-xs" /> {t('dashboard.correlations.fullscreen')}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
          <div className="relative" style={{ height: '440px' }}>
            <svg
              ref={svgRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 1 }}
            >
              {graphEdges.map((edge, i) => {
                const from = graphNodes.find((n) => n.id === edge.from);
                const to = graphNodes.find((n) => n.id === edge.to);
                if (!from || !to) return null;
                const highlighted = isEdgeHighlighted(edge.corrId);
                return (
                  <line
                    key={`${edge.from}-${edge.to}-${i}`}
                    x1={from.x}
                    y1={from.y + 18}
                    x2={to.x}
                    y2={to.y + 18}
                    stroke={highlighted ? edgeColor('strong') : edgeColor(edge.strength)}
                    strokeWidth={highlighted ? '3' : edgeWidth(edge.strength)}
                    strokeLinecap="round"
                    className="transition-all duration-300"
                    style={{ opacity: highlighted ? 1 : 0.5 }}
                  />
                );
              })}
            </svg>

            {/* Nodes layer */}
            <div className="absolute inset-0" style={{ zIndex: 2 }}>
              {graphNodes.map((node) => {
                const isAlert = node.type === 'alert';
                const highlighted = isNodeHighlighted(node.id);
                const connected = isNodeConnected(node.id);
                const isSelected = selectedNode === node.id;

                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNode(isSelected ? null : node.id)}
                    className="absolute transition-all duration-300 cursor-pointer"
                    style={{
                      left: `${node.x}px`,
                      top: `${node.y}px`,
                      transform: `translate(-50%, 0)`,
                      opacity: highlighted ? 1 : 0.25,
                      zIndex: isSelected ? 10 : connected ? 5 : 1,
                    }}
                  >
                    <div
                      className={`flex flex-col items-center gap-1 group ${
                        isSelected ? 'scale-110' : 'hover:scale-105'
                      } transition-transform`}
                    >
                      {isAlert ? (
                        <>
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center shadow-sm border-2 transition-colors"
                            style={{
                              backgroundColor: `${nodeColor(node)}15`,
                              borderColor: nodeBorderColor(node),
                            }}
                          >
                            <i
                              className="ri-alert-fill text-sm"
                              style={{ color: nodeColor(node) }}
                            />
                          </div>
                          <span
                            className="text-[9px] font-semibold whitespace-nowrap px-1.5 py-0.5 rounded-full border transition-colors"
                            style={{
                              backgroundColor: isSelected ? '#1a2d4a' : '#f8fafc',
                              color: isSelected ? '#fff' : '#1a2d4a',
                              borderColor: isSelected ? '#1a2d4a' : '#e2e8f0',
                            }}
                          >
                            {node.label}
                          </span>
                        </>
                      ) : (
                        <>
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm border-2 text-[10px] font-bold transition-colors"
                            style={{
                              backgroundColor: isSelected ? '#1a2d4a' : '#ffffff',
                              color: isSelected ? '#ffffff' : nodeColor(node),
                              borderColor: nodeBorderColor(node),
                            }}
                          >
                            {node.label.slice(0, 3).toUpperCase()}
                          </div>
                          <span
                            className="text-[9px] font-medium whitespace-nowrap max-w-[70px] truncate transition-colors"
                            style={{ color: isSelected ? '#1a2d4a' : '#475569' }}
                          >
                            {node.label}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Hint */}
            {!selectedNode && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-sentiqs-gray-text bg-white/80 px-3 py-1 rounded-full border border-gray-100" style={{ zIndex: 3 }}>
                <i className="ri-information-line mr-1" />
                {t('dashboard.correlations.clickNode')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected node detail panel */}
      {selectedNode && selectedCorrelations.length > 0 && (
        <div className="bg-sentiqs-navy text-white rounded-lg p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-3">
            {t('dashboard.correlations.selectedNode')}: {selectedNode.startsWith('alert-') ? 'Alerte' : 'Pays'} — {selectedCorrelations[0].country}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selectedCorrelations.map((corr) => (
              <div key={corr.id} className="bg-white/10 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={severityBadgeSmall(corr.alertSeverity)}>
                    {t(`dashboard.severity.${corr.alertSeverity}`)}
                  </span>
                  <span className={typeBadge(corr.type)}>
                    {t(`dashboard.correlations.types.${corr.type}`)}
                  </span>
                  <span className={strengthBadge(corr.strength)}>
                    {t(`dashboard.correlations.strengths.${corr.strength}`)}
                  </span>
                </div>
                <p className="text-xs opacity-90 leading-relaxed">{corr.description}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] opacity-60">
                  <span>{t('dashboard.correlations.confidence')}: <strong className={confidenceColor(corr.confidence)}>{corr.confidence}%</strong></span>
                  <span>{formatTime(corr.detectedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex-1 min-w-[200px]">
          <i className="ri-search-line text-sentiqs-gray-text text-sm mr-2" />
          <input
            type="text"
            placeholder={t('dashboard.correlations.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-sentiqs-navy placeholder:text-gray-400 focus:outline-none w-full"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {(['all', 'critical', 'high', 'medium', 'low'] as SeverityFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors whitespace-nowrap ${
                severityFilter === s
                  ? 'bg-sentiqs-navy text-white border-sentiqs-navy'
                  : 'bg-white text-sentiqs-gray-text border-gray-200 hover:border-gray-300'
              }`}
            >
              {s === 'all' ? t('dashboard.correlations.allSeverities') : t(`dashboard.severity.${s}`)}
            </button>
          ))}
        </div>

        <select
          value={strengthFilter}
          onChange={(e) => setStrengthFilter(e.target.value as StrengthFilter)}
          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 bg-white text-sentiqs-gray-text focus:outline-none focus:border-sentiqs-navy whitespace-nowrap"
        >
          <option value="all">{t('dashboard.correlations.allStrengths')}</option>
          <option value="strong">{t('dashboard.correlations.strengths.strong')}</option>
          <option value="medium">{t('dashboard.correlations.strengths.medium')}</option>
          <option value="low">{t('dashboard.correlations.strengths.low')}</option>
        </select>

        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 bg-white text-sentiqs-gray-text focus:outline-none focus:border-sentiqs-navy whitespace-nowrap"
        >
          <option value="all">{t('dashboard.correlations.allRegions')}</option>
          {regions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Correlation list */}
      <div>
        <h2 className="text-sm font-semibold text-sentiqs-navy mb-3">{t('dashboard.correlations.list')}</h2>
        <div className="space-y-2">
          {filteredCorrelations.map((corr) => {
            const isExpanded = expandedCorr === corr.id;
            const isHovered = hoveredCorr === corr.id;
            return (
              <div
                key={corr.id}
                className={`bg-white rounded-lg border transition-all duration-200 ${
                  isHovered ? 'border-sentiqs-navy/30 shadow-sm' : 'border-gray-100'
                }`}
                onMouseEnter={() => setHoveredCorr(corr.id)}
                onMouseLeave={() => setHoveredCorr(null)}
              >
                <button
                  type="button"
                  onClick={() => setExpandedCorr(isExpanded ? null : corr.id)}
                  className="w-full text-left p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-mono text-[10px] text-sentiqs-gray-text">{corr.id}</span>
                        <span className={severityBadgeSmall(corr.alertSeverity)}>
                          {t(`dashboard.severity.${corr.alertSeverity}`)}
                        </span>
                        <span className={typeBadge(corr.type)}>
                          {t(`dashboard.correlations.types.${corr.type}`)}
                        </span>
                        <span className={strengthBadge(corr.strength)}>
                          {t(`dashboard.correlations.strengths.${corr.strength}`)}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-sentiqs-navy line-clamp-1">{corr.alertTitle}</p>
                      <div className="flex items-center gap-4 mt-1.5 text-[10px] text-sentiqs-gray-text">
                        <span className="flex items-center gap-1">
                          <i className="ri-map-pin-line text-xs" /> {corr.country} ({corr.region})
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ri-links-line text-xs" /> {corr.sources.length} sources concordantes
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <div className={`text-sm font-bold ${confidenceColor(corr.confidence)}`}>{corr.confidence}%</div>
                        <div className="text-[9px] text-sentiqs-gray-text">{t('dashboard.correlations.confidence')}</div>
                      </div>
                      <i
                        className={`text-sentiqs-gray-text transition-transform ${
                          isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'
                        }`}
                      />
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-50 pt-3">
                    <p className="text-xs text-sentiqs-navy leading-relaxed mb-3">{corr.description}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                      <div>
                        <span className="font-semibold uppercase tracking-wider text-sentiqs-gray-text block mb-0.5">{t('dashboard.correlations.alertSource')}</span>
                        <span className="text-sentiqs-navy font-mono">{corr.alertId}</span>
                      </div>
                      <div>
                        <span className="font-semibold uppercase tracking-wider text-sentiqs-gray-text block mb-0.5">Sources concordantes</span>
                        <span className="text-sentiqs-navy">{corr.sources.join(', ')}</span>
                      </div>
                      <div>
                        <span className="font-semibold uppercase tracking-wider text-sentiqs-gray-text block mb-0.5">{t('dashboard.correlations.detectedAt')}</span>
                        <span className="text-sentiqs-navy">{formatTime(corr.detectedAt)}</span>
                      </div>
                      <div>
                        <span className="font-semibold uppercase tracking-wider text-sentiqs-gray-text block mb-0.5">{t('dashboard.correlations.region')}</span>
                        <span className="text-sentiqs-navy">{corr.region}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <button type="button" className="text-[10px] font-semibold text-sentiqs-navy hover:underline flex items-center gap-1">
                        <i className="ri-eye-line text-xs" /> Voir l'alerte source
                      </button>
                      <button type="button" onClick={() => { setShareTarget({ id: corr.id, title: corr.alertTitle }); setShareModalOpen(true); }} className="text-[10px] font-semibold text-sentiqs-navy hover:underline flex items-center gap-1">
                        <i className="ri-share-forward-line text-xs" /> Partager
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredCorrelations.length === 0 && (
          <div className="py-12 text-center text-sentiqs-gray-text text-xs bg-white rounded-lg border border-gray-100">
            {correlations.length === 0
              ? "La collecte n'a détecté aucun recoupement entre pays. Lancez une collecte depuis la page Flux."
              : t('dashboard.correlations.empty')}
          </div>
        )}
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={(e) => { if (e.target === e.currentTarget) exitFullscreen(); }}
        >
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-10">
            <div>
              <h2 className="text-white text-sm font-bold">{t('dashboard.correlations.title')}</h2>
              <p className="text-white/50 text-[10px] mt-0.5">
                {filteredCorrelations.length} {t('dashboard.correlations.totalDetected')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-[10px] text-white/40">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Alertes</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-white/40" /> Pays</span>
              </div>
              <button
                type="button"
                onClick={exitFullscreen}
                className="text-white/60 hover:text-white flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 transition-colors whitespace-nowrap"
              >
                <i className="ri-fullscreen-exit-line" /> {t('dashboard.correlations.exitFullscreen')}
              </button>
            </div>
          </div>

          {/* Hint at bottom */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-[10px] z-10">
            {t('dashboard.correlations.fullscreenHint')}
          </div>

          {/* Scaled graph container */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <div
              ref={graphContainerRef}
              className="relative bg-white/5 rounded-2xl border border-white/10"
              style={{
                width: `${GRAPH_WIDTH}px`,
                height: `${GRAPH_HEIGHT}px`,
                transform: `scale(${fsScale})`,
                transformOrigin: 'center center',
              }}
            >
              {/* SVG edges layer */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ zIndex: 1 }}
              >
                {graphEdges.map((edge, i) => {
                  const from = graphNodes.find((n) => n.id === edge.from);
                  const to = graphNodes.find((n) => n.id === edge.to);
                  if (!from || !to) return null;
                  const highlighted = isEdgeHighlighted(edge.corrId);
                  return (
                    <line
                      key={`fs-${edge.from}-${edge.to}-${i}`}
                      x1={from.x}
                      y1={from.y + 18}
                      x2={to.x}
                      y2={to.y + 18}
                      stroke={highlighted ? 'rgba(220,38,38,0.5)' : edgeColor(edge.strength)}
                      strokeWidth={highlighted ? '3.5' : edgeWidth(edge.strength)}
                      strokeLinecap="round"
                      className="transition-all duration-300"
                      style={{ opacity: highlighted ? 1 : 0.45 }}
                    />
                  );
                })}
              </svg>

              {/* Nodes layer */}
              <div className="absolute inset-0" style={{ zIndex: 2 }}>
                {graphNodes.map((node) => {
                  const isAlert = node.type === 'alert';
                  const highlighted = isNodeHighlighted(node.id);
                  const connected = isNodeConnected(node.id);
                  const isSelected = selectedNode === node.id;

                  return (
                    <button
                      key={`fs-${node.id}`}
                      type="button"
                      onClick={() => setSelectedNode(isSelected ? null : node.id)}
                      className="absolute transition-all duration-300 cursor-pointer"
                      style={{
                        left: `${node.x}px`,
                        top: `${node.y}px`,
                        transform: `translate(-50%, 0)`,
                        opacity: highlighted ? 1 : 0.2,
                        zIndex: isSelected ? 10 : connected ? 5 : 1,
                      }}
                    >
                      <div
                        className={`flex flex-col items-center gap-1 group ${
                          isSelected ? 'scale-110' : 'hover:scale-105'
                        } transition-transform`}
                      >
                        {isAlert ? (
                          <>
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center shadow-sm border-2 transition-colors"
                              style={{
                                backgroundColor: `${nodeColor(node)}15`,
                                borderColor: nodeBorderColor(node),
                              }}
                            >
                              <i
                                className="ri-alert-fill text-sm"
                                style={{ color: nodeColor(node) }}
                              />
                            </div>
                            <span
                              className="text-[9px] font-semibold whitespace-nowrap px-1.5 py-0.5 rounded-full border transition-colors"
                              style={{
                                backgroundColor: isSelected ? '#1a2d4a' : 'rgba(255,255,255,0.08)',
                                color: isSelected ? '#fff' : 'rgba(255,255,255,0.8)',
                                borderColor: isSelected ? '#1a2d4a' : 'rgba(255,255,255,0.15)',
                              }}
                            >
                              {node.label}
                            </span>
                          </>
                        ) : (
                          <>
                            <div
                              className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm border-2 text-[10px] font-bold transition-colors"
                              style={{
                                backgroundColor: isSelected ? '#ffffff' : 'rgba(255,255,255,0.06)',
                                color: isSelected ? (nodeColor(node)) : nodeColor(node),
                                borderColor: nodeBorderColor(node),
                              }}
                            >
                              {node.label.slice(0, 3).toUpperCase()}
                            </div>
                            <span
                              className="text-[9px] font-medium whitespace-nowrap max-w-[70px] truncate transition-colors"
                              style={{ color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.6)' }}
                            >
                              {node.label}
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              {!selectedNode && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white/50 bg-white/5 px-3 py-1 rounded-full border border-white/10" style={{ zIndex: 3 }}>
                  <i className="ri-information-line mr-1" />
                  {t('dashboard.correlations.clickNode')}
                </div>
              )}
            </div>
          </div>

          {/* Selected node detail — bottom panel in fullscreen */}
          {selectedNode && selectedCorrelations.length > 0 && (
            <div className="absolute bottom-14 left-6 right-6 bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15 z-10 max-h-[30vh] overflow-y-auto">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-3">
                {t('dashboard.correlations.selectedNode')}: {selectedNode.startsWith('alert-') ? 'Alerte' : 'Pays'} — {selectedCorrelations[0].country}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedCorrelations.map((corr) => (
                  <div key={`fs-${corr.id}`} className="bg-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={severityBadgeSmall(corr.alertSeverity)}>
                        {t(`dashboard.severity.${corr.alertSeverity}`)}
                      </span>
                      <span className={typeBadge(corr.type)}>
                        {t(`dashboard.correlations.types.${corr.type}`)}
                      </span>
                      <span className={strengthBadge(corr.strength)}>
                        {t(`dashboard.correlations.strengths.${corr.strength}`)}
                      </span>
                    </div>
                    <p className="text-xs text-white/80 leading-relaxed">{corr.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-white/50">
                      <span>{t('dashboard.correlations.confidence')}: <strong className={confidenceColor(corr.confidence)}>{corr.confidence}%</strong></span>
                      <span>{formatTime(corr.detectedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}