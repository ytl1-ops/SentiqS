import { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';

interface TopBarProps {
  notificationCount?: number;
  onLogout: () => void;
}

export default function TopBar({ notificationCount = 3, onLogout }: TopBarProps) {
  const { t } = useTranslation();
  const currentLang = i18n.language.startsWith('fr') ? 'fr' : 'en';
  const [userName] = useState('Responsable Sûreté');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sentiqs-dark-mode') === 'true';
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('sentiqs-dark-mode', String(darkMode));
  }, [darkMode]);

  const switchLang = useCallback((newLang: 'fr' | 'en') => {
    i18n.changeLanguage(newLang);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0 dark:bg-[#111827] dark:border-[#1e293b]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-sentiqs-navy dark:bg-red-700 flex items-center justify-center">
          <i className="ri-earth-line text-white text-sm" />
        </div>
        <span className="text-sm font-bold text-sentiqs-navy dark:text-white tracking-tight">SentiqS</span>
        <span className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase hidden sm:inline dark:text-gray-400">
          {t('header.subtitle')}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="hidden md:flex items-center bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100 dark:bg-[#1a2232] dark:border-[#273449]">
          <i className="ri-search-line text-sentiqs-gray-text text-sm mr-2" />
          <input
            type="text"
            placeholder={t('dashboard.search')}
            className="bg-transparent text-xs text-sentiqs-navy dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none w-48"
          />
        </div>

        {/* Dark mode toggle */}
        <button
          type="button"
          onClick={toggleDarkMode}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 dark:hover:bg-[#1a2232] transition-colors"
          title={darkMode ? 'Mode clair' : 'Mode sombre (Salle de Crise)'}
        >
          {darkMode ? (
            <i className="ri-sun-line text-amber-400 text-base" />
          ) : (
            <i className="ri-moon-line text-sentiqs-gray-text text-base" />
          )}
        </button>

        {/* Language toggle */}
        <div className="hidden sm:flex rounded-md overflow-hidden border border-sentiqs-gray-border dark:border-gray-600">
          <button
            type="button"
            onClick={() => switchLang('fr')}
            className={`px-2 py-1 text-[10px] font-medium transition-colors ${
              currentLang === 'fr' ? 'bg-sentiqs-navy dark:bg-red-700 text-white' : 'bg-white dark:bg-[#111827] text-sentiqs-gray-text dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1a2232]'
            }`}
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => switchLang('en')}
            className={`px-2 py-1 text-[10px] font-medium transition-colors ${
              currentLang === 'en' ? 'bg-sentiqs-navy dark:bg-red-700 text-white' : 'bg-white dark:bg-[#111827] text-sentiqs-gray-text dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1a2232]'
            }`}
          >
            EN
          </button>
        </div>

        {/* Notifications */}
        <button type="button" className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 dark:hover:bg-[#1a2232] transition-colors">
          <i className="ri-notification-3-line text-sentiqs-navy dark:text-gray-300 text-base" />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </button>

        {/* Profile */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-sentiqs-navy dark:bg-red-700 flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">RS</span>
          </div>
          <span className="text-xs text-sentiqs-navy dark:text-gray-300 font-medium hidden lg:inline">{userName}</span>
        </div>

        {/* Home button */}
        <button
          type="button"
          onClick={onLogout}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 dark:hover:bg-[#1a2232] transition-colors text-sentiqs-gray-text dark:text-gray-400 hover:text-sentiqs-navy dark:hover:text-gray-200"
          title={t('dashboard.logout')}
        >
          <i className="ri-home-3-line text-base" />
        </button>
      </div>
    </header>
  );
}