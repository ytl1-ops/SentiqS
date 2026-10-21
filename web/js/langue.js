// ═══════════════════════════════════════════════════════════════════════════
//  SentiqS — LANGUE DE L'INTERFACE (FR / EN)
//
//  Signalement du 21/10/2026 (YORO) : « les traductions des pages sont
//  incorrectes, passage d'une langue à une autre pas possible ». Mesure dans
//  Chromium, langue anglaise choisie : environ 800 libellés d'interface
//  restaient en français sur les neuf modules (« Plus récent », « Exporter »,
//  « Tous les pays », les en-têtes de module, les fiches d'alerte, Paramètres
//  en entier…), à côté de ceux qui passaient par I18N/t(). Et le sélecteur
//  FR/EN n'existait que sur l'écran de connexion : une reconnexion automatique
//  du jour le sautait, et une fois dans l'appli il n'y avait plus aucun moyen
//  de changer de langue.
//
//  Cause : ces libellés sont écrits en dur dans quelque deux cents fonctions de
//  rendu. Les faire passer un par un par t('cle') aurait demandé des centaines
//  de clés et dérivé au premier ajout. Ce module pose UNE table de traduction
//  (le texte français tel qu'il s'affiche → l'anglais) et l'applique au DOM
//  rendu, y compris à ce que les rendus ajoutent ensuite (MutationObserver) :
//  un libellé ajouté demain en français se traduit dès qu'il entre dans la
//  table, sans toucher à la fonction qui l'écrit.
//
//  Règles de la table :
//    · clé comparée sans accents, sans casse, espaces réduits : « Securite »,
//      « Sécurité » et « SÉCURITÉ » sont la même entrée ; la sortie reprend la
//      casse du texte source (tout en capitales, ou initiale) ;
//    · les nombres sont des jokers : « Score : 90.3/100 » trouve l'entrée
//      « Score : #/100 » et le nombre est reporté à sa place ;
//    · à défaut, un texte composé (« Algérie — 39.3/100 — Élevé ») est
//      traduit segment par segment autour des séparateurs ;
//    · le CONTENU DES SOURCES n'est jamais touché : titres et résumés d'actus
//      (rappel `ignorer` fourni par la page), éléments `translate="no"` ou
//      `.notranslate`, champs de saisie. L'interface le dit à l'utilisateur.
//
//  Revenir au français restaure le texte d'origine de chaque nœud traduit :
//  rien n'est recalculé, aucun rechargement.
//
//  Le module se charge aussi sous Node (tests) : la partie DOM n'est appelée
//  que dans un navigateur.
// ═══════════════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var CLE_STOCKAGE = 'sentinel_lang';
  var DICO = Object.create(null);
  var MOTIFS = [];
  var NOMBRE = /\d+(?:[.,]\d+)?/g;
  var LETTRE = /[A-Za-zÀ-ÿ]/;

  function sansAccents(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  // Clé de comparaison : sans accents, minuscules, apostrophes unifiées,
  // espaces réduits, nombres remplacés par « # ».
  function cle(s) {
    return sansAccents(s).toLowerCase()
      .replace(/[’‘`]/g, "'").replace(/[  ]/g, ' ')
      .replace(/\s+/g, ' ').trim()
      .replace(/[\s.:…]+$/, '')   // « Sources : », « Sources » et « Sources. » : une entrée
      .replace(NOMBRE, '#');
  }

  function ajouter(table) {
    for (var k in table) {
      if (Object.prototype.hasOwnProperty.call(table, k)) DICO[cle(k)] = table[k];
    }
  }
  // motifs : [[RegExp, remplacement (chaîne ou fonction)], ...] — pour les
  // phrases dont une partie variable n'est pas un nombre (un nom, une date).
  function ajouterMotifs(liste) { MOTIFS.push.apply(MOTIFS, liste); }

  function estMajuscules(s) {
    var l = s.replace(/[^A-Za-zÀ-ÿ]/g, '');
    return l.length >= 2 && l === l.toUpperCase() && l !== l.toLowerCase();
  }
  function casse(source, traduit) {
    if (estMajuscules(source)) return traduit.toUpperCase();
    // Une clé ne garde qu'une valeur : « JAUNE » et « jaune » partagent
    // « YELLOW ». Une source en minuscules ne doit pas sortir en capitales.
    if (estMajuscules(traduit) && /[a-zà-ÿ]{2}/.test(source)) traduit = traduit.toLowerCase();
    var a = source.charAt(0), b = traduit.charAt(0);
    if (a && a === a.toUpperCase() && a !== a.toLowerCase() && b === b.toLowerCase()) {
      return b.toUpperCase() + traduit.slice(1);
    }
    return traduit;
  }

  function chercher(coeur) {
    var k = cle(coeur);
    if (!(k in DICO)) return null;
    var nombres = coeur.match(NOMBRE) || [];
    var i = 0;
    var v = DICO[k].replace(/#/g, function () { return i < nombres.length ? nombres[i++] : '#'; });
    // « 1 months » → « 1 month » : une seule entrée sert le singulier et le pluriel.
    v = v.replace(/(^|[^\d.,])1 (day|month|year|hour|minute|week|incident|countrie|event|signal|source|article|user|download|complaint|item|element)s\b/g,
      function (t, a, mot) { return a + '1 ' + (mot === 'countrie' ? 'country' : mot); });
    // La clé ignore la ponctuation finale : « Détection en cours... » trouve
    // « Détection en cours », et ses points de suspension doivent revenir.
    var fin = /\s*([.:…]+)$/.exec(coeur);
    if (fin && !/[.:…!?]$/.test(v)) v += fin[1];
    return casse(coeur, v);
  }

  // Séparateurs, du plus fort au plus faible : une phrase, un tiret
  // d'incise, un point-virgule, deux-points, une virgule, une barre oblique.
  // Chaque morceau est d'abord cherché entier, et ne descend au palier
  // suivant que s'il est inconnu.
  var PALIERS = [/(\.\s+(?=[A-ZÀ-Ý«"]))/, /(\s+[—–·|]\s+)/, /(\s*;\s+)/, /(\s*:\s+)/, /(,\s+)/, /(\s+\/\s+)/];

  function equilibre(c) {
    return (c.match(/\(/g) || []).length === (c.match(/\)/g) || []).length
      && (c.match(/\[/g) || []).length === (c.match(/\]/g) || []).length;
  }
  function traduireCoeur(c, profondeur) {
    var r = chercher(c);
    if (r !== null) return r;
    for (var i = 0; i < MOTIFS.length; i++) {
      var re = MOTIFS[i][0];
      re.lastIndex = 0;
      if (re.test(c)) { re.lastIndex = 0; return c.replace(re, MOTIFS[i][1]); }
    }
    if (profondeur > 8) return null;
    // Décor en tête (pastille, drapeau, puce, flèche) ou ponctuation en fin.
    var d = /^([^A-Za-zÀ-ÿ0-9«"(]+)([\s\S]+)$/.exec(c);
    if (d) { var rd = traduireCoeur(d[2], profondeur + 1); if (rd !== null) return d[1] + rd; }
    var f = /^([\s\S]+?)(\s*[:.…!?)\]]+)$/.exec(c);
    // Une parenthèse fermante qui répond à une ouvrante appartient au texte :
    // « Maroc — Finale de la CAN (CAN 2025) » ne se coupe pas avant « ) ».
    if (f && /[)\]]/.test(f[2]) && equilibre(c)) f = null;
    if (f && LETTRE.test(f[1])) {
      var rf = traduireCoeur(f[1], profondeur + 1);
      if (rf !== null) return /[:.…!?)\]]$/.test(rf) ? rf : rf + f[2].replace(/^\s+:/, ':');
    }
    var p = /^\(([\s\S]+)\)$/.exec(c);
    if (p) { var rp = traduireCoeur(p[1], profondeur + 1); if (rp !== null) return '(' + rp + ')'; }
    // Segments autour des séparateurs : au moins un segment doit être connu.
    for (var pal = 0; pal < PALIERS.length; pal++) {
      var morceaux = c.split(PALIERS[pal]);
      if (morceaux.length < 2) continue;
      var change = false;
      var sortie = morceaux.map(function (m, j) {
        if (j % 2) return /:/.test(m) && !/[—–·|]/.test(m) ? ': ' : /;/.test(m) ? '; ' : m;
        if (!m || !LETTRE.test(m)) return m;
        var t = traduireCoeur(m, profondeur + 1);
        if (t === null) return m;
        change = true;
        return t;
      });
      if (change) return sortie.join('');
    }
    return null;
  }

  // Remplacements EN LIGNE : un fragment d'interface collé à une donnée dans
  // le même nœud de texte (« Dakar (estimé) »). Liste courte et précise.
  var EN_LIGNE = [];
  function ajouterEnLigne(liste) { EN_LIGNE.push.apply(EN_LIGNE, liste); }
  // traduire(texte) : la version anglaise du texte, ou le texte tel quel s'il
  // n'est pas dans la table. Les espaces de bord sont conservés.
  function traduire(texte) {
    if (typeof texte !== 'string' || !texte || !LETTRE.test(texte)) return texte;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(texte);
    var r = traduireCoeur(m[2], 0);
    var sortie = r === null ? m[2] : r;
    for (var i = 0; i < EN_LIGNE.length; i++) sortie = sortie.replace(EN_LIGNE[i][0], EN_LIGNE[i][1]);
    return sortie === m[2] ? texte : m[1] + sortie + m[3];
  }
  function connu(texte) { return traduire(texte) !== texte; }

  // ── Choix de langue mémorisé ─────────────────────────────────────────────
  function lireChoix(stockage) {
    try { var v = (stockage || global.localStorage).getItem(CLE_STOCKAGE); return v === 'en' ? 'en' : 'fr'; }
    catch (_) { return 'fr'; }
  }
  function memoriser(lang, stockage) {
    try { (stockage || global.localStorage).setItem(CLE_STOCKAGE, lang === 'en' ? 'en' : 'fr'); } catch (_) {}
  }

  // ── Application au DOM ───────────────────────────────────────────────────
  var ATTRIBUTS = ['placeholder', 'title', 'aria-label', 'alt', 'data-tip'];
  var EXCLUS = 'script,style,noscript,textarea,code,pre,[translate="no"],.notranslate,[contenteditable="true"]';
  var ORIGINE = typeof WeakMap === 'function' ? new WeakMap() : null;  // nœud texte → français d'origine
  var POSE = typeof WeakMap === 'function' ? new WeakMap() : null;     // nœud texte → valeur posée par nous
  var ATTR_ORIGINE = typeof WeakMap === 'function' ? new WeakMap() : null;
  var langueActive = 'fr';
  var observateur = null;
  var ignorer = null;

  function exclu(el) {
    if (!el || el.nodeType !== 1) return true;
    return !!(el.closest && el.closest(EXCLUS));
  }
  function traiterTexte(n) {
    var v = n.nodeValue;
    if (!v || POSE.get(n) === v) return;
    if (exclu(n.parentElement)) return;
    var coeur = v.trim();
    if (!coeur || (ignorer && ignorer(coeur))) return;
    var t = traduire(v);
    if (t !== v) {
      ORIGINE.set(n, v);
      POSE.set(n, t);
      n.nodeValue = t;
    }
  }
  function traiterAttributs(el) {
    if (exclu(el)) return;
    var rec = ATTR_ORIGINE.get(el);
    for (var i = 0; i < ATTRIBUTS.length; i++) {
      var a = ATTRIBUTS[i];
      if (!el.hasAttribute(a)) continue;
      var v = el.getAttribute(a);
      if (rec && rec[a] && rec[a].en === v) continue;
      if (ignorer && ignorer(v.trim())) continue;
      var t = traduire(v);
      if (t !== v) {
        rec = rec || {};
        rec[a] = { fr: v, en: t };
        ATTR_ORIGINE.set(el, rec);
        el.setAttribute(a, t);
      }
    }
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type || '')) {
      var val = el.value, tv = traduire(val);
      if (tv !== val && !(rec && rec.value && rec.value.en === val)) {
        rec = rec || {}; rec.value = { fr: val, en: tv }; ATTR_ORIGINE.set(el, rec); el.value = tv;
      }
    }
  }
  function parcourir(racine) {
    if (!racine) return;
    if (racine.nodeType === 3) { traiterTexte(racine); return; }
    if (racine.nodeType !== 1 && racine.nodeType !== 9 && racine.nodeType !== 11) return;
    if (racine.nodeType === 1) { if (exclu(racine)) return; traiterAttributs(racine); }
    var doc = racine.ownerDocument || racine;
    var w = doc.createTreeWalker(racine, 1 | 4, {
      acceptNode: function (n) {
        if (n.nodeType === 1) return n.matches(EXCLUS) ? 2 : 1;   // REJECT saute le sous-arbre
        return 1;
      }
    });
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) traiterTexte(n); else traiterAttributs(n);
    }
  }
  function restaurer(racine) {
    var doc = racine.ownerDocument || racine;
    var w = doc.createTreeWalker(racine, 1 | 4, null);
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) {
        if (ORIGINE.has(n) && POSE.get(n) === n.nodeValue) n.nodeValue = ORIGINE.get(n);
        ORIGINE.delete(n); POSE.delete(n);
      } else {
        var rec = ATTR_ORIGINE.get(n);
        if (!rec) continue;
        for (var a in rec) {
          if (a === 'value') { if (n.value === rec.value.en) n.value = rec.value.fr; continue; }
          if (n.getAttribute(a) === rec[a].en) n.setAttribute(a, rec[a].fr);
        }
        ATTR_ORIGINE.delete(n);
      }
    }
  }
  function surMutations(liste) {
    for (var i = 0; i < liste.length; i++) {
      var m = liste[i];
      if (m.type === 'childList') {
        for (var j = 0; j < m.addedNodes.length; j++) parcourir(m.addedNodes[j]);
      } else if (m.type === 'characterData') {
        traiterTexte(m.target);
      } else if (m.type === 'attributes') {
        traiterAttributs(m.target);
      }
    }
  }

  // activer(lang, options) : applique la langue au document. En anglais, le
  // document entier est traduit puis surveillé ; en français, le texte
  // d'origine est restauré et la surveillance s'arrête.
  //   options.ignorer(texte) → vrai pour un texte à ne jamais traduire
  //   (contenu d'une source).
  function activer(lang, options) {
    var doc = global.document;
    if (!doc || !ORIGINE) { langueActive = lang === 'en' ? 'en' : 'fr'; return; }
    if (options && typeof options.ignorer === 'function') ignorer = options.ignorer;
    langueActive = lang === 'en' ? 'en' : 'fr';
    var racine = doc.documentElement;
    if (langueActive === 'en') {
      parcourir(racine);
      if (!observateur && typeof MutationObserver === 'function') {
        observateur = new MutationObserver(surMutations);
        observateur.observe(racine, { childList: true, subtree: true, characterData: true,
          attributes: true, attributeFilter: ATTRIBUTS.concat(['value']) });
      }
    } else {
      if (observateur) { observateur.disconnect(); observateur = null; }
      restaurer(racine);
    }
  }
  // Retraduit tout le document (table enrichie après coup, par exemple les
  // noms de pays déclarés par la page une fois ses données chargées).
  function rafraichir() { if (langueActive === 'en' && global.document) parcourir(global.document.documentElement); }

  var api = {
    ajouter: ajouter, ajouterMotifs: ajouterMotifs, ajouterEnLigne: ajouterEnLigne, traduire: traduire, connu: connu, cle: cle,
    activer: activer, rafraichir: rafraichir, langue: function () { return langueActive; },
    lireChoix: lireChoix, memoriser: memoriser, CLE_STOCKAGE: CLE_STOCKAGE,
    _dico: DICO,
  };
  global.SentiqLangue = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
