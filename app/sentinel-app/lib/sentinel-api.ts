// Connexion au moteur SENTINEL Python hébergé sur votre VPS
// Remplacez SENTINEL_API_URL par l'URL de votre serveur

const SENTINEL_API_URL = 'https://votre-serveur.com/api';
const SENTINEL_API_KEY = 'VOTRE_CLE_API_INTERNE';

export type Article = {
  id: string;
  title: string;
  summary: string;
  source: string;
  source_url: string;
  reliability_score: number;
  category: 'security' | 'food' | 'economy' | 'politics' | 'health' | 'environment';
  tags: string[];
  country: string;
  published_at: string;
  is_verified: boolean;
  cross_check_count: number;
  cross_check_sources: { name: string; url: string; confirmed: boolean }[];
  is_flagged: boolean;
  flag_reason?: string;
};

export type Alert = {
  id: string;
  title: string;
  body: string;
  level: 'critical' | 'high' | 'medium' | 'info';
  category: string;
  countries: string[];
  reliability_score: number;
  source: string;
  created_at: string;
};

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type: 'security' | 'food' | 'economy';
  severity: 'critical' | 'high' | 'medium' | 'low';
  country: string;
};

export type HistoryResult = {
  total: number;
  articles: Article[];
};

export type Stats = {
  sources_count: number;
  articles_today: number;
  fake_news_blocked: number;
  avg_reliability: number;
  alerts_active: number;
  last_updated: string;
};

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SENTINEL_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': SENTINEL_API_KEY,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Flux temps réel ───────────────────────────────────────────
export async function getLiveFeed(params: {
  page?: number;
  limit?: number;
  category?: string;
  country?: string;
  min_reliability?: number;
  verified_only?: boolean;
}): Promise<{ articles: Article[]; total: number; page: number }> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.category) q.set('category', params.category);
  if (params.country) q.set('country', params.country);
  if (params.min_reliability) q.set('min_reliability', String(params.min_reliability));
  if (params.verified_only) q.set('verified_only', '1');
  return fetchAPI(`/feed?${q.toString()}`);
}

// ── Alertes actives ───────────────────────────────────────────
export async function getActiveAlerts(countries?: string[]): Promise<Alert[]> {
  const q = countries ? `?countries=${countries.join(',')}` : '';
  return fetchAPI(`/alerts${q}`);
}

// ── Carte ─────────────────────────────────────────────────────
export async function getMapPoints(bbox?: {
  north: number; south: number; east: number; west: number;
}): Promise<MapPoint[]> {
  const q = bbox
    ? `?north=${bbox.north}&south=${bbox.south}&east=${bbox.east}&west=${bbox.west}`
    : '';
  return fetchAPI(`/map${q}`);
}

// ── Recherche historique ──────────────────────────────────────
export async function searchHistory(params: {
  query: string;
  date_from?: string;
  date_to?: string;
  category?: string;
  country?: string;
  source?: string;
  page?: number;
  limit?: number;
}): Promise<HistoryResult> {
  return fetchAPI('/history/search', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── Statistiques moteur ───────────────────────────────────────
export async function getEngineStats(): Promise<Stats> {
  return fetchAPI('/stats');
}

// ── Génération rapport ────────────────────────────────────────
export async function generateReport(params: {
  date_from: string;
  date_to: string;
  categories?: string[];
  countries?: string[];
  format: 'pdf' | 'docx';
  include_map?: boolean;
  language?: 'fr' | 'en';
}): Promise<{ url: string; filename: string; expires_at: string }> {
  return fetchAPI('/reports/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── Tendances ─────────────────────────────────────────────────
export async function getTrends(): Promise<{
  trending: { keyword: string; count: number; change: number }[];
  top_sources: { name: string; score: number; count: number }[];
}> {
  return fetchAPI('/trends');
}
