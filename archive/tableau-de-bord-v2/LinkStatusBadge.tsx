import { useTranslation } from 'react-i18next';

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  org: string;
  avatar: string;
}

export default function TestimonialsSection() {
  const { t } = useTranslation();

  const testimonials: Testimonial[] = [
    {
      quote: t('landing.testimonials.0.quote'),
      author: t('landing.testimonials.0.author'),
      role: t('landing.testimonials.0.role'),
      org: t('landing.testimonials.0.org'),
      avatar: 'https://readdy.ai/api/search-image?query=Professional%20portrait%20of%20a%20middle-aged%20African%20businessman%20in%20dark%20suit%2C%20confident%20expression%2C%20clean%20neutral%20background%2C%20corporate%20headshot%2C%20warm%20lighting%2C%20high%20detail&width=200&height=200&seq=avatar-testimonial-01&orientation=squarish',
    },
    {
      quote: t('landing.testimonials.1.quote'),
      author: t('landing.testimonials.1.author'),
      role: t('landing.testimonials.1.role'),
      org: t('landing.testimonials.1.org'),
      avatar: 'https://readdy.ai/api/search-image?query=Professional%20portrait%20of%20a%20young%20European%20woman%20security%20manager%2C%20confident%20expression%2C%20corporate%20attire%2C%20clean%20neutral%20background%2C%20soft%20studio%20lighting%2C%20high%20detail&width=200&height=200&seq=avatar-testimonial-02&orientation=squarish',
    },
    {
      quote: t('landing.testimonials.2.quote'),
      author: t('landing.testimonials.2.author'),
      role: t('landing.testimonials.2.role'),
      org: t('landing.testimonials.2.org'),
      avatar: 'https://readdy.ai/api/search-image?query=Professional%20portrait%20of%20an%20African%20male%20executive%20in%20his%2040s%2C%20dark%20suit%2C%20serious%20and%20confident%20expression%2C%20corporate%20headshot%2C%20neutral%20background%2C%20warm%20studio%20lighting%2C%20high%20detail&width=200&height=200&seq=avatar-testimonial-03&orientation=squarish',
    },
  ];

  return (
    <section className="w-full bg-white">
      <div className="w-full px-6 md:px-10 py-14 md:py-20">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-4xl font-bold text-sentiqs-navy">
            {t('landing.testimonials.title')}
          </h2>
          <p className="mt-3 text-sm md:text-base text-sentiqs-gray-text max-w-2xl mx-auto leading-relaxed">
            {t('landing.testimonials.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 max-w-5xl mx-auto">
          {testimonials.map((t) => (
            <div
              key={t.author}
              className="bg-sentiqs-gray-bg rounded-xl border border-gray-100 p-6 md:p-7 flex flex-col"
            >
              <div className="mb-4">
                <i className="ri-double-quotes-l text-sentiqs-blue/30 text-3xl" />
              </div>
              <p className="text-sm md:text-base text-sentiqs-navy leading-relaxed flex-1">{t.quote}</p>
              <div className="mt-5 flex items-center gap-3">
                <img
                  src={t.avatar}
                  alt={t.author}
                  className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold text-sentiqs-navy">{t.author}</p>
                  <p className="text-xs text-sentiqs-gray-text">{t.role} — {t.org}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}