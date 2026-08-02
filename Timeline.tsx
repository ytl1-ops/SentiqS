import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="w-full bg-sentiqs-navy">
      <div className="w-full px-6 md:px-10 py-10 md:py-14">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex flex-col gap-3">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                <i className="ri-earth-line text-white text-base" />
              </div>
              <span className="text-base font-bold text-white">SentiqS</span>
            </Link>
            <p className="text-sm text-white/60 max-w-sm leading-relaxed">
              {t('landing.footer.desc')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 md:gap-8">
            <a href="/#features" className="text-sm text-white/60 hover:text-white transition-colors whitespace-nowrap">
              {t('landing.nav.features')}
            </a>
            <a href="/#pricing" className="text-sm text-white/60 hover:text-white transition-colors whitespace-nowrap">
              {t('landing.nav.pricing')}
            </a>
            <a href="/#stats" className="text-sm text-white/60 hover:text-white transition-colors whitespace-nowrap">
              {t('landing.nav.stats')}
            </a>
            <Link to="/dashboard" className="text-sm text-white/60 hover:text-white transition-colors whitespace-nowrap">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/40">
            &copy; {new Date().getFullYear()} SentiqS. {t('landing.footer.copyright')}
          </p>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-white/40 uppercase">
            FLUX &bull; CORR&Eacute;LATIONS &bull; ALERTES &bull; S&Ucirc;RET&Eacute; OP&Eacute;RATIONNELLE
          </p>
        </div>
      </div>
    </footer>
  );
}