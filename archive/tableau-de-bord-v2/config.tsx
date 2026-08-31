import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { syncPostureChanges } from '@/hooks/usePostureHistory';

export interface SupabaseAlert {
  id: string;
  severity: string;
  title: string;
  country: string;
  region: string;
  department: string;
  locality: string;
  timestamp: string;
  source: string;
  category: string;
  status: string;
  aggravating_factors: string[] | null;
}

export interface SupabaseFeed {
  id: string;
  title: string;
  country: string;
  category: string;
  source: string;
  timestamp: string;
  source_url: string | null;
  verification_status: string;
  summary?: string;
  parent_feed_id?: string | null;
}

export interface TriggeringIncident {
  id: string;
  title: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'alert' | 'feed';
  locality?: string;
  source: string;
  verified: boolean;
  category: string;
}

export interface CountryAlertLevel {
  country: string;
  countryCode: string;
  level: 'rouge' | 'orange' | 'jaune' | 'vert';
  levelLabel: string;
  score: number;
  rawScore: number;
  incidents: number;
  aggravantsCount: number;
  verifiedCount: number;
  rssCount: number;
  factorsCount: number;
  latestIncidentAt: string | null;
  latestIncidentVerifiedAt: string | null;
  incidentsBySeverity: { critical: number; high: number; medium: number; low: number };
  triggeringIncidents: TriggeringIncident[];
  aggravatingFactorsBreakdown: Record<string, number>;
  protectionMeasures: string[];
  trend: 'up' | 'down' | 'stable';
  trendDelta: number;
  freshnessHours: number | null;
}

export interface FeedCluster {
  canonicalId: string;
  duplicateIds: string[];
  canonicalTitle: string;
  sources: string[];
  country: string;
}

const COUNTRY_CODES: Record<string, string> = {
  'Afrique du Sud': 'ZA', Algérie: 'DZ', Angola: 'AO', Bénin: 'BJ', Botswana: 'BW',
  'Burkina Faso': 'BF', Burundi: 'BI', Cameroun: 'CM', 'Cap-Vert': 'CV', 'Centrafrique': 'CF',
  Comores: 'KM', Congo: 'CG', 'Côte d\'Ivoire': 'CI', Djibouti: 'DJ', Égypte: 'EG',
  'Érythrée': 'ER', Éthiopie: 'ET', Gabon: 'GA', Gambie: 'GM', Ghana: 'GH',
  Guinée: 'GN', 'Guinée-Bissau': 'GW', 'Guinée Équatoriale': 'GQ', Kenya: 'KE', Lesotho: 'LS',
  Libéria: 'LR', Libye: 'LY', Madagascar: 'MG', Malawi: 'MW', Mali: 'ML',
  Maroc: 'MA', Maurice: 'MU', Mauritanie: 'MR', Mozambique: 'MZ', Namibie: 'NA',
  Niger: 'NE', Nigeria: 'NG', Ouganda: 'UG', RDC: 'CD', Rwanda: 'RW',
  'Sao Tomé-et-Principe': 'ST', Sénégal: 'SN', Seychelles: 'SC', 'Sierra Leone': 'SL', Somalie: 'SO',
  Soudan: 'SD', 'Soudan du Sud': 'SS', 'Éswatini': 'SZ', Swaziland: 'SZ', Tanzanie: 'TZ', Tchad: 'TD',
  Togo: 'TG', Tunisie: 'TN', Zambie: 'ZM', Zimbabwe: 'ZW',
};

/** Reverse mapping: ISO code → country name */
export const COUNTRY_NAME_BY_CODE: Record<string, string> = {};
for (const [name, code] of Object.entries(COUNTRY_CODES)) {
  if (!COUNTRY_NAME_BY_CODE[code]) {
    COUNTRY_NAME_BY_CODE[code] = name;
  }
}

const AFRICA_54: string[] = [
  'Afrique du Sud', 'Algérie', 'Angola', 'Bénin', 'Botswana',
  'Burkina Faso', 'Burundi', 'Cameroun', 'Cap-Vert', 'Centrafrique',
  'Comores', 'Congo', 'Côte d\'Ivoire', 'Djibouti', 'Égypte',
  'Érythrée', 'Éthiopie', 'Gabon', 'Gambie', 'Ghana',
  'Guinée', 'Guinée-Bissau', 'Guinée Équatoriale', 'Kenya', 'Lesotho',
  'Libéria', 'Libye', 'Madagascar', 'Malawi', 'Mali',
  'Maroc', 'Maurice', 'Mauritanie', 'Mozambique', 'Namibie',
  'Niger', 'Nigeria', 'Ouganda', 'RDC', 'Rwanda',
  'Sao Tomé-et-Principe', 'Sénégal', 'Seychelles', 'Sierra Leone', 'Somalie',
  'Soudan', 'Soudan du Sud', 'Éswatini', 'Tanzanie', 'Tchad',
  'Togo', 'Tunisie', 'Zambie', 'Zimbabwe',
];

