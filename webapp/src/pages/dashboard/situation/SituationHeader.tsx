import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import type { CountryAlertLevel } from '@/hooks/useAlertLevels';

interface SituationHeaderProps {
  levels: CountryAlertLevel[];
  lastUpdated: string | null;
  totalIncidents: number;
}

function getBannerColor(levels: CountryAlertLevel[]) {
  const hasRouge = levels.some((l) => l.level === 'rouge');
  const hasOrange = levels.some((l) => l.level === 'orange');
  const hasJaune = levels.some((l) => l.level === 'jaune');
  if (hasRouge) return { color: 'bg-red-700', text: 'text-white' };
  if (hasOrange) return { color: 'bg-orange-600', text: 'text-white' };
  if (hasJaune) return { color: 'bg-yellow-500', text: 'text-yellow-950' };
  return { color: 'bg-emerald-600', text: 'text-white' };
}

export default function SituationHeader({ levels, lastUpdated, totalIncidents }: SituationHeaderProps) {
  const { t } = useTranslation();
  const loc = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  const banner = useMemo(() => getBannerColor(levels), [levels]);

  const counts = useMemo(() => {
    const rouge = levels.filter((l) => l.level === 'rouge');
    const orange = levels.filter((l) => l.level === 'orange');
    const jaune = levels.filter((l) => l.level === 'jaune');
    const vert = levels.filter((l) => l.level === 'vert');
    const criticalIncidents = rouge.reduce((sum, l) => sum + l.incidentsBySeverity.critical, 0);
    return { rouge, orange, jaune, vert, criticalIncidents };
  }, [levels]);

  const topCountry = levels[0];

  const summaryParts: string[] = [];
  if (counts.rouge.length > 0) {
    summaryParts.push(t('dashboard.situation.banner.redCount', { count: counts.rouge.length }));
  }
  if (counts.orange.length > 0) {
    summaryParts.push(t('dashboard.situation.banner.orangeCount', { count: counts.orange.length }));
  }
  if (counts.jaune.length > 0) {
    summaryParts.push(t('dashboard.situation.banner.yellowCount', { count: counts.jaune.length }));
  }
  if (counts.vert.length > 0 && counts.rouge.length === 0 && counts.orange.length === 0) {
    summaryParts.push(t('dashboard.situation.banner.greenCount', { count: counts.vert.length }));
  }
  const summaryText = summaryParts.length > 0 ? summaryParts.join(' · ') : t('dashboard.situation.banner.noRisk');

  return (
    <div className="space-y-4">
      {/* Main status banner — nuanced, proportional summary */}
      <div className={`${banner.color} ${banner.text} rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <i className="ri-alarm-warning-line text-lg" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('dashboard.situation.banner.title')}</div>
            <div className="text-sm font-bold">{summaryText}</div>
          </div>
        </div>
        <div className="text-[10px] opacity-80 sm:text-right">
          {lastUpdated
            ? t('dashboard.situation.updated', {
                date: new Date(lastUpdated).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' }),
                time: new Date(lastUpdated).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }),
              })
            : '—'}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="text-lg font-bold text-red-700">{counts.rouge.length}</div>
          <div className="text-[9px] font-semibold text-red-600 uppercase tracking-wide">{t('dashboard.level.redDesc')}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="text-lg font-bold text-orange-600">{counts.orange.length}</div>
          <div className="text-[9px] font-semibold text-orange-500 uppercase tracking-wide">{t('dashboard.level.orangeDesc')}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="text-lg font-bold text-yellow-600">{counts.jaune.length}</div>
          <div className="text-[9px] font-semibold text-yellow-500 uppercase tracking-wide">{t('dashboard.level.yellowDesc')}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="text-lg font-bold text-emerald-600">{counts.vert.length}</div>
          <div className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wide">{t('dashboard.level.greenDesc')}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="text-lg font-bold text-sentiqs-navy">{totalIncidents}</div>
          <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">{t('dashboard.situation.incidents72h')}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="text-lg font-bold text-sentiqs-navy">{counts.criticalIncidents}</div>
          <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">{t('common.severity.critical')}</div>
        </div>
      </div>

      {/* Top threat spotlight */}
      {topCountry && topCountry.level === 'rouge' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-700 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
            {topCountry.countryCode}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-red-800">
              {topCountry.country} — {t('dashboard.situation.topThreat')}
            </div>
            <div className="text-[10px] text-red-700 truncate">
              {t('dashboard.situation.scoreLabel', { score: topCountry.score })} · {t('dashboard.situation.incidentsLabel', { count: topCountry.incidents })} · {t('dashboard.situation.criticalIncidentsLabel', { count: topCountry.incidentsBySeverity.critical })}
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-red-700 font-medium">
            <i className="ri-alert-line" />
            {topCountry.triggeringIncidents[0]?.title || t('dashboard.situation.critical.empty')}
          </div>
        </div>
      )}
    </div>
  );
}