import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface PaymentConfig {
  id: number;
  provider: string;
  display_name: string;
  is_active: boolean;
  config: Record<string, string>;
  supported_currencies: string[];
}

const providerIcons: Record<string, string> = {
  stripe: 'ri-bank-card-line',
  paypal: 'ri-paypal-line',
  virement: 'ri-bank-line',
  mobile_money: 'ri-smartphone-line',
};

const providerColors: Record<string, string> = {
  stripe: 'bg-violet-100 text-violet-700',
  paypal: 'bg-blue-100 text-blue-700',
  virement: 'bg-emerald-100 text-emerald-700',
  mobile_money: 'bg-orange-100 text-orange-700',
};

export default function PaymentsPanel() {
  const [configs, setConfigs] = useState<PaymentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.from('payment_configs').select('*').order('created_at', { ascending: false });
      setConfigs(data || []);
    } catch {
      setError('Impossible de charger les configurations de paiement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const handleToggle = async (cfg: PaymentConfig) => {
    try {
      await supabase.from('payment_configs').update({ is_active: !cfg.is_active }).eq('id', cfg.id);
      setToast(cfg.is_active ? `${cfg.display_name} désactivé` : `${cfg.display_name} activé`);
      setTimeout(() => setToast(null), 2000);
      await fetchConfigs();
    } catch {
      setToast('Erreur de mise à jour.');
      setTimeout(() => setToast(null), 2500);
    }
  };

  const activeCount = configs.filter((c) => c.is_active).length;

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-sentiqs-navy text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300">
          <i className="ri-check-line text-emerald-400 text-sm" /> {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-sentiqs-navy">Modes de paiement</h2>
          <p className="text-[10px] text-sentiqs-gray-text mt-0.5">Activez et configurez les méthodes de paiement acceptées</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-sentiqs-gray-text">{activeCount}/{configs.length} actifs</span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-100 p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
              <div className="h-3 bg-gray-50 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-8 text-center text-sentiqs-gray-text text-xs bg-white rounded-lg border border-gray-100">
          {error}
          <button type="button" onClick={fetchConfigs} className="ml-2 text-sentiqs-navy font-semibold underline cursor-pointer">Réessayer</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {configs.map((cfg) => {
            const isExpanded = expandedId === cfg.id;
            return (
              <div key={cfg.id} className="bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${providerColors[cfg.provider] || 'bg-gray-100 text-gray-500'}`}>
                        <i className={`${providerIcons[cfg.provider] || 'ri-money-dollar-circle-line'} text-lg`} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-sentiqs-navy block">{cfg.display_name}</span>
                        <span className="text-[10px] text-sentiqs-gray-text uppercase">{cfg.provider}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle(cfg)}
                      className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                        cfg.is_active ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        cfg.is_active ? 'left-5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>

                  {/* Supported currencies */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    {(cfg.supported_currencies || []).map((cur) => (
                      <span key={cur} className="px-2 py-0.5 rounded bg-gray-100 text-[10px] font-semibold text-sentiqs-gray-text">{cur}</span>
                    ))}
                  </div>

                  {/* Expand toggle */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : cfg.id)}
                    className="text-[10px] font-semibold text-sentiqs-gray-text hover:text-sentiqs-navy flex items-center gap-1 cursor-pointer"
                  >
                    <i className={isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line text-xs'} />
                    {isExpanded ? 'Masquer détails' : 'Voir configuration'}
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                      {Object.entries(cfg.config || {}).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between text-[10px]">
                          <span className="text-sentiqs-gray-text capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="font-mono text-sentiqs-navy max-w-[180px] truncate">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stripe CTA */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center">
            <i className="ri-bank-card-line text-amber-600 text-lg" />
          </div>
          <div>
            <span className="text-xs font-bold text-amber-800 block">Connecter Stripe</span>
            <span className="text-[10px] text-amber-600">Pour accepter les paiements par carte bancaire</span>
          </div>
        </div>
        <a href="/dashboard/settings" className="text-[10px] font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer">
          Configurer Stripe
        </a>
      </div>
    </div>
  );
}