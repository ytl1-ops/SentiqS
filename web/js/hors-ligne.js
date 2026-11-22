// ════════════════════════════════════════════════════════════════════
//  SentiqS — version hors ligne (22/11/2026)
// ════════════════════════════════════════════════════════════════════
// Demande de YORO : « je n'ai pas de serveur, trouve une solution pour faire
// tourner l'appli sur Google Drive, sur mon PC ou sur mobile ». L'appli
// tourne déjà sans serveur à gérer (GitHub Pages + Firebase gratuit + GitHub
// Actions) ; ce qui manquait, c'est de pouvoir la consulter quand Internet,
// GitHub ou Firebase ne répondent pas.
//
// Un utilisateur connecté (forfait payant ou administrateur) télécharge depuis
// le menu « Plus » UN fichier HTML autonome : la page, ses scripts locaux
// recopiés dedans, et un instantané des actus et de l'archive des niveaux.
// Ce fichier s'ouvre d'un double-clic sur un PC, se range sur Google Drive,
// une clé USB ou une pièce jointe, et fonctionne sans réseau.
//
// Trois règles, parce qu'un instantané qui se ferait passer pour du direct
// est pire que pas d'instantané :
//  1. l'horloge de la page est ramenée à l'instant de l'instantané : les
//     actus de la fenêtre de 36 h restent celles que l'utilisateur voyait,
//     au lieu de disparaître toutes au bout de 36 h et de laisser croire au
//     calme (voir « Silence n'est pas calme » dans CLAUDE.md) ;
//  2. un bandeau permanent dit la date réelle de l'instantané et son âge
//     réel, compté avec la vraie horloge ;
//  3. aucune collecte, aucun envoi : le fichier ne lit que ce qu'il contient.
//
// Le fichier contient des actus réservées aux comptes : il ne se génère
// qu'avec une session ouverte, comme un export Word ou PDF, et ne doit pas
// être publié (jamais dans le dépôt, jamais en artefact public).
// Double export navigateur / CommonJS, comme noyau.js, pour les tests.
(function (racine, fabrique) {
  var m = fabrique();
  if (typeof module === 'object' && module.exports) module.exports = m;
  if (racine) racine.SentiqHorsLigne = m;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  // Fichiers de données que la page lit par fetch() : recopiés dans
  // l'instantané, servis par le fetch() de remplacement. Le cumul mensuel
  // des faits (rapports/mensuel/faits-*.json, ~1 Mo) n'y est pas : seul
  // l'assistant le lit, et il se rabat sur les actus présentes.
  var FICHIERS_DONNEES = [
    'historique/serie.json',
    'historique/avis-officiels.json',
    'agenda/externe.json',
    'bulletins/index.json'
  ];
  // Borne de taille : ~2 600 actus pèsent ~3 Mo. Au-delà, les plus récentes.
  var MAX_ARTICLES = 5000;
  var VERSION = 1;

  // Un texte recopié dans un <script> ne doit jamais le refermer.
  function echapperScript(t) {
    return String(t).replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
  }
  function jsonDansScript(o) {
    return JSON.stringify(o)
      .replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }

  var RE_SCRIPT_LOCAL = /<script\s+src="(js\/[A-Za-z0-9._-]+\.js)"\s*><\/script>/g;
  function scriptsLocaux(html) {
    var res = [], m;
    RE_SCRIPT_LOCAL.lastIndex = 0;
    while ((m = RE_SCRIPT_LOCAL.exec(html))) if (res.indexOf(m[1]) < 0) res.push(m[1]);
    return res;
  }

  // construire(html, scripts, instantane) → texte du fichier autonome.
  // scripts : { 'js/x.js': texte } ; il doit contenir chaque script local de
  // la page ET js/hors-ligne.js (posé en tête pour s'installer avant tout).
  // Police d'icônes (Tabler, chargée depuis jsDelivr) : sans elle, hors
  // réseau, les boutons d'icône du téléphone sont des cases vides. Le
  // générateur la recopie en data URL ; la CSP du fichier l'autorise.
  var RE_LIEN_ICONES = /<link\s+rel="stylesheet"\s+href="(https:\/\/cdn\.jsdelivr\.net\/npm\/@tabler\/icons-webfont@[^"]+\.css)"\s*\/?>/;

  function construire(html, scripts, instantane, opts) {
    opts = opts || {};
    if (typeof html !== 'string' || html.indexOf('<head') < 0) throw new Error('page illisible');
    var propre = scripts['js/hors-ligne.js'];
    if (!propre) throw new Error('js/hors-ligne.js manquant');
    var manquants = scriptsLocaux(html).filter(function (s) { return typeof scripts[s] !== 'string'; });
    if (manquants.length) throw new Error('scripts manquants : ' + manquants.join(', '));
    var inline = function (morceau) {
      return morceau.replace(RE_SCRIPT_LOCAL, function (_, src) {
        // hors-ligne.js est déjà en tête : inutile de l'exécuter deux fois.
        if (src === 'js/hors-ligne.js') return '<!-- ' + src + ' : en tête -->';
        return '<script data-src="' + src + '">' + echapperScript(scripts[src]) + '\n</script>';
      });
    };
    var tete = '<script data-src="instantane">window.SENTIQ_HORS_LIGNE=' + jsonDansScript(instantane) + ';</script>\n'
      + '<script data-src="js/hors-ligne.js">' + echapperScript(propre)
      + '\nSentiqHorsLigne.installer(window);</script>\n';
    // Point d'insertion cherché dans la page AVANT d'y recopier les scripts :
    // un script recopié peut lui-même contenir « <meta charset> » dans une
    // chaîne (bulletin-message.js), et l'instantané y aurait été inséré.
    var mc = /<meta\s+(charset=|http-equiv="Content-Type")[^>]*>/i.exec(html);
    var pos = mc ? mc.index + mc[0].length : -1;
    if (pos < 0) {
      var h = /<head[^>]*>/i.exec(html);
      pos = h.index + h[0].length;
    }
    var res = inline(html.slice(0, pos)) + '\n' + tete + inline(html.slice(pos));
    if (opts.cssIcones) {
      res = res.replace(RE_LIEN_ICONES, function () { return '<style data-src="icones">' + String(opts.cssIcones).replace(/<\/style/gi, '<\\/style') + '</style>'; });
      res = res.replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*?font-src\s)/, '$1data: ');
    }
    return res;
  }

  // cheminDonnee(url) : 'historique/serie.json' pour 'historique/serie.json?v=3',
  // './historique/serie.json' ou une adresse absolue qui se termine ainsi.
  function cheminDonnee(url, connus) {
    var u = String(url || '').split('#')[0].split('?')[0];
    for (var i = 0; i < connus.length; i++) {
      var c = connus[i];
      if (u === c || u === './' + c || (u.length > c.length && u.slice(-c.length - 1) === '/' + c)) return c;
    }
    return null;
  }
  function estAdresseLocale(url) {
    var u = String(url || '');
    return !/^[a-z][a-z0-9+.-]*:/i.test(u) || /^file:/i.test(u);
  }

  // installer(win) : exécuté en tête du fichier autonome, avant tout script
  // de la page. Ne fait rien dans la page servie normalement.
  function installer(win) {
    var inst = win && win.SENTIQ_HORS_LIGNE;
    if (!inst || typeof inst.t !== 'number') return false;
    var R = win.Date;
    var vraiOuverture = R.now();
    var decalage = inst.t - vraiOuverture;
    inst.vraiOuverture = vraiOuverture;
    inst.vraiMaintenant = function () { return R.now(); };
    // Horloge ramenée à l'instantané (règle 1). Un appel sans argument donne
    // l'instant de l'instantané plus le temps écoulé depuis l'ouverture ;
    // une date explicite reste cette date.
    var D = function () {
      if (!(this instanceof D)) return new R(R.now() + decalage).toString();
      if (!arguments.length) return new R(R.now() + decalage);
      var a = [null];
      for (var i = 0; i < arguments.length; i++) a.push(arguments[i]);
      return new (Function.prototype.bind.apply(R, a))();
    };
    D.prototype = R.prototype;
    D.now = function () { return R.now() + decalage; };
    D.parse = R.parse;
    D.UTC = R.UTC;
    win.Date = D;
    // fetch() : les données recopiées, jamais le réseau pour un fichier local.
    var fichiers = inst.fichiers || {};
    var connus = Object.keys(fichiers);
    var vraiFetch = win.fetch;
    win.fetch = function (entree) {
      var url = typeof entree === 'string' ? entree : (entree && entree.url) || '';
      var cle = cheminDonnee(url, connus);
      if (cle) {
        return Promise.resolve(new win.Response(JSON.stringify(fichiers[cle]), {
          status: 200, headers: { 'content-type': 'application/json' }
        }));
      }
      if (estAdresseLocale(url)) return Promise.resolve(new win.Response('', { status: 404 }));
      if (!vraiFetch) return Promise.reject(new TypeError('hors ligne'));
      return vraiFetch.apply(win, arguments);
    };
    return true;
  }

  function actif(win) {
    var inst = win && win.SENTIQ_HORS_LIGNE;
    return !!(inst && typeof inst.t === 'number');
  }

  // Âge réel, en mots, pour le bandeau.
  function ageLisible(ms, lang) {
    var en = lang === 'en';
    var min = Math.max(0, Math.round(ms / 60000));
    if (min < 60) return en ? (min + ' min ago') : ('il y a ' + min + ' min');
    var h = Math.round(min / 60);
    if (h < 48) return en ? (h + ' h ago') : ('il y a ' + h + ' h');
    var j = Math.round(h / 24);
    return en ? (j + ' days ago') : ('il y a ' + j + ' jours');
  }

  // texteBandeau(inst, vraiMaintenant, lang) → { texte, perime }.
  // « Périmé » au-delà de la fenêtre d'actualité : ce qui est affiché comme
  // actualité ne l'est plus, et le bandeau doit le dire plus fort.
  function texteBandeau(inst, vraiMaintenant, lang, fenetreMs) {
    var en = lang === 'en';
    var age = vraiMaintenant - inst.t;
    var d = new Date(inst.t);
    var quand;
    try {
      quand = d.toLocaleString(en ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) { quand = d.toISOString(); }
    var perime = age > (fenetreMs || 36 * 3600000);
    var texte = en
      ? 'Offline version — snapshot of ' + quand + ' (' + ageLisible(age, 'en') + '). No collection: levels and news are those of that moment.'
      : 'Version hors ligne — instantané du ' + quand + ' (' + ageLisible(age, 'fr') + '). Aucune collecte : niveaux et actus sont ceux de cet instant.';
    if (perime) texte += en ? ' This is no longer current news.' : ' Ce n\'est plus de l\'actualité.';
    return { texte: texte, perime: perime };
  }

  // instantaneDepuis(articles, extra) : l'objet recopié dans le fichier.
  function instantaneDepuis(articles, extra) {
    var arts = (Array.isArray(articles) ? articles : []).slice();
    if (arts.length > MAX_ARTICLES) {
      arts.sort(function (a, b) { return (b.pubDate || 0) - (a.pubDate || 0); });
      arts = arts.slice(0, MAX_ARTICLES);
    }
    var o = { v: VERSION, t: Date.now(), articles: arts, fichiers: {} };
    for (var k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  }

  function nomFichier(t) {
    var d = new Date(t), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return 'SentiqS-hors-ligne-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
      + '-' + p(d.getHours()) + 'h' + p(d.getMinutes()) + '.html';
  }

  // generer(win, instantane) : lit la page servie et ses scripts sur le
  // même site, puis construit le fichier. Rejette si une pièce manque :
  // un fichier sans noyau.js ne calculerait aucun niveau.
  function generer(win, instantane) {
    var f = win.fetch.bind(win);
    var page = (win.location.pathname.split('/').pop()) || 'SentiqS_Web.html';
    var lire = function (u, json) {
      return f(u, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error(u + ' : ' + r.status);
        return json ? r.json() : r.text();
      });
    };
    return lire(page).then(function (html) {
      var aLire = scriptsLocaux(html);
      if (aLire.indexOf('js/hors-ligne.js') < 0) aLire.push('js/hors-ligne.js');
      var scripts = {};
      var donnees = FICHIERS_DONNEES.map(function (c) {
        return lire(c, true).then(function (j) { instantane.fichiers[c] = j; }, function () { /* absent : la page s'en passe */ });
      });
      var opts = {};
      var icones = iconesEnLigne(win, html).then(function (css) { opts.cssIcones = css; }, function () { /* icônes absentes : texte seul */ });
      return Promise.all(aLire.map(function (s) { return lire(s).then(function (t) { scripts[s] = t; }); }).concat(donnees, [icones]))
        .then(function () { return construire(html, scripts, instantane, opts); });
    });
  }

  function base64(buf) {
    var o = new Uint8Array(buf), b = '', pas = 0x8000;
    for (var i = 0; i < o.length; i += pas) b += String.fromCharCode.apply(null, o.subarray(i, i + pas));
    return btoa(b);
  }
  function iconesEnLigne(win, html) {
    var m = RE_LIEN_ICONES.exec(html);
    if (!m) return Promise.reject(new Error('pas de police d\'icônes'));
    var base = m[1].replace(/[^/]+$/, '');
    return win.fetch(m[1]).then(function (r) { if (!r.ok) throw new Error('css ' + r.status); return r.text(); }).then(function (css) {
      var w = /url\(["']?([^"')]+\.woff2)(\?[^"')]*)?["']?\)/.exec(css);
      if (!w) throw new Error('woff2 introuvable');
      return win.fetch(new URL(w[1], base).href).then(function (r) { if (!r.ok) throw new Error('woff2 ' + r.status); return r.arrayBuffer(); }).then(function (buf) {
        var face = '@font-face{font-family:"tabler-icons";font-style:normal;font-weight:400;src:url(data:font/woff2;base64,' + base64(buf) + ') format("woff2")}';
        return face + css.replace(/@font-face\s*\{[^}]*\}/g, '');
      });
    });
  }

  return {
    iconesEnLigne: iconesEnLigne,
    FICHIERS_DONNEES: FICHIERS_DONNEES,
    MAX_ARTICLES: MAX_ARTICLES,
    scriptsLocaux: scriptsLocaux,
    construire: construire,
    cheminDonnee: cheminDonnee,
    installer: installer,
    actif: actif,
    ageLisible: ageLisible,
    texteBandeau: texteBandeau,
    instantaneDepuis: instantaneDepuis,
    nomFichier: nomFichier,
    generer: generer
  };
});
