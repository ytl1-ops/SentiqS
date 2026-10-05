import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { zonePays } from '@/lib/pays';

// Lit country_posture_state — le niveau d'alerte pays AUTHENTIQUE, calcule
// par la fonction Edge score-countries (socle : feeds des 10 derniers jours,
// ponderation gravite/verification/recence/portee, seuils ROUGE/ORANGE/
// JAUNE/VERT avec confirmation ROUGE a 2 incidents critiques corrobores —
// voir app/sentinel-app/supabase/functions/score-countries). Remplace les
// calculs locaux (risquePays() dans veille.ts, deriveAlertLevels() dans
// useAlertLevels.ts) qui ne regardaient que le Flux du jour et ignoraient
// tout pays sans article recent.
//
// Echelle : vert / jaune / orange / rouge / non_cote — PAS de "marron".
// C'est l'echelle propre a score-countries, independante des 5 niveaux
// (vert/jaune/orange/marron/rouge) du site principal (web/SentiqS_Web.html,
// calcAlertScore) : les deux systemes ne partagent ni la meme base de
// donnees Supabase ni le meme moteur de calcul (voir CLAUDE.md, panne du
// 05/10/2026 — deux projets Supabase distincts). "non_cote" n'est pas un
// niveau de risque : c'est l'absence de signal recent, affiche separement
// pour ne pas la confondre avec "vert" (silence n'est pas calme).
export type PostureLevel = 'vert' | 'jaune' | 'orange' | 'rouge' | 'non_cote';

export interface CountryPosture {
  code: string;
  name: string;
  region: string;
  level: PostureLevel;
  score: number;
  coverageStatus: string;
  sourcesConsultedCount: number;
  lastCollectionAt: string | null;
  isLocked: boolean;
  /** Incidents critiques + eleves du dernier calcul (score_calculations.factors). 0 si indisponible. */
  alerts: number;
  /** Ecart de score entre les deux derniers calculs connus ("+N" / "-N" / "0"). */
  trend: string;
}

export const RANG_NIVEAU: Record<PostureLevel, number> = {
  rouge: 4, orange: 3, jaune: 2, vert: 1, non_cote: 0,
};

interface ScoreCalcRow {
  country_code: string;
  computed_at: string;
  score: number;
  factors: { n_critiques?: number; n_eleves?: number } | null;
}

// Echantillon recent, pas une table complete : 300 lignes aux 54 pays et
// une collecte toutes les ~30 min couvrent large les deux derniers calculs
// par pays necessaires au calcul de tendance ci-dessous. Degrade proprement
// (trend/alerts a 0) si un pays n'y figure pas plutot que d'echouer.
const ECHANTILLON_CALCULS = 300;

export function useCountryPosture() {
  const [postures, setPostures] = useState<CountryPosture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('country_posture_state')
        .select('country_code, country_name, level, score, coverage_status, sources_consulted_count, last_collection_at, is_locked');
      if (err) throw err;

      // Deux derniers calculs par pays, pour alerts (dernier) et trend
      // (dernier - precedent) — best-effort : le niveau affiche ne depend
      // JAMAIS de cette seconde requete, seulement ces deux champs annexes.
      const derniersCalculsParPays = new Map<string, ScoreCalcRow[]>();
      try {
        const { data: calculs } = await supabase
          .from('score_calculations')
          .select('country_code, computed_at, score, factors')
          .order('computed_at', { ascending: false })
          .limit(ECHANTILLON_CALCULS);
        (calculs || []).forEach((c) => {
          const liste = derniersCalculsParPays.get(c.country_code) || [];
          if (liste.length < 2) {
            liste.push(c as ScoreCalcRow);
            derniersCalculsParPays.set(c.country_code, liste);
          }
        });
      } catch {
        // trend/alerts resteront a 0 — le niveau authentique reste affiche
      }

      const lignes: CountryPosture[] = (data || []).map((p) => {
        const calculs = derniersCalculsParPays.get(p.country_code) || [];
        const [recent, precedent] = calculs;
        const facteurs = recent?.factors;
        const alerts = (facteurs?.n_critiques ?? 0) + (facteurs?.n_eleves ?? 0);
        const delta = recent && precedent ? Math.round(recent.score - precedent.score) : 0;

        return {
          code: p.country_code,
          name: p.country_name,
          region: zonePays(p.country_code),
          level: (p.level as PostureLevel) || 'non_cote',
          score: Number(p.score) || 0,
          coverageStatus: p.coverage_status || 'aucune_donnee_recente',
          sourcesConsultedCount: p.sources_consulted_count || 0,
          lastCollectionAt: p.last_collection_at,
          isLocked: !!p.is_locked,
          alerts,
          trend: delta > 0 ? `+${delta}` : String(delta),
        };
      }).sort((a, b) => RANG_NIVEAU[b.level] - RANG_NIVEAU[a.level] || b.score - a.score);

      setPostures(lignes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  return { postures, loading, error, recharger: charger };
}
