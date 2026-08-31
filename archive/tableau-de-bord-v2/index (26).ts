import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import Toast from '@/components/base/Toast';
import ErrorState from '@/components/base/ErrorState';

interface ScheduledReport {
  id: number;
  name: string;
  name_en: string | null;
  frequency: 'weekly' | 'monthly';
  day_of_week: number;
  day_of_month: number;
  time_of_day: string;
  report_type: string;
  report_format: string;
  region: string;
  countries: string[];
  recipients: string[];
  status: 'active' | 'paused';
  last_run: string | null;
  next_run: string | null;
  created_at: string;
  updated_at: string;
}

const REPORT_TYPES = ['correlation', 'monthly', 'risk', 'executive', 'quarterly', 'data'];
const FORMATS = ['pdf', 'excel', 'word'];
const FREQ_DAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

const regionsList = ['Sahel', 'Golfe de Guinée', 'Afrique de l\'Ouest', 'Afrique Centrale', 'Afrique de l\'Est', 'Corne de l\'Afrique', 'Maghreb', 'Panafricain'];

export default function ScheduledReportsPanel() {
  const { t } = useTranslation();
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // --- Create form state ---
  const [formName, setFormName] = useState('');
  const [formFreq, setFormFreq] = useState<'weekly' | 'monthly'>('weekly');
  const [formDayOfWeek, setFormDayOfWeek] = useState(1);
  const [formDayOfMonth, setFormDayOfMonth] = useState(1);
  const [formTime, setFormTime] = useState('08:00');
  const [formType, setFormType] = useState('correlation');
  const [formFormat, setFormFormat] = useState('pdf');
  const [formRegion, setFormRegion] = useState('Sahel');
  const [formRecipients, setFormRecipients] = useState<string[]>(['']);

  // Fetch schedules from DB
  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const { data, error } = await supabase
        .from('scheduled_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSchedules((data || []) as ScheduledReport[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load scheduled reports';
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const resetForm = () => {
    setFormName('');
    setFormFreq('weekly');
    setFormDayOfWeek(1);
    setFormDayOfMonth(1);
    setFormTime('08:00');
    setFormType('correlation');
    setFormFormat('pdf');
    setFormRegion('Sahel');
    setFormRecipients(['']);
  };

  const handleAddRecipient = () => {
    setFormRecipients((prev) => [...prev, '']);
  };

  const handleRemoveRecipient = (idx: number) => {
    setFormRecipients((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRecipientChange = (idx: number, value: string) => {
    setFormRecipients((prev) => prev.map((r, i) => (i === idx ? value : r)));
  };

  const computeNextRun = (freq: 'weekly' | 'monthly', dayOfWeek: number, dayOfMonth: number, timeOfDay: string): string => {
    const next = new Date();
    if (freq === 'weekly') {
      const currentDay = next.getUTCDay();
      const diff = (dayOfWeek - currentDay + 7) % 7;
      next.setUTCDate(next.getUTCDate() + (diff === 0 ? 7 : diff));
    } else {
      next.setUTCMonth(next.getUTCDate() > dayOfMonth ? next.getUTCMonth() + 1 : next.getUTCMonth());
      next.setUTCDate(dayOfMonth);
    }
    const [h, m] = timeOfDay.split(':');
    next.setUTCHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    return next.toISOString();
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    const validRecipients = formRecipients.filter((r) => r.trim() !== '');
    if (validRecipients.length === 0) return;

    setSaving(true);
    try {
      const nextRun = computeNextRun(formFreq, formDayOfWeek, formDayOfMonth, formTime);

      const { error } = await supabase
        .from('scheduled_reports')
        .insert({
          name: formName.trim(),
          name_en: formName.trim(),
          frequency: formFreq,
          day_of_week: formFreq === 'weekly' ? formDayOfWeek : 1,
          day_of_month: formFreq === 'monthly' ? formDayOfMonth : 1,
          time_of_day: formTime,
          report_type: formType,
          report_format: formFormat,
          region: formRegion,
          countries: [],
          recipients: validRecipients,
          status: 'active',
          last_run: null,
          next_run: nextRun,
        });

      if (error) throw error;

      setToast(t('dashboard.reports.scheduled.created'));
      setShowCreate(false);
      resetForm();
      fetchSchedules();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create schedule';
      setToast(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (sch: ScheduledReport) => {
    try {
      const newStatus = sch.status === 'active' ? 'paused' : 'active';
      const newNextRun = newStatus === 'active'
        ? computeNextRun(sch.frequency, sch.day_of_week, sch.day_of_month, sch.time_of_day)
        : null;

      const { error } = await supabase
        .from('scheduled_reports')
        .update({
          status: newStatus,
          next_run: newNextRun,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sch.id);

      if (error) throw error;

      setToast(t('dashboard.reports.scheduled.toggled'));
      fetchSchedules();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle schedule';
      setToast(msg);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from('scheduled_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setDeleteConfirm(null);
      setToast(t('dashboard.reports.scheduled.deleted'));
      fetchSchedules();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete schedule';
      setToast(msg);
    }
  };

  const handleTriggerNow = async (sch: ScheduledReport) => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('scheduled_reports')
        .update({ last_run: now, updated_at: now })
        .eq('id', sch.id);

      if (error) throw error;

      setToast(`"${sch.name}" — ${t('dashboard.reports.scheduled.toast.triggered')}`);
      fetchSchedules();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to trigger report';
      setToast(msg);
    }
  };

  const counts = useMemo(() => {
    return {
      total: schedules.length,
      active: schedules.filter((s) => s.status === 'active').length,
      paused: schedules.filter((s) => s.status === 'paused').length,
    };
  }, [schedules]);

  const formatTime = (ts: string | null) => {
    if (!ts || ts === '—') return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const freqLabel = (s: ScheduledReport) => {
    if (s.frequency === 'weekly') {
      const dayKey = FREQ_DAYS[s.day_of_week - 1] || 'monday';
      return `${t(`dashboard.reports.scheduled.frequencies.weekly`)} · ${t(`dashboard.reports.scheduled.days.${dayKey}`)}`;
    }
    return `${t('dashboard.reports.scheduled.frequencies.monthly')} · ${t('dashboard.reports.scheduled.next')} ${s.day_of_month}`;
  };

  const formatIcon = (fmt: string) => {
    const map: Record<string, string> = {
      pdf: 'ri-file-pdf-2-line text-red-500',
      word: 'ri-file-word-2-line text-blue-500',
      excel: 'ri-file-excel-2-line text-emerald-600',
    };
    return map[fmt] || 'ri-file-line text-gray-400';
  };

  // --- Loading state ---
  if (loading) {
    return (
      <div className="space-y-5 pt-4 border-t border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-64 bg-gray-50 rounded animate-pulse mt-1.5" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-100 p-3">
              <div className="h-7 w-8 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-16 bg-gray-50 rounded animate-pulse mt-1" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-100 p-4">
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-gray-100 rounded-lg animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3 w-48 bg-gray-50 rounded animate-pulse" />
                  <div className="h-3 w-56 bg-gray-50 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (fetchError) {
    return (
      <div className="space-y-5 pt-4 border-t border-gray-100">
        <ErrorState message={t('dashboard.reports.scheduled.loadError')} onRetry={fetchSchedules} retryLabel={t('dashboard.reports.scheduled.retry')} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Toast message={toast} onDismiss={() => setToast(null)} />

      {/* Delete confirm modal */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-sentiqs-navy mb-1">{t('dashboard.reports.scheduled.confirmDelete')}</p>
            <p className="text-xs text-sentiqs-gray-text mb-5">{schedules.find((s) => s.id === deleteConfirm)?.name}</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-semibold text-sentiqs-gray-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
              >
                {t('share.close')}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors whitespace-nowrap"
              >
                {t('dashboard.reports.scheduled.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create schedule modal */}
      {showCreate && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-start justify-center pt-[5vh] overflow-y-auto" onClick={() => { setShowCreate(false); resetForm(); }}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-lg my-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-sentiqs-navy mb-4">{t('dashboard.reports.scheduled.create')}</h2>

            <div className="space-y-3">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">{t('dashboard.reports.scheduled.form.name')}</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Rapport hebdo — Zone Sahel"
                  className="w-full px-3 py-2 text-xs text-sentiqs-navy border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy placeholder:text-gray-300"
                />
              </div>

              {/* Frequency + Day + Time row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">{t('dashboard.reports.scheduled.form.frequency')}</label>
                  <select
                    value={formFreq}
                    onChange={(e) => setFormFreq(e.target.value as 'weekly' | 'monthly')}
                    className="w-full px-2 py-2 text-xs text-sentiqs-navy border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy bg-white"
                  >
                    <option value="weekly">{t('dashboard.reports.scheduled.frequencies.weekly')}</option>
                    <option value="monthly">{t('dashboard.reports.scheduled.frequencies.monthly')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">
                    {formFreq === 'weekly' ? t('dashboard.reports.scheduled.form.dayOfWeek') : t('dashboard.reports.scheduled.form.dayOfMonth')}
                  </label>
                  {formFreq === 'weekly' ? (
                    <select
                      value={formDayOfWeek}
                      onChange={(e) => setFormDayOfWeek(parseInt(e.target.value, 10))}
                      className="w-full px-2 py-2 text-xs text-sentiqs-navy border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy bg-white"
                    >
                      {FREQ_DAYS.map((day, i) => (
                        <option key={day} value={i + 1}>{t(`dashboard.reports.scheduled.days.${day}`)}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={formDayOfMonth}
                      onChange={(e) => setFormDayOfMonth(Math.min(28, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                      className="w-full px-2 py-2 text-xs text-sentiqs-navy border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">{t('dashboard.reports.scheduled.form.time')}</label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-2 py-2 text-xs text-sentiqs-navy border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy"
                  />
                </div>
              </div>

              {/* Type + Format */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">{t('dashboard.reports.scheduled.form.type')}</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-2 py-2 text-xs text-sentiqs-navy border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy bg-white"
                  >
                    {REPORT_TYPES.map((tp) => (
                      <option key={tp} value={tp}>{t(`dashboard.reports.types.${tp}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">{t('dashboard.reports.scheduled.form.format')}</label>
                  <select
                    value={formFormat}
                    onChange={(e) => setFormFormat(e.target.value)}
                    className="w-full px-2 py-2 text-xs text-sentiqs-navy border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy bg-white"
                  >
                    {FORMATS.map((f) => (
                      <option key={f} value={f}>{f.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Region */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">{t('dashboard.reports.scheduled.form.region')}</label>
                <select
                  value={formRegion}
                  onChange={(e) => setFormRegion(e.target.value)}
                  className="w-full px-2 py-2 text-xs text-sentiqs-navy border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy bg-white"
                >
                  {regionsList.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Recipients */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">{t('dashboard.reports.scheduled.form.recipients')}</label>
                <div className="space-y-1.5">
                  {formRecipients.map((r, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input
                        type="email"
                        value={r}
                        onChange={(e) => handleRecipientChange(i, e.target.value)}
                        placeholder={t('dashboard.reports.scheduled.form.recipientPlaceholder')}
                        className="flex-1 px-2 py-1.5 text-xs text-sentiqs-navy border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy placeholder:text-gray-300"
                      />
                      {formRecipients.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRecipient(i)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
                        >
                          <i className="ri-delete-bin-line text-sm" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddRecipient}
                  className="mt-2 text-[10px] font-semibold text-sentiqs-navy/60 hover:text-sentiqs-navy flex items-center gap-1 transition-colors"
                >
                  <i className="ri-add-line text-xs" /> {t('dashboard.reports.scheduled.form.addRecipient')}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="px-4 py-2 text-xs font-semibold text-sentiqs-gray-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
              >
                {t('share.close')}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving || !formName.trim() || formRecipients.every((r) => r.trim() === '')}
                className="px-4 py-2 text-xs font-semibold text-white bg-sentiqs-navy rounded-lg hover:bg-sentiqs-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {saving ? (
                  <span className="flex items-center gap-1">
                    <i className="ri-loader-4-line animate-spin text-xs" />
                    {t('dashboard.reports.scheduled.creating')}
                  </span>
                ) : (
                  t('dashboard.reports.scheduled.create')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 pt-4 border-t border-gray-100">
        <div>
          <h2 className="text-sm font-bold text-sentiqs-navy">{t('dashboard.reports.scheduled')}</h2>
          <p className="text-[10px] text-sentiqs-gray-text mt-0.5">{t('dashboard.reports.scheduledDesc')}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-[10px] font-semibold text-white bg-sentiqs-navy hover:bg-sentiqs-navy/90 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <i className="ri-add-line text-xs" /> {t('dashboard.reports.scheduled.create')}
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="text-2xl font-bold text-sentiqs-navy">{counts.total}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mt-0.5">{t('dashboard.reports.total')}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="text-2xl font-bold text-emerald-600">{counts.active}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mt-0.5">{t('dashboard.reports.scheduled.active')}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="text-2xl font-bold text-amber-500">{counts.paused}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mt-0.5">{t('dashboard.reports.scheduled.paused')}</div>
        </div>
      </div>

      {/* Scheduled reports list */}
      <div className="space-y-2">
        {schedules.length === 0 ? (
          <div className="py-12 text-center text-sentiqs-gray-text text-xs bg-white rounded-lg border border-gray-100">
            {t('dashboard.reports.scheduled.empty')}
          </div>
        ) : (
          schedules.map((sch) => (
            <div
              key={sch.id}
              className={`bg-white rounded-lg border transition-colors ${
                sch.status === 'active' ? 'border-gray-100 hover:border-gray-200' : 'border-gray-100/60 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-4 p-4">
                {/* Format icon */}
                <div className="flex-shrink-0">
                  <i className={`${formatIcon(sch.report_format)} text-2xl`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[10px] text-sentiqs-gray-text">SCH-{String(sch.id).padStart(3, '0')}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      sch.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {t(`dashboard.reports.scheduled.status.${sch.status}`)}
                    </span>
                    <span className="text-[10px] text-sentiqs-gray-text">{freqLabel(sch)} · {sch.time_of_day} UTC</span>
                  </div>
                  <p className="text-xs font-semibold text-sentiqs-navy line-clamp-1">{sch.name}</p>
                  <div className="flex items-center gap-4 mt-1.5 text-[10px] text-sentiqs-gray-text flex-wrap">
                    <span><i className="ri-map-pin-line text-xs mr-0.5" />{sch.region}</span>
                    <span>{(sch.recipients || []).length} {t('dashboard.reports.scheduled.recipients').toLowerCase()}</span>
                    <span title={t('dashboard.reports.scheduled.nextRun')}><i className="ri-timer-line text-xs mr-0.5" />{formatTime(sch.next_run)}</span>
                    {sch.last_run && (
                      <span title={t('dashboard.reports.scheduled.lastRun')}><i className="ri-history-line text-xs mr-0.5" />{formatTime(sch.last_run)}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Trigger now */}
                  {sch.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => handleTriggerNow(sch)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-sentiqs-gray-text hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                      title={t('dashboard.reports.scheduled.triggerNow')}
                    >
                      <i className="ri-flashlight-line text-base" />
                    </button>
                  )}
                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggle(sch)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                      sch.status === 'active'
                        ? 'bg-amber-50 text-amber-500 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}
                    title={t('dashboard.reports.scheduled.toggle')}
                  >
                    <i className={sch.status === 'active' ? 'ri-pause-line' : 'ri-play-line'} />
                  </button>
                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(sch.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-sentiqs-gray-text hover:bg-red-50 hover:text-red-500 transition-colors"
                    title={t('dashboard.reports.scheduled.delete')}
                  >
                    <i className="ri-delete-bin-line text-base" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}