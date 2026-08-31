import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import type { ActivityLogEntry } from '@/hooks/useActivityLog';
import { useActivityLog } from '@/hooks/useActivityLog';
import ErrorState from '@/components/base/ErrorState';
import EmptyState from '@/components/base/EmptyState';

export default function MainCourante() {
  const { t, i18n } = useTranslation();
  const { entries, loading, error, refetch } = useActivityLog(20);
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);
    setSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Honeypot check
    const honeypot = (formData.get('phone_alt') as string || '').trim();
    if (honeypot) {
      setFormSuccess(true);
      setSubmitting(false);
      return;
    }

    const message = (formData.get('message') as string || '').trim();
    const analyst = (formData.get('analyst') as string || '').trim();
    const country = (formData.get('country') as string || '').trim();

    if (!message || message.length < 3) {
      setFormError('Le message doit contenir au moins 3 caractères.');
      setSubmitting(false);
      return;
    }

    try {
      const { error: insertError } = await supabase.from('activity_log').insert({
        type: 'manual_note',
        message,
        analyst_initials: analyst || null,
        country_code: country || null,
        details: { source: 'manual_entry' },
      });

      if (insertError) throw insertError;

      setFormSuccess(true);
      form.reset();
      refetch();
      setTimeout(() => setShowModal(false), 800);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    const loc = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';
    return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    const loc = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';
    return d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit' });
  }

  function isToday(iso: string): boolean {
    const d = new Date(iso);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }

  const getTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'auto_change': return <i className="ri-exchange-line text-orange-500" />;
      case 'manual_note': return <i className="ri-user-line text-sentiqs-navy" />;
      case 'alert_triggered': return <i className="ri-alarm-warning-line text-red-500" />;
      case 'stale_data': return <i className="ri-time-line text-gray-400" />;
      default: return <i className="ri-file-list-line text-gray-400" />;
    }
  }, []);

  const getTypeLabel = useCallback((type: string) => {
    switch (type) {
      case 'auto_change': return t('dashboard.postureChange');
      case 'manual_note': return t('dashboard.situation.mainCourante.message');
      case 'alert_triggered': return t('dashboard.alerts');
      case 'stale_data': return t('dashboard.timeline.today');
      default: return 'Info';
    }
  }, [t]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
          <i className="ri-book-open-line text-sentiqs-navy" />
          {t('dashboard.situation.mainCourante.title')}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-gray-400">{entries.length} {t('dashboard.situation.mainCourante.entries')}</span>
          <button
            type="button"
            onClick={() => {
              setShowModal(true);
              setFormError(null);
              setFormSuccess(false);
            }}
            className="px-2.5 py-1 bg-sentiqs-navy text-white rounded text-[10px] font-semibold hover:bg-opacity-90 transition-colors whitespace-nowrap"
          >
            <i className="ri-add-line mr-1" />
            {t('dashboard.situation.mainCourante.addEntry')}
          </button>
        </div>
      </div>

      {/* Entries list */}
      <div className="bg-white rounded-lg border border-gray-100">
        {loading && (
          <div className="p-6 text-center">
            <i className="ri-loader-4-line animate-spin text-gray-400 text-lg" />
          </div>
        )}

        {error && (
          <ErrorState
            message={error}
            onRetry={refetch}
            icon="ri-error-warning-line"
          />
        )}

        {!loading && !error && entries.length === 0 && (
          <EmptyState
            icon="ri-book-open-line"
            title={t('dashboard.situation.mainCourante.empty')}
            description={t('dashboard.situation.mainCourante.emptyHint', 'Les entrées apparaîtront ici au fur et à mesure des événements.')}
          />
        )}

        {!loading && entries.map((entry, idx) => (
          <div
            key={entry.id}
            className={`px-4 py-3 ${idx !== entries.length - 1 ? 'border-b border-gray-100' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-[10px] font-mono text-gray-400 pt-0.5 w-14 text-right">
                {formatTime(entry.created_at)}
                <div className="text-[9px] text-gray-300">
                  {isToday(entry.created_at) ? t('common.today') : formatDate(entry.created_at)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs">{getTypeIcon(entry.type)}</span>
                  <span className="text-[9px] font-semibold text-gray-400 uppercase">{getTypeLabel(entry.type)}</span>
                  {entry.analyst_initials && (
                    <span className="text-[9px] text-gray-400">· {entry.analyst_initials}</span>
                  )}
                  {entry.country_code && (
                    <span className="text-[9px] font-mono bg-gray-100 px-1 rounded text-gray-600">
                      {entry.country_code}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-gray-900">{entry.message}</p>
                {entry.details && typeof entry.details === 'object' && Object.keys(entry.details).length > 0 && (
                  <p className="mt-0.5 text-[10px] text-gray-400">
                    {Object.entries(entry.details as Record<string, unknown>)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Manual entry modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-lg">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">{t('dashboard.situation.mainCourante.modalTitle')}</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <i className="ri-close-line text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {/* Honeypot */}
              <div className="company-phone-field" style={{ position: 'absolute', left: '-9999px', opacity: 0 }}>
                <input
                  type="text"
                  name="phone_alt"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  readOnly
                />
              </div>

              <div>
                <label htmlFor="mc-message" className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                  {t('dashboard.situation.mainCourante.message')}
                </label>
                <textarea
                  id="mc-message"
                  name="message"
                  rows={3}
                  maxLength={500}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-sentiqs-navy focus:ring-1 focus:ring-sentiqs-navy/20 resize-none"
                  placeholder={i18n.language.startsWith('fr') ? "Décrivez l'événement ou la note d'analyse..." : "Describe the event or analysis note..."}
                />
                <p className="mt-0.5 text-[9px] text-gray-400">500 {i18n.language.startsWith('fr') ? 'caractères max' : 'chars max'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="mc-analyst" className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                    {t('dashboard.situation.mainCourante.analyst')}
                  </label>
                  <input
                    id="mc-analyst"
                    name="analyst"
                    type="text"
                    maxLength={10}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-sentiqs-navy focus:ring-1 focus:ring-sentiqs-navy/20"
                    placeholder="Ex: L.D."
                  />
                </div>
                <div>
                  <label htmlFor="mc-country" className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                    {t('dashboard.situation.mainCourante.country')}
                  </label>
                  <input
                    id="mc-country"
                    name="country"
                    type="text"
                    maxLength={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono uppercase focus:outline-none focus:border-sentiqs-navy focus:ring-1 focus:ring-sentiqs-navy/20"
                    placeholder="Ex: ML"
                  />
                </div>
              </div>

              {formError && (
                <div className="p-2 bg-red-50 rounded border border-red-100 text-xs text-red-700">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="p-2 bg-emerald-50 rounded border border-emerald-100 text-xs text-emerald-700">
                  <i className="ri-check-line mr-1" />
                  {t('dashboard.situation.mainCourante.added')}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-sentiqs-navy text-white rounded-lg text-xs font-semibold hover:bg-opacity-90 transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-1">
                      <i className="ri-loader-4-line animate-spin" />
                      {i18n.language.startsWith('fr') ? 'Enregistrement...' : 'Saving...'}
                    </span>
                  ) : (
                    t('dashboard.situation.mainCourante.save')
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  {t('dashboard.situation.mainCourante.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}