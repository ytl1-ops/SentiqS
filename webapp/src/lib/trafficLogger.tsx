import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

/**
 * Enregistre une visite dans public.traffic_logs à chaque changement de route.
 *
 * La ligne est écrite au *départ* de la page (navigation interne ou fermeture
 * de l'onglet) afin que duration_seconds reflète le temps réellement passé.
 *
 * country et ip_hash restent nuls : ils demandent une résolution géographique
 * de l'IP, qui ne peut se faire que côté serveur. Le panneau Trafic affiche
 * « Inconnu » tant qu'une edge function ne les renseigne pas.
 */

function currentRegion(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // "Africa/Abidjan" → "Africa" ; les fuseaux sans continent sont ignorés.
    const continent = tz?.split('/')[0];
    return continent && continent !== tz ? continent : null;
  } catch {
    return null;
  }
}

async function logVisit(pagePath: string, startedAt: number) {
  const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
  // Un passage éclair (redirection, remontage React) n'est pas une visite.
  if (durationSeconds < 1) return;

  try {
    await supabase.from('traffic_logs').insert({
      page_path: pagePath,
      region: currentRegion(),
      user_agent: navigator.userAgent,
      referrer: document.referrer || null,
      duration_seconds: durationSeconds,
    });
  } catch {
    // La télémétrie ne doit jamais casser la navigation.
  }
}

export function TrafficLogger() {
  const { pathname } = useLocation();
  const startedAt = useRef(Date.now());

  useEffect(() => {
    startedAt.current = Date.now();
    const path = pathname;

    const onPageHide = () => logVisit(path, startedAt.current);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      logVisit(path, startedAt.current);
    };
  }, [pathname]);

  return null;
}
