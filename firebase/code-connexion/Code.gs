// ═══════════════════════════════════════════════════════════════════════════
//  SentiqS — CODE DE CONNEXION PAR E-MAIL (Google Apps Script, gratuit)
//
//  Demande du 01/11/2026 : se connecter avec N'IMPORTE QUELLE adresse e-mail,
//  par un code de vérification, en restant sur le plan gratuit.
//
//  Pourquoi ce script existe. Firebase Authentication n'a pas de code à six
//  chiffres pour l'e-mail : il n'envoie qu'un LIEN, et le plan Spark n'en
//  autorise que 5 par jour pour tout le projet. Un lien casse aussi sur les
//  messageries d'entreprise : le scanner de liens (Outlook « Safe Links »)
//  l'ouvre avant l'utilisateur, l'application de messagerie l'ouvre dans son
//  propre navigateur (l'adresse gardée par la page n'y est pas), et l'e-mail
//  de noreply@…firebaseapp.com finit souvent en indésirables. Les Cloud
//  Functions, qui permettraient d'émettre un code côté serveur, demandent le
//  plan payant Blaze.
//
//  Ce script est le « petit serveur » gratuit qui manquait, hébergé par
//  Google sous le compte du propriétaire :
//    · action « envoyer » : tire un code à 6 chiffres, en garde l'EMPREINTE
//      (jamais le code) 10 minutes, et l'envoie par Gmail (MailApp : 100
//      destinataires par jour pour un compte Gmail gratuit, 20 fois le quota
//      des liens Firebase) ;
//    · action « verifier » : compare le code, puis retrouve (ou crée) le
//      compte Firebase de cette adresse et renvoie un JETON PERSONNALISÉ
//      signé avec la clé du compte de service. La page l'échange contre une
//      session Firebase normale (signInWithCustomToken) : profils, règles
//      Firestore et rôle admin fonctionnent exactement comme avec Google.
//
//  Garde-fous : 1 envoi par minute et 5 par heure par adresse, plafond
//  quotidien global (QUOTA_JOUR, défaut 90), 5 essais par code, code valable
//  10 minutes et à usage unique. Le compte retrouvé est marqué « e-mail
//  vérifié » : la personne vient de prouver qu'elle lit cette boîte.
//
//  Réglages (Paramètres du projet Apps Script > Propriétés du script) :
//    COMPTE_SERVICE   tout le JSON de la clé du compte de service Firebase
//                     (projet sentiqs-235ce). SECRET : ne vit qu'ici.
//    NOM_EXPEDITEUR   facultatif, défaut « SentiqS »
//    QUOTA_JOUR       facultatif, défaut 90 (le quota Gmail est de 100)
//  Déploiement : Déployer > Nouveau déploiement > Application Web,
//  « Exécuter en tant que : moi », « Accès : tout le monde ». L'adresse
//  obtenue (…/exec) va dans web/js/firebase-config.js. Voir FIREBASE.md.
// ═══════════════════════════════════════════════════════════════════════════

var DUREE_CODE_S = 600;
var ESSAIS_MAX = 5;
var RENVOI_MIN_S = 60;
var ENVOIS_HEURE_MAX = 5;
var AUD_JETON = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';
var EMAIL_RE = /^[^@\s"'<>]+@[^@\s"'<>]+\.[^@\s"'<>]+$/;

function doPost(e) {
  var r;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (req.action === 'envoyer') r = envoyerCode(req.email);
    else if (req.action === 'verifier') r = verifierCode(req.email, req.code);
    else r = { ok: false, erreur: 'action' };
  } catch (err) {
    console.error('code-connexion : ' + (err && err.stack ? err.stack : err));
    r = { ok: false, erreur: 'serveur' };
  }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

// Une visite à l'adresse dans un navigateur dit que le service répond, sans
// rien révéler : c'est le test le plus simple après le déploiement.
function doGet() {
  var pret = !!PropertiesService.getScriptProperties().getProperty('COMPTE_SERVICE');
  return ContentService.createTextOutput(JSON.stringify({ service: 'sentiqs-code-connexion', pret: pret }))
    .setMimeType(ContentService.MimeType.JSON);
}

