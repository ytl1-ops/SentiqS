// ═══════════════════════════════════════════════════════════════════════════
//  SentiqS — cache d'actus partagé sur Firestore (étape 2 de FIREBASE.md)
//
//  Le projet Supabase a dépassé son quota de transfert le 27/10/2026 (402,
//  « exceed_egress_quota ») : chaque visiteur relisait 1,4 Mo de JSON à chaque
//  ouverture, et le cache partagé ne se rafraîchissait plus pour personne.
//
//  Firestore plafonne un document à 1 Mo. Le cache est donc :
//    · sérialisé en JSON, compressé (gzip) puis encodé en base64 — une chaîne,
//      environ cinq à huit fois plus petite que le JSON ;
//    · découpé en morceaux de PARTIE_MAX caractères, chacun dans son document
//      `collecte_partagee/global_<emplacement>_<n>` ;
//    · annoncé par un document `collecte_partagee/global` (updated_at, nombre
//      de morceaux, emplacement courant). Deux emplacements, « a » et « b » :
//      l'écriture remplit celui qui n'est PAS annoncé, puis bascule l'annonce.
//      Un visiteur qui lit pendant une publication voit donc l'ancien cache
//      entier, jamais un mélange de deux versions.
//
//  Ce fichier est la partie commune : la page (lecture, via l'API REST, sans
//  SDK) et le job de collecte (Node, qui y ajoute l'écriture, voir
//  scripts/lib/cache-firestore-ecriture.js). Aucune clé privée ici : la lecture
//  est publique (firebase/firestore.rules), seule l'écriture passe par le
//  compte de service du workflow.
// ═══════════════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var COLLECTION = 'collecte_partagee';
  var ID_ANNONCE = 'global';
  // Un document Firestore pèse 1 048 576 octets au plus, champs et nom
  // compris : 700 000 caractères ASCII laissent une large marge.
  var PARTIE_MAX = 700000;
  var CLE_LOCALE = 'sentiq_cache_firestore';

  function racine(cfg) {
    return 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(cfg.projectId)
      + '/databases/(default)/documents/' + COLLECTION;
  }
  function idPartie(emplacement, n) { return ID_ANNONCE + '_' + emplacement + '_' + n; }

  function decouper(texte, taille) {
    var t = taille || PARTIE_MAX, parts = [];
    for (var i = 0; i < texte.length; i += t) parts.push(texte.slice(i, i + t));
    return parts.length ? parts : [''];
  }

  // Valeurs typées de l'API REST -> valeurs simples.
  function valeur(champ) {
    if (!champ) return undefined;
    if ('stringValue' in champ) return champ.stringValue;
    if ('integerValue' in champ) return Number(champ.integerValue);
    if ('timestampValue' in champ) return champ.timestampValue;
    return undefined;
  }

  function base64VersOctets(b64) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
    var bin = global.atob(b64), o = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i);
    return o;
  }

  // base64 gzip -> articles. Navigateur : DecompressionStream ; Node : zlib.
  function decoder(b64) {
    var octets = base64VersOctets(b64);
    if (typeof DecompressionStream === 'function' && typeof Response === 'function') {
      var flux = new Response(new Blob([octets]).stream().pipeThrough(new DecompressionStream('gzip')));
      return flux.text().then(function (t) { return JSON.parse(t); });
    }
    try {
      var zlib = require('node:zlib');
      return Promise.resolve(JSON.parse(zlib.gunzipSync(Buffer.from(octets)).toString('utf8')));
    } catch (e) { return Promise.reject(e); }
  }

  function lireJson(fetchFn, url, entetes) {
    return fetchFn(url, entetes ? { headers: entetes } : undefined).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('Firestore HTTP ' + r.status);
      return r.json();
    });
  }

  // Lit l'annonce seule (un document de quelques octets) : suffit à savoir si
  // le cache a changé, et son âge, sans transférer les morceaux.
  function lireAnnonce(cfg, fetchFn, entetes) {
    return lireJson(fetchFn, racine(cfg) + '/' + ID_ANNONCE + '?key=' + encodeURIComponent(cfg.apiKey), entetes)
      .then(function (d) {
        if (!d || !d.fields) return null;
        var f = d.fields;
        var a = {
          updated_at: valeur(f.updated_at), parts: valeur(f.parts),
          emplacement: valeur(f.emplacement), nb: valeur(f.nb),
        };
        return (a.updated_at && a.parts > 0 && (a.emplacement === 'a' || a.emplacement === 'b')) ? a : null;
      });
  }

  function lireMorceaux(cfg, fetchFn, annonce, entetes) {
    var demandes = [];
    for (var n = 0; n < annonce.parts; n++) {
      demandes.push(lireJson(fetchFn, racine(cfg) + '/' + idPartie(annonce.emplacement, n)
        + '?key=' + encodeURIComponent(cfg.apiKey), entetes));
    }
    return Promise.all(demandes).then(function (docs) {
      return docs.map(function (d) {
        var v = d && d.fields ? valeur(d.fields.d) : undefined;
        if (typeof v !== 'string') throw new Error('morceau du cache illisible');
        return v;
      }).join('');
    });
  }

  // lire(cfg, { fetchFn, stockage }) -> { articles, updated_at, inchange? } | null
  //
  // Avec `stockage` (localStorage), la dernière version lue est gardée : si
  // l'annonce n'a pas changé, les morceaux ne sont pas retéléchargés. C'est ce
  // qui évite de refaire payer le transfert à chaque ouverture de la page — la
  // cause du dépassement de quota de Supabase.
  function lire(cfg, options) {
    options = options || {};
    var fetchFn = options.fetchFn || (typeof fetch === 'function' ? fetch.bind(global) : null);
    if (!cfg || !cfg.projectId || !cfg.apiKey || !fetchFn) return Promise.resolve(null);
    var st = options.stockage || null;
    var local = null;
    try { local = st ? JSON.parse(st.getItem(CLE_LOCALE) || 'null') : null; } catch (_) { local = null; }
    return lireAnnonce(cfg, fetchFn, options.entetes).then(function (annonce) {
      if (!annonce) return null;
      var memeVersion = local && local.updated_at === annonce.updated_at && local.emplacement === annonce.emplacement
        && typeof local.donnees === 'string';
      var donnees = memeVersion ? Promise.resolve(local.donnees) : lireMorceaux(cfg, fetchFn, annonce, options.entetes);
      return donnees.then(function (b64) {
        return decoder(b64).then(function (articles) {
          if (!Array.isArray(articles)) return null;
          if (st && !memeVersion) {
            try { st.setItem(CLE_LOCALE, JSON.stringify({ updated_at: annonce.updated_at, emplacement: annonce.emplacement, donnees: b64 })); } catch (_) { /* quota local : sans conséquence */ }
          }
          return { articles: articles, updated_at: annonce.updated_at, inchange: !!memeVersion, annonce: annonce };
        });
      });
    });
  }

  var api = {
    COLLECTION: COLLECTION, ID_ANNONCE: ID_ANNONCE, PARTIE_MAX: PARTIE_MAX, CLE_LOCALE: CLE_LOCALE,
    racine: racine, idPartie: idPartie, decouper: decouper, valeur: valeur,
    decoder: decoder, lireAnnonce: lireAnnonce, lireMorceaux: lireMorceaux, lire: lire,
  };
  global.SentiqCacheFirestore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
