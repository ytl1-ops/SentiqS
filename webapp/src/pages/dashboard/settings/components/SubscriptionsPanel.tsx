import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Plan {
  id: number;
  name: string;
  price: number;
  currency: string;
  billing_cycle: string;
  features: string[];
  download_limit: number;
  max_alerts_per_day: number;
}

interface UserSub {
  id: number;
  subscriber_id: number;
  plan_id: number;
  status: string;
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  subscribers?: { name: string; email: string } | null;
  subscription_plans?: { name: string } | null;
}

const cycleLabels: Record<string, string> = {
  monthly: 'Mensuel',
  yearly: 'Annuel',
};

const statusColors: Record<string, string> = {
  actif: 'bg-emerald-100 text-emerald-700',
  expiré: 'bg-red-100 text-red-700',
  suspendu: 'bg-amber-100 text-amber-700',
  annulé: 'bg-gray-100 text-gray-500',
};

export default function SubscriptionsPanel() {
  const [tab, setTab] = useState<'plans' | 'subscriptions'>('subscriptions');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<UserSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: plansData }, { data: subsData }] = await Promise.all([
        supabase.from('subscription_plans').select('*').order('price', { ascending: true }),
        supabase.from('user_subscriptions').select('*, subscribers(name, email), subscription_plans(name)').order('created_at', { ascending: false }),
      ]);
      setPlans(plansData || []);
      setSubs(subsData || []);
    } catch {
      setError('Impossible de charger les données.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const stats = {
    total: subs.length,
    actif: subs.filter((s) => s.status === 'actif').length,
    expire: subs.filter((s) => s.status === 'expiré').length,
    renew: subs.filter((s) => s.auto_renew).length,
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-sentiqs-navy text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300">
          <i className="ri-check-line text-emerald-400 text-sm" /> {toast}
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold text-sentiqs-navy">Gestion des abonnements</h2>
        <p className="text-[10px] text-sentiqs-gray-text mt-0.5">Suivi des abonnements, plans et téléchargements</p>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 w-fit">
        {(['subscriptions', 'plans'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-[10px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              tab === t ? 'bg-white text-sentiqs-navy shadow-sm' : 'text-sentiqs-gray-text hover:text-sentiqs-navy'
            }`}
          >
            {t === 'subscriptions' ? 'Abonnements actifs' : 'Plans & Tarifs'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-100 p-4 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-2 bg-gray-50 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-8 text-center text-sentiqs-gray-text text-xs bg-white rounded-lg border border-gray-100">
          {error}
          <button type="button" onClick={fetchAll} className="ml-2 text-sentiqs-navy font-semibold underline cursor-pointer">Réessayer</button>
        </div>
      ) : tab === 'subscriptions' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total', value: stats.total, color: 'text-sentiqs-navy' },
              { label: 'Actifs', value: stats.actif, color: 'text-emerald-600' },
              { label: 'Expirés', value: stats.expire, color: 'text-red-500' },
              { label: 'Renouv. auto', value: stats.renew, color: 'text-amber-500' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-lg border border-gray-100 p-3">
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Subscriptions table */}
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Abonné</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Plan</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Début</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Fin</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Statut</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Renouv.</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => {
                    const subData = s.subscribers as { name: string; email: string } | null;
                    const planData = s.subscription_plans as { name: string } | null;
                    return (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-sentiqs-navy">{subData?.name || '—'}</div>
                          <div className="text-[10px] text-sentiqs-gray-text">{subData?.email || ''}</div>
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-sentiqs-navy">{planData?.name || '—'}</td>
                        <td className="px-4 py-2.5 text-sentiqs-gray-text">{formatDate(s.start_date)}</td>
                        <td className="px-4 py-2.5 text-sentiqs-gray-text">{formatDate(s.end_date)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[s.status] || ''}`}>{s.status}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {s.auto_renew ? (
                            <span className="text-emerald-600"><i className="ri-refresh-line mr-0.5" />Auto</span>
                          ) : (
                            <span className="text-gray-400">Manuel</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {subs.length === 0 && (
              <div className="py-12 text-center text-sentiqs-gray-text text-xs">Aucun abonnement trouvé.</div>
            )}
          </div>
        </>
      ) : (
        /* Plans view */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors p-5 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-sentiqs-navy">{plan.name}</span>
                <span className="text-[10px] font-semibold uppercase text-sentiqs-gray-text">{cycleLabels[plan.billing_cycle] || plan.billing_cycle}</span>
              </div>
              <div className="mb-4">
                <span className="text-2xl font-bold text-sentiqs-navy">{(plan.price || 0).toLocaleString('fr-FR')}</span>
                <span className="text-xs text-sentiqs-gray-text ml-1">{plan.currency}</span>
                <span className="text-[10px] text-sentiqs-gray-text">/{plan.billing_cycle === 'yearly' ? 'an' : 'mois'}</span>
              </div>
              <div className="space-y-2 mb-4 flex-1">
                {(Array.isArray(plan.features) ? plan.features : []).map((feat: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <i className="ri-check-line text-emerald-500 text-sm mt-0.5 flex-shrink-0" />
                    <span className="text-[10px] text-sentiqs-gray-text leading-relaxed">{feat}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-3 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sentiqs-gray-text">Téléchargements</span>
                  <span className="font-semibold text-sentiqs-navy">{plan.download_limit || 0}/mois</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sentiqs-gray-text">Alertes max/jour</span>
                  <span className="font-semibold text-sentiqs-navy">{plan.max_alerts_per_day || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}