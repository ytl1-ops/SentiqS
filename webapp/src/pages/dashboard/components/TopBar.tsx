import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';

interface TopBarProps {
  userName?: string;
  notificationCount?: number;
  onLogout: () => void;
}

export default function TopBar({ userName = 'Responsable Sûreté', notificationCount = 3, onLogout }: TopBarProps) {
  const { t } = useTranslation();
  const currentLang = i18n.language.startsWith('fr') ? 'fr' : 'en';

  const switchLang = useCallback((newLang: 'fr' | 'en') => {
    i18n.changeLanguage(newLang);
  }, []);

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-sentiqs-navy flex items-center justify-center">
          <i className="ri-earth-line text-white text-sm" />
        </div>
        <span className="text-sm font-bold text-sentiqs-navy tracking-tight">SentiqS</span>
        <span className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase hidden sm:inline">
          Veille Sûreté
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="hidden md:flex items-center bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100">
          <i className="ri-search-line text-sentiqs-gray-text text-sm mr-2" />
          <input
            type="text"
            placeholder={t('dashboard.search')}
            className="bg-transparent text-xs text-sentiqs-navy placeholder:text-gray-400 focus:outline-none w-48"
          />
        </div>

        {/* Language toggle */}
        <div className="hidden sm:flex rounded-md overflow-hidden border border-sentiqs-gray-border">
          <button
            type="button"
            onClick={() => switchLang('fr')}
            className={`px-2 py-1 text-[10px] font-medium transition-colors ${
              currentLang === 'fr' ? 'bg-sentiqs-navy text-white' : 'bg-white text-sentiqs-gray-text hover:bg-gray-50'
            }`}
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => switchLang('en')}
            className={`px-2 py-1 text-[10px] font-medium transition-colors ${
              currentLang === 'en' ? 'bg-sentiqs-navy text-white' : 'bg-white text-sentiqs-gray-text hover:bg-gray-50'
            }`}
          >
            EN
          </button>
        </div>

        {/* Notifications */}
        <button type="button" className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 transition-colors">
          <i className="ri-notification-3-line text-sentiqs-navy text-base" />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </button>

        {/* Profile */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-sentiqs-navy flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">RS</span>
          </div>
          <span className="text-xs text-sentiqs-navy font-medium hidden lg:inline">{userName}</span>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={onLogout}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors text-sentiqs-gray-text hover:text-red-500"
          title={t('dashboard.logout')}
        >
          <i className="ri-logout-box-r-line text-base" />
        </button>
      </div>
    </header>
  );
}