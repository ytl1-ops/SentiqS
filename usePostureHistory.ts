import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Tooltip, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { feature } from 'topojson-client';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - world-atlas ships JSON but has no TS declarations
import topology from 'world-atlas/countries-50m.json';
import { supabase } from '@/lib/supabase';
import { africaCountryCenters, findLocalityCoord, type GeoCoord, type HeatPoint } from '@/data/africaCoordinates';
import type { CountryAlertLevel } from '@/hooks/useAlertLevels';

// —— ISO 3166-1 numeric → French country name mapping for Africa ——
const isoCodeToCountryFR: Record<string, string> = {
  '012': 'Algérie', '024': 'Angola', '204': 'Bénin', '072': 'Botswana',
  '854': 'Burkina Faso', '108': 'Burundi', '132': 'Cap-Vert', '120': 'Cameroun',
  '140': 'Centrafrique', '148': 'Tchad', '174': 'Comores', '178': 'Congo',
  '384': "Côte d'Ivoire", '180': 'RDC', '262': 'Djibouti', '818': 'Égypte',
  '226': 'Guinée Équatoriale', '232': 'Érythrée', '748': 'Éswatini', '231': 'Éthiopie',
  '266': 'Gabon', '270': 'Gambie', '288': 'Ghana', '324': 'Guinée',
  '624': 'Guinée-Bissau', '404': 'Kenya', '426': 'Lesotho', '430': 'Liberia',
  '434': 'Libye', '450': 'Madagascar', '454': 'Malawi', '466': 'Mali',
  '478': 'Mauritanie', '480': 'Maurice', '504': 'Maroc', '508': 'Mozambique',
  '516': 'Namibie', '562': 'Niger', '566': 'Nigeria', '646': 'Rwanda',
  '678': 'Sao Tomé-et-Principe', '686': 'Sénégal', '690': 'Seychelles',
  '694': 'Sierra Leone', '706': 'Somalie', '710': 'Afrique du Sud',
  '728': 'Soudan du Sud', '729': 'Soudan', '834': 'Tanzanie', '768': 'Togo',
  '788': 'Tunisie', '800': 'Ouganda', '894': 'Zambie', '716': 'Zimbabwe',
};

// —— Static region mapping for 54 African countries ——
const COUNTRY_REGION: Record<string, string> = {
  'Afrique du Sud': 'Afrique australe', 'Algérie': 'Afrique du Nord', 'Angola': 'Afrique centrale',
  'Bénin': 'Afrique de l\'Ouest', 'Botswana': 'Afrique australe',
  'Burkina Faso': 'Afrique de l\'Ouest', 'Burundi': 'Afrique de l\'Est',
  'Cameroun': 'Afrique centrale', 'Cap-Vert': 'Afrique de l\'Ouest',
  'Centrafrique': 'Afrique centrale', 'Comores': 'Afrique de l\'Est',
  'Congo': 'Afrique centrale', 'Côte d\'Ivoire': 'Afrique de l\'Ouest',
  'Djibouti': 'Afrique de l\'Est', 'Égypte': 'Afrique du Nord',
  'Érythrée': 'Afrique de l\'Est', 'Éthiopie': 'Afrique de l\'Est',
  'Gabon': 'Afrique centrale', 'Gambie': 'Afrique de l\'Ouest',
  'Ghana': 'Afrique de l\'Ouest', 'Guinée': 'Afrique de l\'Ouest',
  'Guinée-Bissau': 'Afrique de l\'Ouest', 'Guinée Équatoriale': 'Afrique centrale',
  'Kenya': 'Afrique de l\'Est', 'Lesotho': 'Afrique australe',
  'Libéria': 'Afrique de l\'Ouest', 'Libye': 'Afrique du Nord',
  'Madagascar': 'Afrique australe', 'Malawi': 'Afrique australe',
  'Mali': 'Afrique de l\'Ouest', 'Maroc': 'Afrique du Nord',
  'Maurice': 'Afrique australe', 'Mauritanie': 'Afrique de l\'Ouest',
  'Mozambique': 'Afrique australe', 'Namibie': 'Afrique australe',
  'Niger': 'Afrique de l\'Ouest', 'Nigeria': 'Afrique de l\'Ouest',
  'Ouganda': 'Afrique de l\'Est', 'RDC': 'Afrique centrale',
  'Rwanda': 'Afrique de l\'Est', 'Sao Tomé-et-Principe': 'Afrique centrale',
  'Sénégal': 'Afrique de l\'Ouest', 'Seychelles': 'Afrique de l\'Est',
  'Sierra Leone': 'Afrique de l\'Ouest', 'Somalie': 'Afrique de l\'Est',
  'Soudan': 'Afrique du Nord', 'Soudan du Sud': 'Afrique de l\'Est',
  'Éswatini': 'Afrique australe', 'Tanzanie': 'Afrique de l\'Est',
  'Tchad': 'Afrique centrale', 'Togo': 'Afrique de l\'Ouest',
  'Tunisie': 'Afrique du Nord', 'Zambie': 'Afrique australe',
  'Zimbabwe': 'Afrique australe',
};

