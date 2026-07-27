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
          setFormError(
            lang === 'fr'
              ? 'E-mail ou mot de passe incorrect. Si vous venez de créer un compte, assurez-vous d\'avoir confirmé votre adresse e-mail via le lien reçu.'
              : 'Invalid email or password. If you just created an account, make sure you have confirmed your email address via the link received.'
          );
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
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (error) {
        setFormError(error.message);
      } else {
        setSuccessMessage(
          lang === 'fr'
            ? 'E-mail de confirmation renvoyé ! Vérifiez votre boîte de réception (et vos spams).'
            : 'Confirmation email resent! Check your inbox (and spam folder).'
        );
      }
    } catch {
      setFormError(lang === 'fr' ? 'Une erreur est survenue lors de l\'envoi.' : 'An error occurred while sending.');
    } finally {
      setIsSubmitting(false);
    }
  }, [email, lang]);

  if (checkingSession) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-sentiqs-gray-bg">
        <div className="w-8 h-8 border-2 border-sentiqs-navy/30 border-t-sentiqs-navy rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-between overflow-hidden bg-sentiqs-gray-bg">
      {/* Globe Background Image */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img
          src="https://readdy.ai/api/search-image?query=Abstract%20minimalist%20wireframe%20globe%20sphere%20with%20latitude%20and%20longitude%20mesh%20lines%2C%20very%20light%20pale%20blue%20gray%20background%2C%20subtle%20soft%20gradient%2C%20corporate%20security%20intelligence%20aesthetic%2C%20clean%203D%20render%2C%20delicate%20thin%20lines%2C%20professional%20design%2C%20soft%20lighting%2C%20no%20text%2C%20monochromatic%20blue%20gray%20tones%2C%20faint%20glowing%20blue%20dots%20on%20surface&width=1200&height=900&seq=sentiqs-globe-bg&orientation=landscape"
          alt=""
          className="w-[800px] h-[600px] object-contain opacity-40"
        />
      </div>

      {/* Top Header */}
      <header className="relative z-10 w-full flex items-center justify-between px-8 py-4">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-sentiqs-navy flex items-center justify-center">
            <i className="ri-earth-line text-white text-base" />
          </div>
          <span className="text-sm font-bold text-sentiqs-navy">SentiqS</span>
        </Link>
        <div className="text-right">
          <p className="text-xs font-semibold tracking-[0.15em] text-sentiqs-navy uppercase">
            {t('header.network')}
          </p>
          <p className="text-[10px] tracking-[0.15em] text-sentiqs-gray-text uppercase mt-0.5">
            {t('header.africa')}
          </p>
        </div>
      </header>

      {/* Main Content - Centered Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center w-full px-4 py-8">
        <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {/* Language Toggle */}
          <div className="flex justify-end mb-4">
            <div className="inline-flex rounded-md overflow-hidden border border-sentiqs-gray-border">
              <button
                type="button"
                onClick={() => switchLang('fr')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  lang === 'fr'
                    ? 'bg-sentiqs-navy text-white'
                    : 'bg-white text-sentiqs-gray-text hover:bg-gray-50'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => switchLang('en')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  lang === 'en'
                    ? 'bg-sentiqs-navy text-white'
                    : 'bg-white text-sentiqs-gray-text hover:bg-gray-50'
                }`}
              >
                EN
              </button>
            </div>
          </div>

          {/* Logo Section */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-sentiqs-navy flex items-center justify-center flex-shrink-0">
              <i className="ri-earth-line text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-sentiqs-navy tracking-tight">SentiqS</h1>
              <p className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">
                {t('card.subtitle')}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="text-center mb-6">
            <p className="text-sm text-sentiqs-gray-text leading-relaxed">
              {t('card.description1')}
            </p>
            <p className="text-xs text-sentiqs-gray-text mt-1">
              {t('card.description2')}
            </p>
          </div>

          {/* Stats Row */}
          <div className="flex items-center justify-center gap-8 mb-2">
            <div className="text-center">
              <p className="text-2xl font-bold text-sentiqs-blue">54</p>
              <p className="text-[9px] font-semibold tracking-[0.1em] text-sentiqs-gray-text uppercase mt-1">
                {t('card.stats.countries')}
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-sentiqs-blue">—</p>
              <p className="text-[9px] font-semibold tracking-[0.1em] text-sentiqs-gray-text uppercase mt-1">
                {t('card.stats.news')}
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-sentiqs-blue">—</p>
              <p className="text-[9px] font-semibold tracking-[0.1em] text-sentiqs-gray-text uppercase mt-1">
                {t('card.stats.alerts')}
              </p>
            </div>
          </div>

          {/* Notice */}
          <p className="text-center text-xs text-sentiqs-gray-text italic mb-6">
            {t('card.notice')}
          </p>

          {/* Divider */}
          <div className="border-t border-gray-100 mb-6" />

          {/* Login Section */}
          <div className="mb-5">
            <h2 className="text-base font-bold text-sentiqs-navy mb-1">{t('card.login.title')}</h2>
            <p className="text-xs text-sentiqs-gray-text">{t('card.login.subtitle')}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-xs text-red-600">{formError}</p>
              </div>
            )}

            {successMessage && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <p className="text-xs text-green-700">{successMessage}</p>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] text-sentiqs-navy uppercase mb-1.5">
                {t('card.email.label')}
              </label>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('card.email.placeholder')}
                className="w-full px-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-blue/20 focus:border-sentiqs-blue transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] text-sentiqs-navy uppercase mb-1.5">
                {t('card.password.label')}
              </label>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('card.password.placeholder')}
                className="w-full px-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-blue/20 focus:border-sentiqs-blue transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] text-sentiqs-navy uppercase mb-1.5">
                {t('card.zone.label')}
              </label>
              <select
                name="zone"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy focus:outline-none focus:ring-2 focus:ring-sentiqs-blue/20 focus:border-sentiqs-blue transition-all cursor-pointer"
              >
                <option value="">{t('card.zone.default')}</option>
                <option value="golfe">Golfe de Guinée</option>
                <option value="sahel">Sahel</option>
                <option value="afrique-est">Afrique de l&apos;Est</option>
                <option value="afrique-centrale">Afrique Centrale</option>
                <option value="afrique-sud">Afrique du Sud</option>
                <option value="maghreb">Maghreb</option>
              </select>
              <p className="text-[10px] text-sentiqs-gray-text mt-1.5 leading-relaxed">
                {t('card.zone.help')}
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-sentiqs-navy hover:bg-sentiqs-navy-light text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <i className="ri-login-box-line" />
              )}
              {t('card.submit')}
            </button>
          </form>

          {/* Links Row */}
          <div className="flex items-center justify-center gap-4 mt-5">
            <Link
              to="/signup"
              className="text-xs text-sentiqs-blue hover:text-sentiqs-blue-dark transition-colors underline underline-offset-2"
            >
              {t('card.firstTime')}
            </Link>
            <Link
              to="/forgot-password"
              className="text-xs text-sentiqs-blue hover:text-sentiqs-blue-dark transition-colors underline underline-offset-2"
            >
              {t('card.forgot')}
            </Link>
          </div>

          {/* Resend confirmation button */}
          {formError && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={isSubmitting}
                className="text-xs text-sentiqs-blue hover:text-sentiqs-blue-dark transition-colors underline underline-offset-2 disabled:opacity-50"
              >
                {lang === 'fr'
                  ? 'Pas reçu l\'email de confirmation ? Renvoyer'
                  : 'Didn\'t receive the confirmation email? Resend'}
              </button>
            </div>
          )}

          {/* Bottom Links */}
          <div className="border-t border-gray-100 mt-5 pt-4 flex items-center justify-center gap-6">
            <a
              href="#"
              className="flex items-center gap-1.5 text-xs text-sentiqs-gray-text hover:text-sentiqs-navy transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              <i className="ri-newspaper-line" />
              {t('card.publicBulletin')}
            </a>
            <a
              href="#"
              className="flex items-center gap-1.5 text-xs text-sentiqs-gray-text hover:text-sentiqs-navy transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              <i className="ri-link" />
              {t('card.methodology')}
            </a>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 w-full flex items-center justify-between px-8 py-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-sentiqs-navy uppercase">
          {t('footer.left')}
        </p>
        <p className="text-[10px] font-semibold tracking-[0.2em] text-sentiqs-navy uppercase">
          {t('footer.right')}
        </p>
      </footer>
    </div>
  );
}