import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';

export default function Navbar() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [lang, setLang] = useState<'fr' | 'en'>(i18n.language.startsWith('fr') ? 'fr' : 'en');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const switchLang = useCallback((newLang: 'fr' | 'en') => {
    setLang(newLang);
    i18n.changeLanguage(newLang);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100'
          : 'bg-transparent'
      }`}
    >
      <div className="w-full px-6 md:px-10 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-sentiqs-navy flex items-center justify-center">
            <i className="ri-earth-line text-white text-base" />
          </div>
          <span className="text-base font-bold text-sentiqs-navy">SentiqS</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a
            href="/#features"
            className="text-sm font-medium text-sentiqs-gray-text hover:text-sentiqs-navy transition-colors whitespace-nowrap"
          >
            {t('landing.nav.features')}
          </a>
          <a
            href="/#pricing"
            className="text-sm font-medium text-sentiqs-gray-text hover:text-sentiqs-navy transition-colors whitespace-nowrap"
          >
            {t('landing.nav.pricing')}
          </a>
          <a
            href="/#stats"
            className="text-sm font-medium text-sentiqs-gray-text hover:text-sentiqs-navy transition-colors whitespace-nowrap"
          >
            {t('landing.nav.stats')}
          </a>
        </div>

        <div className="flex items-center gap-3">
          {/* Language Toggle */}
          <div className="inline-flex rounded-md overflow-hidden border border-sentiqs-gray-border">
            <button
              type="button"
              onClick={() => switchLang('fr')}
              className={`px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
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
              className={`px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                lang === 'en'
                  ? 'bg-sentiqs-navy text-white'
                  : 'bg-white text-sentiqs-gray-text hover:bg-gray-50'
              }`}
            >
              EN
            </button>
          </div>

          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-4 py-2 border border-sentiqs-navy text-sentiqs-navy hover:bg-sentiqs-navy hover:text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <i className="ri-login-box-line" />
            {t('card.login.title')}
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-sentiqs-navy hover:bg-sentiqs-navy-light text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <i className="ri-dashboard-line" />
            {t('landing.nav.access')}
          </Link>
        </div>
      </div>
    </nav>
  );
}