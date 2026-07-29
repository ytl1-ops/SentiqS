import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

interface Plan {
  id: number;
  name: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  currency: string;
  download_limit: number;
  alerts_per_day: number;
  features: string[];
  is_popular: boolean;
}

const fallbackPlans: Plan[] = [
  {
    id: 1,
    name: 'Essentiel',
    description: 'Pour les petites structures',
    price_monthly: 290,
    price_annual: 2900,
    currency: 'EUR',
    download_limit: 10,
    alerts_per_day: 5,
    features: ['5 alertes/jour', '10 téléchargements/mois', '1 utilisateur', 'Support email'],
    is_popular: false,
  },
  {
    id: 2,
    name: 'Pro',
    description: 'Pour les équipes sûreté',
    price_monthly: 590,
    price_annual: 5900,
    currency: 'EUR',
    download_limit: 50,
    alerts_per_day: 20,
    features: ['20 alertes/jour', '50 téléchargements/mois', '5 utilisateurs', 'Support prioritaire', 'Rapports planifiés'],
    is_popular: true,
  },
  {
    id: 3,
    name: 'Enterprise',
    description: 'Pour les grands groupes',
    price_monthly: 1490,
    price_annual: 14900,
    currency: 'EUR',
    download_limit: 999,
    alerts_per_day: 999,
    features: ['Alertes illimitées', 'Téléchargements illimités', 'Utilisateurs illimités', 'Support dédié', 'API d\'accès', 'Personnalisation'],
    is_popular: false,
  },
];

export default function PricingSection() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [annual, setAnnual] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('subscription_plans')
      .select('*')
      .order('price_monthly', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || data.length === 0) {
          setPlans(fallbackPlans);
        } else {
          const mapped = data.map((p: Record<string, unknown>) => ({
            id: p.id as number,
            name: p.name as string,
            description: p.description as string || '',
            price_monthly: Number(p.price_monthly) || 0,
            price_annual: Number(p.price_annual) || 0,
            currency: p.currency as string || 'EUR',
            download_limit: p.download_limit as number || 0,
            alerts_per_day: p.alerts_per_day as number || 0,
            features: Array.isArray(p.features) ? (p.features as string[]) : [],
            is_popular: !!p.is_popular,
          }));
          setPlans(mapped.length ? mapped : fallbackPlans);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section id="pricing" className="w-full bg-white">
      <div className="w-full px-6 md:px-10 py-14 md:py-20">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-4xl font-bold text-sentiqs-navy">{t('landing.pricing.title')}</h2>
          <p className="mt-3 text-sm md:text-base text-sentiqs-gray-text max-w-2xl mx-auto leading-relaxed">
            {t('landing.pricing.subtitle')}
          </p>

          <div className="mt-6 inline-flex items-center gap-3 p-1 rounded-full bg-sentiqs-gray-bg border border-gray-100">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                !annual ? 'bg-white text-sentiqs-navy shadow-sm' : 'text-sentiqs-gray-text'
              }`}
            >
              {t('landing.pricing.monthly')}
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                annual ? 'bg-white text-sentiqs-navy shadow-sm' : 'text-sentiqs-gray-text'
              }`}
            >
              {t('landing.pricing.annual')} <span className="text-emerald-600 text-xs font-semibold ml-1">{t('landing.pricing.discount')}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <span className="w-6 h-6 border-2 border-sentiqs-blue/30 border-t-sentiqs-blue rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-6 md:p-7 transition-colors ${
                  plan.is_popular
                    ? 'border-sentiqs-blue bg-sentiqs-blue/5'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                {plan.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-sentiqs-blue text-white text-xs font-semibold rounded-full whitespace-nowrap">
                    {t('landing.pricing.popular')}
                  </div>
                )}

                <h3 className="text-lg font-bold text-sentiqs-navy">{plan.name}</h3>
                <p className="text-sm text-sentiqs-gray-text mt-1">{plan.description}</p>

                <div className="mt-4 mb-5">
                  <span className="text-3xl font-bold text-sentiqs-navy">
                    {annual ? plan.price_annual : plan.price_monthly}
                  </span>
                  <span className="text-sm text-sentiqs-gray-text ml-1">
                    {plan.currency}{annual ? t('landing.pricing.perYear') : t('landing.pricing.perMonth')}
                  </span>
                </div>

                <ul className="space-y-2.5 mb-6">
                  {(plan.features.length ? plan.features : [
                    `${plan.alerts_per_day === 999 ? 'Alertes illimitées' : `${plan.alerts_per_day} alertes/jour`}`,
                    `${plan.download_limit === 999 ? 'Téléchargements illimités' : `${plan.download_limit} téléchargements/mois`}`,
                  ]).map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-sentiqs-gray-text">
                      <i className="ri-check-line text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/login"
                  className={`block w-full text-center py-2.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    plan.is_popular
                      ? 'bg-sentiqs-blue hover:bg-sentiqs-blue-dark text-white'
                      : 'bg-sentiqs-navy hover:bg-sentiqs-navy-light text-white'
                  }`}
                >
                  {t('landing.pricing.choosePlan')}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}