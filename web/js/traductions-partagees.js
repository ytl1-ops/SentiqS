// ═══════════════════════════════════════════════════════════════════════════
//  SentiqS — traductions partagées entre utilisateurs (20/11/2026)
//
//  Demande de YORO : « que les actus ouvertes persistent pour les autres,
//  pour empêcher de nombreuses sollicitations de traduction ». Le job traduit
//  pour tous le titre et le chapô de chaque actu (a.tr, scripts/lib/
//  traduction-actus.js), mais il ne passe qu'une fois par heure, avec un
//  budget : entre deux passages, chaque navigateur retraduisait les mêmes
//  textes, à chaque ouverture (TR_CACHE ne vit qu'en mémoire), auprès de
//  services gratuits qui saturent.
//
//  Désormais, une traduction obtenue par un navigateur est rangée dans
//  Firestore (`traductions/{clé}`), et le navigateur suivant la relit au lieu
//  de rappeler un service. Clé = SHA-256 de « langue cible \n texte envoyé » :
//  le texte source lui-même n'est pas un nom de document possible (longueur,
//  caractères), et deux navigateurs qui envoient le même texte retombent sur
//  la même clé.
//
//  Règles (firebase/firestore.rules) : lecture et création par un compte
//  actif dont l'accès est en cours ; création seulement (la première
//  traduction rangée reste, personne ne la réécrit) ; la clé doit être
//  l'empreinte du texte qu'elle porte ; l'auteur est noté. Une traduction du
//  job (a.tr) passe toujours avant : la page ne cherche ici que ce qui
//  manque.
//
//  Partagé par la page (navigateur) et les tests (Node) : double export.
// ═══════════════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var COLLECTION = 'traductions';
  var CIBLES = ['fr', 'en'];
  // Bornes communes avec les règles : un texte envoyé fait au plus
  // EXTRAIT_MAX_CARACTERES + 40 (320) caractères dans la page ; 600 laisse
  // de la marge. Une traduction peut être plus longue que sa source.
  var SOURCE_MAX = 600;
  var TRADUCTION_MAX = 1500;
  // batchGet accepte bien plus, mais une réponse courte se lit vite et un
  // refus ne coûte qu'un lot.
  var LOT_MAX = 100;

  function moteurCrypto() {
    if (global.crypto && global.crypto.subtle) return global.crypto.subtle;
    try { return require('crypto').webcrypto.subtle; } catch (_) { return null; }
  }
  function hex(buf) {
    var o = new Uint8Array(buf), s = '';
    for (var i = 0; i < o.length; i++) s += (o[i] < 16 ? '0' : '') + o[i].toString(16);
    return s;
  }
  // cle(cible, texteEnvoye) : empreinte hexadécimale minuscule, 64 caractères.
  // Les règles recalculent la même (hashing.sha256) : une traduction ne peut
  // pas être rangée sous la clé d'un autre texte.
  function cle(cible, texteEnvoye) {
    var st = moteurCrypto();
    if (!st || typeof TextEncoder === 'undefined') return Promise.resolve(null);
    return st.digest('SHA-256', new TextEncoder().encode(cible + '\n' + texteEnvoye)).then(hex);
  }

  // uidDuJeton(jeton) : identifiant du compte lu dans le jeton d'identité
  // (champ user_id, à défaut sub). Les règles exigent qu'il soit celui de la
  // session : on ne range jamais une traduction au nom d'un autre.
  function uidDuJeton(jeton) {
    try {
      var p = String(jeton || '').split('.')[1];
      if (!p) return null;
      p = p.replace(/-/g, '+').replace(/_/g, '/');
      while (p.length % 4) p += '=';
      var txt = typeof atob === 'function' ? atob(p) : Buffer.from(p, 'base64').toString('binary');
      var o = JSON.parse(decodeURIComponent(escape(txt)));
      return (o && (o.user_id || o.sub)) || null;
    } catch (_) { return null; }
  }

  function base(cfg) {
    return 'projects/' + cfg.projectId + '/databases/(default)/documents';
  }
  function url(cfg, suite) {
    return 'https://firestore.googleapis.com/v1/' + base(cfg) + suite;
  }

  // lire(cfg, entetes, demandes, fetchFn) : demandes = [{cible, s}] (s = texte
  // envoyé). Rend une Map « cible + '\n' + s » → traduction, pour celles qui
  // existent. Un refus, une panne ou un document mal formé ne lève jamais :
  // le navigateur traduit alors lui-même, comme avant.
  function lire(cfg, entetes, demandes, fetchFn) {
    var trouve = new Map();
    if (!cfg || !cfg.projectId || !entetes || !fetchFn || !demandes || !demandes.length) return Promise.resolve(trouve);
    var valides = demandes.filter(function (d) {
      return d && CIBLES.indexOf(d.cible) !== -1 && typeof d.s === 'string' && d.s && d.s.length <= SOURCE_MAX;
    });
    return Promise.all(valides.map(function (d) { return cle(d.cible, d.s); })).then(function (cles) {
      var parNom = {};
      valides.forEach(function (d, i) { if (cles[i]) parNom[base(cfg) + '/' + COLLECTION + '/' + cles[i]] = d; });
      var noms = Object.keys(parNom);
      var lots = [];
      for (var i = 0; i < noms.length; i += LOT_MAX) lots.push(noms.slice(i, i + LOT_MAX));
      return Promise.all(lots.map(function (lot) {
        return Promise.resolve(fetchFn(url(cfg, ':batchGet'), {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, entetes),
          body: JSON.stringify({ documents: lot }),
        })).then(function (r) { return r && r.ok ? r.json() : []; }).then(function (rep) {
          (Array.isArray(rep) ? rep : []).forEach(function (e) {
            var doc = e && e.found;
            var d = doc && parNom[doc.name];
            var f = doc && doc.fields;
            if (!d || !f) return;
            var c = f.c && f.c.stringValue, s = f.s && f.s.stringValue, t = f.t && f.t.stringValue;
            // Le texte porté doit être celui demandé : jamais une traduction
            // d'un autre texte, même sous la bonne clé.
            if (c !== d.cible || s !== d.s || typeof t !== 'string' || !t.trim() || t.length > TRADUCTION_MAX) return;
            trouve.set(d.cible + '\n' + d.s, t);
          });
        }, function () { /* lot perdu : traduit localement */ });
      }));
    }).then(function () { return trouve; }, function () { return trouve; });
  }

  // ecrire(cfg, entetes, uid, cible, s, t, fetchFn, maintenant) : range une
  // traduction, création seule (documentId imposé : un second navigateur qui
  // arrive avec la même reçoit 409, c'est normal). Rend vrai si rangée.
  function ecrire(cfg, entetes, uid, cible, s, t, fetchFn, maintenant) {
    if (!cfg || !cfg.projectId || !entetes || !uid || !fetchFn) return Promise.resolve(false);
    if (CIBLES.indexOf(cible) === -1 || typeof s !== 'string' || !s || s.length > SOURCE_MAX) return Promise.resolve(false);
    if (typeof t !== 'string' || !t.trim() || t.length > TRADUCTION_MAX || t.trim() === s.trim()) return Promise.resolve(false);
    return cle(cible, s).then(function (k) {
      if (!k) return false;
      var at = new Date(maintenant === undefined ? Date.now() : maintenant).toISOString();
      return Promise.resolve(fetchFn(url(cfg, '/' + COLLECTION + '?documentId=' + k), {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, entetes),
        body: JSON.stringify({ fields: {
          c: { stringValue: cible }, s: { stringValue: s }, t: { stringValue: t },
          uid: { stringValue: uid }, at: { timestampValue: at },
        } }),
      })).then(function (r) { return !!(r && r.ok); }, function () { return false; });
    }, function () { return false; });
  }

  var api = { cle: cle, uidDuJeton: uidDuJeton, lire: lire, ecrire: ecrire,
    COLLECTION: COLLECTION, SOURCE_MAX: SOURCE_MAX, TRADUCTION_MAX: TRADUCTION_MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.SentiqTraductionsPartagees = api;
})(typeof window !== 'undefined' ? window : globalThis);
