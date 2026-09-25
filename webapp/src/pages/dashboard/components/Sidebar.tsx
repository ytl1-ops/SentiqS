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
    <aside className="w-16 lg:w-60 bg-slate-950/80 border-r border-slate-800/80 backdrop-blur-xl flex flex-col flex-shrink-0 transition-all">
      <nav className="flex-1 py-3">
        {sections.map((section) => (
          <div key={section.title} className="mb-3">
            <div className="hidden lg:block px-4 pb-2 pt-1">
              <span className="text-[9px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
                {section.title}
              </span>
            </div>
            <div className="space-y-1.5 px-2">
              {section.items.map((item) => {
                const isActive = activeItem === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.id === 'alerts' ? handleAlertsClick : () => navigate(item.path)}
                    className={`group relative w-full flex items-center gap-3 rounded-xl px-2.5 lg:px-3 py-2.5 text-xs transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-cyan-400/10 text-cyan-200 border border-cyan-400/25 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.1)]'
                        : 'text-slate-400 hover:bg-slate-900/80 hover:text-slate-100'
                    }`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 relative">
                      <i className={`${item.icon} text-base ${isActive ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-200'}`} />
                      {item.badge && item.badge > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none px-1">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </div>
                    <span className="hidden lg:inline text-sm font-medium">{item.label}</span>
                    {item.badge && item.badge > 0 && (
                      <span className="hidden lg:inline-flex ml-auto items-center justify-center min-w-[22px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1.5">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 lg:p-4 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <span className="hidden lg:inline text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
            {t('common.activeMonitoring')}
          </span>
        </div>
        <p className="hidden lg:block text-[10px] text-slate-500 mt-2">{t('common.monitoredCountries')}</p>
      </div>
    </aside>
  );
}
