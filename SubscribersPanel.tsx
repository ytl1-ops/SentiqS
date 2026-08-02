import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SupabaseAlert } from '@/hooks/useSupabaseAlerts';

interface CriticalToastProps {
  unreadCount: number;
  show: boolean;
  onDismiss: () => void;
  onView: () => void;
  muted: boolean;
  onToggleMute: () => void;
  latestAlert: SupabaseAlert | null;
}

export default function CriticalToast({ unreadCount, show, onDismiss, onView, muted, onToggleMute, latestAlert }: CriticalToastProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setExiting(false);
      const autoDismiss = setTimeout(() => {
        setExiting(true);
        setTimeout(() => {
          setVisible(false);
          onDismiss();
        }, 400);
      }, 8000);
      return () => clearTimeout(autoDismiss);
    }
    return undefined;
  }, [show, onDismiss]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 400);
  };

  const handleView = () => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      onView();
      navigate('/dashboard/alerts');
    }, 400);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-[9999] max-w-sm w-full bg-white border border-red-200 rounded-xl shadow-lg overflow-hidden transition-all duration-400 ${
        exiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      }`}
    >
      {/* Barre supérieure rouge */}
      <div className="h-1 bg-red-500 animate-pulse" />

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icône alarme */}
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <i className="ri-alarm-warning-line text-red-500 text-xl" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
                {t('dashboard.alerts.pushTitle', 'Alerte critique')}
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                {unreadCount}
              </span>
            </div>

            {latestAlert && (
              <p className="text-xs text-sentiqs-navy font-semibold leading-snug line-clamp-2 mb-1">
                {latestAlert.title}
              </p>
            )}

            {unreadCount > 1 && (
              <p className="text-[10px] text-sentiqs-gray-text">
                + {unreadCount - 1} autre{unreadCount - 1 > 1 ? 's' : ''} alerte{unreadCount - 1 > 1 ? 's' : ''} critique{unreadCount - 1 > 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            {/* Bouton muet/son */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
              className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
              title={muted ? t('dashboard.alerts.unmute', 'Activer le son') : t('dashboard.alerts.mute', 'Couper le son')}
            >
              <i className={`text-gray-400 text-sm ${muted ? 'ri-volume-mute-line' : 'ri-volume-up-line'}`} />
            </button>
            {/* Bouton fermer */}
            <button
              type="button"
              onClick={handleDismiss}
              className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
            >
              <i className="ri-close-line text-gray-400 text-sm" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={handleView}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-2 px-3 rounded-lg cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
          >
            <i className="ri-eye-line text-sm" />
            {t('dashboard.alerts.viewNow', 'Voir maintenant')}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-[10px] text-sentiqs-gray-text hover:text-sentiqs-navy cursor-pointer whitespace-nowrap px-2"
          >
            {t('dashboard.alerts.dismiss', 'Ignorer')}
          </button>
        </div>
      </div>
    </div>
  );
}