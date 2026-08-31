import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<'fr' | 'en'>(i18n.language.startsWith('fr') ? 'fr' : 'en');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  const t = (key: string) => {
    const fr: Record<string, string> = {
      'login.title': 'Connexion',
      'login.subtitle': 'Accès à la plateforme de veille stratégique',
      'login.email': 'Adresse e-mail',
      'login.email.ph': 'votre@email.com',
      'login.password': 'Mot de passe',
      'login.password.ph': 'Votre mot de passe',
      'login.submit': 'Se connecter',
      'login.forgot': 'Mot de passe oublié ?',
      'login.signup': 'Première connexion ? Demander un accès',
      'login.resend': "Pas reçu l'email de confirmation ? Renvoyer",
      'login.error.required_email': 'Veuillez saisir votre adresse e-mail.',
      'login.error.required_pwd': 'Veuillez saisir votre mot de passe.',
      'login.error.invalid': "E-mail ou mot de passe incorrect.",
      'login.error.not_confirmed': 'Veuillez confirmer votre adresse e-mail avant de vous connecter.',
      'login.error.generic': 'Une erreur est survenue. Veuillez réessayer.',
      'login.resend.success': "E-mail de confirmation renvoyé ! Vérifiez votre boîte de réception.",
      'login.resend.error': "Veuillez d'abord saisir votre adresse e-mail.",
      'side.badge': 'VEILLE ACTIVE',
      'side.countries': '54 PAYS',
      'side.tagline': 'Veille stratégique et sécuritaire pour l\'Afrique sub-saharienne',
      'side.feature1': 'Alertes temps réel',
      'side.feature2': 'Corrélations automatiques',
      'side.feature3': 'Rapports personnalisés',
      'side.feature4': 'Agenda opérationnel',
    };
    const en: Record<string, string> = {
      'login.title': 'Sign in',
      'login.subtitle': 'Access the strategic intelligence platform',
      'login.email': 'Email address',
      'login.email.ph': 'your@email.com',
      'login.password': 'Password',
      'login.password.ph': 'Your password',
      'login.submit': 'Sign in',
      'login.forgot': 'Forgot password?',
      'login.signup': 'First time? Request access',
      'login.resend': "Didn't receive the confirmation email? Resend",
      'login.error.required_email': 'Please enter your email address.',
      'login.error.required_pwd': 'Please enter your password.',
      'login.error.invalid': 'Invalid email or password.',
      'login.error.not_confirmed': 'Please confirm your email address before logging in.',
      'login.error.generic': 'An error occurred. Please try again.',
      'login.resend.success': 'Confirmation email resent! Check your inbox.',
      'login.resend.error': 'Please enter your email address first.',
      'side.badge': 'LIVE MONITORING',
      'side.countries': '54 COUNTRIES',
      'side.tagline': 'Strategic and security intelligence for Sub-Saharan Africa',
      'side.feature1': 'Real-time alerts',
      'side.feature2': 'Automatic correlations',
      'side.feature3': 'Custom reports',
      'side.feature4': 'Operational agenda',
    };
    return (lang === 'fr' ? fr[key] : en[key]) ?? key;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard', { replace: true });
      } else {
        setCheckingSession(false);
      }
    }).catch(() => {
      setCheckingSession(false);
    });
  }, [navigate]);

  const switchLang = useCallback((newLang: 'fr' | 'en') => {
    setLang(newLang);
    i18n.changeLanguage(newLang);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');
    if (!email.trim()) {
      setFormError(t('login.error.required_email'));
      return;
    }
    if (!password.trim()) {
      setFormError(t('login.error.required_pwd'));
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message?.includes('Invalid login credentials') || error.code === 'invalid_credentials') {
          setFormError(t('login.error.invalid'));
        } else if (error.message?.includes('Email not confirmed') || error.code === 'email_not_confirmed') {
          setFormError(t('login.error.not_confirmed'));
        } else {
          setFormError(error.message);
        }
        return;
      }
      navigate('/dashboard', { replace: true });
    } catch {
      setFormError(t('login.error.generic'));
    } finally {
      setIsSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password, lang, navigate]);

  const handleResendConfirmation = useCallback(async () => {
    if (!email.trim()) {
      setFormError(t('login.resend.error'));
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    setSuccessMessage('');
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
      if (error) {
        setFormError(error.message);
      } else {
        setSuccessMessage(t('login.resend.success'));
      }
    } catch {
      setFormError(t('login.error.generic'));
    } finally {
      setIsSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, lang]);

  if (checkingSession) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-sentiqs-gray-bg">
        <div className="w-8 h-8 border-2 border-sentiqs-navy/30 border-t-sentiqs-navy rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative flex-col overflow-hidden bg-sentiqs-navy">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src="https://readdy.ai/api/search-image?query=Dark%20dramatic%20aerial%20satellite%20view%20of%20African%20continent%20at%20night%20with%20glowing%20city%20lights%20and%20network%20connectivity%20lines%20overlaid%20on%20deep%20navy%20blue%20background%2C%20high%20contrast%20intelligence%20monitoring%20aesthetic%2C%20minimalist%20professional%20security%20technology%20visualization%2C%20subtle%20geometric%20grid%20overlay%2C%20cinematic%20deep%20blue%20tones&width=1200&height=1400&seq=login-left-panel-africa&orientation=portrait"
            alt=""
            className="w-full h-full object-cover object-center opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-sentiqs-navy via-sentiqs-navy/95 to-[#0d1f35]" />
        </div>

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
              <i className="ri-earth-line text-white text-base" />
            </div>
            <div>
              <span className="text-base font-bold text-white tracking-tight">SentiqS</span>
            </div>
          </div>

          {/* Main content — centered vertically */}
          <div className="flex-1 flex flex-col justify-center mt-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
                {t('side.badge')} · {t('side.countries')}
              </span>
            </div>

            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-snug mb-5 max-w-xs">
              {t('side.tagline')}
            </h1>

            <p className="text-sm text-white/50 mb-10 max-w-xs leading-relaxed">
              Plateforme d&apos;aide à la décision pour responsables sûreté. Alertes, corrélations, rapports.
            </p>

            {/* Feature list */}
            <div className="space-y-3">
              {[
                { icon: 'ri-alarm-warning-line', label: t('side.feature1') },
                { icon: 'ri-git-merge-line', label: t('side.feature2') },
                { icon: 'ri-file-chart-line', label: t('side.feature3') },
                { icon: 'ri-calendar-line', label: t('side.feature4') },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <i className={`${f.icon} text-white/70 text-sm`} />
                  </div>
                  <span className="text-xs font-medium text-white/70">{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer info */}
          <div className="flex items-center justify-between pt-8 border-t border-white/10">
            <span className="text-[10px] font-semibold tracking-[0.15em] text-white/30 uppercase">
              SENTIQS © 2026
            </span>
            <span className="text-[10px] font-semibold tracking-[0.15em] text-white/30 uppercase">
              AFRICA RISK INTELLIGENCE
            </span>
          </div>
        </div>
      </div>

      {/* ── Right panel — Form ── */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-sentiqs-navy flex items-center justify-center">
              <i className="ri-earth-line text-white text-sm" />
            </div>
            <span className="text-sm font-bold text-sentiqs-navy">SentiqS</span>
          </div>
          <span className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">
            Veille active · 54 pays
          </span>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-10">
          <div className="w-full max-w-[400px]">

            {/* Lang toggle + top spacing */}
            <div className="flex items-center justify-between mb-10">
              <div className="hidden lg:block">
                <span className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">
                  Veille active · 54 pays
                </span>
              </div>
              <div className="inline-flex rounded-md overflow-hidden border border-sentiqs-gray-border">
                <button
                  type="button"
                  onClick={() => switchLang('fr')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    lang === 'fr' ? 'bg-sentiqs-navy text-white' : 'bg-white text-sentiqs-gray-text hover:bg-gray-50'
                  }`}
                >
                  FR
                </button>
                <button
                  type="button"
                  onClick={() => switchLang('en')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    lang === 'en' ? 'bg-sentiqs-navy text-white' : 'bg-white text-sentiqs-gray-text hover:bg-gray-50'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>

            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-sentiqs-navy mb-1.5">{t('login.title')}</h2>
              <p className="text-sm text-sentiqs-gray-text">{t('login.subtitle')}</p>
            </div>

            {/* Alerts */}
            {formError && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-3.5 py-3 mb-5">
                <i className="ri-error-warning-line text-red-500 text-sm mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-600 leading-relaxed">{formError}</p>
              </div>
            )}
            {successMessage && (
              <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-100 rounded-lg px-3.5 py-3 mb-5">
                <i className="ri-checkbox-circle-line text-emerald-600 text-sm mt-0.5 flex-shrink-0" />
                <p className="text-xs text-emerald-700">{successMessage}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-[11px] font-bold tracking-[0.08em] text-sentiqs-navy uppercase mb-1.5">
                  {t('login.email')}
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
                    placeholder={t('login.email.ph')}
                    autoComplete="email"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-navy/15 focus:border-sentiqs-navy transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold tracking-[0.08em] text-sentiqs-navy uppercase">
                    {t('login.password')}
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-[11px] text-sentiqs-blue hover:text-sentiqs-blue-dark transition-colors"
                  >
                    {t('login.forgot')}
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <i className="ri-lock-line text-sentiqs-gray-text text-sm" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('login.password.ph')}
                    autoComplete="current-password"
                    className="w-full pl-9 pr-10 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-navy/15 focus:border-sentiqs-navy transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-sentiqs-gray-text hover:text-sentiqs-navy transition-colors"
                  >
                    <i className={`text-sm ${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}`} />
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-sentiqs-navy hover:bg-sentiqs-navy-light text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap mt-2"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <i className="ri-arrow-right-line text-sm" />
                )}
                {t('login.submit')}
              </button>
            </form>

            {/* Resend confirmation */}
            {formError && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={isSubmitting}
                  className="text-xs text-sentiqs-blue hover:text-sentiqs-blue-dark transition-colors underline underline-offset-2 disabled:opacity-50 cursor-pointer"
                >
                  {t('login.resend')}
                </button>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] text-sentiqs-gray-text font-medium uppercase tracking-widest">ou</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Signup link */}
            <Link
              to="/signup"
              className="flex items-center justify-center gap-2 w-full py-2.5 border border-sentiqs-gray-border text-sentiqs-navy text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              <i className="ri-user-add-line text-sm" />
              {t('login.signup')}
            </Link>

          </div>
        </div>

        {/* Right panel footer */}
        <div className="px-6 sm:px-10 lg:px-16 py-5 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">
            FLUX · CORRÉLATIONS · ALERTES
          </span>
          <span className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">
            SÛRETÉ OPÉRATIONNELLE
          </span>
        </div>
      </div>
    </div>
  );
}