import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCriticalAlerts } from '@/hooks/useCriticalAlerts';

interface SidebarProps {
  activeItem?: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export default function Sidebar({ activeItem = 'overview' }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const base = location.pathname.startsWith('/preview') ? '/preview' : '/dashboard';

  const { unreadCount, markAsSeen } = useCriticalAlerts();

  const handleAlertsClick = () => {
    markAsSeen();
    navigate(`${base}/alerts`);
  };

  const sections: NavSection[] = [
    {
      title: t('dashboard.section.monitoring'),
      items: [
        { id: 'overview', label: t('dashboard.overview'), icon: 'ri-dashboard-line', path: `${base}` },
        { id: 'situation', label: t('dashboard.situation'), icon: 'ri-file-list-3-line', path: `${base}/situation` },
        { id: 'alerts', label: t('dashboard.alerts'), icon: 'ri-alarm-warning-line', path: `${base}/alerts`, badge: unreadCount },
        { id: 'feeds', label: t('dashboard.feeds'), icon: 'ri-rss-line', path: `${base}/feeds` },
      ],
    },
    {
      title: t('dashboard.section.tools'),
      items: [
        { id: 'reports', label: t('dashboard.reports'), icon: 'ri-file-chart-line', path: `${base}/reports` },
        { id: 'agenda', label: t('dashboard.agenda'), icon: 'ri-calendar-line', path: `${base}/agenda` },
        { id: 'settings', label: t('dashboard.settings'), icon: 'ri-settings-3-line', path: `${base}/settings` },
      ],
    },
  ];

  return (
    <aside className="w-14 lg:w-56 bg-white border-r border-gray-100 flex flex-col flex-shrink-0 transition-all">
      <nav className="flex-1 py-2">
        {sections.map((section) => (
          <div key={section.title} className="mb-1">
            <div className="hidden lg:block px-4 py-1.5">
              <span className="text-[9px] font-bold tracking-[0.2em] text-gray-400 uppercase">
                {section.title}
              </span>
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.id === 'alerts' ? handleAlertsClick : () => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 lg:px-4 py-2 text-xs transition-colors whitespace-nowrap cursor-pointer relative ${
                    activeItem === item.id
                      ? 'bg-sentiqs-navy/5 text-sentiqs-navy font-semibold border-r-2 border-sentiqs-navy'
                      : 'text-sentiqs-gray-text hover:bg-gray-50 hover:text-sentiqs-navy'
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 relative">
                    <i className={`${item.icon} text-base`} />
                    {item.badge && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none px-1 animate-in">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="hidden lg:inline">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="hidden lg:inline-flex ml-auto items-center justify-center min-w-[22px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1.5 animate-pulse">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 lg:p-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <span className="hidden lg:inline text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">
            {t('common.activeMonitoring')}
          </span>
        </div>
        <p className="hidden lg:block text-[10px] text-sentiqs-gray-text mt-1">{t('common.monitoredCountries')}</p>
      </div>
    </aside>
  );
}