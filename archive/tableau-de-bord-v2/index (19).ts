import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/utils/timeFormat';
import i18n from '@/i18n';
import ErrorState from '@/components/base/ErrorState';
import EmptyState from '@/components/base/EmptyState';
import Toast from '@/components/base/Toast';

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
  const { t } = useTranslation();
  const [tab, setTab] = useState<'plans' | 'subscriptions'>('plans');
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
      const validPlans = (plansData || []).filter((p: Plan) => p.max_alerts_per_day > 0 && (Array.isArray(p.features) && p.features.length > 0));
      setPlans(validPlans);
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

  const formatDate = (d: string) => formatDateTime(d, i18n.language, true);

  return (
    <div className="space-y-5">
      <Toast message={toast} onDismiss={() => setToast(null)} />

      {/* Connection card */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
          <i className="ri-file-list-3-line text-amber-600 text-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-bold text-sentiqs-navy">Plans tarifaires & abonnements</h3>
          <p className="text-[10px] text-sentiqs-gray-text mt-0.5">
            Configurez vos offres et suivez les abonnements actifs. Les plans définissent les droits d'accès (téléchargements, alertes/jour, fonctionnalités).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {subs.length > 0 && (
            <span className="text-[10px] font-semibold text-sentiqs-gray-text bg-gray-50 px-2.5 py-1.5 rounded-lg">
              {subs.length} abonnement{subs.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold text-sentiqs-navy">Gestion des abonnements</h2>
        <p className="text-[10px] text-sentiqs-gray-text mt-0.5">Suivi des abonnements, plans et téléchargements</p>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 w-fit">
        {(['plans', 'subscriptions'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-[10px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              tab === t ? 'bg-white text-sentiqs-navy shadow-sm' : 'text-sentiqs-gray-text hover:text-sentiqs-navy'
            }`}
          >
            {t === 'plans' ? 'Plans & Tarifs' : `Abonnements${subs.length > 0 ? ` (${subs.length})` : ''}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-100 p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-50 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAll} retryLabel={t('common.retry')} />
      ) : tab === 'plans' ? (
        <>
          {plans.length === 0 ? (
            <EmptyState
              icon="ri-price-tag-3-line"
              title="Aucun plan configuré"
              description="Créez vos offres tarifaires depuis le module Produits pour les rendre disponibles ici."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        </>
      ) : (
        <>
          {/* Stats */}
          {stats.total > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total', value: stats.total, color: 'text-sentiqs-navy' },
                { label: t('dashboard.settings.subscriptions.active'), value: stats.actif, color: 'text-emerald-600' },
                { label: 'Expirés', value: stats.expire, color: 'text-red-500' },
                { label: 'Renouv. auto', value: stats.renew, color: 'text-amber-500' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-lg border border-gray-100 p-3">
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Subscriptions table or empty state */}
          {subs.length === 0 ? (
            <EmptyState
              icon="ri-file-list-3-line"
              title="Aucun abonnement actif"
              description="Les abonnements apparaîtront ici dès que des abonnés seront rattachés à un plan tarifaire."
            />
          ) : (
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
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[s.status] || 'bg-gray-100 text-gray-600'}`}>{s.status}</span>
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
            </div>
          )}
        </>
      )}
    </div>
  );
}