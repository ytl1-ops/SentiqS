import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import Toast from '@/components/base/Toast';
import ErrorState from '@/components/base/ErrorState';
import EmptyState from '@/components/base/EmptyState';

interface Subscriber {
  id: number;
  name: string;
  email: string;
  phone: string;
  country: string;
  subscription_tier: string;
  status: string;
  created_at: string;
}

const tierLabels: Record<string, string> = {
  Essentiel: 'Essentiel',
  Professionnel: 'Professionnel',
  Enterprise: 'Enterprise',
};

const tierColors: Record<string, string> = {
  Essentiel: 'bg-gray-100 text-gray-700 border-gray-200',
  Professionnel: 'bg-sentiqs-navy/10 text-sentiqs-navy border-sentiqs-navy/20',
  Enterprise: 'bg-amber-100 text-amber-700 border-amber-200',
};

const statusColors: Record<string, string> = {
  actif: 'bg-emerald-100 text-emerald-700',
  inactif: 'bg-gray-100 text-gray-500',
  suspendu: 'bg-red-100 text-red-700',
};

export default function SubscribersPanel() {
  const { t } = useTranslation();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', country: '', subscription_tier: 'Essentiel', status: 'actif' });

  const fetchSubscribers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.from('subscribers').select('*').order('created_at', { ascending: false });
      setSubscribers(data || []);
    } catch {
      setError('Impossible de charger les abonnés.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubscribers(); }, []);

  const filtered = subscribers.filter((s) => {
    if (tierFilter !== 'all' && s.subscription_tier !== tierFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.country.toLowerCase().includes(q) || (s.phone && s.phone.includes(q));
    }
    return true;
  });

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    try {
      await supabase.from('subscribers').insert(form);
      setShowCreate(false);
      setForm({ name: '', email: '', phone: '', country: '', subscription_tier: 'Essentiel', status: 'actif' });
      setToast('Abonné ajouté !');
      await fetchSubscribers();
    } catch {
      setToast('Erreur lors de l\'ajout.');
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await supabase.from('subscribers').update({ status: newStatus }).eq('id', id);
      setToast('Statut mis à jour');
      await fetchSubscribers();
    } catch {
      setToast('Erreur de mise à jour.');
    }
  };

  const stats = {
    total: subscribers.length,
    actif: subscribers.filter((s) => s.status === 'actif').length,
    suspendu: subscribers.filter((s) => s.status === 'suspendu').length,
    inactif: subscribers.filter((s) => s.status === 'inactif').length,
  };

  return (
    <div className="space-y-5">
      <Toast message={toast} onDismiss={() => setToast(null)} />

      {/* Connection card to user management */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <i className="ri-user-settings-line text-emerald-600 text-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-bold text-sentiqs-navy">Gestion des accès plateforme</h3>
          <p className="text-[10px] text-sentiqs-gray-text mt-0.5">
            Les abonnés sont les utilisateurs autorisés à accéder au dashboard SentiqS. Chaque abonné est lié à un plan tarifaire qui détermine ses droits.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer flex-shrink-0"
        >
          <i className="ri-question-line text-xs" /> Guide d'accès
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-sentiqs-navy">Gestion des abonnés</h2>
          <p className="text-[10px] text-sentiqs-gray-text mt-0.5">Gérez les abonnés et leurs droits d'accès à la plateforme</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-[10px] font-semibold text-white bg-sentiqs-navy hover:bg-sentiqs-navy/90 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-add-line text-xs" /> Ajouter un abonné
        </button>
      </div>

      {/* Stats */}
      {stats.total > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-sentiqs-navy' },
            { label: t('dashboard.settings.subscribers.active'), value: stats.actif, color: 'text-emerald-600' },
            { label: 'Suspendus', value: stats.suspendu, color: 'text-red-500' },
            { label: 'Inactifs', value: stats.inactif, color: 'text-gray-400' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-100 p-3">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sentiqs-navy">Nouvel abonné</span>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sentiqs-gray-text hover:text-sentiqs-navy cursor-pointer"><i className="ri-close-line" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="text" placeholder="Nom complet" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 focus:outline-none focus:border-sentiqs-navy text-sentiqs-navy placeholder:text-gray-400" />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 focus:outline-none focus:border-sentiqs-navy text-sentiqs-navy placeholder:text-gray-400" />
            <input type="text" placeholder="Téléphone (ex: +225...)" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 focus:outline-none focus:border-sentiqs-navy text-sentiqs-navy placeholder:text-gray-400" />
            <input type="text" placeholder="Pays" value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 focus:outline-none focus:border-sentiqs-navy text-sentiqs-navy placeholder:text-gray-400" />
            <select value={form.subscription_tier} onChange={(e) => setForm((p) => ({ ...p, subscription_tier: e.target.value }))} className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 focus:outline-none focus:border-sentiqs-navy text-sentiqs-gray-text">
              <option value="Essentiel">Essentiel</option>
              <option value="Professionnel">Professionnel</option>
              <option value="Enterprise">Enterprise</option>
            </select>
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 focus:outline-none focus:border-sentiqs-navy text-sentiqs-gray-text">
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
              <option value="suspendu">Suspendu</option>
            </select>
          </div>
          <button type="button" onClick={handleCreate} disabled={!form.name.trim() || !form.email.trim()} className="text-[10px] font-semibold text-white bg-sentiqs-navy hover:bg-sentiqs-navy/90 disabled:opacity-40 px-4 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer">
            Ajouter
          </button>
        </div>
      )}

      {/* Filters */}
      {subscribers.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex-1 min-w-[180px]">
            <i className="ri-search-line text-sentiqs-gray-text text-sm mr-2" />
            <input type="text" placeholder="Rechercher un abonné..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent text-xs text-sentiqs-navy placeholder:text-gray-400 focus:outline-none w-full" />
          </div>
          <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 bg-white text-sentiqs-gray-text focus:outline-none focus:border-sentiqs-navy whitespace-nowrap">
            <option value="all">Tous les plans</option>
            <option value="Essentiel">Essentiel</option>
            <option value="Professionnel">Professionnel</option>
            <option value="Enterprise">Enterprise</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 bg-white text-sentiqs-gray-text focus:outline-none focus:border-sentiqs-navy whitespace-nowrap">
            <option value="all">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
            <option value="suspendu">Suspendu</option>
          </select>
        </div>
      )}

      {/* Table or empty state */}
      {loading ? (
        <div className="space-y-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-100 p-4 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-2 bg-gray-50 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchSubscribers} retryLabel={t('common.retry')} />
      ) : subscribers.length === 0 ? (
        <EmptyState
          icon="ri-group-line"
          title="Aucun abonné enregistré"
          description="Ajoutez des abonnés pour leur donner accès à la plateforme SentiqS. Chaque abonné peut être rattaché à un plan tarifaire."
          actionLabel="Ajouter un premier abonné"
          actionIcon="ri-add-line"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Nom</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Email</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Téléphone</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Pays</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Plan</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Statut</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-sentiqs-navy">{s.name}</td>
                    <td className="px-4 py-2.5 text-sentiqs-gray-text">{s.email}</td>
                    <td className="px-4 py-2.5 text-sentiqs-gray-text font-mono">{s.phone || '—'}</td>
                    <td className="px-4 py-2.5 text-sentiqs-gray-text">{s.country}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${tierColors[s.subscription_tier] || ''}`}>{s.subscription_tier}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[s.status] || ''}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <select
                        value={s.status}
                        onChange={(e) => handleStatusChange(s.id, e.target.value)}
                        className="text-[10px] px-2 py-1 rounded border border-gray-200 bg-white text-sentiqs-gray-text focus:outline-none focus:border-sentiqs-navy cursor-pointer"
                      >
                        <option value="actif">Actif</option>
                        <option value="inactif">Inactif</option>
                        <option value="suspendu">Suspendu</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sentiqs-gray-text text-xs">Aucun abonné trouvé.</div>
          )}
        </div>
      )}
    </div>
  );
}