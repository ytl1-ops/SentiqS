import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/auto-confirm-signup`;

export default function Signup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [lang, setLang] = useState<'fr' | 'en'>(i18n.language.startsWith('fr') ? 'fr' : 'en');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [zone, setZone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard', { replace: true });
      }
    }).catch(() => {});
  }, [navigate]);

  const switchLang = useCallback((newLang: 'fr' | 'en') => {
    setLang(newLang);
    i18n.changeLanguage(newLang);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');

    if (!fullName.trim()) {
      setFormError(lang === 'fr' ? 'Veuillez saisir votre nom complet.' : 'Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setFormError(lang === 'fr' ? 'Veuillez saisir votre adresse e-mail.' : 'Please enter your email address.');
      return;
    }
    if (!password.trim()) {
      setFormError(lang === 'fr' ? 'Veuillez saisir un mot de passe.' : 'Please enter a password.');
      return;
    }
    if (password.length < 8) {
      setFormError(lang === 'fr' ? 'Le mot de passe doit contenir au moins 8 caractères.' : 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError(lang === 'fr' ? 'Les mots de passe ne correspondent pas.' : 'Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          organization: organization.trim(),
          zone,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        const errMsg = data.error || 'Signup failed';
        if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('exists')) {
          setFormError(lang === 'fr' ? 'Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter.' : 'An account already exists with this email. Please log in.');
        } else {
          setFormError(errMsg);
        }
        return;
      }

      setSuccessMessage(
        lang === 'fr'
          ? 'Compte créé avec succès ! Vous pouvez maintenant vous connecter.'
          : 'Account created successfully! You can now log in.'
      );
    } catch {
      setFormError(lang === 'fr' ? 'Une erreur est survenue. Veuillez réessayer.' : 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [fullName, email, organization, zone, password, confirmPassword, lang]);

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
                {t('signup.card.subtitle')}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="text-center mb-6">
            <p className="text-sm text-sentiqs-gray-text leading-relaxed">
              {t('signup.card.description1')}
            </p>
            <p className="text-xs text-sentiqs-gray-text mt-1">
              {t('signup.card.description2')}
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
            {t('signup.card.notice')}
          </p>

          {/* Divider */}
          <div className="border-t border-gray-100 mb-6" />

          {/* Signup Section */}
          <div className="mb-5">
            <h2 className="text-base font-bold text-sentiqs-navy mb-1">{t('signup.card.title')}</h2>
            <p className="text-xs text-sentiqs-gray-text">{t('signup.card.loginSubtitle')}</p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-check-line text-white text-xs" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">{successMessage}</p>
                  <Link
                    to="/login"
                    className="inline-block mt-3 text-sm font-semibold text-sentiqs-blue hover:text-sentiqs-blue-dark transition-colors underline underline-offset-2"
                  >
                    {t('signup.card.goToLogin')}
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          {!successMessage && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-600">{formError}</p>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold tracking-[0.1em] text-sentiqs-navy uppercase mb-1.5">
                  {t('signup.card.fullName.label')}
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('signup.card.fullName.placeholder')}
                  className="w-full px-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-blue/20 focus:border-sentiqs-blue transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold tracking-[0.1em] text-sentiqs-navy uppercase mb-1.5">
                  {t('signup.card.email.label')}
                </label>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('signup.card.email.placeholder')}
                  className="w-full px-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-blue/20 focus:border-sentiqs-blue transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold tracking-[0.1em] text-sentiqs-navy uppercase mb-1.5">
                  {t('signup.card.organization.label')}
                </label>
                <input
                  type="text"
                  name="organization"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder={t('signup.card.organization.placeholder')}
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

              <div>
                <label className="block text-[10px] font-bold tracking-[0.1em] text-sentiqs-navy uppercase mb-1.5">
                  {t('signup.card.password.label')}
                </label>
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('signup.card.password.placeholder')}
                  className="w-full px-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-blue/20 focus:border-sentiqs-blue transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold tracking-[0.1em] text-sentiqs-navy uppercase mb-1.5">
                  {t('signup.card.confirmPassword.label')}
                </label>
                <input
                  type="password"
                  name="confirm_password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('signup.card.confirmPassword.placeholder')}
                  className="w-full px-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-blue/20 focus:border-sentiqs-blue transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-sentiqs-navy hover:bg-sentiqs-navy-light text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <i className="ri-user-add-line" />
                )}
                {t('signup.card.submit')}
              </button>
            </form>
          )}

          {/* Login Link */}
          {!successMessage && (
            <div className="flex items-center justify-center mt-5">
              <p className="text-xs text-sentiqs-gray-text">
                {t('signup.card.haveAccount')}{' '}
                <Link
                  to="/login"
                  className="text-sentiqs-blue hover:text-sentiqs-blue-dark transition-colors underline underline-offset-2 font-medium"
                >
                  {t('signup.card.loginLink')}
                </Link>
              </p>
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