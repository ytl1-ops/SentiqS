import { useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    // Le nom affiche vient du profil reel (table profiles, colonne data.name)
    // quand il existe, sinon on retombe sur l'email de la session — meme
    // schema que web/SentiqS_Web.html (role/status/data jsonb), pas le
    // modele `subscribers` de la maquette d'origine.
    const loadProfileName = async (userId: string, fallbackEmail: string) => {
      setUserName(fallbackEmail);
      const { data: profile } = await supabase
        .from('profiles')
        .select('data')
        .eq('id', userId)
        .maybeSingle();
      const name = (profile?.data as { name?: string } | null)?.name;
      if (name) setUserName(name);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfileName(session.user.id, session.user.email ?? '');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfileName(session.user.id, session.user.email ?? '');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }, [navigate]);

  const pathToActive = (path: string): string => {
    if (path === '/dashboard') return 'overview';
    if (path.startsWith('/dashboard/alerts')) return 'alerts';
    if (path.startsWith('/dashboard/feeds')) return 'feeds';
    if (path.startsWith('/dashboard/countries')) return 'countries';
    if (path.startsWith('/dashboard/correlations')) return 'correlations';
    if (path.startsWith('/dashboard/reports')) return 'reports';
    if (path.startsWith('/dashboard/agenda')) return 'agenda';
    if (path.startsWith('/dashboard/settings')) return 'settings';
    return 'overview';
  };

  return (
    <div className="min-h-screen bg-sentiqs-gray-bg flex flex-col">
      <TopBar onLogout={handleLogout} userName={userName} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeItem={pathToActive(location.pathname)} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />

          <div className="flex items-center justify-between py-3 mt-5 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">
                Veille Active
              </span>
              <span className="text-[10px] text-sentiqs-gray-text">• 54 pays • Temps réel</span>
            </div>
            <span className="text-[10px] text-sentiqs-gray-text">
              Dernière mise à jour : {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}