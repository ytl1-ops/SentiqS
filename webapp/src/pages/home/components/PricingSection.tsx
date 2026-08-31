import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

interface DbPlan {
  id: number;
  name: string;
  price: number;
  currency: string;
  billing_cycle: string;
  features: string[];
  download_limit: number;
  max_alerts_per_day: number;
}

interface DisplayPlan {
  id: number;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  yearly_plan_id: number;
  currency: string;
  features: string[];
  is_popular: boolean;
  saving_percent: number;
}

const planDescriptions: Record<string, { desc: string; popular: boolean }> = {
  Essentiel: { desc: 'Pour les petites structures', popular: false },
  Professionnel: { desc: 'Pour les équipes sûreté', popular: true },
  Enterprise: { desc: 'Pour les grands groupes', popular: false },
};

export default function PricingSection() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<DisplayPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [annual, setAnnual] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price', { ascending: true });

      if (cancelled) return;

      if (error || !data || data.length === 0) {
        setLoading(false);
        return;
      }

      const all = data as unknown as DbPlan[];
      const monthly = all.filter((p) => p.billing_cycle === 'monthly');
      const yearly = all.filter((p) => p.billing_cycle === 'yearly');

      const merged: DisplayPlan[] = monthly.map((m) => {
        const baseName = m.name;
        const yearlyMatch = yearly.find((y) => y.name.startsWith(baseName));
        const yearlyPrice = yearlyMatch ? Number(yearlyMatch.price) : Number(m.price) * 10;
        const monthlyTotal = Number(m.price) * 12;
        const saving = monthlyTotal > 0
          ? Math.round(((monthlyTotal - yearlyPrice) / monthlyTotal) * 100)
          : 0;

        return {
          id: m.id,
          name: baseName,
          description: planDescriptions[baseName]?.desc || '',
          price_monthly: Number(m.price),
          price_yearly: yearlyPrice,
          yearly_plan_id: yearlyMatch?.id || 0,
          currency: m.currency,
          features: Array.isArray(m.features) ? m.features : [],
          is_popular: planDescriptions[baseName]?.popular || false,
          saving_percent: saving,
        };
      });

      setPlans(merged);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <section id="pricing" className="w-full bg-sentiqs-gray-bg">
      <div className="w-full px-6 md:px-10 py-14 md:py-20">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-4xl font-bold text-sentiqs-navy">
            {t('landing.pricing.title', 'Des plans adaptés à vos besoins')}
          </h2>
          <p className="mt-3 text-sm md:text-base text-sentiqs-gray-text max-w-2xl mx-auto leading-relaxed">
            {t('landing.pricing.subtitle', 'Choisissez le plan qui correspond à votre niveau d\'exposition et à la taille de votre organisation.')}
          </p>

          <div className="mt-6 inline-flex items-center gap-3 p-1 rounded-full bg-white border border-gray-100">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap cursor-pointer ${
                !annual ? 'bg-sentiqs-navy text-white shadow-sm' : 'text-sentiqs-gray-text hover:text-sentiqs-navy'
              }`}
            >
              {t('landing.pricing.monthly', 'Mensuel')}
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap cursor-pointer ${
                annual ? 'bg-sentiqs-navy text-white shadow-sm' : 'text-sentiqs-gray-text hover:text-sentiqs-navy'
              }`}
            >
              {t('landing.pricing.annual', 'Annuel')}
              <span className="ml-1 text-emerald-500 text-xs font-bold">
                {t('landing.pricing.discount', '-17%')}
              </span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <span className="w-6 h-6 border-2 border-sentiqs-navy/30 border-t-sentiqs-navy rounded-full animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-sentiqs-gray-text">Aucun plan disponible pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => {
              const displayPrice = annual ? plan.price_yearly : plan.price_monthly;
              const period = annual
                ? t('landing.pricing.perYear', '/an')
                : t('landing.pricing.perMonth', '/mois');

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border p-6 md:p-7 transition-all duration-200 ${
                    plan.is_popular
                      ? 'border-sentiqs-navy bg-white ring-1 ring-sentiqs-navy/10'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  {plan.is_popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-sentiqs-navy text-white text-xs font-semibold rounded-full whitespace-nowrap">
                      {t('landing.pricing.popular', 'Le plus populaire')}
                    </div>
                  )}

                  <h3 className="text-lg font-bold text-sentiqs-navy">{plan.name}</h3>
                  <p className="text-sm text-sentiqs-gray-text mt-1">{plan.description}</p>

                  <div className="mt-4 mb-1">
                    <span className="text-3xl font-bold text-sentiqs-navy">
                      {displayPrice.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-sm text-sentiqs-gray-text ml-1">
                      {plan.currency} {period}
                    </span>
                  </div>

                  {annual && plan.saving_percent > 0 && (
                    <div className="mb-3 -mt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                        <i className="ri-price-tag-3-line text-emerald-500 text-xs" />
                        {plan.saving_percent}% d&apos;économie
                      </span>
                    </div>
                  )}

                  {!annual && (
                    <div className="mb-5 mt-1">
                      <span className="text-xs text-sentiqs-gray-text">
                        Soit {(plan.price_yearly / 12).toLocaleString('fr-FR')} {plan.currency}/mois en annuel
                      </span>
                    </div>
                  )}

                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-sentiqs-gray-text">
                        <i className="ri-check-line text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={`/signup${annual && plan.yearly_plan_id ? `?plan=${plan.yearly_plan_id}` : `?plan=${plan.id}`}`}
                    className={`block w-full text-center py-2.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      plan.is_popular
                        ? 'bg-sentiqs-navy hover:bg-sentiqs-navy-light text-white'
                        : 'border border-sentiqs-navy text-sentiqs-navy hover:bg-sentiqs-navy hover:text-white'
                    }`}
                  >
                    {t('landing.pricing.choosePlan', 'Choisir ce plan')}
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Trust badges */}
        <div className="mt-12 text-center">
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-sentiqs-gray-text">
            <span className="flex items-center gap-1.5">
              <i className="ri-lock-line text-emerald-500" />
              Paiement sécurisé
            </span>
            <span className="flex items-center gap-1.5">
              <i className="ri-arrow-go-back-line text-emerald-500" />
              Satisfait ou remboursé 14 jours
            </span>
            <span className="flex items-center gap-1.5">
              <i className="ri-customer-service-line text-emerald-500" />
              Support dédié
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}