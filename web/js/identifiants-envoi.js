// ═══════════════════════════════════════════════════════════════════════════
//  SentiqS — IDENTIFIANTS D'ENVOI : « apportez votre propre compte » (14/11/2026)
//
//  Décisions de YORO : aucun compte WhatsApp Business côté SentiqS, et
//  l'utilisateur désigne lui-même l'adresse e-mail qui envoie. Chaque
//  utilisateur qui le veut saisit dans Paramètres :
//    · WhatsApp : le jeton d'accès de SON compte Meta (API WhatsApp Cloud),
//      l'identifiant de son numéro et le nom de son modèle de message ;
//    · e-mail : le serveur d'envoi (SMTP) de SA boîte (Gmail avec mot de
//      passe d'application, Brevo, messagerie d'entreprise…).
//  Les bulletins partent de SON numéro ou de SON adresse, sur SON compte ;
//  SentiqS ne paie rien.
//
//  Le jeton et le mot de passe sont des secrets : quiconque les tient envoie
//  au nom de l'utilisateur. Ils sont donc CHIFFRÉS DANS LE NAVIGATEUR, avant
//  tout envoi, avec la clé publique du job d'envoi :
//    · AES-256-GCM avec une clé tirée au hasard pour ce seul enregistrement ;
//    · cette clé chiffrée en RSA-OAEP (SHA-256) avec la clé publique du compte
//      de service du job, publiée par le job dans bulletins_etat/_canaux.
//  Seul le job, qui détient la clé privée (secret GitHub
//  FIREBASE_SERVICE_ACCOUNT), peut le relire. Les règles Firestore refusent
//  en plus toute lecture depuis un navigateur, y compris par son auteur : on
//  peut remplacer ou effacer ses identifiants, jamais les relire.
//
//  Ce module est partagé page / tests (double export, comme noyau.js) ; le
//  déchiffrement, côté job, vit dans scripts/lib/identifiants-envoi.js.
// ═══════════════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  // Formats Meta : jeton d'accès (utilisateur système, permanent), identifiant
  // du numéro (« Phone number ID », chiffres), nom de modèle (minuscules,
  // chiffres, soulignés), code de langue du modèle (fr, en, en_US, pt_BR…).
  var RE_JETON = /^[A-Za-z0-9_\-.|]{40,600}$/;
  var RE_NUMERO_ID = /^\d{8,25}$/;
  var RE_MODELE = /^[a-z0-9_]{1,512}$/;
  var RE_LANGUE = /^[a-z]{2,3}(_[A-Z]{2})?$/;
  // Le modèle que Meta crée sur tout nouveau compte : il sert à l'essai, avant
  // même que l'utilisateur ait fait approuver le sien.
  var MODELE_ESSAI = 'hello_world';
  var LANGUE_ESSAI = 'en_US';

  function verifierWhatsapp(o) {
    var e = [];
    o = o || {};
    if (!RE_JETON.test(String(o.jeton || '').trim())) e.push('wa_jeton');
    if (!RE_NUMERO_ID.test(String(o.numeroId || '').trim())) e.push('wa_numero_id');
    if (!RE_MODELE.test(String(o.modele || '').trim())) e.push('wa_modele');
    if (!RE_LANGUE.test(String(o.langue || '').trim())) e.push('wa_langue');
    return e;
  }

  // SMTP : nom d'hôte simple (pas d'adresse IP privée écrite en clair, pas
  // d'espace ni de saut de ligne), ports chiffrés seulement (465 TLS, 587
  // STARTTLS) : un mot de passe ne part jamais en clair sur le réseau.
  var RE_HOTE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
  var RE_EMAIL = /^[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
  function verifierSmtp(o) {
    var e = [];
    o = o || {};
    if (!RE_HOTE.test(String(o.hote || '').trim().toLowerCase())) e.push('smtp_hote');
    if ([465, 587].indexOf(Number(o.port)) < 0) e.push('smtp_port');
    var u = String(o.utilisateur || '').trim();
    if (!u || u.length > 200 || /[\s<>]/.test(u)) e.push('smtp_utilisateur');
    var m = String(o.motDePasse || '');
    if (m.length < 4 || m.length > 300 || /[\r\n]/.test(m)) e.push('smtp_mot_de_passe');
    if (!RE_EMAIL.test(String(o.expediteur || '').trim())) e.push('smtp_expediteur');
    if (String(o.nom || '').length > 60 || /[\r\n<>]/.test(String(o.nom || ''))) e.push('smtp_nom');
    return e;
  }

  function b64(buf) {
    var o = new Uint8Array(buf), s = '';
    for (var i = 0; i < o.length; i++) s += String.fromCharCode(o[i]);
    return (typeof btoa === 'function') ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
  }
  function deB64(t) {
    var s = (typeof atob === 'function') ? atob(t) : Buffer.from(t, 'base64').toString('binary');
    var o = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i);
    return o;
  }
  function pemVersDer(pem) {
    var corps = String(pem || '').replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/=]{200,2000}$/.test(corps)) throw new Error('clé publique illisible');
    return deB64(corps);
  }

  /**
   * Chiffre un secret (jeton WhatsApp, mot de passe SMTP) pour le job. Rend { v, cle, iv, donnees } (base64), où
   * rien n'est lisible sans la clé privée du job. `subtle` : crypto.subtle
   * (navigateur ou Node 20). Le secret en clair ne quitte jamais cette fonction.
   */
  async function chiffrer(secret, pemPublic, subtle) {
    var s = subtle || (global.crypto && global.crypto.subtle);
    if (!s) throw new Error('chiffrement indisponible dans ce navigateur');
    var rsa = await s.importKey('spki', pemVersDer(pemPublic), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
    var aes = await s.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    var iv = new Uint8Array(12);
    (global.crypto || require('node:crypto').webcrypto).getRandomValues(iv);
    var clair = new TextEncoder().encode(String(secret));
    var donnees = await s.encrypt({ name: 'AES-GCM', iv: iv }, aes, clair);
    var brute = await s.exportKey('raw', aes);
    var cle = await s.encrypt({ name: 'RSA-OAEP' }, rsa, brute);
    return { v: 1, cle: b64(cle), iv: b64(iv), donnees: b64(donnees) };
  }

  /** Dernier chiffres d'un identifiant, pour l'affichage (jamais en entier). */
  function masquer(t) { var s = String(t || ''); return s.length > 4 ? '•••' + s.slice(-4) : '•••'; }

  var API = { RE_JETON: RE_JETON, RE_NUMERO_ID: RE_NUMERO_ID, RE_MODELE: RE_MODELE, RE_LANGUE: RE_LANGUE, RE_HOTE: RE_HOTE,
    MODELE_ESSAI: MODELE_ESSAI, LANGUE_ESSAI: LANGUE_ESSAI, verifierWhatsapp: verifierWhatsapp, verifierSmtp: verifierSmtp,
    chiffrer: chiffrer, masquer: masquer };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.IdentifiantsEnvoi = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
