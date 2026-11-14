// Domaine canonique des pages publiques (référencement, 14/11/2026).
//
// Le même dossier web/ est servi à trois adresses : GitHub Pages
// (ytl1-ops.github.io/SentiqS), Firebase (sentiqs-235ce.web.app) et son alias
// sentiqs-235ce.firebaseapp.com. Pour un moteur de recherche, ce sont trois
// copies du même site qui se concurrencent. Le domaine retenu est
// sentiqs-235ce.web.app : c'est une racine (robots.txt et sitemap.xml y sont
// lus, ce que GitHub Pages ne permet pas sous /SentiqS/), il porte les
// en-têtes HTTP de firebase.json, et l'application Android l'ouvre déjà.
//
// Chargé seulement par les pages PUBLIQUES (accueil, fiches pays, bulletins
// publics). Jamais par l'application ni par abonnement.html : un utilisateur
// existant garderait ses réglages locaux (marque, logo, identités) sur
// l'adresse qu'il utilise, et la collecte planifiée ouvre l'application sur
// GitHub Pages.
(function (racine) {
  'use strict';
  var CANONIQUE = 'https://sentiqs-235ce.web.app';

  // Adresse canonique d'une adresse servie, ou null si elle l'est déjà ou si
  // elle n'est pas une copie connue (poste local, banc de test).
  function adresseCanonique(loc) {
    var h = String(loc.hostname || '').toLowerCase(), chemin = loc.pathname || '/';
    if (h === 'ytl1-ops.github.io') {
      if (!/^\/SentiqS(\/|$)/.test(chemin)) return null;
      chemin = chemin.replace(/^\/SentiqS/, '') || '/';
    } else if (h !== 'sentiqs-235ce.firebaseapp.com') {
      return null;
    }
    if (/^\/__\//.test(chemin)) return null; // pages internes de Firebase Auth
    return CANONIQUE + chemin + (loc.search || '') + (loc.hash || '');
  }

  var api = { CANONIQUE: CANONIQUE, adresseCanonique: adresseCanonique };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  racine.SentiqDomaine = api;
  try {
    // Un navigateur piloté (job, bancs de mesure) ne doit jamais partir.
    if (racine.navigator && racine.navigator.webdriver) return;
    var cible = adresseCanonique(racine.location);
    if (cible) racine.location.replace(cible);
  } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
