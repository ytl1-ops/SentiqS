// ═══════════════════════════════════════════════════════════════════════════
//  SentiqS — PAGE DE GARDE (animation d'ouverture)
//
//  Une seule logique pour les deux endroits où l'animation de marque joue
//  avant qu'on puisse saisir un mot de passe :
//    · web/index.html       — plein écran, avant le contenu de la page ;
//    · web/SentiqS_Web.html — dans #authOverlay, avant la carte de connexion.
//
//  Elle ne joue QU'UNE FOIS PAR ONGLET : le drapeau de sessionStorage est
//  partagé (même origine), donc l'enchaînement accueil → connexion ne rejoue
//  jamais l'animation. Le bouton « Passer » (ou Échap) l'arrête à tout moment.
//
//  Elle s'efface au lieu de gêner dès que quelque chose cloche :
//    · stockage de session refusé (navigation privée stricte) ;
//    · préférence « réduire les animations » ;
//    · économiseur de données / connexion 2G (la vidéo pèse ~0,8 Mo) ;
//    · lecture automatique refusée, fichier illisible, ou démarrage trop lent.
//  Dans tous ces cas la page apparaît immédiatement, comme avant.
//
//  Pendant la lecture, tout le reste de la page est rendu inerte (clavier et
//  lecteurs d'écran) : on ne peut pas tabuler dans les champs masqués par la
//  vidéo.
//
//  Ne touche jamais au chemin automatisé : la collecte planifiée ouvre
//  SentiqS_Web.html avec #collecteur-<JETON> ; checkCollectorSession() la
//  traite avant tout appel à lancer(), qui n'est donc jamais atteint.
//
//  Module à injection : l'environnement (stockage, préférences, connexion,
//  adresse) se passe en paramètre, ce qui le rend testable sans navigateur.
// ═══════════════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var CLE = 'sentinel_intro_vue';
  var DELAI_DEMARRAGE_MS = 6000;

  // Lit l'environnement réel. Chaque accès est protégé : sessionStorage lève
  // une exception (et non une valeur nulle) quand le navigateur le refuse.
  function envNavigateur(w) {
    w = w || global;
    var stockage = null;
    try { stockage = w.sessionStorage; } catch (_) { stockage = null; }
    var mouvementReduit = false;
    try {
      mouvementReduit = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_) {}
    var connexionLente = false;
    try {
      var c = w.navigator && (w.navigator.connection || w.navigator.mozConnection || w.navigator.webkitConnection);
      connexionLente = !!(c && (c.saveData || /(^|-)2g$/.test(String(c.effectiveType || ''))));
    } catch (_) {}
    var hash = '', referrer = '', origine = '';
    try { hash = w.location.hash || ''; } catch (_) {}
    try { referrer = w.document.referrer || ''; } catch (_) {}
    try { origine = w.location.origin || ''; } catch (_) {}
    return { stockage: stockage, mouvementReduit: mouvementReduit, connexionLente: connexionLente,
             hash: hash, referrer: referrer, origine: origine };
  }

  // Renvoie le motif pour lequel il ne faut PAS jouer l'animation, ou null.
  // options.ignorerNavigationInterne : sur la page d'accueil, un lien profond
  // (#tarifs) ou un clic depuis une autre page du site n'est pas une « arrivée ».
  function raisonDeSaut(env, options) {
    if (!env || !env.stockage) return 'stockage';
    try {
      if (env.stockage.getItem(CLE) === '1') return 'deja-vue';
    } catch (_) { return 'stockage'; }
    if (env.mouvementReduit) return 'mouvement-reduit';
    if (env.connexionLente) return 'connexion-lente';
    if (options && options.ignorerNavigationInterne) {
      if (env.hash && env.hash !== '#') return 'ancre';
      if (env.referrer && env.origine && env.referrer.indexOf(env.origine) === 0) return 'navigation-interne';
    }
    return null;
  }

  function marquerVue(stockage) {
    try { stockage.setItem(CLE, '1'); } catch (_) {}
  }

  // els : { overlay, video, skip }. options : { env, delaiMs, ignorerNavigationInterne,
  // onFin(motif) } — onFin est appelée exactement une fois, qu'on ait joué ou non.
  // Renvoie true si l'animation est en cours de lecture.
  function lancer(els, options) {
    options = options || {};
    var onFin = typeof options.onFin === 'function' ? options.onFin : function () {};
    var env = options.env || envNavigateur();
    var raison = raisonDeSaut(env, options);
    if (raison || !els || !els.overlay || !els.video) {
      onFin(raison || 'absente');
      return false;
    }

    var overlay = els.overlay, video = els.video, skip = els.skip || null;
    var doc = overlay.ownerDocument;
    var racine = doc.documentElement;
    var fini = false;
    var minuteur = null;
    var inertes = [];

    function surTouche(e) { if (e && e.key === 'Escape') fin('passee'); }
    function surFin() { fin('terminee'); }
    function surErreur() { fin('erreur'); }
    function surLecture() { if (minuteur) { clearTimeout(minuteur); minuteur = null; } }
    function surClic() { fin('passee'); }

    var sources = [];
    try { sources = Array.prototype.slice.call(video.querySelectorAll('source')); } catch (_) {}

    function fin(motif) {
      if (fini) return;
      fini = true;
      if (minuteur) { clearTimeout(minuteur); minuteur = null; }
      doc.removeEventListener('keydown', surTouche);
      doc.removeEventListener('DOMContentLoaded', rendreInerte);
      video.removeEventListener('ended', surFin);
      video.removeEventListener('error', surErreur);
      video.removeEventListener('playing', surLecture);
      sources.forEach(function (s) { s.removeEventListener('error', surErreur); });
      if (skip) skip.removeEventListener('click', surClic);
      overlay.classList.add('hidden');
      racine.classList.remove('intro-actif');
      inertes.forEach(function (e) { e.inert = false; });
      inertes = [];
      try { video.pause(); } catch (_) {}
      if (skip && doc.activeElement === skip) { try { skip.blur(); } catch (_) {} }
      marquerVue(env.stockage);
      onFin(motif);
    }

    overlay.classList.remove('hidden');
    racine.classList.add('intro-actif');
    // Le reste de la page devient inerte tant que la vidéo couvre l'écran. Sur la
    // page d'accueil l'overlay est le premier élément du <body> : ses voisins ne
    // sont pas encore analysés au moment du lancement, d'où le second passage.
    function rendreInerte() {
      if (fini) return;
      try {
        Array.prototype.forEach.call(overlay.parentNode.children, function (e) {
          if (e === overlay || e.inert || /^(SCRIPT|STYLE|LINK|NOSCRIPT)$/.test(e.tagName)) return;
          e.inert = true;
          inertes.push(e);
        });
      } catch (_) {}
    }
    rendreInerte();
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', rendreInerte);

    video.addEventListener('ended', surFin);
    video.addEventListener('error', surErreur);
    video.addEventListener('playing', surLecture);
    sources.forEach(function (s) { s.addEventListener('error', surErreur); });
    if (skip) skip.addEventListener('click', surClic);
    doc.addEventListener('keydown', surTouche);
    minuteur = setTimeout(function () { fin('delai'); }, options.delaiMs || DELAI_DEMARRAGE_MS);
    if (skip) { try { skip.focus({ preventScroll: true }); } catch (_) {} }

    try {
      var p = video.play();
      if (p && typeof p.catch === 'function') p.catch(function () { fin('autoplay-refuse'); });
    } catch (_) { fin('autoplay-refuse'); }
    return !fini;
  }

  var api = { CLE: CLE, DELAI_DEMARRAGE_MS: DELAI_DEMARRAGE_MS,
              envNavigateur: envNavigateur, raisonDeSaut: raisonDeSaut, lancer: lancer };
  global.SentiqIntro = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
