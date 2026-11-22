// ═══════════════════════════════════════════════════════════════════════════
//  SentiqS — AGENT DE RECHERCHE D'ACTUS (22/11/2026)
//
//  Demande de YORO : « un agent IA autonome sécurisé, anti-hallucination, qui
//  permet un chat pour trouver des actus dans la base de l'appli et, si
//  nécessaire, sur plusieurs moteurs de recherche parmi les plus utilisés au
//  monde. Les données trouvées, si vérifiées, pourront être insérées dans la
//  base de l'appli si absentes. »
//
//  Architecture (site statique + Firebase + GitHub Actions, rien de payant) :
//
//    1. l'assistant de veille répond d'abord avec la base (web/js/assistant.js) ;
//    2. « Chercher aussi sur le web » dépose une DEMANDE dans Firestore
//       (agent_demandes/{uid}_{jour}_{n}) — cinq par jour et par compte, compté
//       par les règles elles-mêmes (le numéro n fait partie de la clé) ;
//    3. le job GitHub (scripts/agent-recherche.js) interroge les moteurs qui
//       l'autorisent, ne garde que les résultats publiés par un média du
//       registre de l'appli (liste blanche), vérifie date, pays et doublon
//       avec la VRAIE page, recoupe, cote, et écrit la réponse
//       (agent_reponses/{même clé}) ;
//    4. un fait confirmé (deux médias distincts du registre) et absent de la
//       base est inséré dans actus_agent ; un fait probable ou non confirmé
//       part en quarantaine (actus_agent_quarantaine), que seul l'analyste
//       (YORO) valide ou rejette.
//
//  Anti-hallucination : AUCUN modèle de langage. Chaque ligne affichée est un
//  titre, un extrait et un lien rendus par un moteur, jamais une phrase
//  composée ; une question sans résultat reçoit « introuvable ». Anti-
//  injection : le contenu du web est une donnée — il n'est ni interprété ni
//  exécuté, seulement nettoyé (balises, caractères de contrôle et de
//  direction retirés), borné et échappé à l'affichage. Les pages d'articles ne
//  sont jamais téléchargées : seuls les points d'accès des moteurs le sont.
//
//  Partagé par la page (navigateur), le job et les tests : double export.
// ═══════════════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var COLLECTIONS = {
    demandes: 'agent_demandes',
    reponses: 'agent_reponses',
    actus: 'actus_agent',
    quarantaine: 'actus_agent_quarantaine',
    agenda: 'agenda_agent',
    rapport: 'agent_rapport',
  };
  // Mêmes nombres que firebase/firestore.rules (demandeAgentBienFormee).
  var LIMITE_JOUR = 5;
  var LIMITE_JOUR_ADMIN = 20;
  var Q_MIN = 3;
  var Q_MAX = 160;
  var PAYS_MAX = 3;
  var JOURS_DEFAUT = 7;
  var JOURS_MAX = 30;
  var TITRE_MAX = 300;
  var EXTRAIT_MAX = 400;
  var URL_MAX = 800;
  var JOUR_MS = 86400000;

  // Les moteurs, et ce que leur robots.txt dit d'un robot de veille (mesuré
  // le 22/11/2026). Un moteur qui interdit l'accès n'est pas contourné : le
  // contourner par un relais est un arbitrage du propriétaire, pas du code.
  var MOTEURS = [
    { id: 'bing', nom: 'Bing Actualités', etat: 'actif', note: '/news/search autorisé par robots.txt' },
    { id: 'reliefweb', nom: 'ReliefWeb (OCHA)', etat: 'actif', note: 'API publique de l’ONU' },
    { id: 'google_news', nom: 'Google Actualités', etat: 'refuse', note: 'robots.txt : Disallow /rss/' },
    { id: 'duckduckgo', nom: 'DuckDuckGo', etat: 'refuse', note: 'robots.txt : Disallow /html et /lite' },
    { id: 'yahoo', nom: 'Yahoo Actualités', etat: 'refuse', note: 'robots.txt : Disallow /news/search' },
  ];

  var COTATIONS = ['confirme', 'probable', 'non_confirme'];
  var STATUTS = ['insere', 'deja', 'quarantaine'];

  function jourDe(ms) { return Math.floor(Number(ms) / JOUR_MS); }
  function idDemande(uid, jour, n) { return String(uid) + '_' + String(jour) + '_' + String(n); }

  // Caractères qui n'ont rien à faire dans un titre et servent à tromper un
  // lecteur ou un programme : contrôles, largeur nulle, inversions de
  // direction (U+202A-202E, U+2066-2069), marque d'ordre d'octets.
  var INVISIBLES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

  function couper(t, max) {
    t = String(t || '');
    if (t.length <= max) return t;
    var c = t.slice(0, max);
    var i = c.lastIndexOf(' ');
    return (i > max * 0.6 ? c.slice(0, i) : c).replace(/[\s,;:.-]+$/, '') + '…';
  }

  // nettoyerTexte(t, max) : du texte brut, et rien d'autre. Les balises sont
  // retirées (jamais interprétées), les espaces repliés.
  function nettoyerTexte(t, max) {
    var s = String(t == null ? '' : t)
      .replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(INVISIBLES, '')
      .replace(/\s+/g, ' ')
      .trim();
    return couper(s, max || TITRE_MAX);
  }

  // nettoyerRequete(q) : ce que l'utilisateur a tapé, réduit à des mots. Les
  // opérateurs de moteur (site:, inurl:, guillemets, exclusion) sont retirés :
  // la requête cherche des actus, elle ne pilote pas le moteur.
  function nettoyerRequete(q) {
    var s = String(q == null ? '' : q).normalize('NFC').replace(INVISIBLES, ' ');
    s = s.replace(/\b(site|inurl|intitle|intext|filetype|ext|cache|related|link|info|define)\s*:\S*/gi, ' ');
    s = s.replace(/[^\p{L}\p{N}\s'’-]/gu, ' ');
    s = s.replace(/(^|\s)-+(?=\S)/g, ' ').replace(/\s+/g, ' ').trim();
    if (s.length > Q_MAX) { s = s.slice(0, Q_MAX); var i = s.lastIndexOf(' '); if (i > 40) s = s.slice(0, i); }
    return s.length >= Q_MIN ? s : '';
  }

  // urlSure(u) : une adresse web ordinaire, ou null. Pas d'identifiants dans
  // l'adresse, pas de schéma autre que http(s), pas d'adresse démesurée.
  function urlSure(u) {
    if (typeof u !== 'string' || !u || u.length > URL_MAX) return null;
    var x;
    try { x = new URL(u.trim()); } catch (_) { return null; }
    if (x.protocol !== 'https:' && x.protocol !== 'http:') return null;
    if (x.username || x.password) return null;
    if (!/^[a-z0-9.-]+$/i.test(x.hostname) || x.hostname.indexOf('.') === -1) return null;
    return x.href;
  }

  // domaineRacine(hote) : le domaine qui identifie un média. « www.rfi.fr » et
  // « rfi.fr » sont le même média ; « news.co.za » garde trois niveaux.
  var SLD = { co: 1, com: 1, org: 1, net: 1, gov: 1, gouv: 1, ac: 1, go: 1, or: 1, info: 1, edu: 1, ne: 1 };
  function domaineRacine(hote) {
    var h = String(hote || '').toLowerCase().replace(/\.$/, '');
    try { if (/^[a-z]+:\/\//.test(h)) h = new URL(h).hostname; } catch (_) { return ''; }
    var p = h.split('.').filter(Boolean);
    if (p.length < 2) return '';
    var n = (p.length >= 3 && p[p.length - 1].length === 2 && SLD[p[p.length - 2]]) ? 3 : 2;
    return p.slice(-n).join('.');
  }

  // demandeBienFormee(d, id, estAdmin, maintenant) : même règle que
  // firebase/firestore.rules, pour que la page ne dépose jamais une demande
  // que le serveur refusera (et pour les tests).
  function demandeBienFormee(d, id, estAdmin, maintenant) {
    if (!d || typeof d !== 'object') return false;
    var cles = Object.keys(d).sort().join(',');
    if (cles !== 'at,jour,jours,lang,n,pays,q,uid') return false;
    var lim = estAdmin ? LIMITE_JOUR_ADMIN : LIMITE_JOUR;
    return typeof d.uid === 'string' && d.uid.length > 0
      && typeof d.q === 'string' && d.q.length >= Q_MIN && d.q.length <= Q_MAX
      && Array.isArray(d.pays) && d.pays.length <= PAYS_MAX && d.pays.every(function (c) { return /^[A-Z]{2}$/.test(c); })
      && Number.isInteger(d.jours) && d.jours >= 1 && d.jours <= JOURS_MAX
      && (d.lang === 'fr' || d.lang === 'en')
      && Number.isInteger(d.jour) && d.jour === jourDe(maintenant === undefined ? Date.now() : maintenant)
      && Number.isInteger(d.n) && d.n >= 0 && d.n < lim
      && id === idDemande(d.uid, d.jour, d.n);
  }

  // preparerDemande(question, interp, uid, n, lang, maintenant) : l'objet que
  // la page dépose, ou null si la question ne contient aucun mot exploitable.
  function preparerDemande(question, interp, uid, n, lang, maintenant) {
    var q = nettoyerRequete(question);
    if (!q || !uid) return null;
    var t = maintenant === undefined ? Date.now() : maintenant;
    var per = (interp && interp.periode) || {};
    var jours = per.depuis ? Math.ceil((t - per.depuis) / JOUR_MS) : JOURS_DEFAUT;
    jours = Math.max(1, Math.min(JOURS_MAX, jours || JOURS_DEFAUT));
    var pays = ((interp && interp.pays) || []).filter(function (c) { return /^[A-Z]{2}$/.test(c); }).slice(0, PAYS_MAX);
    return { uid: uid, q: q, pays: pays, jours: jours, lang: lang === 'en' ? 'en' : 'fr', jour: jourDe(t), n: n, at: new Date(t).toISOString() };
  }

  // articleAgentValide(a, sources) : un article lu dans actus_agent, ramené à
  // des champs connus et bornés, ou null. La page ne fait confiance à rien de
  // ce qu'elle lit : la source doit être au registre, l'adresse sûre et de
  // son domaine, la date lisible. Le niveau et le pays seront recalculés par
  // rehydrateArticles, comme pour tout article du cache.
  function articleAgentValide(a, sources) {
    if (!a || typeof a !== 'object') return null;
    var srcIds = (sources || []).map(function (s) { return s.id; });
    var srcs = (Array.isArray(a.srcs) ? a.srcs : [a.primary]).filter(function (s) { return srcIds.indexOf(s) !== -1; });
    if (!srcs.length || srcIds.indexOf(a.primary) === -1) return null;
    var url = urlSure(a.url);
    var titre = nettoyerTexte(a.title, TITRE_MAX);
    if (!url || titre.length < 8) return null;
    var pub = Number(a.pubDate);
    if (!(pub > 0) || pub > Date.now() + 3600000) return null;
    var cot = COTATIONS.indexOf(a._agentCotation) !== -1 ? a._agentCotation : 'non_confirme';
    var liens = (Array.isArray(a._agentLiens) ? a._agentLiens : []).slice(0, 6).map(function (l) {
      var u = l && urlSure(l.url);
      return u ? { url: u, domaine: domaineRacine(new URL(u).hostname), source: nettoyerTexte(l.source, 80) } : null;
    }).filter(Boolean);
    return {
      id: 'ag_' + String(a.id || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40),
      title: titre,
      analysis: nettoyerTexte(a.analysis, EXTRAIT_MAX) || titre,
      url: url, srcs: srcs, primary: a.primary,
      cy: /^[A-Z]{2,3}$/.test(a.cy) ? a.cy : 'INT',
      cat: typeof a.cat === 'string' ? a.cat.slice(0, 20) : 'politique',
      level: typeof a.level === 'string' ? a.level.slice(0, 10) : 'normal',
      score: Number(a.score) || 0,
      pubDate: pub,
      verified: srcs.length >= 2,
      crosses: (Array.isArray(a.crosses) ? a.crosses : []).slice(0, 6).map(function (c) { return nettoyerTexte(c, 80); }),
      recos: [], flagged: false, fromRSS: true,
      origine: 'agent',
      _agentCotation: cot,
      _agentLiens: liens,
      _agentTrouveLe: typeof a._agentTrouveLe === 'string' ? a._agentTrouveLe.slice(0, 30) : null,
      _agentValidePar: typeof a._agentValidePar === 'string' ? a._agentValidePar.slice(0, 20) : null,
    };
  }

  // resultatValide(r) : la réponse du job, relue avant affichage. Tout champ
  // inconnu est ignoré, tout texte nettoyé, toute adresse revérifiée.
  function resultatValide(r) {
    if (!r || typeof r !== 'object') return null;
    var faits = (Array.isArray(r.faits) ? r.faits : []).slice(0, 25).map(function (f) {
      if (!f) return null;
      var liens = (Array.isArray(f.liens) ? f.liens : []).slice(0, 6).map(function (l) {
        var u = l && urlSure(l.url);
        return u ? { url: u, domaine: domaineRacine(new URL(u).hostname), source: nettoyerTexte(l.source, 80), moteur: nettoyerTexte(l.moteur, 20) } : null;
      }).filter(Boolean);
      var titre = nettoyerTexte(f.titre, TITRE_MAX);
      if (!liens.length || titre.length < 8) return null;
      return {
        titre: titre, extrait: nettoyerTexte(f.extrait, EXTRAIT_MAX), liens: liens,
        publieMs: Number(f.publieMs) || null,
        cy: /^[A-Z]{2,3}$/.test(f.cy) ? f.cy : null,
        niveau: typeof f.niveau === 'string' ? f.niveau.slice(0, 10) : 'normal',
        cotation: COTATIONS.indexOf(f.cotation) !== -1 ? f.cotation : 'non_confirme',
        statut: STATUTS.indexOf(f.statut) !== -1 ? f.statut : 'quarantaine',
      };
    }).filter(Boolean);
    var moteurs = (Array.isArray(r.moteurs) ? r.moteurs : []).slice(0, 10).map(function (m) {
      return m ? { nom: nettoyerTexte(m.nom, 40), etat: nettoyerTexte(m.etat, 20), n: Number(m.n) || 0 } : null;
    }).filter(Boolean);
    var ecartes = {};
    Object.keys(r.ecartes || {}).slice(0, 12).forEach(function (k) {
      if (/^[a-z_]{2,30}$/.test(k)) ecartes[k] = Number(r.ecartes[k]) || 0;
    });
    return { q: nettoyerTexte(r.q, Q_MAX), faits: faits, moteurs: moteurs, ecartes: ecartes, le: typeof r.le === 'string' ? r.le.slice(0, 30) : null };
  }

  var LIB = {
    fr: {
      cot: { confirme: 'Confirmé', probable: 'Probable', non_confirme: 'Non confirmé' },
      statut: { insere: 'Ajouté à la base', deja: 'Déjà dans la base', quarantaine: 'En attente de validation par l’analyste' },
      etat: { ok: 'interrogé', robots: 'refusé par son robots.txt', erreur: 'injoignable', quota: 'quota atteint', ignore: 'non interrogé' },
      ecarte: { hors_liste: 'média hors du registre', hors_periode: 'hors de la période', sans_date: 'sans date', autre_pays: 'autre pays', hors_surete: 'hors sûreté', doublon: 'déjà vu' },
    },
    en: {
      cot: { confirme: 'Confirmed', probable: 'Probable', non_confirme: 'Unconfirmed' },
      statut: { insere: 'Added to the database', deja: 'Already in the database', quarantaine: 'Awaiting analyst validation' },
      etat: { ok: 'queried', robots: 'refused by its robots.txt', erreur: 'unreachable', quota: 'quota reached', ignore: 'not queried' },
      ecarte: { hors_liste: 'outlet not in the registry', hors_periode: 'outside the period', sans_date: 'undated', autre_pays: 'another country', hors_surete: 'not security-related', doublon: 'already seen' },
    },
  };

  // ── Côté navigateur : déposer une demande, lire les réponses ─────────────
  // REST Firestore, avec le jeton de la session (mêmes en-têtes que la
  // lecture du cache). `fetchFn` est injecté pour les tests.
  function base(cfg) { return 'https://firestore.googleapis.com/v1/projects/' + cfg.projectId + '/databases/(default)/documents'; }
  function versChamps(d) {
    return {
      uid: { stringValue: d.uid }, q: { stringValue: d.q },
      pays: { arrayValue: { values: d.pays.map(function (c) { return { stringValue: c }; }) } },
      jours: { integerValue: String(d.jours) }, lang: { stringValue: d.lang },
      jour: { integerValue: String(d.jour) }, n: { integerValue: String(d.n) },
      at: { timestampValue: d.at },
    };
  }
  // deposer(cfg, entetes, question, interp, uid, lang, fetchFn, estAdmin) :
  // essaie les numéros libres du jour (création seule : un numéro pris répond
  // 409, on passe au suivant). Un refus des règles (403) peut venir d'une
  // horloge décalée autour de minuit : on retente une fois sur le jour du
  // serveur voisin. Rend { id } ou { erreur: 'quota' | 'refus' | 'reseau' | 'question' }.
  function deposer(cfg, entetes, question, interp, uid, lang, fetchFn, estAdmin, depart) {
    var max = estAdmin ? LIMITE_JOUR_ADMIN : LIMITE_JOUR;
    var maintenant = Date.now();
    var d0 = preparerDemande(question, interp, uid, 0, lang, maintenant);
    if (!d0 || d0.q.length < Q_MIN) return Promise.resolve({ erreur: 'question' });
    if (!cfg || !cfg.projectId || !entetes || !fetchFn) return Promise.resolve({ erreur: 'refus' });
    // Le jour du navigateur d'abord, puis ses voisins (horloge décalée autour
    // de minuit) ; `depart` = premier numéro pas encore utilisé sur cet appareil.
    var jours = [d0.jour, d0.jour + 1, d0.jour - 1];
    var dejaPris = Number(depart) > 0;
    function essayer(ij, n) {
      if (ij >= jours.length) return Promise.resolve({ erreur: dejaPris ? 'quota' : 'refus' });
      if (n >= max) return dejaPris ? Promise.resolve({ erreur: 'quota' }) : essayer(ij + 1, 0);
      var d = Object.assign({}, d0, { jour: jours[ij], n: n });
      var id = idDemande(uid, d.jour, n);
      return Promise.resolve(fetchFn(base(cfg) + '/' + COLLECTIONS.demandes + '?documentId=' + encodeURIComponent(id), {
        method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, entetes),
        body: JSON.stringify({ fields: versChamps(d) }),
      })).then(function (r) {
        if (r && r.ok) return { id: id, jour: d.jour, n: n };
        // 409 : numéro déjà pris. 403 : numéro pris (une création sur un
        // document existant est une mise à jour, que les règles refusent),
        // jour refusé, ou compte sans accès — on essaie le suivant.
        if (r && r.status === 409) { dejaPris = true; return essayer(ij, n + 1); }
        if (r && r.status === 403) return essayer(ij, n + 1);
        return { erreur: 'reseau' };
      }, function () { return { erreur: 'reseau' }; });
    }
    return essayer(0, Math.max(0, Math.min(max, Number(depart) || 0)));
  }
  // lireReponses(cfg, entetes, ids, fetchFn) : Map id → résultat validé, pour
  // celles qui existent. Le texte vient d'un passage GitHub mais porte ce que
  // des pages web ont écrit : relu par resultatValide, jamais injecté tel quel.
  function lireReponses(cfg, entetes, ids, fetchFn) {
    var trouve = new Map();
    if (!cfg || !cfg.projectId || !entetes || !fetchFn || !ids || !ids.length) return Promise.resolve(trouve);
    var racine = 'projects/' + cfg.projectId + '/databases/(default)/documents/' + COLLECTIONS.reponses + '/';
    return Promise.resolve(fetchFn(base(cfg) + ':batchGet', {
      method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, entetes),
      body: JSON.stringify({ documents: ids.slice(0, 50).map(function (i) { return racine + i; }) }),
    })).then(function (r) { return r && r.ok ? r.json() : []; }).then(function (rep) {
      (Array.isArray(rep) ? rep : []).forEach(function (e) {
        var doc = e && e.found, f = doc && doc.fields;
        if (!f || !f.resultat) return;
        var id = String(doc.name).split('/').pop();
        var r = null;
        try { r = resultatValide(JSON.parse(f.resultat.stringValue || 'null')); } catch (_) {}
        if (r) trouve.set(id, r);
      });
      return trouve;
    }, function () { return trouve; });
  }

  var api = {
    deposer: deposer, lireReponses: lireReponses, versChamps: versChamps,
    COLLECTIONS: COLLECTIONS, LIMITE_JOUR: LIMITE_JOUR, LIMITE_JOUR_ADMIN: LIMITE_JOUR_ADMIN,
    Q_MIN: Q_MIN, Q_MAX: Q_MAX, PAYS_MAX: PAYS_MAX, JOURS_DEFAUT: JOURS_DEFAUT, JOURS_MAX: JOURS_MAX,
    TITRE_MAX: TITRE_MAX, EXTRAIT_MAX: EXTRAIT_MAX, MOTEURS: MOTEURS, COTATIONS: COTATIONS, STATUTS: STATUTS, LIB: LIB,
    jourDe: jourDe, idDemande: idDemande, nettoyerTexte: nettoyerTexte, nettoyerRequete: nettoyerRequete,
    urlSure: urlSure, domaineRacine: domaineRacine, demandeBienFormee: demandeBienFormee,
    preparerDemande: preparerDemande, articleAgentValide: articleAgentValide, resultatValide: resultatValide,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.SentiqAgent = api;
})(typeof window !== 'undefined' ? window : globalThis);
