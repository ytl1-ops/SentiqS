// Port du moteur de collecte reel de web/SentiqS_Web.html (proxyFetch/
// proxyFetchOne ~L5546-5667, parseRSS ~L7575, parseJSON ~L5783) — memes
// services de collecte (rss2json + 7 proxys CORS), meme chaine de repli,
// meme heuristique de validite de contenu.
//
// Simplifications assumees (disclosed) :
// - Pas de suivi de fiabilite par pays (meilleurProxyPourPays/
//   recordProxyResultPays) : optimisation de performance, pas de
//   correction — cette version garde juste un `bestProxy` global en
//   memoire de session.
// - Pas d'extraction media (image/video) ni de detection d'evenement
//   agenda (typeEvenementDetecte) : hors perimetre de la vue Flux.
// - cy (pays de l'article) = cy declare de la source (src.cy), pas la
//   detection textuelle _detecterPaysCoeur (54 listes de termes par
//   pays, non portee) — c'est deja le comportement de repli du code reel
//   quand la detection n'est pas confiante.

import { classify, type Level, type Category } from './classify';
import type { Source } from './sources';

export interface RealArticle {
  id: string;
  title: string;
  analysis: string;
  url: string;
  srcs: string[];
  primary: string;
  cy: string;
  sc: 'local' | 'national' | 'regional';
  cat: Category;
  level: Level;
  score: number;
  pubDate: number;
  verified: boolean;
  crosses: string[];
  fromRSS: true;
}

const RSS2JSON = (u: string) => 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(u);
const CORS_PX: ((u: string) => string)[] = [
  (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  (u) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
  (u) => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u),
  (u) => 'https://proxy.cors.sh/' + u,
  (u) => 'https://test.cors.workers.dev/?' + u,
  (u) => 'https://corsproxy.org/?' + encodeURIComponent(u),
  (u) => 'https://thingproxy.freeboard.io/fetch/' + u,
];
const RSSHUB_MIRRORS = [
  'https://rsshub.app',
  'https://rsshub.rssforever.com',
  'https://rss.shab.fun',
  'https://rsshub.pseudoyu.com',
];

let bestProxy: 'rss2json' | number | null = null;

type ProxyResult = { type: 'json'; data: unknown } | { type: 'xml'; data: string };

function looksLikeValidFeed(txt: string): boolean {
  return !!txt && txt.length > 100 && (txt.includes('<item') || txt.includes('<entry') || txt.includes('<feed') || txt.includes('<?xml'));
}

async function unwrapAllOrigins(txt: string): Promise<string> {
  if (txt.trim().startsWith('{') && txt.includes('"contents"')) {
    try {
      const w = JSON.parse(txt);
      if (w?.contents) return w.contents as string;
    } catch {
      /* pas un JSON exploitable, on garde le texte brut */
    }
  }
  return txt;
}

