import { useState } from 'react';

interface LeadMagnetProps {
  variant?: 'inline' | 'banner' | 'country';
  countryName?: string;
}

export default function LeadMagnet({ variant = 'banner', countryName }: LeadMagnetProps) {
  const [email, setEmail] = useState('');
  const [countrySelected, setCountrySelected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const honeypot = (formData.get('phone_alt') as string || '').trim();
    if (honeypot) { setFeedback({ type: 'success', msg: 'Inscription confirmée !' }); setSubmitting(false); return; }

    try {
      const payload = new URLSearchParams();
      payload.append('email', email);
      payload.append('country', countryName || countrySelected || '');
      payload.append('source', 'website_lead_magnet');

      const res = await fetch('https://readdy.ai/api/form/d9lb205g475qjv0tjv4g', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload.toString(),
      });

      const text = await res.text();
      let parsed: Record<string, unknown> | null = null;
      try { parsed = JSON.parse(text); } catch { /* raw text */ }

      if (res.ok && parsed?.code === 'OK') {
        setFeedback({ type: 'success', msg: 'Inscription confirmée ! Vous recevrez les alertes par email.' });
        setEmail('');
        setCountrySelected('');
        form.reset();
      } else {
        const errMsg = (parsed && (parsed.meta as Record<string, string>)?.message) || text || 'Erreur serveur';
        setFeedback({ type: 'error', msg: errMsg });
      }
    } catch {
      setFeedback({ type: 'error', msg: 'Erreur réseau. Réessayez.' });
    } finally {
      setSubmitting(false);
    }
  }

  const countries = [
    'Mali', 'Burkina Faso', 'Niger', 'Nigeria', 'RDC', 'Somalie', 'Soudan', 'Soudan du Sud',
    'Tchad', 'Centrafrique', 'Cameroun', "Côte d'Ivoire", 'Sénégal', 'Guinée',
    'Libye', 'Éthiopie', 'Mozambique', 'Kenya', 'Algérie', 'Maroc',
  ];

  if (variant === 'inline') {
    return (
      <div className="bg-sentiqs-navy rounded-xl p-5 text-white">
        <h3 className="text-sm font-bold">Restez informé — Alertes par pays</h3>
        <p className="text-xs text-white/60 mt-1 mb-4">Recevez une alerte email quand la posture d'un pays change.</p>
        <form onSubmit={handleSubmit} className="space-y-3" data-readdy-form="">
          <div className="company-phone-field" style={{ position: 'absolute', left: '-9999px', opacity: 0 }}>
            <input type="text" name="phone_alt" tabIndex={-1} autoComplete="off" aria-hidden="true" readOnly />
          </div>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="votre@email.com"
            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-xs placeholder:text-white/40 focus:outline-none focus:border-white/40"
          />
          <select
            value={countrySelected}
            onChange={(e) => setCountrySelected(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-xs focus:outline-none focus:border-white/40"
          >
            <option value="">Tous les pays</option>
            {countries.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 bg-white text-sentiqs-navy rounded-lg text-xs font-bold hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Inscription...' : "S'abonner aux alertes"}
          </button>
          {feedback && (
            <p className={`text-[10px] ${feedback.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
              {feedback.msg}
            </p>
          )}
        </form>
      </div>
    );
  }

  return (
    <section className="w-full bg-sentiqs-navy">
      <div className="w-full px-6 md:px-10 py-10 md:py-14">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
            <i className="ri-notification-3-line text-white text-xl" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white">
            {countryName ? `Alertes sécurité — ${countryName}` : 'Alertes sécurité par pays'}
          </h2>
          <p className="mt-2 text-sm text-white/60 max-w-lg mx-auto">
            Recevez gratuitement les changements de posture et les alertes critiques pour les pays qui vous concernent.
            Un email, pas de spam.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col sm:flex-row gap-2 max-w-md mx-auto" data-readdy-form="">
            <div className="company-phone-field" style={{ position: 'absolute', left: '-9999px', opacity: 0 }}>
              <input type="text" name="phone_alt" tabIndex={-1} autoComplete="off" aria-hidden="true" readOnly />
            </div>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="votre@email.com"
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-white/40"
            />
            <select
              value={countrySelected}
              onChange={(e) => setCountrySelected(e.target.value)}
              className="px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:border-white/40"
            >
              <option value="">Tous les pays</option>
              {countries.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-white text-sentiqs-navy rounded-lg text-sm font-bold hover:bg-white/90 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {submitting ? '...' : "S'abonner"}
            </button>
          </form>
          {feedback && (
            <p className={`mt-3 text-xs ${feedback.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
              {feedback.msg}
            </p>
          )}
          <p className="mt-4 text-[10px] text-white/30">
            Pas de spam. Désabonnement en 1 clic. Conforme RGPD.
          </p>
        </div>
      </div>
    </section>
  );
}