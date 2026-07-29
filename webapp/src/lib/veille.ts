// Dérivations du tableau de bord à partir de la collecte RSS réelle.
//
// Source unique : la table collecte_partagee (id='global'), alimentée par
// src/lib/collecte/doCollect.ts — exactement le cache que lit déjà la page
// Flux. Toutes les vues du tableau de bord en descendent, plus aucune ne lit
// src/mocks/dashboard.ts.
//
// Règle tenue partout : rien n'est inventé. Un champ qui n'existe pas dans
// l'article réel n'est pas rempli au jugé — il est soit calculé à partir de
// données présentes, soit supprimé de la vue. Les écarts assumés sont
// signalés au cas par cas ci-dessous.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { nomPays, zonePays, NB_PAYS_COUVERTS } from '@/lib/pays';
import type { RealArticle } from '@/lib/collecte/fetchRss';
import type { Level, Category } from '@/lib/collecte/classify';

const COLLECTE_PARTAGEE_ID = 'global';
const JOUR_MS = 24 * 60 * 60 * 1000;

export type Severity = 'critical' | 'high' | 'medium' | 'low';

/** Les niveaux de la classification réelle, tels que les vues les nomment. */
const SEVERITY_PAR_NIVEAU: Record<Level, Severity> = {
  crit: 'critical',
  high: 'high',
  mod: 'medium',
  ok: 'low',
};

const LABEL_CATEGORIE: Record<Category, string> = {
  securite: 'Sécurité',
  humanitaire: 'Humanitaire',
  politique: 'Politique',
  economique: 'Économie',
  sport: 'Sport',
  culture: 'Culture',
};

const IMPACT_PAR_SEVERITE: Record<Severity, string> = {
  critical: 'Critique',
  high: 'Élevé',
  medium: 'Modéré',
  low: 'Faible',
};

/** Catégories retenues pour la veille sûreté : sport et culture en sont exclus. */
const CATEGORIES_SURETE: Category[] = ['securite', 'humanitaire', 'politique', 'economique'];

function severite(a: RealArticle): Severity {
  return SEVERITY_PAR_NIVEAU[a.level] ?? 'low';
}

function sourceLisible(a: RealArticle): string {
  return a.primary || a.srcs?.[0] || 'Source inconnue';
}

// ─── Chargement partagé ────────────────────────────────────────────────────
// Les six blocs de la vue d'ensemble sont montés ensemble : sans cache, ils
// déclencheraient six requêtes identiques. Un seul chargement est mutualisé.

export interface EtatVeille {
  articles: RealArticle[];
  majLe: string | null;
  loading: boolean;
  error: string | null;
}

let cache: { articles: RealArticle[]; majLe: string | null } | null = null;
let chargement: Promise<void> | null = null;
const abonnes = new Set<(e: EtatVeille) => void>();
let etat: EtatVeille = { articles: [], majLe: null, loading: true, error: null };

function diffuser(next: EtatVeille) {
  etat = next;
  abonnes.forEach((fn) => fn(etat));
}

async function charger(): Promise<void> {
  const { data, error } = await supabase
    .from('collecte_partagee')
    .select('articles, updated_at')
    .eq('id', COLLECTE_PARTAGEE_ID)
    .maybeSingle();

  if (error) {
    diffuser({ articles: [], majLe: null, loading: false, error: error.message });
    return;
  }

  const articles = ((data?.articles as RealArticle[] | null) ?? []).filter(
    (a) => a && typeof a.pubDate === 'number',
  );
  cache = { articles, majLe: data?.updated_at ?? null };
  diffuser({ ...cache, loading: false, error: null });
}

/** Force un rechargement au prochain appel — après une collecte, typiquement. */
export function invaliderVeille() {
  cache = null;
  chargement = null;
}

export function useVeille(): EtatVeille & { recharger: () => void } {
  const [local, setLocal] = useState<EtatVeille>(() =>
    cache ? { ...cache, loading: false, error: null } : etat,
  );

  useEffect(() => {
    abonnes.add(setLocal);
    if (cache) {
      setLocal({ ...cache, loading: false, error: null });
    } else {
      chargement ??= charger();
    }
    return () => {
      abonnes.delete(setLocal);
    };
  }, []);

  return {
    ...local,
    recharger: () => {
      invaliderVeille();
      diffuser({ articles: [], majLe: null, loading: true, error: null });
      chargement = charger();
    },
  };
}

