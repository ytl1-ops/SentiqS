import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { CountryAlertLevel } from '@/hooks/useAlertLevels';
import { AFRICA_54, COUNTRY_CODES } from '@/hooks/useAlertLevels';
import { LEVEL_STYLES, LEVEL_SHORT_LABELS } from '@/utils/postureUtils';

interface CountryGridProps {
  levels: CountryAlertLevel[];
}

const REGION_MAP: Record<string, string[]> = {
  Sahel: ['Burkina Faso', 'Mali', 'Niger', 'Mauritanie', 'Tchad'],
  'Golfe de Guinée': ['Bénin', 'Cameroun', "Côte d'Ivoire", 'Ghana', 'Nigeria', 'Togo'],
  'Afrique Centrale': ['Centrafrique', 'Congo', 'Gabon', 'Guinée Équatoriale', 'RDC', 'Sao Tomé-et-Principe'],
  'Grands Lacs': ['Burundi', 'Ouganda', 'Rwanda'],
  "Afrique de l'Est": ['Éthiopie', 'Kenya', 'Tanzanie', 'Malawi'],
  "Corne de l'Afrique": ['Djibouti', 'Érythrée', 'Somalie', 'Soudan', 'Soudan du Sud'],
  Maghreb: ['Algérie', 'Égypte', 'Libye', 'Maroc', 'Tunisie'],
  'Afrique Australe': ['Afrique du Sud', 'Angola', 'Botswana', 'Éswatini', 'Lesotho', 'Mozambique', 'Namibie', 'Zambie', 'Zimbabwe'],
  'Océan Indien': ['Comores', 'Madagascar', 'Maurice', 'Seychelles'],
  "Afrique de l'Ouest": ['Cap-Vert', 'Gambie', 'Guinée', 'Guinée-Bissau', 'Libéria', 'Sénégal', 'Sierra Leone'],
};

const REGION_ORDER = [
  'Sahel', "Corne de l'Afrique", 'Afrique Centrale', 'Grands Lacs',
  'Golfe de Guinée', "Afrique de l'Est", "Afrique de l'Ouest",
  'Maghreb', 'Afrique Australe', 'Océan Indien',
];

function getRegionStatus(counts: { rouge: number; orange: number; jaune: number; vert: number }) {
  if (counts.rouge > 0) return { label: 'CRITIQUE', bg: 'bg-red-700', text: 'text-white' };
  if (counts.orange > 0) return { label: 'TENDUE', bg: 'bg-orange-600', text: 'text-white' };
  if (counts.jaune > 2) return { label: 'DÉGRADÉE', bg: 'bg-yellow-500', text: 'text-yellow-950' };
  return { label: 'STABLE', bg: 'bg-emerald-600', text: 'text-white' };
}

export default function CountryGrid({ levels }: CountryGridProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith('/preview') ? '/preview' : '/dashboard';

  const levelMap = useMemo(() => {
    const map = new Map<string, CountryAlertLevel>();
    levels.forEach((l) => map.set(l.country, l));
    return map;
  }, [levels]);

  const regionData = useMemo(() => {
    return REGION_ORDER.map((regionName) => {
      const countries = REGION_MAP[regionName] || [];
      const entries = countries
        .filter((c) => AFRICA_54.includes(c))
        .map((country) => {
          const level = levelMap.get(country);
          return {
            country,
            code: COUNTRY_CODES[country] || '--',
            level: level?.level || 'none',
            score: level?.score ?? 0,
          };
        });

      const counts = { rouge: 0, orange: 0, jaune: 0, vert: 0 };
      entries.forEach((e) => { if (e.level in counts) (counts as any)[e.level]++; });
      const worst = [...entries].sort((a, b) => b.score - a.score)[0];

      return { name: regionName, entries, counts, worst, status: getRegionStatus(counts) };
    });
  }, [levelMap]);

  const totalCounts = useMemo(() => {
    const c = { rouge: 0, orange: 0, jaune: 0, vert: 0, none: 0 };
    regionData.forEach((r) => {
      r.entries.forEach((e) => { (c as any)[e.level]++; });
    });
    return c;
  }, [regionData]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Posture par région · {AFRICA_54.length} pays
        </h2>
        <button
          type="button"
          onClick={() => navigate(`${base}/alerts`)}
          className="text-[10px] font-semibold text-sentiqs-navy hover:underline whitespace-nowrap"
        >
          Grille de cotation
          <i className="ri-arrow-right-line ml-1" />
        </button>
      </div>

      {/* Regions */}
      <div className="space-y-2">
        {regionData.map((region) => (
          <div
            key={region.name}
            className="bg-white rounded-lg border border-gray-100 overflow-hidden"
          >
            {/* Region header */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50/50 border-b border-gray-100">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-bold text-gray-800 truncate">{region.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${region.status.bg} ${region.status.text}`}>
                  {region.status.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-500 ml-2 flex-shrink-0">
                {region.counts.rouge > 0 && <span className="font-bold text-red-600">{region.counts.rouge}<span className="text-[9px] font-normal text-red-400 ml-0.5">R</span></span>}
                {region.counts.orange > 0 && <span className="font-bold text-orange-500">{region.counts.orange}<span className="text-[9px] font-normal text-orange-400 ml-0.5">O</span></span>}
                {region.counts.jaune > 0 && <span className="font-bold text-yellow-600">{region.counts.jaune}<span className="text-[9px] font-normal text-yellow-400 ml-0.5">J</span></span>}
                {region.counts.vert > 0 && <span className="font-bold text-emerald-600">{region.counts.vert}<span className="text-[9px] font-normal text-emerald-400 ml-0.5">V</span></span>}
              </div>
            </div>

            {/* Country squares */}
            <div className="flex flex-wrap gap-1 p-3">
              {region.entries.map((c) => {
                const style = LEVEL_STYLES[c.level] || LEVEL_STYLES.none;
                return (
                  <button
                    key={c.country}
                    type="button"
                    onClick={() => {
                      if (c.level !== 'none') navigate(`${base}/alerts/country/${c.code}`);
                    }}
                    className={`w-11 h-8 rounded-md ${style.bg} ${style.text} flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-105 cursor-pointer whitespace-nowrap`}
                    title={`${c.country} — ${LEVEL_SHORT_LABELS[c.level]}${c.score > 0 ? ` · ${c.score}/100` : ''}`}
                  >
                    {c.code}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-gray-100 px-3 py-2">
        {[
          { key: 'rouge', label: 'ROUGE', count: totalCounts.rouge, bg: 'bg-red-700' },
          { key: 'orange', label: 'ORANGE', count: totalCounts.orange, bg: 'bg-orange-500' },
          { key: 'jaune', label: 'JAUNE', count: totalCounts.jaune, bg: 'bg-yellow-500' },
          { key: 'vert', label: 'VERT', count: totalCounts.vert, bg: 'bg-emerald-500' },
          { key: 'none', label: 'NON CÔTÉ', count: totalCounts.none, bg: 'bg-gray-200' },
        ]
          .filter((item) => item.count > 0)
          .map((item) => (
            <div key={item.key} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${item.bg}`} />
              <span className="text-[10px] font-semibold text-gray-600">{item.label} · {item.count}</span>
            </div>
          ))}
      </div>
    </div>
  );
}