function normaliserEmail(v) {
  var e = String(v || '').trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

function empreinte(texte) {
  var octets = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texte, Utilities.Charset.UTF_8);
  return octets.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

// Six chiffres tirés de l'aléa de getUuid (UUID v4), passé dans SHA-256 :
// Math.random n'est pas fait pour un secret.
function tirerCode() {
  var octets = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid());
  var n = 0;
  for (var i = 0; i < 6; i++) n = (n * 256 + (octets[i] & 0xff)) % 1000000007;
  return ('00000' + (n % 1000000)).slice(-6);
}

function lireConfig() {
  var p = PropertiesService.getScriptProperties();
  var brut = p.getProperty('COMPTE_SERVICE');
  var cs = null;
  try { cs = brut ? JSON.parse(brut) : null; } catch (_) { cs = null; }
  return {
    compte: cs && cs.private_key && cs.client_email && cs.project_id ? cs : null,
    nom: p.getProperty('NOM_EXPEDITEUR') || 'SentiqS',
    quota: parseInt(p.getProperty('QUOTA_JOUR') || '90', 10) || 90,
  };
}

function envoyerCode(emailBrut) {
  var email = normaliserEmail(emailBrut);
  if (!email) return { ok: false, erreur: 'email' };
  var cfg = lireConfig();
  if (!cfg.compte) return { ok: false, erreur: 'config' };
  var cache = CacheService.getScriptCache();
  var h = empreinte('adr:' + email);
  var verrou = LockService.getScriptLock();
  verrou.waitLock(10000);
  try {
    if (cache.get('renvoi:' + h)) return { ok: false, erreur: 'rate' };
    var parHeure = parseInt(cache.get('heure:' + h) || '0', 10);
    if (parHeure >= ENVOIS_HEURE_MAX) return { ok: false, erreur: 'rate' };
    var props = PropertiesService.getScriptProperties();
    var cleJour = 'envois_' + Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd');
    var duJour = parseInt(props.getProperty(cleJour) || '0', 10);
    if (duJour >= cfg.quota || MailApp.getRemainingDailyQuota() < 1) return { ok: false, erreur: 'quota' };

    var code = tirerCode();
    var sel = Utilities.getUuid();
    cache.put('otp:' + h, JSON.stringify({ sel: sel, h: empreinte(sel + ':' + code), essais: 0, fin: Date.now() + DUREE_CODE_S * 1000 }), DUREE_CODE_S);
    cache.put('renvoi:' + h, '1', RENVOI_MIN_S);
    cache.put('heure:' + h, String(parHeure + 1), 3600);
    props.setProperty(cleJour, String(duJour + 1));
    nettoyerCompteurs(props, cleJour);

    MailApp.sendEmail({
      to: email,
      subject: code + ' — votre code de connexion ' + cfg.nom,
      name: cfg.nom,
      body: 'Votre code de connexion ' + cfg.nom + ' : ' + code + '\n\n' +
        'Il est valable 10 minutes et ne sert qu\'une fois. Si vous n\'avez rien demandé, ignorez ce message.\n\n' +
        'Your ' + cfg.nom + ' sign-in code: ' + code + ' (valid 10 minutes).',
      htmlBody: corpsHtml(code, cfg.nom),
    });
    return { ok: true, duree: DUREE_CODE_S };
  } finally {
    verrou.releaseLock();
  }
}

function nettoyerCompteurs(props, cleJour) {
  var toutes = props.getKeys();
  for (var i = 0; i < toutes.length; i++) if (/^envois_/.test(toutes[i]) && toutes[i] !== cleJour) props.deleteProperty(toutes[i]);
}

function corpsHtml(code, nom) {
  return '<div style="font-family:Arial,sans-serif;max-width:460px;margin:auto;padding:24px;color:#0F2450">' +
    '<div style="font-size:18px;font-weight:700;margin-bottom:12px">' + nom + '</div>' +
    '<p style="margin:0 0 12px">Votre code de connexion :</p>' +
    '<div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#F1F4FA;border-radius:6px;padding:14px;text-align:center">' + code + '</div>' +
    '<p style="font-size:13px;color:#4A5568;margin:14px 0 0">Valable 10 minutes, à usage unique. Si vous n\'avez rien demandé, ignorez ce message.</p>' +
    '<p style="font-size:12px;color:#4A5568;margin:10px 0 0">Your sign-in code, valid for 10 minutes.</p></div>';
}