// ─── Alertes ───────────────────────────────────────────────────────────────

export interface VeilleAlerte {
  id: string;
  severity: Severity;
  title: string;
  country: string;
  region: string;
  timestamp: string;
  source: string;
  category: string;
  /**
   * Toujours 'active' : la collecte RSS ne porte aucun cycle de vie
   * (accusé de réception, résolution). Un vrai statut suppose la table
   * public.alerts et une action d'opérateur.
   */
  status: 'active';
  impact: string;
  url: string;
}

/** Les alertes sont les signaux critiques ou élevés hors sport et culture. */
export function alertes(articles: RealArticle[]): VeilleAlerte[] {
  return articles
    .filter((a) => (a.level === 'crit' || a.level === 'high') && CATEGORIES_SURETE.includes(a.cat))
    .sort((a, b) => b.pubDate - a.pubDate)
    .map((a) => ({
      id: a.id,
      severity: severite(a),
      title: a.title,
      country: nomPays(a.cy),
      region: zonePays(a.cy),
      timestamp: new Date(a.pubDate).toISOString(),
      source: sourceLisible(a),
      category: LABEL_CATEGORIE[a.cat],
      status: 'active' as const,
      impact: IMPACT_PAR_SEVERITE[severite(a)],
      url: a.url,
    }));
}

// ─── Flux ──────────────────────────────────────────────────────────────────

export interface VeilleFlux {
  id: string;
  title: string;
  source: string;
  timestamp: string;
  category: string;
  country: string;
  url: string;
}

export function flux(articles: RealArticle[], limite = 6): VeilleFlux[] {
  return articles
    .slice()
    .sort((a, b) => b.pubDate - a.pubDate)
    .slice(0, limite)
    .map((a) => ({
      id: a.id,
      title: a.title,
      source: sourceLisible(a),
      timestamp: new Date(a.pubDate).toISOString(),
      category: LABEL_CATEGORIE[a.cat],
      country: nomPays(a.cy),
      url: a.url,
    }));
}

// ─── Risque pays ───────────────────────────────────────────────────────────

export interface VeillePays {
  country: string;
  code: string;
  region: string;
  risk: Severity;
  alerts: number;
  /** Écart du volume d'alertes entre les dernières 24 h et les 24 h précédentes. */
  trend: string;
}

const RANG_SEVERITE: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 };

export function risquePays(articles: RealArticle[]): VeillePays[] {
  const maintenant = Date.now();
  const parPays = new Map<
    string,
    { pire: Severity; alertes: number; recent: number; precedent: number }
  >();

  for (const a of articles) {
    if (a.cy === 'INT' || !CATEGORIES_SURETE.includes(a.cat)) continue;

    const sev = severite(a);
    const entree = parPays.get(a.cy) ?? { pire: 'low' as Severity, alertes: 0, recent: 0, precedent: 0 };

    if (RANG_SEVERITE[sev] > RANG_SEVERITE[entree.pire]) entree.pire = sev;

    if (sev === 'critical' || sev === 'high') {
      entree.alertes += 1;
      const age = maintenant - a.pubDate;
      if (age < JOUR_MS) entree.recent += 1;
      else if (age < 2 * JOUR_MS) entree.precedent += 1;
    }
    parPays.set(a.cy, entree);
  }

  return [...parPays.entries()]
    .map(([code, e]) => {
      const delta = e.recent - e.precedent;
      return {
        country: nomPays(code),
        code,
        region: zonePays(code),
        risk: e.pire,
        alerts: e.alertes,
        trend: delta > 0 ? `+${delta}` : String(delta),
      };
    })
    .sort(
      (a, b) => RANG_SEVERITE[b.risk] - RANG_SEVERITE[a.risk] || b.alerts - a.alerts,
    );
}

// ─── Fil chronologique ─────────────────────────────────────────────────────

export interface VeilleEvenement {
  id: string;
  time: string;
  title: string;
  type: 'alert' | 'feed' | 'correlation';
  severity: Severity;
}

