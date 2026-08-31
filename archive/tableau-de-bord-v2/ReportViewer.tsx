import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgendaEvents, AgendaEvent } from '@/hooks/useAgendaEvents';
import ShareModal from '@/components/feature/ShareModal';
import EmptyState from '@/components/base/EmptyState';
import { SEVERITY_BADGE_BORDERED } from '@/utils/severityColors';

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type EventType = 'meeting' | 'exercise' | 'conference' | 'audit' | 'briefing' | 'training' | 'deadline' | 'mission';

const typeConfig: Record<EventType, { label: string; labelEn: string; icon: string; color: string; bg: string; dot: string }> = {
  meeting: { label: 'Réunion', labelEn: 'Meeting', icon: 'ri-group-line', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  exercise: { label: 'Exercice', labelEn: 'Exercise', icon: 'ri-shield-flash-line', color: 'text-red-600', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
  conference: { label: 'Conférence', labelEn: 'Conference', icon: 'ri-megaphone-line', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
  audit: { label: 'Audit', labelEn: 'Audit', icon: 'ri-file-search-line', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  briefing: { label: 'Briefing', labelEn: 'Briefing', icon: 'ri-presentation-line', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500' },
  training: { label: 'Formation', labelEn: 'Training', icon: 'ri-graduation-cap-line', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  deadline: { label: 'Échéance', labelEn: 'Deadline', icon: 'ri-timer-line', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  mission: { label: 'Mission', labelEn: 'Mission', icon: 'ri-radar-line', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200', dot: 'bg-rose-500' },
};


export default function AgendaPage() {
  const { t, i18n } = useTranslation();
  const isFr = i18n.language.startsWith('fr');
  const { events: agendaEvents, loading } = useAgendaEvents();

  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string } | null>(null);

  const months = isFr ? MONTHS_FR : MONTHS_EN;
  const days = isFr ? DAYS_FR : DAYS_EN;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const eventsByDate = useMemo(() => {
    const map: Record<string, AgendaEvent[]> = {};
    agendaEvents.forEach((ev) => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [agendaEvents]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return null;
    return eventsByDate[selectedDate] || [];
  }, [selectedDate, eventsByDate]);

  const selectedEventData = useMemo(() => {
    if (!selectedEvent) return null;
    return agendaEvents.find((e) => e.id === selectedEvent) || null;
  }, [selectedEvent, agendaEvents]);

  const allEventTypes = useMemo(() => {
    const types = new Set(agendaEvents.map((e) => e.type));
    return Array.from(types) as EventType[];
  }, [agendaEvents]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startDow = firstDay.getDay();
    const adjustedStart = startDow === 0 ? 6 : startDow - 1;
    const totalDays = lastDay.getDate();

    const daysArr = [];
    for (let i = 0; i < adjustedStart; i++) {
      daysArr.push({ day: null, dateStr: '' });
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      daysArr.push({ day: d, dateStr });
    }
    return daysArr;
  }, [viewMonth, viewYear]);

  const upstreamEvents = useMemo(() => {
    return [...agendaEvents]
      .filter((ev) => {
        if (typeFilter !== 'all' && ev.type !== typeFilter) return false;
        return new Date(ev.date) >= new Date(new Date().setHours(0, 0, 0, 0));
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [typeFilter, agendaEvents]);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const countByType = useMemo(() => {
    const counts: Record<string, number> = {};
    agendaEvents.forEach((ev) => { counts[ev.type] = (counts[ev.type] || 0) + 1; });
    return counts;
  }, [agendaEvents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-sentiqs-gray-text">
          <i className="ri-loader-4-line animate-spin text-lg" />
          <span className="text-sm">{isFr ? 'Chargement...' : 'Loading...'}</span>
        </div>
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
          itemType={`Événement ${shareTarget.id}`}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 anim-entry-down">
        <div>
          <h1 className="text-lg font-bold text-sentiqs-navy">{t('dashboard.agenda')}</h1>
          <p className="text-xs text-sentiqs-gray-text mt-0.5">
            {agendaEvents.length} {isFr ? 'événements programmés' : 'scheduled events'} — {upstreamEvents.length} {isFr ? 'à venir' : 'upcoming'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-sentiqs-gray-text hover:bg-gray-100 transition-colors">
            <i className="ri-arrow-left-s-line text-sm" />
          </button>
          <span className="text-sm font-semibold text-sentiqs-navy min-w-[140px] text-center">
            {months[viewMonth]} {viewYear}
          </span>
          <button type="button" onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-sentiqs-gray-text hover:bg-gray-100 transition-colors">
            <i className="ri-arrow-right-s-line text-sm" />
          </button>
          <button
            type="button"
            onClick={() => { setViewMonth(today.getMonth()); setViewYear(today.getFullYear()); }}
            className="ml-2 px-2 py-1 text-[10px] font-semibold text-sentiqs-navy border border-gray-200 rounded-md hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            {t('common.today')}
          </button>
        </div>
      </div>

      {/* Type filter bar */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors whitespace-nowrap ${
            typeFilter === 'all' ? 'bg-sentiqs-navy text-white border-sentiqs-navy' : 'bg-white text-sentiqs-gray-text border-gray-200 hover:border-gray-300'
          }`}
        >
          {isFr ? `Tous (${agendaEvents.length})` : `All (${agendaEvents.length})`}
        </button>
        {allEventTypes.map((tp) => {
          const cfg = typeConfig[tp];
          return (
            <button
              key={tp}
              type="button"
              onClick={() => setTypeFilter(tp)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                typeFilter === tp ? `${cfg.bg} ${cfg.color} border-current` : 'bg-white text-sentiqs-gray-text border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {isFr ? cfg.label : cfg.labelEn} ({countByType[tp] || 0})
            </button>
          );
        })}
      </div>

      {/* Main content: calendar + upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-100 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {days.map((d) => (
              <div key={d} className="py-2 text-center text-[10px] font-semibold text-sentiqs-gray-text uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>
          {/* Days grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((cell, idx) => (
              <button
                key={idx}
                type="button"
                disabled={!cell.day}
                onClick={() => setSelectedDate(cell.dateStr)}
                className={`min-h-[72px] p-1.5 border-b border-r border-gray-50 text-left transition-colors ${
                  !cell.day ? 'bg-gray-50/50 cursor-default' : 'hover:bg-sentiqs-navy/[0.02] cursor-pointer'
                } ${cell.dateStr === selectedDate ? 'bg-sentiqs-navy/5 ring-1 ring-inset ring-sentiqs-navy/20' : ''}`}
              >
                {cell.day && (
                  <>
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                      cell.dateStr === todayStr ? 'bg-sentiqs-navy text-white' : 'text-sentiqs-navy'
                    }`}>
                      {cell.day}
                    </span>
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {(eventsByDate[cell.dateStr] || []).slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className={`w-1.5 h-1.5 rounded-full ${typeConfig[ev.type as EventType]?.dot || 'bg-gray-400'}`}
                          title={ev.title}
                        />
                      ))}
                      {(eventsByDate[cell.dateStr] || []).length > 3 && (
                        <span className="text-[8px] text-sentiqs-gray-text font-semibold ml-0.5">
                          +{(eventsByDate[cell.dateStr] || []).length - 3}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Upcoming events list */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-sentiqs-navy uppercase tracking-wider flex items-center gap-2">
            <i className="ri-calendar-event-line text-sm" />
            {selectedDate
              ? `${isFr ? 'Événements du' : 'Events of'} ${selectedDate.split('-').reverse().join('/')}`
              : isFr ? 'Prochains événements' : 'Upcoming events'}
          </h3>

          {agendaEvents.length === 0 ? (
            <EmptyState
              icon="ri-calendar-line"
              title={isFr ? 'Aucun événement programmé' : 'No events scheduled'}
              description={isFr ? 'Vos événements apparaîtront ici.' : 'Your events will appear here.'}
            />
          ) : (
            <>
              {selectedDate && selectedDateEvents ? (
                selectedDateEvents.length === 0 ? (
                  <EmptyState
                    icon="ri-calendar-line"
                    title={isFr ? 'Aucun événement ce jour' : 'No events on this day'}
                  />
                ) : (
                  <div className="space-y-2">
                    {selectedDateEvents.map((ev) => {
                      const cfg = typeConfig[ev.type as EventType];
                      const localizedTitle = isFr ? ev.title : (ev.title_en || ev.title);
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => setSelectedEvent(selectedEvent === ev.id ? null : ev.id)}
                          className={`w-full bg-white rounded-lg border p-3 text-left transition-all ${
                            selectedEvent === ev.id ? 'border-sentiqs-navy ring-1 ring-sentiqs-navy/20' : 'border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                              <i className={`${cfg.icon} ${cfg.color} text-sm`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-sentiqs-navy leading-snug line-clamp-2">{localizedTitle}</p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cfg.bg} ${cfg.color}`}>
                                  {isFr ? cfg.label : cfg.labelEn}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${SEVERITY_BADGE_BORDERED[ev.priority]}`}>{t(`dashboard.severity.${ev.priority}`)}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-[10px] text-sentiqs-gray-text">
                                <span className="flex items-center gap-1"><i className="ri-time-line text-xs" />{ev.time}</span>
                                <span className="flex items-center gap-1"><i className="ri-map-pin-line text-xs" />{ev.country}</span>
                              </div>

                              {selectedEvent === ev.id && (
                                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-sentiqs-gray-text">{isFr ? 'Durée' : 'Duration'}</span>
                                    <span className="font-semibold text-sentiqs-navy">{ev.duration}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-sentiqs-gray-text">{isFr ? 'Lieu' : 'Location'}</span>
                                    <span className="font-semibold text-sentiqs-navy text-right max-w-[160px]">{ev.location}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-sentiqs-gray-text">{isFr ? 'Organisateur' : 'Organizer'}</span>
                                    <span className="font-semibold text-sentiqs-navy">{ev.organizer}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-sentiqs-gray-text">{isFr ? 'Participants' : 'Participants'}</span>
                                    <span className="font-semibold text-sentiqs-navy">{ev.participants}</span>
                                  </div>
                                  <p className="text-[10px] text-sentiqs-gray-text leading-relaxed pt-1">
                                    {isFr ? ev.description : (ev.description_en || ev.description)}
                                  </p>
                                  <div className="flex gap-2 pt-1">
                                    <button type="button" className="text-[10px] font-semibold text-sentiqs-navy hover:underline flex items-center gap-1">
                                      <i className="ri-calendar-check-line text-xs" /> {isFr ? 'Confirmer présence' : 'Confirm attendance'}
                                    </button>
                                    <button type="button" onClick={() => { setShareTarget({ id: ev.id, title: localizedTitle }); setShareModalOpen(true); }} className="text-[10px] font-semibold text-sentiqs-navy hover:underline flex items-center gap-1">
                                      <i className="ri-share-forward-line text-xs" /> {isFr ? 'Partager' : 'Share'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  {upstreamEvents.slice(0, 8).map((ev, idx) => {
                    const cfg = typeConfig[ev.type as EventType];
                    const evDate = new Date(ev.date);
                    const evDay = evDate.getDate();
                    const evMonthName = (isFr ? MONTHS_FR : MONTHS_EN)[evDate.getMonth()];
                    const localizedTitle = isFr ? ev.title : (ev.title_en || ev.title);
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => { setSelectedDate(ev.date); setSelectedEvent(ev.id); }}
                        className="w-full bg-white rounded-lg border border-gray-100 p-3 text-left hover:border-gray-200 transition-colors anim-entry-right"
                        style={{ animationDelay: `${idx * 80}ms` }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-sentiqs-navy/5 flex flex-col items-center justify-center">
                            <span className="text-sm font-bold text-sentiqs-navy leading-none">{evDay}</span>
                            <span className="text-[8px] text-sentiqs-gray-text uppercase font-semibold">{evMonthName.slice(0, 3)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-sentiqs-navy leading-snug line-clamp-1">{localizedTitle}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="flex items-center gap-1 text-[10px] text-sentiqs-gray-text">
                                <i className="ri-time-line text-[9px]" />{ev.time}
                              </span>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              <span className="text-[10px] text-sentiqs-gray-text">{ev.country}</span>
                            </div>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${SEVERITY_BADGE_BORDERED[ev.priority]}`}>{t(`dashboard.severity.${ev.priority}`)}</span>
                        </div>
                      </button>
                    );
                  })}
                  {upstreamEvents.length > 8 && (
                    <p className="text-center text-[10px] text-sentiqs-gray-text pt-1">
                      + {upstreamEvents.length - 8} {isFr ? 'autres événements...' : 'more events...'}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}