import { useCallback, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import CriticalToast from './components/CriticalToast';
import PageTransition from '@/components/base/PageTransition';
import { useCriticalAlerts } from '@/hooks/useCriticalAlerts';
import { setFaviconBadge, resetFavicon, setTabTitle } from '@/utils/tabNotification';

export default function DashboardLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const { unreadCount, showToast, dismissToast, markAsSeen, muted, toggleMute, latestAlert } = useCriticalAlerts();

  // --- Tab notification : titre clignotant + favicon badge ---
  const titleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Mettre à jour le favicon avec badge
    if (unreadCount > 0) {
      setFaviconBadge(unreadCount);
    } else {
      resetFavicon();
    }

    // Titre clignotant : alterne entre le titre d'alerte et le titre normal
    // pour attirer l'attention quand l'utilisateur est sur un autre onglet
    if (unreadCount > 0) {
      let blink = true;
      setTabTitle(unreadCount); // titre initial avec compteur

      titleIntervalRef.current = setInterval(() => {
        blink = !blink;
        if (blink) {
          setTabTitle(unreadCount);
        } else {
          document.title = t('common.newAlert');
        }
      }, 1500);
    } else {
      setTabTitle(0); // reset au titre normal
    }

    return () => {
      if (titleIntervalRef.current) {
        clearInterval(titleIntervalRef.current);
        titleIntervalRef.current = null;
      }
    };
  }, [unreadCount]);

  // Nettoyage final au démontage
  useEffect(() => {
    return () => {
      resetFavicon();
      setTabTitle(0);
      if (titleIntervalRef.current) {
        clearInterval(titleIntervalRef.current);
      }
    };
  }, []);
  // --- Fin tab notification ---

  const handleLogout = useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  const pathToActive = (path: string): string => {
    const base = location.pathname.startsWith('/preview') ? '/preview' : '/dashboard';
    if (path === base || path === `${base}/`) return 'overview';
    if (path.startsWith(`${base}/alerts`)) return 'alerts';
    if (path.startsWith(`${base}/feeds`)) return 'feeds';
    if (path.startsWith(`${base}/situation`)) return 'situation';
    if (path.startsWith(`${base}/reports`)) return 'reports';
    if (path.startsWith(`${base}/agenda`)) return 'agenda';
    if (path.startsWith(`${base}/agent`)) return 'agent';
    if (path.startsWith(`${base}/settings`)) return 'settings';
    return 'overview';
  };

  return (
    <div className="min-h-screen bg-sentiqs-gray-bg flex flex-col">
      <TopBar onLogout={handleLogout} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeItem={pathToActive(location.pathname)} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <PageTransition>
            <Outlet />
          </PageTransition>

          <div className="flex items-center justify-between py-3 mt-5 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">
                {t('common.activeMonitoring')}
              </span>
              <span className="text-[10px] text-sentiqs-gray-text">• {t('dashboard.countries54')} • {t('dashboard.realTime')}</span>
            </div>
            <span className="text-[10px] text-sentiqs-gray-text">
              {t('dashboard.lastUpdate')} : {new Date().toLocaleTimeString(i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </main>
      </div>

      {/* Toast notification push pour alertes critiques */}
      <CriticalToast
        unreadCount={unreadCount}
        show={showToast}
        onDismiss={dismissToast}
        onView={markAsSeen}
        muted={muted}
        onToggleMute={toggleMute}
        latestAlert={latestAlert}
      />
    </div>
  );
}