const GENERIC_REGIONS = new Set([
  'Afrique', 'Afrique subsaharienne', 'Afrique orientale', 'Afrique occidentale',
  'Afrique centrale', 'Afrique du Nord', 'Afrique australe', 'Sahel', 'Corne de l\'Afrique',
  'Afrique de l\'Est', 'Afrique de l\'Ouest', 'Afrique du Nord-Est',
]);

const DISPUTED_TERRITORIES = new Set([
  'Somaliland', 'Sahara Occidental', 'Sahara occidental',
]);

function normalizeCountryName(name: string): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (GENERIC_REGIONS.has(trimmed)) return null;
  if (DISPUTED_TERRITORIES.has(trimmed)) return null;

  const aliases: Record<string, string> = {
    'RD Congo': 'RDC',
    'RDCongo': 'RDC',
    'Congo-Kinshasa': 'RDC',
    'Congo Kinshasa': 'RDC',
    'Congo Brazzaville': 'Congo',
    'Congo-Brazzaville': 'Congo',
    "Côte d Ivoire": "Côte d'Ivoire",
    'Cote d\'Ivoire': "Côte d'Ivoire",
    'Cote d Ivoire': "Côte d'Ivoire",
    'Cap Vert': 'Cap-Vert',
    'Guinee': 'Guinée',
    'Guinée Bissau': 'Guinée-Bissau',
    'Guinee Bissau': 'Guinée-Bissau',
    'Guinée equatoriale': 'Guinée Équatoriale',
    'Guinee Equatoriale': 'Guinée Équatoriale',
    'Sao Tome': 'Sao Tomé-et-Principe',
    'Sao Tome et Principe': 'Sao Tomé-et-Principe',
    'Sao Tome-et-Principe': 'Sao Tomé-et-Principe',
    'Sierra Leone': 'Sierra Leone',
    'Soudan du sud': 'Soudan du Sud',
    'South Sudan': 'Soudan du Sud',
    'Swaziland': 'Éswatini',
    'Eswatini': 'Éswatini',
    'Tanzania': 'Tanzanie',
    'Zimbabwe': 'Zimbabwe',
    'Zambie': 'Zambie',
    'Algerie': 'Algérie',
    'Egypte': 'Égypte',
    'Erythree': 'Érythrée',
    'Ethiopie': 'Éthiopie',
    'RCA': 'Centrafrique',
  };

  if (aliases[trimmed]) return aliases[trimmed];
  if (COUNTRY_CODES[trimmed]) return trimmed;

  const lower = trimmed.toLowerCase();
  for (const [canonical] of Object.entries(COUNTRY_CODES)) {
    if (canonical.toLowerCase() === lower) return canonical;
  }

  return null;
}

/* ============================================================
   SCORING RÉALISTE — SOURCES PONÉRÉES PAR FIABILITÉ ET FRAÎCHEUR
   ============================================================
   //
   // ALERTS STRUCTURÉES (analystes) : poids ×1.5 vs feeds RSS
   //   critical → 12 pts   |   high → 8   |   medium → 3   |   low → 1
   //
   // FEEDS RSS : poids standard
   //   critical → 8 pts    |   high → 5   |   medium → 2   |   low → 0.5
   //
   // DÉCLIN TEMPOREL (feeds uniquement) :
   //   0–24h  → 100%   |   24–72h → 80%   |   72h–7j → 50%   |   7j–30j → 20%
   //
   // SEUILS :
   //   ROUGE  ≥ 70   |   ORANGE ≥ 35   |   JAUNE ≥ 10   |   VERT < 10
   //
   // STICKY : un pays ≥ orange reste au moins jaune (10 pts) pendant 7 jours
   ============================================================ */

const ALERT_WEIGHTS: Record<string, number> = {
  critical: 12,
  high: 8,
  medium: 3,
  low: 1,
};

const FEED_WEIGHTS: Record<string, number> = {
  critical: 8,
  high: 5,
  medium: 2,
  low: 0.5,
};

