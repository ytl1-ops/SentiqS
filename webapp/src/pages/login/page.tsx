import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [lang, setLang] = useState<'fr' | 'en'>(i18n.language.startsWith('fr') ? 'fr' : 'en');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [zone, setZone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

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
      setFormError(lang === 'fr' ? 'Veuillez saisir votre adresse e-mail.' : 'Please enter your email address.');
      return;
    }
    if (!password.trim()) {
      setFormError(lang === 'fr' ? 'Veuillez saisir votre mot de passe.' : 'Please enter your password.');
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
          setFormError(lang === 'fr' ? 'E-mail ou mot de passe incorrect. Si vous venez de créer un compte, assurez-vous d\'avoir confirmé votre adresse e-mail via le lien reçu.' : 'Invalid email or password. If you just created an account, make sure you have confirmed your email address via the link received.');
        } else if (error.message?.includes('Email not confirmed') || error.code === 'email_not_confirmed') {
          setFormError(lang === 'fr' ? 'Veuillez confirmer votre adresse e-mail avant de vous connecter. Vérifiez votre boîte de réception.' : 'Please confirm your email address before logging in. Check your inbox.');
        } else {
          setFormError(error.message);
        }
        return;
      }

      navigate('/dashboard', { replace: true });
    } catch {
      setFormError(lang === 'fr' ? 'Une erreur est survenue. Veuillez réessayer.' : 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, lang, navigate]);

  const handleResendConfirmation = useCallback(async () => {
    if (!email.trim()) {
      setFormError(lang === 'fr' ? 'Veuillez d\'abord saisir votre adresse e-mail.' : 'Please enter your email address first.');
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
        setSuccessMessage(lang === 'fr' ? 'E-mail de confirmation renvoyé ! Vérifiez votre boîte de réception (et vos spams).' : 'Confirmation email resent! Check your inbox (and spam folder).');
      }
    } catch {
      setFormError(lang === 'fr' ? 'Une erreur est survenue lors de l\'envoi.' : 'An error occurred while sending.');
    } finally {
      setIsSubmitting(false);
    }
  }, [email, lang]);

  if (checkingSession) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#081018]">
        <div className="w-10 h-10 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#081018] text-slate-100">
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative flex-col overflow-hidden bg-[#07111a]">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at top left, rgba(34,211,238,0.25), transparent 30%), linear-gradient(135deg, rgba(8,16,24,0.96), rgba(15,23,42,0.88))' }} />
        <img
          src="https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1400&q=80"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />

        <div className="relative z-10 flex h-full flex-col p-8 xl:p-12">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl border border-cyan-400/30 bg-cyan-400/10 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.25)]">
              <i className="ri-earth-line text-xl text-cyan-300" />
            </div>
            <div>
              <div className="text-[10px] font-semibold tracking-[0.22em] text-cyan-300 uppercase">SentiqS</div>
              <div className="text-sm font-medium text-slate-300">Global Security Intelligence</div>
            </div>
          </div>

          <div className="mt-auto max-w-lg">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/5 px-3 py-1.5 text-[10px] font-semibold tracking-[0.2em] uppercase text-cyan-200">
              <span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" />
              Active monitoring
            </div>

            <h1 className="max-w-md text-4xl xl:text-5xl font-semibold leading-tight text-white tracking-[-0.04em]">
              Operational visibility for 54 markets across Africa.
            </h1>

            <p className="mt-5 max-w-md text-base text-slate-300 leading-7">
              Continuous threat monitoring, country-level posture tracking, and actionable intelligence for security and risk teams.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-4 text-left">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="text-2xl font-semibold text-cyan-300">54</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">countries</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="text-2xl font-semibold text-cyan-300">24/7</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">coverage</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="text-2xl font-semibold text-cyan-300">0.3s</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">latency</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
        <div className="w-full max-w-[430px] rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_80px_rgba(2,6,23,0.75)] backdrop-blur-xl sm:p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="hidden lg:block">
              <div className="text-[10px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
                Veille active · 54 pays
              </div>
            </div>
            <div className="inline-flex rounded-lg border border-white/10 bg-slate-950/60 p-1">
              <button
                type="button"
                onClick={() => switchLang('fr')}
                className={`rounded-md px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase transition ${lang === 'fr' ? 'bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.4)]' : 'text-slate-300 hover:text-white'}`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => switchLang('en')}
                className={`rounded-md px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase transition ${lang === 'en' ? 'bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.4)]' : 'text-slate-300 hover:text-white'}`}
              >
                EN
              </button>
            </div>
          </div>

          <div className="mb-7">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/35 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                <i className="ri-earth-line text-lg text-cyan-300" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white">SentiqS</h1>
                <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-400 uppercase">{t('card.subtitle')}</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-6">{t('card.description1')}</p>
            <p className="mt-1 text-xs text-slate-400">{t('card.description2')}</p>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
              <div className="text-xl font-semibold text-cyan-300">54</div>
              <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-slate-400">{t('card.stats.countries')}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
              <div className="text-xl font-semibold text-cyan-300">—</div>
              <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-slate-400">{t('card.stats.news')}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
              <div className="text-xl font-semibold text-cyan-300">—</div>
              <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-slate-400">{t('card.stats.alerts')}</div>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-center text-xs text-cyan-100 italic">
            {t('card.notice')}
          </div>

          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">{t('card.login.title')}</h2>
            <p className="mt-1 text-sm text-slate-400">{t('card.login.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
                {formError}
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-200">
                {successMessage}
              </div>
            )}

            <div>
              <label className="mb-2 block text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
                {t('card.email.label')}
              </label>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('card.email.placeholder')}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
                {t('card.password.label')}
              </label>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('card.password.placeholder')}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
                {t('card.zone.label')}
              </label>
              <select
                name="zone"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-3 text-sm text-white focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
              >
                <option value="" className="bg-slate-900">{t('card.zone.default')}</option>
                <option value="golfe" className="bg-slate-900">Golfe de Guinée</option>
                <option value="sahel" className="bg-slate-900">Sahel</option>
                <option value="afrique-est" className="bg-slate-900">Afrique de l&apos;Est</option>
                <option value="afrique-centrale" className="bg-slate-900">Afrique Centrale</option>
                <option value="afrique-sud" className="bg-slate-900">Afrique du Sud</option>
                <option value="maghreb" className="bg-slate-900">Maghreb</option>
              </select>
              <p className="mt-2 text-[10px] text-slate-400 leading-5">{t('card.zone.help')}</p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 shadow-[0_0_30px_rgba(34,211,238,0.25)]"
            >
              {isSubmitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
              ) : (
                <i className="ri-login-box-line text-base" />
              )}
              {t('card.submit')}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-4">
            <Link to="/signup" className="text-xs text-cyan-300 hover:text-cyan-200 transition">{t('card.firstTime')}</Link>
            <Link to="/forgot-password" className="text-xs text-slate-400 hover:text-slate-200 transition">{t('card.forgot')}</Link>
          </div>

          {formError && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={isSubmitting}
                className="text-xs text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
              >
                {lang === 'fr' ? 'Pas reçu l\'email de confirmation ? Renvoyer' : 'Didn\'t receive the confirmation email? Resend'}
              </button>
            </div>
          )}

          <div className="mt-6 border-t border-white/10 pt-4">
            <div className="flex items-center justify-center gap-6 text-[10px] uppercase tracking-[0.18em] text-slate-400">
              <a href="#" className="flex items-center gap-2 hover:text-cyan-200 transition" onClick={(e) => e.preventDefault()}>
                <i className="ri-newspaper-line" />
                {t('card.publicBulletin')}
              </a>
              <a href="#" className="flex items-center gap-2 hover:text-cyan-200 transition" onClick={(e) => e.preventDefault()}>
                <i className="ri-link" />
                {t('card.methodology')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