export function chronologie(articles: RealArticle[], limite = 8): VeilleEvenement[] {
  return articles
    .slice()
    .sort((a, b) => b.pubDate - a.pubDate)
    .slice(0, limite)
    .map((a) => {
      const sev = severite(a);
      const type: VeilleEvenement['type'] =
        a.crosses?.length > 0 ? 'correlation' : sev === 'critical' || sev === 'high' ? 'alert' : 'feed';
      return {
        id: a.id,
        time: new Date(a.pubDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        title: a.title,
        type,
        severity: sev,
      };
    });
}

// ─── Activité sur 7 jours ──────────────────────────────────────────────────

export interface VeilleActivite {
  day: string;
  alerts: number;
  feeds: number;
}

export function activite(articles: RealArticle[]): VeilleActivite[] {
  const jours: VeilleActivite[] = [];
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const debut = new Date(aujourdhui.getTime() - i * JOUR_MS);
    const fin = debut.getTime() + JOUR_MS;
    const duJour = articles.filter((a) => a.pubDate >= debut.getTime() && a.pubDate < fin);

    jours.push({
      day: debut.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
      alerts: duJour.filter((a) => a.level === 'crit' || a.level === 'high').length,
      feeds: duJour.length,
    });
  }
  return jours;
}

// ─── Indicateurs ───────────────────────────────────────────────────────────

export interface VeilleStats {
  activeAlerts: number;
  newFeeds24h: number;
  countriesInAlert: number;
  correlationsDetected: number;
  totalMonitored: number;
}

export function stats(articles: RealArticle[]): VeilleStats {
  const seuil = Date.now() - JOUR_MS;
  const alertesCourantes = alertes(articles);

  return {
    activeAlerts: alertesCourantes.length,
    newFeeds24h: articles.filter((a) => a.pubDate >= seuil).length,
    // Les alertes panafricaines (cy='INT') sont bien des alertes, mais ne
    // désignent pas un pays : elles ne gonflent pas le compteur.
    countriesInAlert: new Set(
      alertesCourantes.map((a) => a.country).filter((c) => c !== 'International'),
    ).size,
    correlationsDetected: correlations(articles).length,
    totalMonitored: NB_PAYS_COUVERTS,
  };
}

// ─── Corrélations ──────────────────────────────────────────────────────────

export interface VeilleCorrelation {
  id: string;
  alertId: string;
  alertTitle: string;
  alertSeverity: Severity;
  country: string;
  region: string;
  type: 'direct' | 'cluster' | 'chain';
  strength: 'strong' | 'medium' | 'low';
  description: string;
  /** Noms des sources ayant rapporté le même fait (champ `crosses`). */
  sources: string[];
  detectedAt: string;
  /**
   * Score de fiabilité de la source, porté tel quel par la collecte —
   * ce n'est pas une probabilité calculée sur la corrélation elle-même.
   */
  confidence: number;
}

/**
 * Une corrélation réelle = un fait rapporté par PLUSIEURS sources
 * indépendantes. `crosses` porte les noms de sources qui ont remonté le
 * même article (voir `crosses: [src.n]` dans collecte/fetchRss.ts) — ce
 * n'est pas une liste de pays, malgré ce que son nom pourrait laisser
 * croire. Un seul rapporteur n'est pas une corrélation : sur une collecte
 * réelle, 600 des 645 articles n'ont qu'une source, les retenir tous
 * reviendrait à appeler « corrélation » n'importe quelle dépêche.
 */
export function correlations(articles: RealArticle[]): VeilleCorrelation[] {
  return articles
    .filter((a) => (a.crosses?.length ?? 0) >= 2 && CATEGORIES_SURETE.includes(a.cat))
    .sort((a, b) => b.pubDate - a.pubDate)
    .map((a) => {
      const n = a.crosses.length;
      return {
        id: `COR-${a.id}`,
        alertId: a.id,
        alertTitle: a.title,
        alertSeverity: severite(a),
        country: nomPays(a.cy),
        region: zonePays(a.cy),
        type: n >= 4 ? 'chain' : n === 3 ? 'cluster' : 'direct',
        strength: n >= 4 ? 'strong' : n === 3 ? 'medium' : 'low',
        description: a.analysis || a.title,
        sources: a.crosses,
        detectedAt: new Date(a.pubDate).toISOString(),
        confidence: a.score,
      };
    });
}
