import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

interface AlertChannel {
  id: number;
  name: string;
  channel_type: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  alert_severities: string[];
  created_at: string;
}

const channelIcons: Record<string, string> = {
  sms: 'ri-message-2-line',
  whatsapp: 'ri-whatsapp-line',
  email: 'ri-mail-line',
};

const channelColors: Record<string, string> = {
  sms: 'bg-emerald-100 text-emerald-700',
  whatsapp: 'bg-green-100 text-green-700',
  email: 'bg-amber-100 text-amber-700',
};

const severityLabels: Record<string, string> = {
  critical: 'Critique',
  high: 'Élevée',
  medium: 'Moyenne',
  low: 'Faible',
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function AlertChannelsPanel() {
  const { t } = useTranslation();
  const [channels, setChannels] = useState<AlertChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    channel_type: 'sms' as string,
    phone: '',
    email: '',
    is_active: true,
    alert_severities: ['critical', 'high'] as string[],
  });

  const fetchChannels = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.from('alert_channels').select('*').order('created_at', { ascending: false });
      setChannels(data || []);
    } catch {
      setError('Impossible de charger les canaux d\'alerte.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChannels(); }, []);

  const toggleSeverity = (sev: string) => {
    setForm((prev) => ({
      ...prev,
      alert_severities: prev.alert_severities.includes(sev)
        ? prev.alert_severities.filter((s) => s !== sev)
        : [...prev.alert_severities, sev],
    }));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      const { error: insertErr } = await supabase.from('alert_channels').insert({
        name: form.name,
        channel_type: form.channel_type,
        phone: form.channel_type !== 'email' ? form.phone : null,
        email: form.channel_type === 'email' ? form.email : null,
        is_active: form.is_active,
        alert_severities: form.alert_severities,
      });
      if (insertErr) throw insertErr;
      setShowCreate(false);
      setForm({ name: '', channel_type: 'sms', phone: '', email: '', is_active: true, alert_severities: ['critical', 'high'] });
      setToast('Canal d\'alerte créé !');
      setTimeout(() => setToast(null), 2500);
      await fetchChannels();
    } catch {
      setToast('Erreur lors de la création.');
      setTimeout(() => setToast(null), 2500);
    }
  };

  const handleToggle = async (ch: AlertChannel) => {
    try {
      await supabase.from('alert_channels').update({ is_active: !ch.is_active }).eq('id', ch.id);
      setToast(ch.is_active ? 'Canal désactivé' : 'Canal activé');
      setTimeout(() => setToast(null), 2000);
      await fetchChannels();
    } catch {
      setToast('Erreur lors de la mise à jour.');
      setTimeout(() => setToast(null), 2500);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await supabase.from('alert_channels').delete().eq('id', id);
      setToast('Canal supprimé');
      setTimeout(() => setToast(null), 2000);
      await fetchChannels();
    } catch {
      setToast('Erreur lors de la suppression.');
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-sentiqs-navy text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300">
          <i className="ri-check-line text-emerald-400 text-sm" /> {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-sentiqs-navy">Canaux d'alerte SMS / WhatsApp</h2>
          <p className="text-[10px] text-sentiqs-gray-text mt-0.5">Configurez les destinataires des alertes critiques par SMS ou WhatsApp</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-[10px] font-semibold text-white bg-sentiqs-navy hover:bg-sentiqs-navy/90 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-add-line text-xs" /> Ajouter un canal
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sentiqs-navy">Nouveau canal d'alerte</span>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sentiqs-gray-text hover:text-sentiqs-navy cursor-pointer">
              <i className="ri-close-line" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Nom du canal"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 focus:outline-none focus:border-sentiqs-navy text-sentiqs-navy placeholder:text-gray-400"
            />
            <select
              value={form.channel_type}
              onChange={(e) => setForm((p) => ({ ...p, channel_type: e.target.value }))}
              className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 focus:outline-none focus:border-sentiqs-navy text-sentiqs-gray-text"
            >
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
            {form.channel_type !== 'email' ? (
              <input
                type="text"
                placeholder="+33612345678"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 focus:outline-none focus:border-sentiqs-navy text-sentiqs-navy placeholder:text-gray-400"
              />
            ) : (
              <input
                type="email"
                placeholder="email@sentiqs.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 focus:outline-none focus:border-sentiqs-navy text-sentiqs-navy placeholder:text-gray-400"
              />
            )}
          </div>
          <div>
            <span className="text-[10px] font-semibold text-sentiqs-gray-text uppercase tracking-wider mb-1.5 block">Sévérités concernées</span>
            <div className="flex items-center gap-2 flex-wrap">
              {['critical', 'high', 'medium', 'low'].map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => toggleSeverity(sev)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                    form.alert_severities.includes(sev) ? severityColors[sev] : 'bg-gray-50 text-gray-400 border-gray-200'
                  }`}
                >
                  {severityLabels[sev]}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!form.name.trim()}
            className="text-[10px] font-semibold text-white bg-sentiqs-navy hover:bg-sentiqs-navy/90 disabled:opacity-40 px-4 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Créer le canal
          </button>
        </div>
      )}

      {/* Channels list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-100 p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-50 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-8 text-center text-sentiqs-gray-text text-xs bg-white rounded-lg border border-gray-100">
          {error}
          <button type="button" onClick={fetchChannels} className="ml-2 text-sentiqs-navy font-semibold underline cursor-pointer">Réessayer</button>
        </div>
      ) : channels.length === 0 ? (
        <div className="py-12 text-center text-sentiqs-gray-text text-xs bg-white rounded-lg border border-gray-100">
          Aucun canal d'alerte configuré.
        </div>
      ) : (
        <div className="space-y-2">
          {channels.map((ch) => (
            <div key={ch.id} className="bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${channelColors[ch.channel_type] || 'bg-gray-100 text-gray-500'}`}>
                <i className={`${channelIcons[ch.channel_type] || 'ri-notification-line'} text-lg`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-semibold text-sentiqs-navy">{ch.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${channelColors[ch.channel_type] || ''}`}>
                    {ch.channel_type}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${ch.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <span className="text-[10px] text-sentiqs-gray-text">{ch.is_active ? 'Actif' : 'Inactif'}</span>
                </div>
                <div className="text-[10px] text-sentiqs-gray-text font-mono">
                  {ch.phone || ch.email || '—'}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {ch.alert_severities.map((sev) => (
                    <span key={sev} className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${severityColors[sev]}`}>
                      {severityLabels[sev]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggle(ch)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    ch.is_active ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  }`}
                  title={ch.is_active ? 'Désactiver' : 'Activer'}
                >
                  <i className={ch.is_active ? 'ri-pause-line' : 'ri-play-line'} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(ch.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors cursor-pointer"
                  title="Supprimer"
                >
                  <i className="ri-delete-bin-line" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}