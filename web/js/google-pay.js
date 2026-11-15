// ═══════════════════════════════════════════════════════════════════════════
//  SentiqS — GOOGLE PAY dans le panneau « Déclarer un paiement »
//
//  Demande de YORO du 15/11/2026 : « insère Google Pay également comme mode
//  de paiement ». Google Pay ne fait que transmettre une carte chiffrée : il
//  faut un PRESTATAIRE de paiement (passerelle) pour l'encaisser, et un
//  identifiant marchand Google pour passer en production. SentiqS n'en a
//  aucun au 15/11/2026. Le bouton est donc branché en environnement TEST de
//  Google (cartes fictives, aucun débit possible) et passera en production en
//  changeant la seule configuration ci-dessous — jamais le code.
//
//  Trois règles :
//    · le bouton n'apparaît que si Google répond que l'appareil sait payer
//      (isReadyToPay) : jamais un bouton qui mène à une impasse ;
//    · AUCUN forfait n'est activé par le navigateur. En test, rien n'est
//      enregistré ; en production, le jeton part vers le point d'encaissement
//      (fonction serveur du prestataire), seul habilité à écrire le forfait
//      dans le profil — les règles Firestore refusent déjà qu'un client le
//      fasse (« forfait verrouillé », 13/11/2026) ;
//    · aucune clé secrète ici : l'identifiant marchand et celui de la
//      passerelle sont PUBLICS par nature (Google les lit dans la page).
//
//  Logique pure + un petit montage navigateur, double export comme noyau.js.
// ═══════════════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  // ── Configuration ─────────────────────────────────────────────────────────
  // Passage en production (à faire quand le prestataire est choisi) :
  //   environnement     'PRODUCTION'
  //   identifiantMarchand  celui de la Google Pay & Wallet Console
  //   passerelle / identifiantPasserelle  fournis par le prestataire
  //   pointEncaissement  adresse https de sa fonction serveur (et l'ajouter
  //                      au connect-src de la CSP de SentiqS_Web.html)
  // Tant qu'un de ces champs manque, la production est refusée (configValide).
  var CONFIG = {
    actif: true,
    environnement: 'TEST',
    nomMarchand: 'SentiqS',
    identifiantMarchand: '',
    // Valeurs d'exemple documentées par Google pour l'environnement TEST.
    passerelle: 'example',
    identifiantPasserelle: 'exampleGatewayMerchantId',
    pointEncaissement: '',
    devise: 'XOF',
    pays: 'CI',
    reseaux: ['VISA', 'MASTERCARD'],
  };

  var URL_SCRIPT = 'https://pay.google.com/gp/p/js/pay.js';
  var DELAI_CHARGEMENT_MS = 6000;

  function configValide(cfg) {
    if (!cfg || cfg.actif !== true) return false;
    if (cfg.environnement === 'TEST') return true;
    if (cfg.environnement !== 'PRODUCTION') return false;
    return !!(cfg.identifiantMarchand && cfg.passerelle && cfg.passerelle !== 'example'
      && cfg.identifiantPasserelle && /^https:\/\//.test(cfg.pointEncaissement || ''));
  }

  function moyenCarte(cfg) {
    return {
      type: 'CARD',
      parameters: { allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'], allowedCardNetworks: cfg.reseaux.slice() },
      tokenizationSpecification: {
        type: 'PAYMENT_GATEWAY',
        parameters: { gateway: cfg.passerelle, gatewayMerchantId: cfg.identifiantPasserelle },
      },
    };
  }

  function requeteDisponibilite(cfg) {
    var m = moyenCarte(cfg);
    return { apiVersion: 2, apiVersionMinor: 0, allowedPaymentMethods: [{ type: m.type, parameters: m.parameters }] };
  }

  // Le franc CFA n'a pas de sous-unité : le montant part en entier.
  function montantTexte(prix) {
    var n = Math.round(Number(prix));
    return isFinite(n) && n > 0 ? String(n) : null;
  }

  function requetePaiement(cfg, plan) {
    var total = plan && montantTexte(plan.prix);
    if (!total) return null;
    var merchantInfo = { merchantName: cfg.nomMarchand };
    if (cfg.identifiantMarchand) merchantInfo.merchantId = cfg.identifiantMarchand;
    return {
      apiVersion: 2, apiVersionMinor: 0,
      allowedPaymentMethods: [moyenCarte(cfg)],
      merchantInfo: merchantInfo,
      transactionInfo: {
        totalPriceStatus: 'FINAL', totalPrice: total, currencyCode: cfg.devise, countryCode: cfg.pays,
        totalPriceLabel: 'SentiqS — ' + String(plan.nom || plan.key || '').slice(0, 60),
      },
    };
  }

  // ── Navigateur ────────────────────────────────────────────────────────────
  var _chargement = null;
  function chargerScript(doc) {
    if (global.google && global.google.payments && global.google.payments.api) return Promise.resolve(true);
    if (_chargement) return _chargement;
    _chargement = new Promise(function (ok) {
      var s = doc.createElement('script');
      var fini = false;
      var finir = function (v) { if (!fini) { fini = true; ok(v); } };
      s.src = URL_SCRIPT; s.async = true;
      s.onload = function () { finir(!!(global.google && global.google.payments && global.google.payments.api)); };
      s.onerror = function () { finir(false); };
      setTimeout(function () { finir(false); }, DELAI_CHARGEMENT_MS);
      doc.head.appendChild(s);
    }).then(function (v) { if (!v) _chargement = null; return v; });
    return _chargement;
  }

  var _client = null;
  function client(cfg) {
    if (!_client) _client = new global.google.payments.api.PaymentsClient({ environment: cfg.environnement });
    return _client;
  }

  // Monte le bouton officiel dans `conteneur` si l'appareil sait payer.
  // opts : { doc, langue:'fr'|'en', sombre:bool, plan:()=>plan, surResultat:(etat, detail)=>void,
  //          jetonSession:()=>Promise<string|null> }
  // Rend true si le bouton est affiché.
  async function monter(conteneur, opts) {
    var cfg = CONFIG;
    if (!conteneur || !configValide(cfg)) return false;
    var ok = await chargerScript(opts.doc || global.document);
    if (!ok) return false;
    var pret;
    try { pret = await client(cfg).isReadyToPay(requeteDisponibilite(cfg)); } catch (_) { return false; }
    if (!pret || !pret.result) return false;
    var bouton = client(cfg).createButton({
      buttonColor: opts.sombre ? 'white' : 'black',
      buttonType: 'pay',
      buttonSizeMode: 'fill',
      buttonLocale: opts.langue === 'en' ? 'en' : 'fr',
      onClick: function () { payer(cfg, opts); },
    });
    conteneur.innerHTML = '';
    conteneur.appendChild(bouton);
    return true;
  }

  async function payer(cfg, opts) {
    var dire = opts.surResultat || function () {};
    var req = requetePaiement(cfg, opts.plan && opts.plan());
    if (!req) { dire('erreur', 'forfait'); return; }
    var donnees;
    try { donnees = await client(cfg).loadPaymentData(req); }
    catch (e) { dire(e && e.statusCode === 'CANCELED' ? 'annule' : 'erreur', e && e.statusCode); return; }
    if (cfg.environnement === 'TEST') {
      // Le jeton de test n'est ni conservé ni envoyé : il ne vaut rien et
      // n'activerait rien.
      dire('test');
      return;
    }
    var jeton = opts.jetonSession ? await opts.jetonSession() : null;
    if (!jeton) { dire('erreur', 'session'); return; }
    try {
      var r = await global.fetch(cfg.pointEncaissement, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jeton },
        body: JSON.stringify({ forfait: (opts.plan() || {}).key, donneesGooglePay: donnees }),
      });
      dire(r.ok ? 'encaisse' : 'erreur', r.status);
    } catch (_) { dire('erreur', 'reseau'); }
  }

  var API = {
    CONFIG: CONFIG, URL_SCRIPT: URL_SCRIPT,
    configValide: configValide, requeteDisponibilite: requeteDisponibilite,
    requetePaiement: requetePaiement, montantTexte: montantTexte, monter: monter,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.SentiqGooglePay = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
