// Formulaire de contact (22/11/2026, demande de YORO).
//
// L'éditeur n'a pas d'adresse e-mail professionnelle, et son adresse
// personnelle ne doit plus figurer sur le site. Un message laissé ici est
// déposé dans Firestore (messages_contact/{clé}) et lu par l'administrateur
// seul, dans Paramètres > « Messages de contact ». Il sert aussi aux demandes
// d'exercice des droits (accès, rectification, suppression) et aux éditeurs
// qui demandent le retrait de leurs contenus.
//
// Pas de serveur (plan gratuit Spark) : la limitation de débit est portée par
// la CLÉ du document, comme pour l'agent de recherche :
//   · compte connecté : {uid}_{jour}_{n}, n < 3 — trois messages par jour ;
//   · sans compte (accès perdu, compte supprimé) : anon_{jour}_{n}, n < 40 —
//     quarante emplacements par jour pour tous les visiteurs sans compte.
// La création seule est permise : un emplacement pris ne se réécrit pas. Un
// abus sans compte peut remplir les quarante emplacements du jour, jamais
// davantage, et ne gêne pas un compte connecté.
//
// Antispam léger côté page : champ piège invisible, délai minimal de
// remplissage, trois liens au plus. Les règles Firestore revérifient tout ce
// qui compte (champs, tailles, objet, jour, clé). Le texte est nettoyé
// (caractères de contrôle et de direction) ; l'affichage chez l'administrateur
// l'échappe : un message n'est jamais du HTML.
//
// Double export : navigateur (window.SentiqContact) et Node (tests).
(function (racine) {
  'use strict';

  var COLLECTION = 'messages_contact';
  var LIMITE_COMPTE = 3;
  var LIMITE_ANONYME = 40;
  var NOM_MAX = 120;
  var EMAIL_MAX = 254;
  var MESSAGE_MIN = 10;
  var MESSAGE_MAX = 3000;
  var LIENS_MAX = 3;
  var DELAI_MIN_MS = 3000;
  var STATUTS = ['nouveau', 'en_cours', 'traite'];

  // Objets proposés. L'ordre est celui de la liste déroulante.
  var OBJETS = [
    { id: 'question', fr: 'Question sur le service', en: 'Question about the service' },
    { id: 'probleme', fr: 'Signaler un problème', en: 'Report a problem' },
    { id: 'facturation', fr: 'Abonnement et facturation', en: 'Subscription and billing' },
    { id: 'droits_acces', fr: 'Accès à mes données', en: 'Access to my data' },
    { id: 'droits_rectification', fr: 'Rectification de mes données', en: 'Correction of my data' },
    { id: 'droits_suppression', fr: 'Suppression de mon compte ou de mes données', en: 'Deletion of my account or data' },
    { id: 'retrait_source', fr: 'Éditeur : retrait de mes contenus', en: 'Publisher: removal of my content' },
    { id: 'autre', fr: 'Autre demande', en: 'Other request' },
  ];
  var IDS_OBJETS = OBJETS.map(function (o) { return o.id; });

  function libelleObjet(id, lang) {
    for (var i = 0; i < OBJETS.length; i++) if (OBJETS[i].id === id) return OBJETS[i][lang === 'en' ? 'en' : 'fr'];
    return lang === 'en' ? 'Other request' : 'Autre demande';
  }

  // Caractères de contrôle (sauf retour à la ligne et tabulation), de largeur
  // nulle et de direction (U+202A-202E, U+2066-2069) : invisibles, ils servent
  // à masquer ou retourner un texte.
  var INVISIBLES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠-⁩﻿]/g;
  function nettoyer(s, max) {
    var t = String(s == null ? '' : s).replace(INVISIBLES, '').replace(/\r\n?/g, '\n');
    t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
    return max ? t.slice(0, max) : t;
  }
  function nettoyerLigne(s, max) {
    return nettoyer(s).replace(/\s+/g, ' ').slice(0, max || 200);
  }
  // Adresse de réponse : une forme simple, la même que dans les règles.
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  function emailValide(e) { return typeof e === 'string' && e.length >= 6 && e.length <= EMAIL_MAX && EMAIL_RE.test(e); }
  function compterLiens(t) { return (String(t).match(/https?:\/\/|www\./gi) || []).length; }

  // valider(champs, opts) → { ok, erreurs: [code…], donnees }.
  // champs : { nom, email, objet, message, piege } ; opts : { ouvertLe, maintenant }.
  // Codes : piege, trop_vite, email, objet, message_court, message_long, liens.
  function valider(champs, opts) {
    champs = champs || {}; opts = opts || {};
    var erreurs = [];
    var maintenant = typeof opts.maintenant === 'number' ? opts.maintenant : Date.now();
    var donnees = {
      nom: nettoyerLigne(champs.nom, NOM_MAX),
      email: nettoyerLigne(champs.email, EMAIL_MAX + 1).toLowerCase(),
      objet: String(champs.objet || ''),
      message: nettoyer(champs.message),
    };
    if (String(champs.piege || '').trim() !== '') erreurs.push('piege');
    if (typeof opts.ouvertLe === 'number' && maintenant - opts.ouvertLe < DELAI_MIN_MS) erreurs.push('trop_vite');
    if (!emailValide(donnees.email)) erreurs.push('email');
    if (IDS_OBJETS.indexOf(donnees.objet) < 0) erreurs.push('objet');
    if (donnees.message.length < MESSAGE_MIN) erreurs.push('message_court');
    if (donnees.message.length > MESSAGE_MAX) erreurs.push('message_long');
    if (compterLiens(donnees.message) > LIENS_MAX) erreurs.push('liens');
    return { ok: erreurs.length === 0, erreurs: erreurs, donnees: donnees };
  }

  var MESSAGES_ERREUR = {
    fr: {
      piege: 'Envoi refusé.', trop_vite: 'Prenez quelques secondes pour relire votre message, puis renvoyez-le.',
      email: 'Indiquez une adresse e-mail valide pour recevoir la réponse.', objet: 'Choisissez un objet.',
      message_court: 'Votre message est trop court (10 caractères au moins).',
      message_long: 'Votre message est trop long (3 000 caractères au plus).',
      liens: 'Trois liens au plus par message.',
      quota: 'Trop de messages aujourd\'hui. Réessayez demain.',
      reseau: 'Envoi impossible pour le moment. Vérifiez votre connexion et réessayez.',
      refus: 'Envoi refusé par le serveur. Réessayez dans quelques minutes.',
    },
    en: {
      piege: 'Sending refused.', trop_vite: 'Take a few seconds to read your message again, then send it.',
      email: 'Enter a valid e-mail address to receive the answer.', objet: 'Choose a subject.',
      message_court: 'Your message is too short (at least 10 characters).',
      message_long: 'Your message is too long (3,000 characters at most).',
      liens: 'Three links at most per message.',
      quota: 'Too many messages today. Please try again tomorrow.',
      reseau: 'Sending is not possible right now. Check your connection and try again.',
      refus: 'The server refused the message. Please try again in a few minutes.',
    },
  };
  function messageErreur(code, lang) { var t = MESSAGES_ERREUR[lang === 'en' ? 'en' : 'fr']; return t[code] || t.reseau; }

  function jourDe(ms) { return Math.floor(ms / 86400000); }
  function idMessage(uid, jour, n) { return (uid ? uid : 'anon') + '_' + jour + '_' + n; }

  function versChamps(d) {
    return {
      uid: { stringValue: d.uid || '' }, nom: { stringValue: d.nom }, email: { stringValue: d.email },
      objet: { stringValue: d.objet }, message: { stringValue: d.message }, lang: { stringValue: d.lang },
      jour: { integerValue: String(d.jour) }, n: { integerValue: String(d.n) },
      at: { timestampValue: d.at }, statut: { stringValue: 'nouveau' },
    };
  }
  function base(cfg) { return 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(cfg.projectId) + '/databases/(default)/documents'; }

  // Ordre des emplacements essayés : dans l'ordre pour un compte (ses trois
  // messages du jour), au hasard pour un visiteur sans compte (quarante
  // emplacements partagés : partir de 0 ferait se heurter tout le monde).
  function ordreEmplacements(uid, depart, alea) {
    var max = uid ? LIMITE_COMPTE : LIMITE_ANONYME;
    var l = [];
    for (var i = Math.max(0, Math.min(max, Number(depart) || 0)); i < max; i++) l.push(i);
    if (!uid) {
      var r = typeof alea === 'function' ? alea : Math.random;
      for (var j = l.length - 1; j > 0; j--) { var k = Math.floor(r() * (j + 1)); var x = l[j]; l[j] = l[k]; l[k] = x; }
      l = l.slice(0, 8);
    }
    return l;
  }

  // deposer(cfg, entetes, donnees, opts) → { id } ou { erreur: 'quota'|'refus'|'reseau' }.
  // donnees : sortie de valider(). opts : { uid, lang, fetchFn, depart, maintenant, alea }.
  // Sans compte, `entetes` est null : la requête part avec la seule clé d'API,
  // comme la réponse d'un destinataire de bulletin (web/js/abonnement.js).
  function deposer(cfg, entetes, donnees, opts) {
    opts = opts || {};
    var fetchFn = opts.fetchFn;
    if (!cfg || !cfg.projectId || !fetchFn || !donnees) return Promise.resolve({ erreur: 'refus' });
    var uid = opts.uid ? String(opts.uid) : '';
    var maintenant = typeof opts.maintenant === 'number' ? opts.maintenant : Date.now();
    var jour = jourDe(maintenant);
    var ordre = ordreEmplacements(uid, opts.depart, opts.alea);
    var pris = 0;
    function essayer(i) {
      if (i >= ordre.length) return Promise.resolve({ erreur: pris || !uid ? 'quota' : 'refus' });
      var n = ordre[i];
      var d = { uid: uid, nom: donnees.nom, email: donnees.email, objet: donnees.objet, message: donnees.message,
        lang: opts.lang === 'en' ? 'en' : 'fr', jour: jour, n: n, at: new Date(maintenant).toISOString() };
      var id = idMessage(uid, jour, n);
      var url = base(cfg) + '/' + COLLECTION + '?documentId=' + encodeURIComponent(id)
        + (cfg.apiKey ? '&key=' + encodeURIComponent(cfg.apiKey) : '');
      return Promise.resolve(fetchFn(url, {
        method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, entetes || {}),
        body: JSON.stringify({ fields: versChamps(d) }),
      })).then(function (r) {
        if (r && r.ok) return { id: id, n: n };
        // 409 : emplacement déjà pris ; 403 : pris (créer sur un document
        // existant est une mise à jour, que les règles refusent) ou refusé.
        if (r && (r.status === 409 || r.status === 403)) { pris++; return essayer(i + 1); }
        return { erreur: 'reseau' };
      }, function () { return { erreur: 'reseau' }; });
    }
    return essayer(0);
  }

  // Lecture côté administrateur : un document REST → message validé, ou null.
  function lireChamp(f, k) {
    var v = f && f[k];
    if (!v) return '';
    if (v.stringValue != null) return String(v.stringValue);
    if (v.integerValue != null) return String(v.integerValue);
    if (v.timestampValue != null) return String(v.timestampValue);
    return '';
  }
  function messageDepuisDoc(doc) {
    if (!doc || !doc.fields) return null;
    var f = doc.fields;
    var m = {
      id: String(doc.name || '').split('/').pop(),
      uid: lireChamp(f, 'uid'), nom: nettoyerLigne(lireChamp(f, 'nom'), NOM_MAX),
      email: nettoyerLigne(lireChamp(f, 'email'), EMAIL_MAX), objet: lireChamp(f, 'objet'),
      message: nettoyer(lireChamp(f, 'message'), MESSAGE_MAX), lang: lireChamp(f, 'lang') === 'en' ? 'en' : 'fr',
      at: lireChamp(f, 'at'), statut: lireChamp(f, 'statut'),
      traitePar: nettoyerLigne(lireChamp(f, 'traitePar'), EMAIL_MAX), traiteLe: lireChamp(f, 'traiteLe'),
    };
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(m.id) || !m.message) return null;
    if (STATUTS.indexOf(m.statut) < 0) m.statut = 'nouveau';
    if (IDS_OBJETS.indexOf(m.objet) < 0) m.objet = 'autre';
    if (!emailValide(m.email)) m.email = '';
    return m;
  }
  // Plus récents d'abord ; les nouveaux avant ceux déjà traités.
  function trierMessages(l) {
    var rang = { nouveau: 0, en_cours: 1, traite: 2 };
    return l.slice().sort(function (a, b) {
      return (rang[a.statut] - rang[b.statut]) || String(b.at).localeCompare(String(a.at));
    });
  }
  function lister(cfg, entetes, fetchFn) {
    if (!cfg || !cfg.projectId || !entetes || !fetchFn) return Promise.resolve(null);
    return Promise.resolve(fetchFn(base(cfg) + '/' + COLLECTION + '?pageSize=300', { headers: entetes }))
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return null;
        return trierMessages((j.documents || []).map(messageDepuisDoc).filter(Boolean));
      }, function () { return null; });
  }
  function changerStatut(cfg, entetes, id, statut, par, fetchFn) {
    if (!cfg || !entetes || !fetchFn || STATUTS.indexOf(statut) < 0 || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) return Promise.resolve(false);
    var url = base(cfg) + '/' + COLLECTION + '/' + id
      + '?updateMask.fieldPaths=statut&updateMask.fieldPaths=traitePar&updateMask.fieldPaths=traiteLe&currentDocument.exists=true';
    return Promise.resolve(fetchFn(url, {
      method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json' }, entetes),
      body: JSON.stringify({ fields: { statut: { stringValue: statut }, traitePar: { stringValue: String(par || '') }, traiteLe: { stringValue: new Date().toISOString() } } }),
    })).then(function (r) { return !!(r && r.ok); }, function () { return false; });
  }
  function supprimer(cfg, entetes, id, fetchFn) {
    if (!cfg || !entetes || !fetchFn || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) return Promise.resolve(false);
    return Promise.resolve(fetchFn(base(cfg) + '/' + COLLECTION + '/' + id, { method: 'DELETE', headers: entetes }))
      .then(function (r) { return !!(r && r.ok); }, function () { return false; });
  }

  // Lien « Répondre » de l'administrateur : ouvre SA messagerie, l'adresse de
  // réponse du visiteur en destinataire. Rien de ce lien n'est affiché au
  // visiteur ; l'objet reprend celui de la demande.
  function lienReponse(m) {
    if (!m || !emailValide(m.email)) return '';
    return 'mailto:' + encodeURIComponent(m.email).replace(/%40/g, '@')
      + '?subject=' + encodeURIComponent('SentiqS — ' + libelleObjet(m.objet, m.lang));
  }

  var api = {
    COLLECTION: COLLECTION, OBJETS: OBJETS, STATUTS: STATUTS,
    LIMITE_COMPTE: LIMITE_COMPTE, LIMITE_ANONYME: LIMITE_ANONYME, NOM_MAX: NOM_MAX,
    MESSAGE_MIN: MESSAGE_MIN, MESSAGE_MAX: MESSAGE_MAX, LIENS_MAX: LIENS_MAX, DELAI_MIN_MS: DELAI_MIN_MS,
    libelleObjet: libelleObjet, nettoyer: nettoyer, valider: valider, messageErreur: messageErreur,
    emailValide: emailValide, jourDe: jourDe, idMessage: idMessage, versChamps: versChamps,
    ordreEmplacements: ordreEmplacements, deposer: deposer, messageDepuisDoc: messageDepuisDoc,
    trierMessages: trierMessages, lister: lister, changerStatut: changerStatut, supprimer: supprimer,
    lienReponse: lienReponse,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else racine.SentiqContact = api;
})(typeof window !== 'undefined' ? window : this);
