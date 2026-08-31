import { useTranslation } from 'react-i18next';

export default function FeaturesSection() {
  const { t } = useTranslation();

  const features = [
    {
      icon: 'ri-alarm-warning-line',
      title: t('landing.features.alerts.title'),
      desc: t('landing.features.alerts.desc'),
    },
    {
      icon: 'ri-node-tree',
      title: t('landing.features.correlations.title'),
      desc: t('landing.features.correlations.desc'),
    },
    {
      icon: 'ri-file-chart-line',
      title: t('landing.features.reports.title'),
      desc: t('landing.features.reports.desc'),
    },
    {
      icon: 'ri-calendar-event-line',
      title: t('landing.features.agenda.title'),
      desc: t('landing.features.agenda.desc'),
    },
    {
      icon: 'ri-dashboard-3-line',
      title: t('landing.features.dashboard.title'),
      desc: t('landing.features.dashboard.desc'),
    },
    {
      icon: 'ri-shield-check-line',
      title: t('landing.features.risks.title'),
      desc: t('landing.features.risks.desc'),
    },
  ];

  return (
    <section id="features" className="w-full bg-sentiqs-gray-bg">
      <div className="w-full px-6 md:px-10 py-14 md:py-20">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-4xl font-bold text-sentiqs-navy">
            {t('landing.features.title')}
          </h2>
          <p className="mt-3 text-sm md:text-base text-sentiqs-gray-text max-w-2xl mx-auto leading-relaxed">
            {t('landing.features.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-xl border border-gray-100 p-5 md:p-6 hover:border-sentiqs-blue/30 transition-colors"
            >
              <div className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-lg bg-sentiqs-blue/10 mb-4">
                <i className={`${f.icon} text-sentiqs-blue text-lg md:text-xl`} />
              </div>
              <h3 className="text-base font-semibold text-sentiqs-navy mb-2">{f.title}</h3>
              <p className="text-sm text-sentiqs-gray-text leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}