function getTemporalWeight(timestamp: string, nowMs: number): number {
  const ageHours = (nowMs - new Date(timestamp).getTime()) / 3600000;
  if (ageHours <= 24) return 1.0;
  if (ageHours <= 72) return 0.8;
  if (ageHours <= 168) return 0.5;   // 7 jours
  if (ageHours <= 720) return 0.2;   // 30 jours
  return 0.0;
}

const AGGRAVATING_BONUS: Record<string, number> = {
  humanitarian_break: 3,
  capital_attack: 4,
  diplomatic_break: 2,
  flooding: 1,
};

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 8,
  high: 5,
  medium: 2,
  low: 0.5,
};

function getFeedSeverity(feed: SupabaseFeed): 'critical' | 'high' | 'medium' | 'low' {
  const fullText = `${feed.title} ${feed.summary || ''}`.toLowerCase();

  // --- NÉGATIFS DE CONTEXTE : réduire la sévérité si c'est une nouvelle positive ---
  const positiveContext = /\b(réouverture|rouverture|reprise|retour\s+à\s+la\s+normale|calme\s+revenu|tensions\s+apaisées|cessez-le-feu\s+respecté|accord\s+de\s+paix\s+signé|libération\s+des\s+otages)\b/i;
  if (positiveContext.test(fullText)) return 'low';

  const criticalPatterns: RegExp[] = [
    /\b(massacre|génocide|nettoyage\s+ethnique|crimes?\s+contre\s+l'humanité|cour\s+pénale\s+internationale)\b/i,
    /\b(attentat-suicide|véhicule\s+piégé|ceinture\s+explosive)\b/i,
    /\b(exécutions?\s+sommaires?|exécutions?\s+extrajudiciaires?|charnier)\b/i,
    // Coup d'état ACTIF uniquement — pas "depuis le coup d'état" ou "avant le coup d'état"
    /\b(coup\s+d'état\s+en\s+cours|coup\s+d'état\s+immédiat| tentative\s+de\s+coup\s+d'état|putsch\s+en\s+cours)\b/i,
    /\b(guerre\s+civile\s+active|conflit\s+armé\s+généralisé|insurrection\s+générale)\b/i,
    /\b(famine\s+déclarée|urgence\s+humanitaire\s+catastrophique)\b/i,
    /\b(missile\s+balistique|bombardement\s+aérien\s+massif)\b/i,
    /\b(ville\s+assiégée|siège\s+total|blocus\s+complet)\b/i,
    /\b(groupe\s+armé\s+a\s+pris\s+le\s+contrôle|djihadistes?\s+contrôlent|rebelles?\s+contrôlent)\b/i,
  ];

  const highPatterns: RegExp[] = [
    /\b(attaque\s+terroriste|groupe\s+armé|djihadiste|boko\s+haram|aqmi|état\s+islamique|m23|rsf|iswap|isgs|j\snim|ansaroul\s+islam)\b/i,
    /\b(embuscade|affrontements?\s+armés?|combats?\s+intenses?|offensive\s+militaire)\b/i,
    /\b(kidnapping|enlèvement|disparition\s+forcée|otage)\b/i,
    /\b(manifestations?\s+violentes?|émeutes?|répression\s+sanglante)\b/i,
    /\b(explosion|déflagration|engin\s+explosif|grenade|eei|ied|mine\s+antipersonnel)\b/i,
    /\b(assassinat|meurtre\s+politique|homicide\s+ciblé)\b/i,
    /\b(déplacement\s+massif|réfugiés?\s+\d{4,}|déplacés?\s+internes?)\b/i,
    /\b(état\s+d'urgence|couvre-feu|loi\s+martiale)\b/i,
    /\b(opération\s+militaire|frappe\s+aérienne|bombardement|drone\s+armé)\b/i,
    /\b(sanctions?\s+internationales?|embargo|rupture\s+diplomatique)\b/i,
    /\b(pillage|saccage|vandalisme\s+généralisé)\b/i,
    /\b(prise\s+d'otages?|enlèvement\s+d'écoliers?|kidnapping\s+de\s+masse)\b/i,
    /\b(tirs?\s+de\s+mortier|roquette|lance-roquettes?|artillerie\s+lourde)\b/i,
    /\b(crimes?\s+de\s+guerre|violations?\s+graves?\s+des\s+droits)\b/i,
    /\b(crise\s+constitutionnelle\s+majeure|dissolution\s+du\s+parlement|censure\s+du\s+gouvernement)\b/i,
  ];

  const mediumPatterns: RegExp[] = [
    /\b(manifestation|protestation|grève\s+générale|mobilisation)\b/i,
    /\b(tension|instabilité|crise\s+politique|crise\s+gouvernementale)\b/i,
    /\b(affrontement|heurts?|échauffourées?|incidents?\s+violents?)\b/i,
    /\b(trafics?\s+illicites?|contrebande|trafic\s+d'armes?)\b/i,
    /\b(mouvement\s+de\s+troupes?|déploiement\s+militaire|renforcement\s+sécuritaire)\b/i,
    /\b(cyberattaque|ransomware|violation\s+de\s+données)\b/i,
    /\b(épidémie|alerte\s+sanitaire|contamination)\b/i,
    /\b(inondation|sécheresse\s+sévère|cyclone|catastrophe\s+naturelle)\b/i,
    /\b(pénurie|crise\s+alimentaire|insécurité\s+alimentaire)\b/i,
    /\b(corruption\s+majeure|scandale\s+financier|détournement\s+de\s+fonds)\b/i,
    /\b(grève\s+des\s+transports?|blocage\s+routier|barrage\s+filtrant)\b/i,
    /\b(négociations?\s+de\s+paix|médiation|cessez-le-feu\s+fragile)\b/i,
    /\b(réforme\s+contestée|projet\s+de\s+loi\s+polémique|référendum\s+tendu)\b/i,
    /\b(dette\s+souveraine|crise\s+financière|inflation\s+galopante)\b/i,
  ];

  for (const pattern of criticalPatterns) {
    if (pattern.test(fullText)) return 'critical';
  }
  for (const pattern of highPatterns) {
    if (pattern.test(fullText)) return 'high';
  }
  for (const pattern of mediumPatterns) {
    if (pattern.test(fullText)) return 'medium';
  }

  const highCats = ['Sécurité', 'Terrorisme', 'Défense', 'Trafics illicites', 'sécurité', 'terrorisme'];
  const medCats = ['Humanitaire', 'Politique', 'Diplomatie', 'Cyber', 'Santé', 'Environnement', 'Social', 'humanitaire', 'politique', 'diplomatie', 'social'];

  if (highCats.includes(feed.category)) return 'high';
  if (medCats.includes(feed.category)) return 'medium';
  return 'low';
}

function calculateAlertLevel(score: number): { level: CountryAlertLevel['level']; label: string } {
  if (score >= 70) return { level: 'rouge', label: 'Conflit majeur' };
  if (score >= 35) return { level: 'orange', label: 'Risque élevé' };
  if (score >= 10) return { level: 'jaune', label: 'Précautions renforcées' };
  return { level: 'vert', label: 'Situation normale' };
}

function getProtectionMeasures(level: CountryAlertLevel['level']): string[] {
  const allMeasures = [
    'Évacuation ou confinement strict immédiat',
    'Point de rassemblement sécurisé actif',
    'Contact ambassade / consulat sous 1h',
    'Suspension des déplacements non essentiels',
    'Rappel du personnel en zone A',
  ];
  const countMap: Record<string, number> = { rouge: 5, orange: 4, jaune: 3, vert: 1 };
  return allMeasures.slice(0, countMap[level] || 1);
}

const LEVEL_COLORS: Record<string, string> = {
  rouge: 'bg-red-700 text-white border-red-800',
  orange: 'bg-orange-600 text-white border-orange-700',
  jaune: 'bg-yellow-500 text-yellow-950 border-yellow-600',
  vert: 'bg-emerald-600 text-white border-emerald-700',
};

const LEVEL_BG: Record<string, string> = {
  rouge: 'bg-red-50 border-red-200',
  orange: 'bg-orange-50 border-orange-200',
  jaune: 'bg-yellow-50 border-yellow-200',
  vert: 'bg-emerald-50 border-emerald-200',
};

const LEVEL_DOT: Record<string, string> = {
  rouge: 'bg-red-500',
  orange: 'bg-orange-500',
  jaune: 'bg-yellow-500',
  vert: 'bg-emerald-500',
};

const LEVEL_HEADER: Record<string, string> = {
  rouge: 'bg-red-700',
  orange: 'bg-orange-600',
  jaune: 'bg-yellow-500',
  vert: 'bg-emerald-600',
};

const LEVEL_HEADER_TEXT: Record<string, string> = {
  rouge: 'text-white',
  orange: 'text-white',
  jaune: 'text-yellow-950',
  vert: 'text-white',
};

const LEVEL_BADGE_BORDERED: Record<string, string> = {
  rouge: 'bg-red-100 text-red-700 border-red-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  jaune: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  vert: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export { LEVEL_COLORS, LEVEL_BG, LEVEL_DOT, LEVEL_HEADER, LEVEL_HEADER_TEXT, LEVEL_BADGE_BORDERED, AFRICA_54, COUNTRY_CODES, normalizeCountryName };

// ============================================================
// DÉDUPLICATION DES FEEDS
// Empêche qu'un même événement rapporté par plusieurs sources
// soit compté plusieurs fois dans le calcul des scores.
// ============================================================

const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'en', 'à', 'au', 'aux',
  'et', 'ou', 'dans', 'sur', 'pour', 'par', 'avec', 'sans', 'son', 'sa', 'ses',
  'ce', 'cet', 'cette', 'ces', 'est', 'sont', 'a', 'ont', 'plus', 'moins',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'been', 'be', 'of', 'in',
  'to', 'for', 'with', 'on', 'at', 'by', 'from', 'and', 'or', 'as', 'it',
  'its', 'that', 'this', 'these', 'those', 'has', 'have', 'had', 'not', 'no',
  'après', 'avant', 'entre', 'pendant', 'depuis', 'selon', 'contre',
  'plusieurs', 'nombreux', 'nouveau', 'nouvelle', 'fait', 'suite',
  'afrique', 'africa', 'pays', 'country', 'mali', 'niger', 'burkina',
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWordSet(text: string): Set<string> {
  const normalized = normalizeText(text);
  return new Set(
    normalized.split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

const VERIFICATION_PRIORITY: Record<string, number> = {
  confirmed: 3,
  verified: 2,
  unverified: 1,
  rumor: 0,
};

export function deduplicateFeeds(feeds: SupabaseFeed[]): {
  clusters: FeedCluster[];
  canonicalFeeds: SupabaseFeed[];
} {
  if (feeds.length === 0) return { clusters: [], canonicalFeeds: [] };

  // First, respect existing parent_feed_id assignments from DB
  const existingParentFeeds = new Set<string>();
  const feedsWithParent = feeds.filter((f) => f.parent_feed_id);
  feedsWithParent.forEach((f) => {
    if (f.parent_feed_id) existingParentFeeds.add(f.parent_feed_id);
  });

  // Prepare feeds for clustering: each feed gets its word set
  const feedEntries = feeds.map((f) => ({
    feed: f,
    wordSet: getWordSet(f.title),
    canonicalCountry: normalizeCountryName(f.country),
    timestamp: new Date(f.timestamp).getTime(),
  }));

  // Group by country first
  const byCountry = new Map<string, typeof feedEntries>();
  feedEntries.forEach((entry) => {
    const cc = entry.canonicalCountry || entry.feed.country;
    if (!byCountry.has(cc)) byCountry.set(cc, []);
    byCountry.get(cc)!.push(entry);
  });

  const clusters: FeedCluster[] = [];
  const processedIds = new Set<string>();
  const canonicalFeedsMap = new Map<string, SupabaseFeed>();

  byCountry.forEach((entries) => {
    // For each country, create similarity groups
    const assigned = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
      const entryA = entries[i];
      if (assigned.has(entryA.feed.id)) continue;

      const group: typeof feedEntries = [entryA];
      assigned.add(entryA.feed.id);

      for (let j = i + 1; j < entries.length; j++) {
        const entryB = entries[j];
        if (assigned.has(entryB.feed.id)) continue;

        // Similarity threshold: must share enough words
        const sim = jaccardSimilarity(entryA.wordSet, entryB.wordSet);
        if (sim >= 0.35) {
          group.push(entryB);
          assigned.add(entryB.feed.id);
        }
      }

      if (group.length > 1) {
        // Pick canonical: highest verification, then most recent, then highest severity
        group.sort((a, b) => {
          const va = VERIFICATION_PRIORITY[a.feed.verification_status] ?? 1;
          const vb = VERIFICATION_PRIORITY[b.feed.verification_status] ?? 1;
          if (va !== vb) return vb - va;
          if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
          const sa = SEVERITY_ORDER[getFeedSeverity(a.feed)] ?? 0;
          const sb = SEVERITY_ORDER[getFeedSeverity(b.feed)] ?? 0;
          return sb - sa;
        });

        const canonical = group[0];
        const duplicates = group.slice(1);

        clusters.push({
          canonicalId: canonical.feed.id,
          duplicateIds: duplicates.map((d) => d.feed.id),
          canonicalTitle: canonical.feed.title,
          sources: group.map((g) => g.feed.source),
          country: entries[0].canonicalCountry || entries[0].feed.country,
        });

        // Mark duplicates with parent_feed_id for scoring
        duplicates.forEach((dup) => {
          dup.feed.parent_feed_id = canonical.feed.id;
        });

        group.forEach((g) => {
          processedIds.add(g.feed.id);
          canonicalFeedsMap.set(g.feed.id, g.feed);
        });
      } else {
        processedIds.add(entryA.feed.id);
        canonicalFeedsMap.set(entryA.feed.id, entryA.feed);
      }
    }
  });

  // Ensure all feeds are in the map
  feeds.forEach((f) => {
    if (!canonicalFeedsMap.has(f.id)) {
      canonicalFeedsMap.set(f.id, f);
    }
  });

  const canonicalFeeds = feeds.filter((f) => !f.parent_feed_id);

  return { clusters, canonicalFeeds };
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function useAlertLevels() {
  const [alertLevels, setAlertLevels] = useState<CountryAlertLevel[]>([]);
  const [rawAlerts, setRawAlerts] = useState<SupabaseAlert[]>([]);
  const [rawFeeds, setRawFeeds] = useState<SupabaseFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCalculatedAt, setLastCalculatedAt] = useState<string | null>(null);
  const isFirstComputation = useRef(true);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousLevelsRef = useRef<Map<string, { score: number; level: string }>>(new Map());

  const computeLevels = useCallback((alerts: SupabaseAlert[], feeds: SupabaseFeed[]) => {
    const now = new Date();
    const nowMs = now.getTime();
    const alertCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);   // 7 jours
    const feedCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);   // 7 jours

    const recentAlerts = alerts.filter((a) => new Date(a.timestamp) >= alertCutoff);
    const recentFeeds = feeds.filter((f) => new Date(f.timestamp) >= feedCutoff);

    // --- DÉDUPLICATION : grouper les feeds similaires, ne compter que les canoniques ---
    const { canonicalFeeds } = deduplicateFeeds(recentFeeds);

    const prevMap = previousLevelsRef.current;

    const countryMap = new Map<string, {
      alerts: SupabaseAlert[];
      feeds: SupabaseFeed[];
      allIncidents: TriggeringIncident[];
    }>();

    recentAlerts.forEach((alert) => {
      const canonical = normalizeCountryName(alert.country);
      if (!canonical) return;
      if (!countryMap.has(canonical)) {
        countryMap.set(canonical, { alerts: [], feeds: [], allIncidents: [] });
      }
      const entry = countryMap.get(canonical)!;
      entry.alerts.push(alert);
      entry.allIncidents.push({
        id: alert.id,
        title: alert.title,
        timestamp: alert.timestamp,
        severity: (alert.severity as 'critical' | 'high' | 'medium' | 'low') || 'medium',
        type: 'alert',
        locality: alert.locality,
        source: alert.source,
        verified: alert.status === 'active' || alert.verification_status === 'verified',
        category: alert.category,
      });
    });

    canonicalFeeds.forEach((feed) => {
      const canonical = normalizeCountryName(feed.country);
      if (!canonical) return;
      if (!countryMap.has(canonical)) {
        countryMap.set(canonical, { alerts: [], feeds: [], allIncidents: [] });
      }
      const entry = countryMap.get(canonical)!;
      entry.feeds.push(feed);
      entry.allIncidents.push({
        id: feed.id,
        title: feed.title,
        timestamp: feed.timestamp,
        severity: getFeedSeverity(feed),
        type: 'feed',
        locality: undefined,
        source: feed.source,
        verified: feed.verification_status === 'verified',
        category: feed.category,
      });
    });

    const levels: CountryAlertLevel[] = [];

    countryMap.forEach((data, country) => {
      const bySev = { critical: 0, high: 0, medium: 0, low: 0 };
      let aggravantsTotal = 0;
      const factorBreakdown: Record<string, number> = {};

      data.alerts.forEach((alert) => {
        bySev[alert.severity as keyof typeof bySev] = (bySev[alert.severity as keyof typeof bySev] || 0) + 1;
        const factors = alert.aggravating_factors || [];
        factors.forEach((f) => {
          aggravantsTotal += AGGRAVATING_BONUS[f] || 0;
          factorBreakdown[f] = (factorBreakdown[f] || 0) + 1;
        });
      });

      data.feeds.forEach((feed) => {
        const sev = getFeedSeverity(feed);
        bySev[sev] = (bySev[sev] || 0) + 1;
      });

      const totalFeeds = data.feeds.length;
      const securityFeeds = data.feeds.filter((f) =>
        ['Sécurité', 'Terrorisme', 'Défense', 'Trafics illicites', 'sécurité', 'terrorisme'].includes(f.category),
      ).length;

      // ---- NOUVEAU SCORING PONDÉRÉ ----
      // 1. Alerts structurées (poids analyste ×1.5) — comptées séparément des feeds
      const alertBySev = { critical: 0, high: 0, medium: 0, low: 0 };
      data.alerts.forEach((alert) => {
        alertBySev[alert.severity as keyof typeof alertBySev] += 1;
      });

      let alertScore =
        alertBySev.critical * ALERT_WEIGHTS.critical +
        alertBySev.high * ALERT_WEIGHTS.high +
        alertBySev.medium * ALERT_WEIGHTS.medium +
        alertBySev.low * ALERT_WEIGHTS.low;

      // 2. Feeds RSS avec déclin temporel — comptées séparément
      let feedScore = 0;
      data.feeds.forEach((feed) => {
        const sev = getFeedSeverity(feed);
        const weight = FEED_WEIGHTS[sev] || 0.5;
        const temporal = getTemporalWeight(feed.timestamp, nowMs);
        feedScore += weight * temporal;
      });

      // 3. Bonus concentration sécuritaire : si >60% des feeds sont sécuritaires
      let securityBonus = 0;
      if (totalFeeds > 0 && securityFeeds / totalFeeds >= 0.6) {
        securityBonus = Math.min(10, Math.round((securityFeeds / totalFeeds) * 10));
      }

      // 4. Bonus volume
      let volumeBonus = 0;
      if (totalFeeds >= 15) volumeBonus = 4;
      else if (totalFeeds >= 10) volumeBonus = 3;
      else if (totalFeeds >= 6) volumeBonus = 2;
      else if (totalFeeds >= 3) volumeBonus = 1;

      const rawScore = alertScore + feedScore + aggravantsTotal + volumeBonus + securityBonus + 3;

      // 5. STICKY : un pays ≥ orange dans le calcul précédent reste au moins jaune
      const prev = prevMap.get(country);
      let stickyFloor = 3;
      if (prev && (prev.level === 'rouge' || prev.level === 'orange')) {
        // Vérifier si la fraîcheur justifie le maintien
        const latestFeed = data.feeds.length > 0
          ? Math.max(...data.feeds.map((f) => new Date(f.timestamp).getTime()))
          : 0;
        const latestAlert = data.alerts.length > 0
          ? Math.max(...data.alerts.map((a) => new Date(a.timestamp).getTime()))
          : 0;
        const latestEventMs = Math.max(latestFeed, latestAlert);
        const hoursSinceLastEvent = latestEventMs > 0 ? (nowMs - latestEventMs) / 3600000 : Infinity;

        // Si événement dans les 7 jours, maintenir au moins jaune
        if (hoursSinceLastEvent <= 168) {
          stickyFloor = 10;
        }
      }

      const displayScore = Math.max(stickyFloor, Math.min(95, Math.round(rawScore)));
      const { level, label } = calculateAlertLevel(displayScore);
      const totalIncidents = data.allIncidents.length;
      const verifiedCount = data.allIncidents.filter((i) => i.verified).length;
      const factorsCount = Object.values(factorBreakdown).reduce((a, b) => a + b, 0);

      data.allIncidents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const latest = data.allIncidents[0] || null;

      // Compute freshness in hours
      let freshnessHours: number | null = null;
      if (latest) {
        freshnessHours = Math.round((nowMs - new Date(latest.timestamp).getTime()) / 3600000);
      }

      // Compute trend by comparing with previous state
      let trend: 'up' | 'down' | 'stable' = 'stable';
      let trendDelta = 0;
      if (prev) {
        trendDelta = Math.round(displayScore - prev.score);
        if (trendDelta > 3) trend = 'up';
        else if (trendDelta < -3) trend = 'down';
        // Level change always marks a trend
        if (prev.level !== level) {
          trend = level === 'rouge' || level === 'orange' ? 'up' : 'down';
        }
      }

      // Store current state for next comparison
      prevMap.set(country, { score: displayScore, level });

      levels.push({
        country,
        countryCode: COUNTRY_CODES[country] || '--',
        level,
        levelLabel: label,
        score: parseFloat(displayScore.toFixed(1)),
        rawScore,
        incidents: totalIncidents,
        aggravantsCount: factorsCount,
        verifiedCount,
        rssCount: 0,
        factorsCount,
        latestIncidentAt: latest?.timestamp || null,
        latestIncidentVerifiedAt: latest?.timestamp || null,
        incidentsBySeverity: bySev,
        triggeringIncidents: data.allIncidents,
        aggravatingFactorsBreakdown: factorBreakdown,
        protectionMeasures: getProtectionMeasures(level),
        trend,
        trendDelta,
        freshnessHours,
      });
    });

    // Ajouter les 54 pays manquants avec un score de base (risque résiduel)
    AFRICA_54.forEach((country) => {
      if (!levels.find((l) => l.country === country)) {
        prevMap.set(country, { score: 3, level: 'vert' });
        levels.push({
          country,
          countryCode: COUNTRY_CODES[country] || '--',
          level: 'vert',
          levelLabel: 'Situation normale',
          score: 3.0,
          rawScore: 3,
          incidents: 0,
          aggravantsCount: 0,
          verifiedCount: 0,
          rssCount: 0,
          factorsCount: 0,
          latestIncidentAt: null,
          latestIncidentVerifiedAt: null,
          incidentsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
          triggeringIncidents: [],
          aggravatingFactorsBreakdown: {},
          protectionMeasures: getProtectionMeasures('vert'),
          trend: 'stable',
          trendDelta: 0,
          freshnessHours: null,
        });
      }
    });

    levels.sort((a, b) => b.score - a.score);
    return levels;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const alertCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const feedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [alertsRes, feedsRes] = await Promise.all([
        supabase.from('alerts').select('*').gte('timestamp', alertCutoff).order('timestamp', { ascending: false }),
        supabase.from('feeds').select('*').gte('timestamp', feedCutoff).order('timestamp', { ascending: false }),
      ]);

      if (alertsRes.error) throw alertsRes.error;
      if (feedsRes.error) throw feedsRes.error;

      const alerts = (alertsRes.data || []) as SupabaseAlert[];
      const feeds = (feedsRes.data || []) as SupabaseFeed[];

      setRawAlerts(alerts);
      setRawFeeds(feeds);
      setAlertLevels(computeLevels(alerts, feeds));
      setLastCalculatedAt(new Date().toISOString());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [computeLevels]);

  useEffect(() => {
    fetchData();

    const alertsChannel = supabase
      .channel('alert-levels-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        fetchData();
      })
      .subscribe();

    const feedsChannel = supabase
      .channel('alert-levels-feeds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feeds' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(alertsChannel);
      supabase.removeChannel(feedsChannel);
    };
  }, [fetchData]);

  const recalculate = useCallback(() => {
    setAlertLevels(computeLevels(rawAlerts, rawFeeds));
    setLastCalculatedAt(new Date().toISOString());
  }, [computeLevels, rawAlerts, rawFeeds]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { rouge: 0, orange: 0, jaune: 0, vert: 0, total: alertLevels.length };
    let totalIncidents = 0;
    let totalVerified = 0;
    alertLevels.forEach((l) => {
      counts[l.level]++;
      totalIncidents += l.incidents;
      totalVerified += l.verifiedCount;
    });
    return { ...counts, totalIncidents, totalVerified };
  }, [alertLevels]);

  // Sync posture changes to the database for real historical tracking
  useEffect(() => {
    if (alertLevels.length === 0) return;

    // Skip the first computation — we don't want to flood history on initial load
    if (isFirstComputation.current) {
      isFirstComputation.current = false;
      return;
    }

    // Debounce: wait 2 seconds after the last computation before syncing
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      const postureInputs = alertLevels.map((l) => ({
        country_code: l.countryCode,
        country_name: l.country,
        level: l.level,
        score: l.score,
      }));

      syncPostureChanges(postureInputs).then((result) => {
        if (result.changes > 0) {
          console.log(`[useAlertLevels] ${result.changes} changement(s) de posture enregistré(s)`);
        }
      });
    }, 2000);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [alertLevels]);

  return { alertLevels, loading, error, stats, lastCalculatedAt, recalculate, refetch: fetchData };
}