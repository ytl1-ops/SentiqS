import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AlertChannelsPanel from './components/AlertChannelsPanel';
import SubscribersPanel from './components/SubscribersPanel';
import SubscriptionsPanel from './components/SubscriptionsPanel';
import TrafficPanel from './components/TrafficPanel';
import PaymentsPanel from './components/PaymentsPanel';
import LinkCheckerPanel from './components/LinkCheckerPanel';

type TabId = 'overview' | 'alerts' | 'subscribers' | 'subscriptions' | 'traffic' | 'payments' | 'links';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isFr = i18n.language.startsWith('fr');
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'overview', label: t('dashboard.settings.overview'), icon: 'ri-dashboard-line' },
    { id: 'alerts', label: t('dashboard.settings.tab.alerts'), icon: 'ri-notification-3-line' },
    { id: 'subscribers', label: t('dashboard.settings.tab.subscribers'), icon: 'ri-user-settings-line' },
    { id: 'subscriptions', label: t('dashboard.settings.tab.subscriptions'), icon: 'ri-file-list-3-line' },
    { id: 'traffic', label: t('dashboard.settings.tab.traffic'), icon: 'ri-bar-chart-line' },
    { id: 'payments', label: t('dashboard.settings.tab.payments'), icon: 'ri-bank-card-line' },
    { id: 'links', label: isFr ? 'Intégrité des liens' : 'Link Integrity', icon: 'ri-link-m' },
  ];

  const overviewCards: {
    title: string;
    desc: string;
    icon: string;
    iconBg: string;
    iconColor: string;
    tabId: TabId;
    actionLabel: string;
    actionIcon: string;
    linkPath?: string;
    linkTab?: TabId;
    linkLabel?: string;
    linkIcon?: string;
  }[] = [
    {
      title: t('dashboard.settings.tab.alerts'),
      desc: t('dashboard.settings.cardAlertsDesc'),
      icon: 'ri-notification-3-line',
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
      tabId: 'alerts',
      actionLabel: t('dashboard.settings.cardAlertsAction'),
      actionIcon: 'ri-settings-3-line',
      linkPath: '/dashboard/alerts',
      linkLabel: isFr ? "Module Alertes" : 'Alerts Module',
      linkIcon: 'ri-alarm-warning-line',
    },
    {
      title: t('dashboard.settings.tab.subscribers'),
      desc: t('dashboard.settings.cardSubscribersDesc'),
      icon: 'ri-user-settings-line',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      tabId: 'subscribers',
      actionLabel: t('dashboard.settings.cardSubscribersAction'),
      actionIcon: 'ri-group-line',
      linkTab: 'subscriptions',
      linkLabel: t('dashboard.settings.tab.subscriptions'),
      linkIcon: 'ri-file-list-3-line',
    },
    {
      title: t('dashboard.settings.tab.subscriptions'),
      desc: t('dashboard.settings.cardSubscriptionsDesc'),
      icon: 'ri-file-list-3-line',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      tabId: 'subscriptions',
      actionLabel: t('dashboard.settings.cardSubscriptionsAction'),
      actionIcon: 'ri-price-tag-3-line',
      linkTab: 'subscribers',
      linkLabel: t('dashboard.settings.tab.subscribers'),
      linkIcon: 'ri-user-settings-line',
    },
    {
      title: t('dashboard.settings.tab.traffic'),
      desc: t('dashboard.settings.cardTrafficDesc'),
      icon: 'ri-bar-chart-line',
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      tabId: 'traffic',
      actionLabel: t('dashboard.settings.cardTrafficAction'),
      actionIcon: 'ri-line-chart-line',
    },
    {
      title: t('dashboard.settings.tab.payments'),
      desc: t('dashboard.settings.cardPaymentsDesc'),
      icon: 'ri-bank-card-line',
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      tabId: 'payments',
      actionLabel: t('dashboard.settings.cardPaymentsAction'),
      actionIcon: 'ri-money-dollar-circle-line',
    },
    {
      title: isFr ? 'Intégrité des liens' : 'Link Integrity',
      desc: t('dashboard.settings.cardLinksDesc'),
      icon: 'ri-link-m',
      iconBg: 'bg-teal-50',
      iconColor: 'text-teal-600',
      tabId: 'links',
      actionLabel: t('dashboard.settings.cardLinksAction'),
      actionIcon: 'ri-shield-check-line',
      linkPath: '/dashboard/feeds',
      linkLabel: t('dashboard.feeds'),
      linkIcon: 'ri-rss-line',
    },
  ];

  const dashboardModuleLinks = [
    { label: isFr ? "Niveau d'alerte" : 'Alert Levels', icon: 'ri-alarm-warning-line', path: '/dashboard/alerts', color: 'bg-red-50 text-red-600' },
    { label: t('dashboard.feeds'), icon: 'ri-rss-line', path: '/dashboard/feeds', color: 'bg-emerald-50 text-emerald-600' },
    { label: t('dashboard.situation'), icon: 'ri-file-list-3-line', path: '/dashboard/situation', color: 'bg-amber-50 text-amber-600' },
    { label: t('dashboard.agenda'), icon: 'ri-calendar-line', path: '/dashboard/agenda', color: 'bg-indigo-50 text-indigo-600' },
    { label: t('dashboard.reports'), icon: 'ri-file-chart-line', path: '/dashboard/reports', color: 'bg-violet-50 text-violet-600' },
    { label: t('dashboard.title'), icon: 'ri-dashboard-line', path: '/dashboard', color: 'bg-gray-100 text-sentiqs-navy' },
  ];

  const handleTabNav = (tabId: TabId) => {
    setActiveTab(tabId);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-sentiqs-navy">{t('dashboard.settings')}</h1>
        <p className="text-xs text-sentiqs-gray-text mt-0.5">{t('dashboard.settings.subtitle')}</p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 overflow-x-auto w-full">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabNav(tab.id)}
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
      <div className="anim-entry-scale" style={{ animationDelay: '100ms' }}>
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-bold text-sentiqs-navy">{t('dashboard.settings.adminPlatform')}</h2>
              <p className="text-[10px] text-sentiqs-gray-text mt-0.5">{t('dashboard.settings.pageSubtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {overviewCards.map((card) => (
                <div
                  key={card.title}
                  className="bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-all p-5 flex flex-col group cursor-pointer"
                  onClick={() => handleTabNav(card.tabId)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mb-4 ${card.iconBg}`}>
                    <i className={`${card.icon} ${card.iconColor} text-lg`} />
                  </div>
                  <h3 className="text-xs font-bold text-sentiqs-navy mb-1.5">{card.title}</h3>
                  <p className="text-[10px] text-sentiqs-gray-text leading-relaxed mb-4 flex-1">{card.desc}</p>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTabNav(card.tabId);
                      }}
                      className="text-[10px] font-semibold text-sentiqs-navy hover:text-sentiqs-navy/70 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <i className={`${card.actionIcon} text-xs`} /> {card.actionLabel}
                    </button>
                    {(card.linkPath || card.linkTab) && card.linkLabel && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (card.linkTab) {
                            handleTabNav(card.linkTab);
                          } else {
                            navigate(card.linkPath!);
                          }
                        }}
                        className="text-[10px] font-semibold text-sentiqs-gray-text hover:text-sentiqs-navy flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <i className={`${card.linkIcon} text-xs`} /> {card.linkLabel}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick links to dashboard modules */}
            <div className="bg-white rounded-lg border border-gray-100 p-4">
              <h3 className="text-xs font-bold text-sentiqs-navy mb-3">{t('dashboard.settings.modules')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {dashboardModuleLinks.map((link) => (
                  <button
                    key={link.path}
                    type="button"
                    onClick={() => navigate(link.path)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${link.color} text-[10px] font-semibold hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap`}
                  >
                    <i className={`${link.icon} text-xs`} /> {link.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && <AlertChannelsPanel />}
        {activeTab === 'subscribers' && <SubscribersPanel />}
        {activeTab === 'subscriptions' && <SubscriptionsPanel />}
        {activeTab === 'traffic' && <TrafficPanel />}
        {activeTab === 'payments' && <PaymentsPanel />}
        {activeTab === 'links' && <LinkCheckerPanel />}
      </div>
    </div>
  );
}