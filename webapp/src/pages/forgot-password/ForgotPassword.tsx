import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<'fr' | 'en'>(i18n.language.startsWith('fr') ? 'fr' : 'en');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetLink, setResetLink] = useState('');

  const t = (key: string) => {
    const fr: Record<string, string> = {
      'forgot.title': 'Mot de passe oublié',
      'forgot.subtitle': 'Saisissez votre email pour recevoir un lien de réinitialisation',
      'forgot.email': 'Adresse e-mail',
      'forgot.email.ph': 'votre@email.com',
      'forgot.submit': 'Envoyer le lien',
      'forgot.back': 'Retour à la connexion',
      'forgot.error.required': 'Veuillez saisir votre adresse e-mail.',
      'forgot.error.generic': 'Une erreur est survenue. Veuillez réessayer.',
      'forgot.success': 'Lien de réinitialisation généré avec succès.',
      'forgot.success.note': "Aucun email n'est envoyé. Le lien est affiché directement ci-dessous :",
      'forgot.cta.reset': 'Réinitialiser le mot de passe',
      'side.badge': 'VEILLE ACTIVE',
      'side.countries': '54 PAYS',
    };
    const en: Record<string, string> = {
      'forgot.title': 'Forgot password',
      'forgot.subtitle': 'Enter your email to receive a reset link',
      'forgot.email': 'Email address',
      'forgot.email.ph': 'your@email.com',
      'forgot.submit': 'Send reset link',
      'forgot.back': 'Back to sign in',
      'forgot.error.required': 'Please enter your email address.',
      'forgot.error.generic': 'An error occurred. Please try again.',
      'forgot.success': 'Reset link generated successfully.',
      'forgot.success.note': 'No email is sent. The reset link is displayed directly below:',
      'forgot.cta.reset': 'Reset Password',
      'side.badge': 'LIVE MONITORING',
      'side.countries': '54 COUNTRIES',
    };
    return (lang === 'fr' ? fr[key] : en[key]) ?? key;
  };

  const switchLang = useCallback((newLang: 'fr' | 'en') => {
    setLang(newLang);
    i18n.changeLanguage(newLang);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');
    setResetLink('');

    if (!email.trim()) {
      setFormError(t('forgot.error.required'));
      return;
    }

    setIsSubmitting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
      const response = await fetch(`${supabaseUrl}/functions/v1/password-reset-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), lang }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setFormError(data.error || t('forgot.error.generic'));
        return;
      }

      if (data.action_link) {
        setResetLink(data.action_link);
        setSuccessMessage(t('forgot.success'));
      } else if (data.note) {
        setSuccessMessage(data.note);
      }
    } catch {
      setFormError(t('forgot.error.generic'));
    } finally {
      setIsSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, lang]);

  const handleGoToDashboard = useCallback(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative flex-col overflow-hidden bg-sentiqs-navy">
        <div className="absolute inset-0">
          <img
            src="https://readdy.ai/api/search-image?query=Dark%20dramatic%20aerial%20satellite%20view%20of%20African%20continent%20at%20night%20with%20glowing%20city%20lights%20and%20network%20connectivity%20lines%20overlaid%20on%20deep%20navy%20blue%20background%2C%20high%20contrast%20intelligence%20monitoring%20aesthetic%2C%20minimalist%20professional%20security%20technology%20visualization%2C%20subtle%20geometric%20grid%20overlay%2C%20cinematic%20deep%20blue%20tones&width=1200&height=1400&seq=login-left-panel-africa&orientation=portrait"
            alt=""
            className="w-full h-full object-cover object-center opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-sentiqs-navy via-sentiqs-navy/95 to-[#0d1f35]" />
        </div>
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
              <i className="ri-earth-line text-white text-base" />
            </div>
            <span className="text-base font-bold text-white tracking-tight">SentiqS</span>
          </div>

          <div className="flex-1 flex flex-col justify-center mt-8">
            <div className="inline-flex items-center gap-2 mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
                {t('side.badge')} · {t('side.countries')}
              </span>
            </div>
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-snug mb-5 max-w-xs">
              Accès sécurisé à votre plateforme
            </h1>
            <p className="text-sm text-white/50 max-w-xs leading-relaxed">
              Réinitialisez votre mot de passe pour retrouver l&apos;accès à votre espace de veille stratégique.
            </p>
          </div>

          <div className="flex items-center justify-between pt-8 border-t border-white/10">
            <span className="text-[10px] font-semibold tracking-[0.15em] text-white/30 uppercase">SENTIQS © 2026</span>
            <span className="text-[10px] font-semibold tracking-[0.15em] text-white/30 uppercase">AFRICA RISK INTELLIGENCE</span>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-sentiqs-navy flex items-center justify-center">
              <i className="ri-earth-line text-white text-sm" />
            </div>
            <span className="text-sm font-bold text-sentiqs-navy">SentiqS</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-10">
          <div className="w-full max-w-[400px]">

            {/* Lang toggle */}
            <div className="flex items-center justify-between mb-10">
              <div className="hidden lg:block">
                <span className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">
                  Veille active · 54 pays
                </span>
              </div>
              <div className="inline-flex rounded-md overflow-hidden border border-sentiqs-gray-border">
                <button type="button" onClick={() => switchLang('fr')} className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${lang === 'fr' ? 'bg-sentiqs-navy text-white' : 'bg-white text-sentiqs-gray-text hover:bg-gray-50'}`}>FR</button>
                <button type="button" onClick={() => switchLang('en')} className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${lang === 'en' ? 'bg-sentiqs-navy text-white' : 'bg-white text-sentiqs-gray-text hover:bg-gray-50'}`}>EN</button>
              </div>
            </div>

            {/* Back link */}
            <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-sentiqs-gray-text hover:text-sentiqs-navy transition-colors mb-6">
              <i className="ri-arrow-left-line text-sm" />
              {t('forgot.back')}
            </Link>

            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-sentiqs-navy mb-1.5">{t('forgot.title')}</h2>
              <p className="text-sm text-sentiqs-gray-text">{t('forgot.subtitle')}</p>
            </div>

            {/* Success state */}
            {successMessage && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mb-5">
                <div className="flex items-start gap-2.5 mb-3">
                  <i className="ri-checkbox-circle-line text-emerald-600 text-sm mt-0.5 flex-shrink-0" />
                  <p className="text-xs font-medium text-emerald-800">{successMessage}</p>
                </div>
                {resetLink && (
                  <>
                    <p className="text-xs text-emerald-700 mb-2.5 ml-5">{t('forgot.success.note')}</p>
                    <div className="bg-white border border-emerald-200 rounded-md p-3 mb-3 ml-5">
                      <p className="text-xs text-gray-500 font-mono break-all leading-relaxed">{resetLink}</p>
                    </div>
                    <a
                      href={resetLink}
                      className="ml-5 inline-flex items-center gap-2 px-4 py-2.5 bg-sentiqs-navy hover:bg-sentiqs-navy-light text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                    >
                      <i className="ri-lock-unlock-line" />
                      {t('forgot.cta.reset')}
                    </a>
                  </>
                )}
                <div className="mt-4 ml-5">
                  <button
                    type="button"
                    onClick={handleGoToDashboard}
                    className="text-xs text-sentiqs-blue hover:text-sentiqs-blue-dark underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    Aller au tableau de bord
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {formError && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-3.5 py-3 mb-5">
                <i className="ri-error-warning-line text-red-500 text-sm mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-600">{formError}</p>
              </div>
            )}

            {/* Form */}
            {!successMessage && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold tracking-[0.08em] text-sentiqs-navy uppercase mb-1.5">
                    {t('forgot.email')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <i className="ri-mail-line text-sentiqs-gray-text text-sm" />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('forgot.email.ph')}
                      autoComplete="email"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-navy/15 focus:border-sentiqs-navy transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-sentiqs-navy hover:bg-sentiqs-navy-light text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <i className="ri-mail-send-line text-sm" />
                  )}
                  {t('forgot.submit')}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="px-6 sm:px-10 lg:px-16 py-5 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">FLUX · CORRÉLATIONS · ALERTES</span>
          <span className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">SÛRETÉ OPÉRATIONNELLE</span>
        </div>
      </div>
    </div>
  );
}