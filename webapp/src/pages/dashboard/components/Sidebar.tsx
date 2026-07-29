import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  activeItem?: string;
}

export default function Sidebar({ activeItem = 'overview' }: SidebarProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const navItems = [
    { id: 'overview', label: t('dashboard.overview'), icon: 'ri-dashboard-line', path: '/dashboard' },
    { id: 'alerts', label: t('dashboard.alerts'), icon: 'ri-alarm-warning-line', path: '/dashboard/alerts' },
    { id: 'feeds', label: t('dashboard.feeds'), icon: 'ri-rss-line', path: '/dashboard/feeds' },
    { id: 'correlations', label: t('dashboard.correlations'), icon: 'ri-git-merge-line', path: '/dashboard/correlations' },
    { id: 'reports', label: t('dashboard.reports'), icon: 'ri-file-chart-line', path: '/dashboard/reports' },
    { id: 'countries', label: t('dashboard.countries'), icon: 'ri-global-line', path: '/dashboard/countries' },
    { id: 'agenda', label: t('dashboard.agenda'), icon: 'ri-calendar-line', path: '/dashboard/agenda' },
    { id: 'settings', label: t('dashboard.settings'), icon: 'ri-settings-3-line', path: '/dashboard/settings' },
  ];

  return (
    <aside className="w-14 lg:w-56 bg-white border-r border-gray-100 flex flex-col flex-shrink-0 transition-all">
      <nav className="flex-1 py-4 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.path)}
            className={`w-full flex items-center gap-3 px-3 lg:px-4 py-2.5 text-xs transition-colors whitespace-nowrap cursor-pointer ${
              activeItem === item.id
                ? 'bg-sentiqs-navy/5 text-sentiqs-navy font-semibold border-r-2 border-sentiqs-navy'
                : 'text-sentiqs-gray-text hover:bg-gray-50 hover:text-sentiqs-navy'
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <i className={`${item.icon} text-base`} />
            </div>
            <span className="hidden lg:inline">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-3 lg:p-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <span className="hidden lg:inline text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">
            Veille Active
          </span>
        </div>
        <p className="hidden lg:block text-[10px] text-sentiqs-gray-text mt-1">54 pays surveillés</p>
      </div>
    </aside>
  );
}