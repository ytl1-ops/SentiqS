import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [lang, setLang] = useState<'fr' | 'en'>(i18n.language.startsWith('fr') ? 'fr' : 'en');
  const [email, setEmail] = useState('');
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

    setIsSubmitting(true);
    try {
      // Flux reel Supabase Auth (comme web/SentiqS_Web.html) : envoie un
      // vrai email de reinitialisation via Supabase, qui redirige vers
      // /reset-password une fois le lien clique. On n'affiche/ne renvoie
      // JAMAIS de lien de reinitialisation directement au navigateur — un
      // tel lien permettrait a n'importe qui de reinitialiser le mot de
      // passe de n'importe quel compte sans jamais avoir acces a sa boite
      // mail (l'ancienne version de cette page, branchee sur une fonction
      // edge desormais retiree, faisait exactement ca).
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setFormError(error.message);
        return;
      }

      // Message volontairement identique que l'email existe ou non, pour
      // ne pas laisser deviner quelles adresses ont un compte.
      setSuccessMessage(
        lang === 'fr'
          ? "Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d'être envoyé."
          : 'If an account exists for this address, a reset email has just been sent.'
      );
    } catch {
      setFormError(lang === 'fr' ? 'Une erreur est survenue. Veuillez réessayer.' : 'An error occurred. Please try again.');
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
                {t('forgot.card.subtitle')}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="text-center mb-5">
            <p className="text-sm text-sentiqs-gray-text leading-relaxed">
              {t('forgot.card.description')}
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 mb-6" />

          {/* Title */}
          <div className="mb-5">
            <h2 className="text-base font-bold text-sentiqs-navy mb-1">{t('forgot.card.title')}</h2>
            <p className="text-xs text-sentiqs-gray-text">{t('forgot.card.subtitle2')}</p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-check-line text-white text-xs" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800">{successMessage}</p>
                  <Link
                    to="/login"
                    className="inline-block mt-3 text-sm font-semibold text-sentiqs-blue hover:text-sentiqs-blue-dark transition-colors underline underline-offset-2 ml-3"
                  >
                    {t('forgot.card.backToLogin')}
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
                  {t('forgot.card.email.label')}
                </label>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('forgot.card.email.placeholder')}
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
                  <i className="ri-mail-send-line" />
                )}
                {t('forgot.card.submit')}
              </button>
            </form>
          )}

          {/* Back to Login Link */}
          {!successMessage && (
            <div className="flex items-center justify-center mt-5">
              <Link
                to="/login"
                className="flex items-center gap-1.5 text-xs text-sentiqs-gray-text hover:text-sentiqs-navy transition-colors"
              >
                <i className="ri-arrow-left-line" />
                {t('forgot.card.backToLogin')}
              </Link>
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