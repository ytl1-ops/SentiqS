import { useState, useEffect, createContext, useContext } from 'react';
import { supabase, Profile, Subscription, getCurrentSubscription, getProfile, ADMIN_EMAIL } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

type AuthContextType = {
  session: Session | null;
  profile: Profile | null;
  subscription: Subscription | null;
  isAdmin: boolean;
  isLoading: boolean;
  hasAccess: boolean;
  canViewReports: boolean;
  canViewArchive: boolean;
  canViewMap: boolean;
  articlesLimit: number;
  refreshSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null, profile: null, subscription: null,
  isAdmin: false, isLoading: true, hasAccess: false,
  canViewReports: false, canViewArchive: false, canViewMap: false,
  articlesLimit: 0,
  refreshSubscription: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadUserData(session.user.id);
      else setIsLoading(false);
    });

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session) await loadUserData(session.user.id);
        else { setProfile(null); setSubscription(null); setIsLoading(false); }
      }
    );
    return () => authListener.unsubscribe();
  }, []);

  async function loadUserData(userId: string) {
    setIsLoading(true);
    try {
      const [prof, sub] = await Promise.all([
        getProfile(userId),
        getCurrentSubscription(userId),
      ]);
      setProfile(prof);
      setSubscription(sub);
    } finally {
      setIsLoading(false);
    }
  }

  const isAdmin = profile?.role === 'admin' || profile?.email === ADMIN_EMAIL;
  const features = subscription?.plan_features;
  const hasAccess = isAdmin || (!!subscription && subscription.status === 'active');
  const canViewReports = isAdmin || (!!features?.reports);
  const canViewArchive = isAdmin || ((features?.archive_years ?? 0) > 0);
  const canViewMap = isAdmin || (!!features?.map);
  const articlesLimit = features?.articles ?? 0;

  async function refreshSubscription() {
    if (session) await loadUserData(session.user.id);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSession(null); setProfile(null); setSubscription(null);
  }

  return (
    <AuthContext.Provider value={{
      session, profile, subscription, isAdmin, isLoading, hasAccess,
      canViewReports, canViewArchive, canViewMap, articlesLimit,
      refreshSubscription, signOut: handleSignOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { AuthContext };
