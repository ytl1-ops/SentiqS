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
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 flex-shrink-0 dark:bg-[#0b1220]/90 dark:border-slate-700/80">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.35)]">
          <i className="ri-radar-line text-white text-sm" />
        </div>
        <div className="min-w-0">
          <span className="block text-sm font-semibold text-white tracking-tight">SentiqS</span>
          <span className="hidden sm:block text-[9px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
            {t('header.subtitle')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden md:flex items-center bg-slate-900/80 rounded-xl border border-slate-700/80 px-3 py-1.5 shadow-inner shadow-slate-950/30">
          <i className="ri-search-line text-slate-400 text-sm mr-2" />
          <input
            type="text"
            placeholder={t('dashboard.search')}
            className="bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none w-40 lg:w-48"
          />
        </div>

        <button
          type="button"
          onClick={toggleDarkMode}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-300 transition-colors"
          title={darkMode ? 'Mode clair' : 'Mode sombre'}
        >
          {darkMode ? (
            <i className="ri-sun-line text-base" />
          ) : (
            <i className="ri-moon-line text-base" />
          )}
        </button>

        <div className="hidden sm:flex rounded-xl border border-slate-700 bg-slate-900/80 overflow-hidden">
          <button
            type="button"
            onClick={() => switchLang('fr')}
            className={`px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.15em] transition ${currentLang === 'fr' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'}`}
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => switchLang('en')}
            className={`px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.15em] transition ${currentLang === 'en' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'}`}
          >
            EN
          </button>
        </div>

        <button type="button" className="relative w-9 h-9 flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-300">
          <i className="ri-notification-3-line text-base" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center px-1">
              {notificationCount}
            </span>
          )}
        </button>

        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-[10px] font-bold text-slate-950">
            RS
          </div>
          <span className="text-xs text-slate-200 font-medium hidden lg:inline">{userName}</span>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-300"
          title={t('dashboard.logout')}
        >
          <i className="ri-home-3-line text-base" />
        </button>
      </div>
    </header>
  );
}