/** Convertit les CountryAlertLevel (feed-driven) en CountryRiskRecord pour la heatmap */
function levelsToRiskRecords(levels: CountryAlertLevel[]): CountryRiskRecord[] {
  return levels.map((l) => ({
    country: l.country,
    code: l.countryCode,
    region: COUNTRY_REGION[l.country] || 'Afrique',
    risk: l.level === 'rouge' ? 'critical' : l.level === 'orange' ? 'high' : l.level === 'jaune' ? 'medium' : 'low',
    alerts_count: l.incidents,
    trend: l.trend === 'up' ? `+${l.trendDelta}` : l.trend === 'down' ? `${l.trendDelta}` : '0',
  }));
}

// —— Types ——
interface AlertRecord {
  id: string; severity: string; title: string; title_en?: string;
  country: string; region: string; department?: string; locality?: string;
  timestamp: string; source?: string; category?: string; status: string;
  impact?: string; verification_status?: string;
}

interface CountryRiskRecord {
  country: string; code: string; region: string; risk: string;
  alerts_count: number; trend: string;
}

// —— Utility: compute heat points from alerts ——
function computeHeatPoints(alerts: AlertRecord[]): HeatPoint[] {
  const map = new Map<string, HeatPoint>();
  for (const alert of alerts) {
    if (alert.status === 'resolved') continue;
    const coord = findLocalityCoord(alert.locality || '', alert.country);
    if (!coord) continue;
    const key = `${coord.lat.toFixed(4)}_${coord.lng.toFixed(4)}`;
    if (!map.has(key)) {
      map.set(key, {
        lat: coord.lat, lng: coord.lng, intensity: 0, count: 0,
        locality: alert.locality || '', country: alert.country,
        sevCritical: 0, sevHigh: 0, sevMedium: 0, sevLow: 0,
      });
    }
    const pt = map.get(key)!;
    pt.count++;
    if (alert.severity === 'critical') pt.sevCritical++;
    else if (alert.severity === 'high') pt.sevHigh++;
    else if (alert.severity === 'medium') pt.sevMedium++;
    else pt.sevLow++;
  }
  for (const pt of map.values()) {
    const weighted = pt.sevCritical * 4 + pt.sevHigh * 3 + pt.sevMedium * 2 + pt.sevLow;
    pt.intensity = Math.min(1, weighted / 16);
  }
  return Array.from(map.values());
}

// —— Heat color: green → yellow → orange → red ——
function heatColor(intensity: number): [number, number, number] {
  if (intensity <= 0.25) {
    const t = intensity / 0.25;
    return [Math.round(34 + t * 200), Math.round(197 - t * 18), Math.round(94 - t * 94)];
  } else if (intensity <= 0.5) {
    const t = (intensity - 0.25) / 0.25;
    return [Math.round(234 - t * 15), Math.round(179 + t * 65), Math.round(0 + t * 34)];
  } else if (intensity <= 0.75) {
    const t = (intensity - 0.5) / 0.25;
    return [Math.round(219 + t * 20), Math.round(244 - t * 95), Math.round(34 + t * 44)];
  } else {
    const t = (intensity - 0.75) / 0.25;
    return [Math.round(239 - t * 19), Math.round(149 - t * 81), Math.round(78 - t * 38)];
  }
}

