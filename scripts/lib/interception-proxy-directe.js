// ============================================================
// SENTINEL — Interception des proxys CORS publics vers un fetch DIRECT
//
// Le moteur de collecte CLIENT (doCollect/proxyFetch, voir CORS_PX dans
// web/SENTINEL_Surete_Web.html) passe par des proxys CORS publics tiers
// (allorigins, corsproxy.org...) — INCONTOURNABLE pour un vrai visiteur
// (contrainte CORS du navigateur), mais inutile pour un job Node/Playwright
// qui contrôle sa propre page : aucune restriction CORS côté serveur, un
// fetch direct suffit. Ces proxys se sont montrés rate-limités en pratique
// face au volume du job de collecte planifiée (~495 requêtes depuis une
// seule IP).
//
// Interception totalement TRANSPARENTE pour le code client (AUCUNE
// modification de SENTINEL_Surete_Web.html) : la page continue de croire
// qu'elle parle au proxy réel — route.fulfill() lui sert une réponse
// construite à partir d'un fetch direct (voir fetch-respectueux.js —
// User-Agent identifiable, throttle par domaine, robots.txt, retries), mise
// en forme exactement comme le proxy visé l'aurait renvoyée. Le parsing
// RSS/JSON, la classification et la déduplication restent 100% ceux du
// moteur client, réutilisés sans la moindre duplication.
//
// Filet de sécurité : si le fetch direct échoue pour une raison quelconque
// (robots.txt, timeout, domaine injoignable...), route.continue() laisse
// passer la requête vers le VRAI proxy — comportement strictement identique
// à avant l'interception, jamais de dégradation possible.
// ============================================================

const { fetchRespectueux } = require('./fetch-respectueux');

const PROXY_PREFIXES = [
  { prefix: 'https://api.allorigins.win/raw?url=', decode: true, forme: 'brut' },
  { prefix: 'https://api.codetabs.com/v1/proxy?quest=', decode: true, forme: 'brut' },
  { prefix: 'https://api.allorigins.win/get?url=', decode: true, forme: 'allorigins_get' },
  { prefix: 'https://proxy.cors.sh/', decode: false, forme: 'brut' },
  { prefix: 'https://test.cors.workers.dev/?', decode: false, forme: 'brut' },
  { prefix: 'https://corsproxy.org/?', decode: true, forme: 'brut' },
  { prefix: 'https://thingproxy.freeboard.io/fetch/', decode: false, forme: 'brut' },
];

// options.prefixes / options.fetchFn : injectables uniquement pour les
// tests (simuler d'autres domaines de proxy, ou mocker le reseau sans
// dependre de fetch-respectueux.js reel) — en production, creerIntercepteur()
// sans argument utilise toujours PROXY_PREFIXES et fetchRespectueux reels.
function creerIntercepteur(options) {
  const prefixes = (options && options.prefixes) || PROXY_PREFIXES;
  const fetchFn = (options && options.fetchFn) || fetchRespectueux;
  const stats = { intercepte: 0, direct_ok: 0, repli_proxy: 0 };

  async function interceptionProxyDirecte(route) {
    const url = route.request().url();
    const motif = prefixes.find(p => url.startsWith(p.prefix));
    if (!motif) return route.continue();
    stats.intercepte++;
    let cible = url.slice(motif.prefix.length);
    if (motif.decode) {
      try { cible = decodeURIComponent(cible); } catch (_) { stats.repli_proxy++; return route.continue(); }
    }
    if (!/^https?:\/\//.test(cible)) { stats.repli_proxy++; return route.continue(); }
    const resultat = await fetchFn(cible);
    if (!resultat.ok) { stats.repli_proxy++; return route.continue(); }
    stats.direct_ok++;
    // Access-Control-Allow-Origin: * — les VRAIS proxys CORS l'envoient
    // systematiquement (c'est litteralement leur raison d'etre) ; sans cet
    // en-tete sur la reponse fabriquee ici, le fetch() de la page echouerait
    // avec une erreur CORS malgre l'interception (le navigateur applique ses
    // regles CORS a la reponse recue, meme construite via route.fulfill()).
    const entetesCORS = { 'Access-Control-Allow-Origin': '*' };
    if (motif.forme === 'allorigins_get') {
      return route.fulfill({ status: 200, headers: { ...entetesCORS, 'content-type': 'application/json' }, body: JSON.stringify({ contents: resultat.texte }) });
    }
    return route.fulfill({ status: 200, headers: { ...entetesCORS, 'content-type': 'application/xml; charset=utf-8' }, body: resultat.texte });
  }

  return { interceptionProxyDirecte, stats };
}

module.exports = { creerIntercepteur, PROXY_PREFIXES };
