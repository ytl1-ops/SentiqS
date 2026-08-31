import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AFRICA_54, COUNTRY_CODES } from '@/hooks/useAlertLevels';

interface ManualOverrideModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LEVELS = [
  { value: 'rouge', label: 'ROUGE — Conflit majeur / Évacuation', color: 'bg-red-600' },
  { value: 'orange', label: 'ORANGE — Risque élevé / Déplacements limités', color: 'bg-orange-500' },
  { value: 'jaune', label: 'JAUNE — Précautions renforcées', color: 'bg-yellow-500' },
  { value: 'vert', label: 'VERT — Situation normale', color: 'bg-emerald-600' },
];

export default function ManualOverrideModal({ open, onClose, onSuccess }: ManualOverrideModalProps) {
  const [countryCode, setCountryCode] = useState('');
  const [newLevel, setNewLevel] = useState('');
  const [score, setScore] = useState('');
  const [reason, setReason] = useState('');
  const [initials, setInitials] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check
    const form = e.currentTarget as HTMLFormElement;
    const honeypot = form.querySelector<HTMLInputElement>('input[name="phone_alt"]');
    if (honeypot && honeypot.value.trim() !== '') return;

    setError('');

    if (!countryCode || !newLevel || !score || !reason.trim()) {
      setError('Tous les champs obligatoires doivent être remplis.');
      return;
    }

    const scoreNum = parseFloat(score);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      setError('Le score doit être un nombre entre 0 et 100.');
      return;
    }

    setSubmitting(true);

    try {
      const countryName = AFRICA_54.find((c) => COUNTRY_CODES[c] === countryCode) || countryCode;

      // Get current state to use as old_level
      const { data: currentState } = await supabase
        .from('country_posture_state')
        .select('level, score')
        .eq('country_code', countryCode)
        .maybeSingle();

      const oldLevel = currentState?.level || 'non_cote';
      const oldScore = currentState?.score || 0;

      // Insert into posture_history
      const { error: histError } = await supabase
        .from('posture_history')
        .insert({
          country_code: countryCode,
          country_name: countryName,
          old_level: oldLevel,
          new_level: newLevel,
          old_score: oldScore,
          new_score: scoreNum,
          reason: reason.trim(),
          event_type: 'manual',
          analyst_initials: initials.trim() || null,
        });

      if (histError) throw histError;

      // Upsert current state
      const { error: stateError } = await supabase
        .from('country_posture_state')
        .upsert({
          country_code: countryCode,
          country_name: countryName,
          level: newLevel,
          score: scoreNum,
        }, { onConflict: 'country_code' });

      if (stateError) throw stateError;

      onSuccess();
      resetForm();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  function resetForm() {
    setCountryCode('');
    setNewLevel('');
    setScore('');
    setReason('');
    setInitials('');
    setError('');
  }

  if (!open) return null;

  const sortedCountries = [...AFRICA_54].sort((a, b) => a.localeCompare(b, 'fr'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <i className="ri-edit-circle-line text-sentiqs-navy text-lg" />
            <h3 className="text-sm font-bold text-gray-900">Forcer un changement de posture</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="ri-close-line" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Honeypot */}
          <input
            type="text"
            name="phone_alt"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            readOnly
            className="absolute opacity-0 pointer-events-none"
            style={{ position: 'absolute', left: '-9999px' }}
          />

          {/* Country */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Pays <span className="text-red-500">*</span>
            </label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-700 focus:outline-none focus:border-sentiqs-navy cursor-pointer"
              required
            >
              <option value="">Sélectionner un pays...</option>
              {sortedCountries.map((country) => {
                const code = COUNTRY_CODES[country] || '';
                return (
                  <option key={code} value={code}>{country}</option>
                );
              })}
            </select>
          </div>

          {/* New level */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Nouveau niveau <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LEVELS.map((lvl) => (
                <button
                  key={lvl.value}
                  type="button"
                  onClick={() => setNewLevel(lvl.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all whitespace-nowrap ${
                    newLevel === lvl.value
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${lvl.color} flex-shrink-0`} />
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Score */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Score (0–100) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="Ex: 75.0"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-700 focus:outline-none focus:border-sentiqs-navy"
              required
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Décrivez la raison de ce changement manuel..."
              maxLength={500}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-700 focus:outline-none focus:border-sentiqs-navy resize-none"
              required
            />
            <div className="text-[9px] text-gray-400 text-right mt-0.5">{reason.length}/500</div>
          </div>

          {/* Analyst initials */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Initiales analyste
            </label>
            <input
              type="text"
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="Ex: JD"
              maxLength={4}
              className="w-24 text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-700 focus:outline-none focus:border-sentiqs-navy text-center tracking-wider"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
              <i className="ri-error-warning-line mr-1" />
              {error}
            </div>
          )}

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-[10px] text-amber-800">
            <i className="ri-alert-line mr-1" />
            Ce changement est <strong>manuel</strong> et sera tracé comme tel dans l'historique. Il peut être écrasé par les prochains calculs automatiques.
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors whitespace-nowrap"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-white bg-sentiqs-navy hover:bg-sentiqs-navy/90 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <i className="ri-loader-4-line animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <i className="ri-check-line" />
                  Confirmer le changement
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}