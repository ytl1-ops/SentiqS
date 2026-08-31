import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!cancelled) {
        setSession(currentSession);
      }
    }).catch(() => {
      if (!cancelled) {
        setSession(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!cancelled) {
        setSession(currentSession);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-sentiqs-gray-bg">
        <div className="w-8 h-8 border-2 border-sentiqs-navy/30 border-t-sentiqs-navy rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}