import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="relative w-full min-h-[620px] md:min-h-[720px] flex items-center justify-center overflow-hidden bg-sentiqs-navy">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src="https://readdy.ai/api/search-image?query=Abstract%20dark%20digital%20intelligence%20network%20map%20over%20Africa%20continent%20silhouette%2C%20glowing%20connection%20nodes%20and%20data%20streams%2C%20deep%20navy%20blue%20and%20soft%20teal%20gradient%2C%20futuristic%20cybersecurity%20aesthetic%2C%20minimal%20clean%20design%2C%20soft%20ambient%20lighting%2C%20no%20text%2C%20professional%20corporate%20hero%20banner&width=1600&height=900&seq=sentiqs-hero-landing&orientation=landscape"
          alt=""
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-sentiqs-navy/60 via-sentiqs-navy/40 to-sentiqs-navy" />
      </div>

      <div className="relative z-10 w-full px-6 md:px-10 pt-24 pb-16 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-white/90 tracking-wide uppercase whitespace-nowrap">
            {t('landing.hero.badge')}
          </span>
        </div>

        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white max-w-4xl leading-tight tracking-tight">
          {t('landing.hero.title')}
        </h1>

        <p className="mt-5 text-base md:text-lg text-white/70 max-w-2xl leading-relaxed">
          {t('landing.hero.subtitle')}
        </p>

        <div className="mt-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-sentiqs-blue hover:bg-sentiqs-blue-dark text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <i className="ri-dashboard-line" />
            {t('landing.hero.ctaPrimary')}
          </Link>
        </div>
      </div>
    </section>
  );
}