function verifierCode(emailBrut, codeBrut) {
  var email = normaliserEmail(emailBrut);
  var code = String(codeBrut || '').replace(/[\s-]/g, '');
  if (!email || !/^\d{6}$/.test(code)) return { ok: false, erreur: 'code' };
  var cfg = lireConfig();
  if (!cfg.compte) return { ok: false, erreur: 'config' };
  var cache = CacheService.getScriptCache();
  var h = empreinte('adr:' + email);
  var verrou = LockService.getScriptLock();
  verrou.waitLock(10000);
  var enr;
  try {
    var brut = cache.get('otp:' + h);
    if (!brut) return { ok: false, erreur: 'code' };
    enr = JSON.parse(brut);
    if (empreinte(enr.sel + ':' + code) !== enr.h) {
      enr.essais += 1;
      var reste = Math.floor((enr.fin - Date.now()) / 1000);
      if (enr.essais >= ESSAIS_MAX || reste < 1) cache.remove('otp:' + h);
      else cache.put('otp:' + h, JSON.stringify(enr), reste);
      return { ok: false, erreur: 'code' };
    }
    cache.remove('otp:' + h); // usage unique
  } finally {
    verrou.releaseLock();
  }
  var uid = compteFirebase(cfg.compte, email);
  if (!uid) return { ok: false, erreur: 'desactive' };
  return { ok: true, jeton: jetonPersonnalise(cfg.compte, uid) };
}

// ── Firebase Authentication (API REST d'administration) ────────────────────
function b64url(octetsOuTexte) { return Utilities.base64EncodeWebSafe(octetsOuTexte).replace(/=+$/, ''); }

function jwtSigne(cs, charge) {
  var entete = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var corps = b64url(JSON.stringify(charge));
  var signature = Utilities.computeRsaSha256Signature(entete + '.' + corps, cs.private_key);
  return entete + '.' + corps + '.' + b64url(signature);
}

// Jeton personnalisé Firebase : signé par le compte de service, valable une
// heure au plus (exigence de Firebase), échangé aussitôt par la page.
function jetonPersonnalise(cs, uid) {
  var t = Math.floor(Date.now() / 1000);
  return jwtSigne(cs, { iss: cs.client_email, sub: cs.client_email, aud: AUD_JETON, iat: t, exp: t + 3600, uid: uid });
}

function jetonAcces(cs) {
  var cache = CacheService.getScriptCache();
  var garde = cache.get('acces');
  if (garde) return garde;
  var t = Math.floor(Date.now() / 1000);
  var assertion = jwtSigne(cs, { iss: cs.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 3600 });
  var rep = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: assertion },
  });
  if (rep.getResponseCode() !== 200) throw new Error('jeton d\'accès refusé : ' + rep.getContentText());
  var jeton = JSON.parse(rep.getContentText()).access_token;
  cache.put('acces', jeton, 3000);
  return jeton;
}

function appelAdmin(cs, chemin, corps) {
  var rep = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/projects/' + cs.project_id + chemin, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + jetonAcces(cs) },
    payload: JSON.stringify(corps),
  });
  if (rep.getResponseCode() !== 200) throw new Error('Firebase Auth ' + chemin + ' : ' + rep.getResponseCode() + ' ' + rep.getContentText());
  return JSON.parse(rep.getContentText() || '{}');
}

// Même adresse = même compte, quel que soit le moyen utilisé avant (Google,
// mot de passe, lien) : le profil et le rôle suivent. null si désactivé.
function compteFirebase(cs, email) {
  var trouve = appelAdmin(cs, '/accounts:lookup', { email: [email] });
  var u = trouve.users && trouve.users[0];
  if (u) {
    if (u.disabled) return null;
    if (!u.emailVerified) appelAdmin(cs, '/accounts:update', { localId: u.localId, emailVerified: true });
    return u.localId;
  }
  return appelAdmin(cs, '/accounts', { email: email, emailVerified: true }).localId;
}
