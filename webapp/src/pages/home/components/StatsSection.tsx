import { useTranslation } from 'react-i18next';

export default function StatsSection() {
  const { t } = useTranslation();

  const stats = [
    { value: '54', label: t('landing.stats.countries'), icon: 'ri-global-line' },
    { value: '12', label: t('landing.stats.alerts'), icon: 'ri-alarm-warning-line' },
    { value: '47', label: t('landing.stats.feeds'), icon: 'ri-rss-line' },
    { value: '8', label: t('landing.stats.regions'), icon: 'ri-map-pin-line' },
  ];

  return (
    <section id="stats" className="w-full bg-white border-b border-gray-100">
      <div className="w-full px-6 md:px-10 py-10 md:py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-sentiqs-gray-bg mb-3">
                <i className={`${s.icon} text-sentiqs-blue text-lg md:text-xl`} />
              </div>
              <p className="text-2xl md:text-3xl font-bold text-sentiqs-navy">{s.value}</p>
              <p className="text-xs md:text-sm text-sentiqs-gray-text mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}