async function fetchCorsProxy(idx: number, rssUrl: string, timeoutMs: number): Promise<ProxyResult> {
  const r = await fetch(CORS_PX[idx](rssUrl), { signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const txt = await unwrapAllOrigins(await r.text());
  if (!looksLikeValidFeed(txt)) throw new Error('contenu invalide/vide');
  return { type: 'xml', data: txt };
}

async function proxyFetchOne(rssUrl: string, timeoutMs = 7000): Promise<ProxyResult> {
  let lastReason = "Aucun service de collecte n'a répondu";

  if (bestProxy === 'rss2json' || bestProxy === null) {
    try {
      const r = await fetch(RSS2JSON(rssUrl), { signal: AbortSignal.timeout(timeoutMs) });
      const d = await r.json();
      if (d && d.status === 'ok' && d.items && d.items.length > 0) {
        if (bestProxy === null) bestProxy = 'rss2json';
        return { type: 'json', data: d };
      }
      lastReason = 'rss2json.com : réponse vide ou format inattendu';
    } catch (e) {
      lastReason = e instanceof Error ? 'rss2json.com : ' + e.message : lastReason;
    }
  }

  if (typeof bestProxy === 'number') {
    try {
      return await fetchCorsProxy(bestProxy, rssUrl, timeoutMs);
    } catch {
      /* le proxy prefere a echoue cette fois, on retente les autres ci-dessous */
    }
  }

  const others = CORS_PX.map((_, i) => i).filter((i) => i !== bestProxy);
  const winner = await Promise.any(
    others.map((idx) =>
      fetchCorsProxy(idx, rssUrl, timeoutMs).then((res) => {
        if (typeof bestProxy !== 'number') bestProxy = idx;
        return res;
      }),
    ),
  ).catch(() => null);
  if (winner) return winner;

  try {
    const r = await fetch(RSS2JSON(rssUrl), { signal: AbortSignal.timeout(timeoutMs) });
    const d = await r.json();
    if (d && d.items && d.items.length > 0) {
      bestProxy = 'rss2json';
      return { type: 'json', data: d };
    }
    lastReason = 'Tous les services testés ont renvoyé un contenu vide ou invalide';
  } catch {
    /* on garde lastReason existant */
  }

  throw new Error(lastReason);
}

export async function proxyFetch(rssUrl: string): Promise<ProxyResult> {
  const T = 7000;
  if (rssUrl.includes('rsshub.app')) {
    const path = rssUrl.replace(/^https?:\/\/rsshub\.app/, '');
    const urls = RSSHUB_MIRRORS.map((m) => m + path);
    const result = await Promise.any(urls.map((u) => proxyFetchOne(u, T))).catch(() => null);
    if (result) return result;
    throw new Error('Les ' + RSSHUB_MIRRORS.length + ' miroirs RSSHub ont échoué : ' + rssUrl);
  }
  return proxyFetchOne(rssUrl, T);
}

let entityDecoderEl: HTMLTextAreaElement | null = null;
function decodeEntitesHTML(str: string): string {
  if (!str || str.indexOf('&') === -1) return str;
  if (!entityDecoderEl) entityDecoderEl = document.createElement('textarea');
  entityDecoderEl.innerHTML = str;
  return entityDecoderEl.value;
}

function fmtAge(pubTs: number): string {
  if (!pubTs) return '—';
  const diffMin = Math.floor((Date.now() - pubTs) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  return `il y a ${Math.floor(diffH / 24)}j`;
}

function makeId(srcId: string, title: string): string {
  const b64 = btoa(unescape(encodeURIComponent(title.slice(0, 28)))).replace(/[+/=]/g, '').slice(0, 18);
  return 'r_' + srcId + '_' + b64;
}

export function parseJSON(d: { items?: Array<Record<string, string>> }, src: Source): RealArticle[] {
  if (!d?.items) return [];
  const isSocial = !!src.rss_method && (src.rss_method.includes('Telegram') || src.rss_method.includes('Google News RSS'));

  return d.items
    .slice(0, isSocial ? 8 : 12)
    .map((item): RealArticle | null => {
      const title = decodeEntitesHTML((item.title || item.description || '').trim().replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ');
      if (isSocial && title.length < 15) return null;
      if (!isSocial && title.length < 8) return null;

      const desc = decodeEntitesHTML((item.description || item.content || item.title || '').replace(/<[^>]+>/g, ''))
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 400);

      const link = item.link || item.guid || src.url;
      let pubTs = item.pubDate ? new Date(item.pubDate).getTime() : 0;
      if (!pubTs || Number.isNaN(pubTs)) pubTs = 0;

      const { lvl, cat } = classify(title + ' ' + desc, src.cy, src.cat);

      return {
        id: makeId(src.id, title),
        title,
        analysis: desc || 'Resume non disponible pour cette actualite.',
        url: link,
        srcs: [src.id],
        primary: src.id,
        cy: src.cy,
        sc: src.sc,
        cat,
        level: lvl,
        score: src.score,
        pubDate: pubTs,
        verified: src.score >= 80,
        crosses: [src.n],
        fromRSS: true,
      };
    })
    .filter((a): a is RealArticle => a !== null);
}

export function parseRSS(xml: string, src: Source): RealArticle[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) return [];
  const items = [...doc.querySelectorAll('item,entry')];
  const isSocial = !!src.rss_method && (src.rss_method.includes('Telegram') || src.rss_method.includes('Google News RSS'));
  const res: RealArticle[] = [];

  for (const item of items.slice(0, isSocial ? 8 : 12)) {
    let title = decodeEntitesHTML((item.querySelector('title')?.textContent || '').trim()).replace(/\s+/g, ' ');
    if (isSocial && title.length < 10) {
      title = decodeEntitesHTML((item.querySelector('description,summary')?.textContent || '').replace(/<[^>]+>/g, ''))
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 140);
    }
    if (title.length < 8) continue;

    const linkEl = item.querySelector('link');
    const link = linkEl?.getAttribute('href') || linkEl?.textContent?.trim() || src.url;

    const desc = decodeEntitesHTML((item.querySelector('description,summary,content')?.textContent || '').replace(/<[^>]+>/g, ''))
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 400);

    const pubRaw = item.querySelector('pubDate,published,updated')?.textContent || '';
    let pubTs = pubRaw ? new Date(pubRaw).getTime() : 0;
    if (!pubTs || Number.isNaN(pubTs)) pubTs = 0;

    const { lvl, cat } = classify(title + ' ' + desc, src.cy, src.cat);

    res.push({
      id: makeId(src.id, title),
      title,
      analysis: desc || 'Resume non disponible pour cette actualite.',
      url: link,
      srcs: [src.id],
      primary: src.id,
      cy: src.cy,
      sc: src.sc,
      cat,
      level: lvl,
      score: src.score,
      pubDate: pubTs,
      verified: src.score >= 80,
      crosses: [src.n],
      fromRSS: true,
    });
  }
  return res;
}

export { fmtAge };
