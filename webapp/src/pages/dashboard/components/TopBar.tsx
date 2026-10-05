import { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';

interface TopBarProps {
  notificationCount?: number;
  onLogout: () => void;
  userName?: string;
}

export default function TopBar({ notificationCount = 3, onLogout }: TopBarProps) {
  const { t } = useTranslation();
  const currentLang = i18n.language.startsWith('fr') ? 'fr' : 'en';
  const [userName] = useState('Responsable Sûreté');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sentiqs-dark-mode') === 'true';
    }
    return true;
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
    <header className="h-[60px] border-b border-white/[0.08] bg-[#17181c] flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-[#d9a85c] flex items-center justify-center">
          <i className="ri-radar-line text-[#17181c] text-sm" />
        </div>
        <div className="min-w-0">
          <span className="block text-sm font-semibold text-slate-50 tracking-tight">SentiqS</span>
          <span className="hidden sm:block text-[9px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
            {t('header.subtitle')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden md:flex items-center bg-[#1e1f24] rounded-lg border border-white/[0.08] px-3 py-1.5">
          <i className="ri-search-line text-slate-500 text-sm mr-2" />
          <input
            type="text"
            placeholder={t('dashboard.search')}
            className="bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none w-40 lg:w-48"
          />
        </div>

        <button
          type="button"
          onClick={toggleDarkMode}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/[0.08] bg-[#1e1f24] text-slate-400 hover:border-[#d9a85c]/40 hover:text-[#d9a85c] transition-colors"
          title={darkMode ? 'Mode clair' : 'Mode sombre'}
        >
          {darkMode ? (
            <i className="ri-sun-line text-base" />
          ) : (
            <i className="ri-moon-line text-base" />
          )}
        </button>

        <div className="hidden sm:flex rounded-lg border border-white/[0.08] bg-[#1e1f24] overflow-hidden">
          <button
            type="button"
            onClick={() => switchLang('fr')}
            className={`px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.15em] transition ${currentLang === 'fr' ? 'bg-[#d9a85c] text-[#17181c]' : 'text-slate-400 hover:text-white'}`}
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => switchLang('en')}
            className={`px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.15em] transition ${currentLang === 'en' ? 'bg-[#d9a85c] text-[#17181c]' : 'text-slate-400 hover:text-white'}`}
          >
            EN
          </button>
        </div>

        <button type="button" className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-white/[0.08] bg-[#1e1f24] text-slate-400 transition hover:border-[#d9a85c]/40 hover:text-[#d9a85c]">
          <i className="ri-notification-3-line text-base" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center px-1">
              {notificationCount}
            </span>
          )}
        </button>

        <div className="hidden sm:flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#1e1f24] px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-[#d9a85c] flex items-center justify-center text-[10px] font-bold text-[#17181c]">
            RS
          </div>
          <span className="text-xs text-slate-200 font-medium hidden lg:inline">{userName}</span>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/[0.08] bg-[#1e1f24] text-slate-400 transition hover:border-[#d9a85c]/40 hover:text-[#d9a85c]"
          title={t('dashboard.logout')}
        >
          <i className="ri-home-3-line text-base" />
        </button>
      </div>
    </header>
  );
}
