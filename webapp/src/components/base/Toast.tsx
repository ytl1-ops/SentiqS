import { useEffect } from 'react';

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
  icon?: string;
}

export default function Toast({ message, onDismiss, duration = 2000, icon = 'ri-check-line text-emerald-400' }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, onDismiss, duration]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-sentiqs-navy text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300">
      <i className={`${icon} text-sm`} /> {message}
    </div>
  );
}