// ============================================================
// SENTINEL — Fetch HTTP respectueux (délais, User-Agent, robots.txt, retries)
//
// Objectif : donner au job de collecte planifiée (et à tout futur script
// serveur) un moyen d'aller chercher directement les flux RSS des sources
// (voir SRCS dans web/SENTINEL_Surete_Web.html) SANS passer par les proxys
// CORS publics partagés (allorigins, corsproxy.org...) — nécessaires côté
// NAVIGATEUR (contrainte CORS incontournable pour un visiteur), mais inutiles
// côté SERVEUR : Node n'a aucune restriction CORS, un fetch() direct suffit.
//
// Utilise UNIQUEMENT des ressources gratuites et déjà publiques (les flux
// RSS eux-mêmes, syndiqués par leurs éditeurs pour être agrégés — aucune clé
// d'API payante requise). "Respectueux" ici signifie concrètement :
//   - un User-Agent identifiable (nom du projet + contact), jamais déguisé
//     en navigateur — pratique de bonne foi pour tout opérateur de site qui
//     consulterait ses journaux d'accès ;
//   - un throttle PAR DOMAINE (jamais plus d'une requête toutes les
//     DELAI_MIN_PAR_DOMAINE_MS vers le même hôte), même si plusieurs sources
//     de SRCS partagent un domaine (ex. plusieurs flux Google News) ;
//   - une lecture best-effort de robots.txt (règles génériques "User-agent:
//     *" — un bot de veille RSS grand public suit les règles publiées pour
//     tous, il ne prétend pas avoir un traitement dédié) : une ressource
//     explicitement interdite n'est jamais récupérée ;
//   - des tentatives limitées avec backoff (jamais de boucle agressive sur
//     une source qui échoue), un timeout raisonnable, et des erreurs
//     toujours capturées individuellement (une source en échec ne bloque
//     jamais les autres).
// ============================================================

const USER_AGENT = 'SentiqSBot/1.0 (+https://ytl1-ops.github.io/SentiqS; veille de surete pour 54 pays d Afrique, usage non commercial; contact: yorot225@gmail.com)';

const DELAI_MIN_PAR_DOMAINE_MS = 1500;
const TIMEOUT_MS = 10000;
const MAX_TENTATIVES = 2;
const DELAI_RETRY_BASE_MS = 3000;
const TIMEOUT_ROBOTS_MS = 5000;

const robotsCache = new Map();      // domaine -> string[] de chemins Disallow (regles "User-agent: *")
const domaineDernierAppel = new Map(); // domaine -> timestamp du dernier fetch (throttle)

function domaineDe(url) {
  try { return new URL(url).hostname; } catch (_) { return null; }
}

// robotsAutorise(url) : true si aucune regle "Disallow" (bloc User-agent: *)
// de robots.txt ne couvre le chemin demande. Best-effort : un robots.txt
// absent, injoignable ou illisible est traite comme "aucune restriction" —
// conforme a la pratique standard (l'absence de robots.txt n'est jamais une
// interdiction implicite).
async function robotsAutorise(url) {
  const domaine = domaineDe(url);
  if (!domaine) return true;
  const cleCache = domaine + ':' + (new URL(url).port || '');
  if (!robotsCache.has(cleCache)) {
    let disallow = [];
    try {
      // Meme origine (protocole + hote + port) que l URL ciblee, jamais une
      // origine differente devinee — indispensable en local/tests (http),
      // et plus correct en general que de forcer https en dur.
      const origine = new URL(url).origin;
      const r = await fetch(origine + '/robots.txt', {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_ROBOTS_MS),
      });
      if (r.ok) {
        const texte = await r.text();
        const blocs = texte.split(/\n(?=\s*User-agent\s*:)/i);
        for (const bloc of blocs) {
          if (/^\s*User-agent\s*:\s*\*/im.test(bloc)) {
            const lignes = bloc.match(/^\s*Disallow\s*:\s*(.+)$/gim) || [];
            disallow.push(...lignes.map(l => l.replace(/^\s*Disallow\s*:\s*/i, '').trim()).filter(Boolean));
          }
        }
      }
    } catch (_) { /* robots.txt absent/injoignable -> pas de restriction connue */ }
    robotsCache.set(cleCache, disallow);
  }
  const regles = robotsCache.get(cleCache);
  if (!regles.length) return true;
  let chemin;
  try { chemin = new URL(url).pathname; } catch (_) { return true; }
  return !regles.some(regle => regle === '/' ? false : chemin.startsWith(regle));
}

// attendreQuota(url) : impose un ecart minimal entre deux requetes vers le
// MEME domaine, quel que soit le nombre de sources SRCS qui le partagent.
async function attendreQuota(url) {
  const domaine = domaineDe(url);
  if (!domaine) return;
  const dernier = domaineDernierAppel.get(domaine) || 0;
  const attente = DELAI_MIN_PAR_DOMAINE_MS - (Date.now() - dernier);
  if (attente > 0) await new Promise(resolve => setTimeout(resolve, attente));
  domaineDernierAppel.set(domaine, Date.now());
}

// fetchRespectueux(url) : {ok:true, texte, status, tentatives} en cas de
// succes ; {ok:false, raison, bloque?} en cas d'echec (raison lisible,
// jamais d'exception non capturee — a l'appelant de decider comment agreger
// les echecs, jamais bloquant pour le reste d'une collecte en lot).
async function fetchRespectueux(url) {
  if (!(await robotsAutorise(url))) {
    return { ok: false, raison: 'interdit par robots.txt (regle Disallow generale)', bloque: true };
  }
  let derniereErreur = 'raison inconnue';
  for (let tentative = 1; tentative <= MAX_TENTATIVES; tentative++) {
    await attendreQuota(url);
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json;q=0.8, */*;q=0.5',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if ((r.status === 429 || r.status >= 500) && tentative < MAX_TENTATIVES) {
        derniereErreur = 'HTTP ' + r.status;
        await new Promise(resolve => setTimeout(resolve, DELAI_RETRY_BASE_MS * tentative));
        continue;
      }
      if (!r.ok) return { ok: false, raison: 'HTTP ' + r.status, tentatives: tentative };
      const texte = await r.text();
      return { ok: true, texte, status: r.status, tentatives: tentative };
    } catch (e) {
      derniereErreur = e && e.name === 'TimeoutError' ? 'delai depasse (' + (TIMEOUT_MS / 1000) + 's)' : (e && e.message) || 'erreur reseau';
      if (tentative < MAX_TENTATIVES) {
        await new Promise(resolve => setTimeout(resolve, DELAI_RETRY_BASE_MS * tentative));
      }
    }
  }
  return { ok: false, raison: derniereErreur, tentatives: MAX_TENTATIVES };
}

module.exports = { fetchRespectueux, USER_AGENT, DELAI_MIN_PAR_DOMAINE_MS, TIMEOUT_MS, MAX_TENTATIVES };