function heatRgba(intensity: number, alpha: number): string {
  const [r, g, b] = heatColor(intensity);
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

// —— Risk color map ——
const riskFill: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
const riskStroke: Record<string, string> = { critical: '#b91c1c', high: '#c2410c', medium: '#a16207', low: '#15803d' };
const riskFillOpacity: Record<string, number> = { critical: 0.35, high: 0.25, medium: 0.15, low: 0.08 };

// —— Canvas Heatmap Overlay ——
function HeatmapCanvas({ points, visible }: { points: HeatPoint[]; visible: boolean }) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.x * dpr;
    canvas.height = size.y * dpr;
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);
    ctx.globalCompositeOperation = 'lighter';

    for (const pt of points) {
      if (pt.intensity < 0.05) continue;
      const pos = map.latLngToContainerPoint([pt.lat, pt.lng]);
      if (pos.x < -100 || pos.y < -100 || pos.x > size.x + 100 || pos.y > size.y + 100) continue;
      const baseRadius = 18 + pt.intensity * 35;
      const radius = baseRadius * (1 + (map.getZoom() - 4) * 0.15);
      const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
      const [r, g, b] = heatColor(pt.intensity);
      if (pt.intensity > 0.7) {
        gradient.addColorStop(0, `rgba(${r},${g},${b},0.85)`);
        gradient.addColorStop(0.08, `rgba(${r},${g},${b},0.75)`);
        gradient.addColorStop(0.25, `rgba(${r},${g},${b},0.45)`);
        gradient.addColorStop(0.5, `rgba(${r},${g},${b},0.12)`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
      } else if (pt.intensity > 0.35) {
        gradient.addColorStop(0, `rgba(${r},${g},${b},0.7)`);
        gradient.addColorStop(0.15, `rgba(${r},${g},${b},0.5)`);
        gradient.addColorStop(0.4, `rgba(${r},${g},${b},0.2)`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
      } else {
        gradient.addColorStop(0, `rgba(${r},${g},${b},0.5)`);
        gradient.addColorStop(0.25, `rgba(${r},${g},${b},0.25)`);
        gradient.addColorStop(0.6, `rgba(${r},${g},${b},0.05)`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
      }
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [map, points, visible]);

  useEffect(() => {
    const onMove = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    };
    map.on('moveend', onMove);
    map.on('zoomend', onMove);
    map.on('resize', onMove);
    setTimeout(onMove, 200);
    return () => {
      map.off('moveend', onMove);
      map.off('zoomend', onMove);
      map.off('resize', onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [map, draw]);

  if (!visible) return null;
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[400] pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    />
  );
}

// —— Country Markers ——
function CountryMarkers({ onSelect, selectedCountry, risks }: {
  onSelect: (c: string) => void;
  selectedCountry: string | null;
  risks: CountryRiskRecord[];
}) {
  const markers = useMemo(() => {
    return risks.map((c) => {
      const center = africaCountryCenters[c.country];
      if (!center) return null;
      return { ...center, risk: c.risk, alerts: c.alerts_count, trend: c.trend, code: c.code, country: c.country };
    }).filter(Boolean) as Array<GeoCoord & { risk: string; alerts: number; trend: string; code: string }>;
  }, [risks]);

  return (
    <>
      {markers.map((m) => (
        <CircleMarker
          key={m.code}
          center={[m.lat, m.lng]}
          radius={selectedCountry === m.country ? 9 : 6}
          pathOptions={{
            fillColor: riskFill[m.risk] || '#6b7280',
            color: riskStroke[m.risk] || '#374151',
            weight: selectedCountry === m.country ? 2.5 : 1,
            opacity: 1,
            fillOpacity: selectedCountry === m.country ? 0.95 : 0.7,
          }}
          eventHandlers={{ click: () => onSelect(m.country) }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={0.95} permanent={false}>
            <div className="text-center">
              <div className="font-bold text-xs">{m.country}</div>
              <div className="text-[10px] text-gray-500">{m.alerts} alertes · {m.trend}</div>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

// —— Heat Spot Markers ——
function HeatSpotMarkers({ points, onSelect, selectedLocality }: {
  points: HeatPoint[];
  onSelect: (p: HeatPoint) => void;
  selectedLocality: string | null;
}) {
  return (
    <>
      {points.filter((p) => p.intensity > 0.3).map((pt, i) => {
        const isSelected = selectedLocality === `${pt.locality}_${pt.country}`;
        return (
          <CircleMarker
            key={`${pt.lat}_${pt.lng}_${i}`}
            center={[pt.lat, pt.lng]}
            radius={isSelected ? 11 : 4 + pt.intensity * 8}
            pathOptions={{
              fillColor: heatRgba(pt.intensity, 1),
              color: heatRgba(pt.intensity, 1),
              weight: isSelected ? 2 : 0,
              opacity: 0.9,
              fillOpacity: isSelected ? 1 : 0.55 + pt.intensity * 0.3,
            }}
            eventHandlers={{ click: () => onSelect(pt) }}
          >
            {isSelected && (
              <Popup>
                <div className="text-xs space-y-0.5 min-w-[160px]">
                  <div className="font-bold text-sm">{pt.locality}</div>
                  <div className="text-gray-500">{pt.country}</div>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {pt.sevCritical > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold">{pt.sevCritical} critiques</span>}
                    {pt.sevHigh > 0 && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-semibold">{pt.sevHigh} élevées</span>}
                    {pt.sevMedium > 0 && <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 text-[10px] font-semibold">{pt.sevMedium} moy.</span>}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">Intensité: {Math.round(pt.intensity * 100)}%</div>
                </div>
              </Popup>
            )}
          </CircleMarker>
        );
      })}
    </>
  );
}

// —— Legend ——
function HeatmapLegend() {
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Intensité</div>
      <div className="flex items-center gap-0.5">
        {[0, 0.25, 0.5, 0.75, 1].map((s, i) => (
          <div key={i} className="w-4 h-2.5 rounded-sm" style={{ backgroundColor: heatRgba(s, 1) }} />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
        <span>Faible</span>
        <span>Critique</span>
      </div>
    </div>
  );
}

// —— Country Detail Panel ——
function CountryDetailPanel({ country, risks, alerts, onClose }: {
  country: string;
  risks: CountryRiskRecord[];
  alerts: AlertRecord[];
  onClose: () => void;
}) {
  const data = useMemo(() => {
    const risk = risks.find((c) => c.country === country);
    const localAlerts = alerts.filter((a) => a.country === country && a.status !== 'resolved');
    return { risk, alerts: localAlerts };
  }, [country, risks, alerts]);

  if (!data.risk) return null;

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm p-3 w-64 max-h-80 overflow-y-auto">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-bold text-sm">{country}</div>
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
            data.risk.risk === 'critical' ? 'bg-red-100 text-red-700 border-red-200' :
            data.risk.risk === 'high' ? 'bg-orange-100 text-orange-700 border-orange-200' :
            data.risk.risk === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
            'bg-emerald-100 text-emerald-700 border-emerald-200'
          }`}>
            {data.risk.risk === 'critical' ? 'Critique' : data.risk.risk === 'high' ? 'Élevé' : data.risk.risk === 'medium' ? 'Moyen' : 'Faible'}
          </span>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
          <i className="ri-close-line text-sm" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-2 text-[10px]">
        <div><span className="text-gray-500">Alertes: </span><span className="font-bold">{data.risk.alerts_count}</span></div>
        <div><span className="text-gray-500">Tendance: </span><span className={`font-bold ${data.risk.trend.startsWith('+') ? 'text-red-600' : data.risk.trend.startsWith('-') ? 'text-emerald-600' : ''}`}>{data.risk.trend}</span></div>
        <div className="col-span-2"><span className="text-gray-500">Région: </span><span className="font-semibold">{data.risk.region}</span></div>
      </div>
      {data.alerts.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Alertes actives</div>
          <div className="space-y-1">
            {data.alerts.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center gap-1.5 text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  a.severity === 'critical' ? 'bg-red-500' : a.severity === 'high' ? 'bg-orange-500' : a.severity === 'medium' ? 'bg-yellow-500' : 'bg-emerald-400'
                }`} />
                <span className="truncate flex-1">{a.title}</span>
              </div>
            ))}
            {data.alerts.length > 5 && (
              <div className="text-[9px] text-gray-400 pl-3">+{data.alerts.length - 5} autres alertes</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// —— Locality Detail Panel ——
function LocalityDetailPanel({ point, alerts, onClose }: { point: HeatPoint; alerts: AlertRecord[]; onClose: () => void }) {
  const localAlerts = useMemo(() => {
    return alerts.filter((a) =>
      a.locality === point.locality && a.country === point.country && a.status !== 'resolved'
    );
  }, [point, alerts]);

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm p-3 w-72 max-h-80 overflow-y-auto">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-bold text-sm">{point.locality}</div>
          <div className="text-[10px] text-gray-500">{point.country}</div>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
          <i className="ri-close-line text-sm" />
        </button>
      </div>
      <div className="flex gap-2 mb-2 flex-wrap">
        {point.sevCritical > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold">{point.sevCritical} critiques</span>}
        {point.sevHigh > 0 && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-semibold">{point.sevHigh} élevées</span>}
        {point.sevMedium > 0 && <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 text-[10px] font-semibold">{point.sevMedium} moyennes</span>}
        {point.sevLow > 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-semibold">{point.sevLow} faibles</span>}
      </div>
      <div className="text-[10px] text-gray-500 mb-1">
        Intensité heatmap: <span className="font-bold">{Math.round(point.intensity * 100)}%</span>
      </div>
      {localAlerts.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 mt-2">Alertes actives</div>
          <div className="space-y-1">
            {localAlerts.map((a) => (
              <div key={a.id} className="flex items-center gap-1.5 text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  a.severity === 'critical' ? 'bg-red-500' : a.severity === 'high' ? 'bg-orange-500' : a.severity === 'medium' ? 'bg-yellow-500' : 'bg-emerald-400'
                }`} />
                <span className="truncate flex-1">{a.title}</span>
                <span className="text-gray-400 flex-shrink-0">{new Date(a.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// —— Choropleth Legend ——
function ChoroplethLegend() {
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Risque pays</div>
      <div className="flex flex-col gap-0.5">
        {[
          { label: 'Critique', color: '#ef4444' },
          { label: 'Élevé', color: '#f97316' },
          { label: 'Moyen', color: '#eab308' },
          { label: 'Faible', color: '#22c55e' },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: r.color }} />
            <span className="text-[9px] text-gray-500">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// —— GeoJSON Choropleth Layer ——
function ChoroplethLayer({ risks, onSelect, selectedCountry }: {
  risks: CountryRiskRecord[];
  onSelect: (c: string) => void;
  selectedCountry: string | null;
}) {
  // Convert TopoJSON to GeoJSON and filter for Africa
  const africaGeoJSON = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topologyAny = topology as any;
    const geoJson = feature(topologyAny, topologyAny.objects.countries) as any;
    const riskMap = new Map<string, CountryRiskRecord>();
    for (const r of risks) riskMap.set(r.country, r);

    const features = geoJson.features.filter((f: any) => {
      const isoNum = String(f.id);
      const countryName = isoCodeToCountryFR[isoNum];
      return countryName && riskMap.has(countryName);
    }).map((f: any) => {
      const isoNum = String(f.id);
      const countryName = isoCodeToCountryFR[isoNum];
      const risk = riskMap.get(countryName);
      return {
        ...f,
        properties: {
          ...f.properties,
          countryName,
          risk: risk?.risk || 'low',
          alertsCount: risk?.alerts_count || 0,
          trend: risk?.trend || '0',
          region: risk?.region || '',
        },
      };
    });

    return { type: 'FeatureCollection', features };
  }, [risks]);

  const styleFn = useCallback((feature: any) => {
    const name = feature?.properties?.countryName;
    const risk = feature?.properties?.risk || 'low';
    const isSelected = name && name === selectedCountry;
    return {
      fillColor: riskFill[risk] || '#22c55e',
      color: isSelected ? '#1e293b' : (riskStroke[risk] || '#15803d'),
      weight: isSelected ? 2.5 : 0.8,
      opacity: 1,
      fillOpacity: isSelected ? (riskFillOpacity[risk] || 0.08) + 0.2 : (riskFillOpacity[risk] || 0.08),
    };
  }, [selectedCountry]);

  const onEachFeature = useCallback((feature: any, layer: L.Layer) => {
    const name = feature.properties.countryName;
    const risk = feature.properties.risk;
    const alertsCount = feature.properties.alertsCount;
    const trend = feature.properties.trend;

    layer.bindTooltip(
      `<div style="text-align:center"><div style="font-weight:bold;font-size:12px">${name}</div><div style="font-size:10px;color:#6b7280">${alertsCount} alertes · ${trend}</div></div>`,
      { direction: 'center', opacity: 0.95, sticky: true }
    );

    layer.on({
      click: () => onSelect(name),
      mouseover: (e: any) => {
        const target = e.target;
        target.setStyle({
          weight: 2,
          fillOpacity: (riskFillOpacity[risk] || 0.08) + 0.15,
          color: riskStroke[risk] || '#15803d',
        });
        target.bringToFront();
      },
      mouseout: (e: any) => {
        const target = e.target;
        if (name !== selectedCountry) {
          target.setStyle({
            weight: 0.8,
            fillOpacity: riskFillOpacity[risk] || 0.08,
            color: riskStroke[risk] || '#15803d',
          });
        }
      },
    });
  }, [onSelect, selectedCountry]);

  return <GeoJSON key="choropleth" data={africaGeoJSON} style={styleFn} onEachFeature={onEachFeature} />;
}

// —— Main Component ——
export default function AfricaHeatmap({ levels }: { levels?: CountryAlertLevel[] }) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedLocality, setSelectedLocality] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<HeatPoint | null>(null);
  const [heatmapVisible, setHeatmapVisible] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [risks, setRisks] = useState<CountryRiskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch alerts + subscribe to realtime
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Si des niveaux feed-driven sont fournis, on les utilise — sinon fallback sur country_risks
        if (levels && levels.length > 0) {
          const alertsRes = await supabase.from('alerts').select('*').order('timestamp', { ascending: false });
          if (alertsRes.error) throw new Error(`Alertes: ${alertsRes.error.message}`);
          setAlerts(alertsRes.data as AlertRecord[]);
          setRisks(levelsToRiskRecords(levels));
        } else {
          const [alertsRes, risksRes] = await Promise.all([
            supabase.from('alerts').select('*').order('timestamp', { ascending: false }),
            supabase.from('country_risks').select('*'),
          ]);
          if (alertsRes.error) throw new Error(`Alertes: ${alertsRes.error.message}`);
          if (risksRes.error) throw new Error(`Risques: ${risksRes.error.message}`);
          setAlerts(alertsRes.data as AlertRecord[]);
          setRisks(risksRes.data as CountryRiskRecord[]);
        }
      } catch (err: any) {
        setError(err.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Realtime subscription for alerts
    channel = supabase
      .channel('alerts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        // Refetch all alerts on any change for simplicity
        supabase.from('alerts').select('*').order('timestamp', { ascending: false }).then((res) => {
          if (!res.error && res.data) setAlerts(res.data as AlertRecord[]);
        });
      })
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [levels]);

  const heatPoints = useMemo(() => computeHeatPoints(alerts), [alerts]);

  const filteredPoints = useMemo(() => {
    if (severityFilter === 'all') return heatPoints;
    return heatPoints.filter((p) => {
      if (severityFilter === 'critical') return p.sevCritical > 0;
      if (severityFilter === 'high') return p.sevHigh > 0 || p.sevCritical > 0;
      return true;
    });
  }, [heatPoints, severityFilter]);

  const stats = useMemo(() => ({
    totalAlerts: alerts.filter((a) => a.status !== 'resolved').length,
    hotspots: heatPoints.length,
    criticalHotspots: heatPoints.filter((p) => p.intensity > 0.7).length,
  }), [alerts, heatPoints]);

  const handleCountrySelect = (country: string) => {
    setSelectedCountry((prev) => (prev === country ? null : country));
    setSelectedLocality(null);
    setSelectedPoint(null);
  };

  const handleLocalitySelect = (pt: HeatPoint) => {
    const key = `${pt.locality}_${pt.country}`;
    setSelectedLocality((prev) => (prev === key ? null : key));
    setSelectedPoint((prev) => (prev?.locality === pt.locality && prev?.country === pt.country ? null : pt));
    setSelectedCountry(null);
  };

  // Auto-refresh pulse
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setHeatmapVisible(false);
      setTimeout(() => setHeatmapVisible(true), 150);
    }, 8000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Fix leaflet default icon path
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-120px)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Chargement de la carte...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-120px)]">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <i className="ri-error-warning-line text-3xl text-red-500" />
          <span className="text-sm text-gray-700">{error}</span>
          <button type="button" onClick={() => window.location.reload()} className="px-4 py-2 bg-red-500 text-white rounded-md text-sm cursor-pointer hover:bg-red-600 whitespace-nowrap">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* ===== Top Toolbar ===== */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm px-3 py-2 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 pr-3 border-r border-gray-150">
            <div className="text-center leading-tight">
              <div className="text-xs font-bold text-gray-800">{stats.totalAlerts}</div>
              <div className="text-[9px] text-gray-400">alertes</div>
            </div>
            <div className="text-center leading-tight">
              <div className="text-xs font-bold text-gray-800">{stats.hotspots}</div>
              <div className="text-[9px] text-gray-400">hotspots</div>
            </div>
            <div className="text-center leading-tight">
              <div className="text-xs font-bold text-red-600">{stats.criticalHotspots}</div>
              <div className="text-[9px] text-gray-400">critiques</div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {(['all', 'critical', 'high'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  severityFilter === sev
                    ? sev === 'critical' ? 'bg-red-500 text-white border-red-500' :
                      sev === 'high' ? 'bg-orange-500 text-white border-orange-500' :
                      'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {sev === 'all' ? 'Toutes' : sev === 'critical' ? 'Critiques' : 'Élevées+'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pl-3 border-l border-gray-150">
            <button
              type="button"
              onClick={() => setHeatmapVisible(!heatmapVisible)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                heatmapVisible ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 text-gray-400 border-gray-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${heatmapVisible ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
              Heatmap {heatmapVisible ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                autoRefresh ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
              Live {autoRefresh ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* DB status indicator */}
        <div className="bg-white/90 backdrop-blur-sm rounded-md border border-emerald-200 px-2.5 py-1 shadow-sm flex items-center gap-1.5 self-start">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-semibold text-emerald-700">DB temps réel</span>
        </div>
      </div>

      {/* ===== Map ===== */}
      <MapContainer
        center={[4, 18]}
        zoom={4}
        minZoom={3}
        maxZoom={10}
        className="w-full h-full rounded-lg"
        style={{ minHeight: 'calc(100vh - 120px)' }}
        zoomControl={true}
        attributionControl={true}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {/* Choropleth layer — GeoJSON country boundaries colored by risk */}
        <ChoroplethLayer risks={risks} onSelect={handleCountrySelect} selectedCountry={selectedCountry} />

        {/* Heatmap canvas overlay */}
        <HeatmapCanvas points={filteredPoints} visible={heatmapVisible} />

        {/* Country risk markers */}
        <CountryMarkers onSelect={handleCountrySelect} selectedCountry={selectedCountry} risks={risks} />

        {/* Heat spot markers */}
        <HeatSpotMarkers points={filteredPoints} onSelect={handleLocalitySelect} selectedLocality={selectedLocality} />
      </MapContainer>

      {/* ===== Bottom-Right Legends ===== */}
      <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2">
        <HeatmapLegend />
        <ChoroplethLegend />
      </div>

      {/* ===== Bottom-Left Detail Panels ===== */}
      {selectedCountry && (
        <div className="absolute bottom-6 left-4 z-[1000]">
          <CountryDetailPanel country={selectedCountry} risks={risks} alerts={alerts} onClose={() => setSelectedCountry(null)} />
        </div>
      )}

      {selectedPoint && (
        <div className="absolute bottom-6 left-4 z-[1000]">
          <LocalityDetailPanel point={selectedPoint} alerts={alerts} onClose={() => { setSelectedPoint(null); setSelectedLocality(null); }} />
        </div>
      )}
    </div>
  );
}

export type { HeatPoint };