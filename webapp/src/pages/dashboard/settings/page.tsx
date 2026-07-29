import { useState } from 'react';
import AlertChannelsPanel from './components/AlertChannelsPanel';
import SubscribersPanel from './components/SubscribersPanel';
import SubscriptionsPanel from './components/SubscriptionsPanel';
import TrafficPanel from './components/TrafficPanel';
import PaymentsPanel from './components/PaymentsPanel';

type TabId = 'alerts' | 'subscribers' | 'subscriptions' | 'traffic' | 'payments';

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'alerts', label: 'Alertes SMS/WhatsApp', icon: 'ri-notification-3-line' },
  { id: 'subscribers', label: 'Abonnés', icon: 'ri-user-settings-line' },
  { id: 'subscriptions', label: 'Abonnements', icon: 'ri-file-list-3-line' },
  { id: 'traffic', label: 'Trafic', icon: 'ri-bar-chart-line' },
  { id: 'payments', label: 'Paiements', icon: 'ri-bank-card-line' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('alerts');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-sentiqs-navy">Paramètres</h1>
        <p className="text-xs text-sentiqs-gray-text mt-0.5">Plateforme d'administration — Alertes, Abonnés, Abonnements, Trafic, Paiements</p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 overflow-x-auto w-full">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-colors whitespace-nowrap cursor-pointer flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-white text-sentiqs-navy shadow-sm'
                : 'text-sentiqs-gray-text hover:text-sentiqs-navy'
            }`}
          >
            <i className={`${tab.icon} text-xs`} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'alerts' && <AlertChannelsPanel />}
        {activeTab === 'subscribers' && <SubscribersPanel />}
        {activeTab === 'subscriptions' && <SubscriptionsPanel />}
        {activeTab === 'traffic' && <TrafficPanel />}
        {activeTab === 'payments' && <PaymentsPanel />}
      </div>
    </div>
  );
}