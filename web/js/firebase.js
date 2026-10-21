// ═══════════════════════════════════════════════════════════════════════════
//  SentiqS — ADAPTATEUR FIREBASE (connexion + comptes, plan gratuit Spark)
//
//  Demande du 21/10/2026 : basculer sur Firebase pour rester gratuit. Le code
//  de Supabase envoyé par e-mail n'arrivait pas — l'expéditeur intégré de
//  Supabase ne livre qu'à l'équipe du projet, et il fallait un SMTP. Firebase
//  envoie lui-même ses e-mails de connexion, sans SMTP.
//
//  Le choix de conception : cet adaptateur expose la PETITE partie de l'API
//  supabase-js que la page utilise réellement (auth.* et from(table)), mais
//  servie par Firebase Authentication et Firestore. La page garde donc toute
//  sa logique (essai de 72 h, compte suspendu, reconnexion du jour, droits),
//  et une seule ligne, dans getSentinelSupabase(), choisit le fournisseur.
//  Tant que web/js/firebase-config.js vaut null, rien ne change.
//
//  Trois différences avec Supabase, à connaître :
//    · pas de code à six chiffres : Firebase envoie un LIEN de connexion.
//      verifyOtp() répond donc une erreur explicite (« lien_seulement ») ;
//    · le plan gratuit n'envoie que 5 e-mails de lien par jour pour TOUT le
//      projet (mesuré dans la documentation Firebase, « Authentication
//      limits », 21/10/2026). D'où la connexion Google (sans mot de passe,
//      sans limite) et le mot de passe en secours ;
//    · pas de déclencheur serveur : le rôle et le statut d'un profil sont
//      imposés par les règles Firestore (firebase/firestore.rules), qui
//      refusent toute écriture qu'un client n'a pas le droit de faire.
//
//  Le kit Firebase (compat, version figée) n'est chargé que si la
//  configuration est remplie : il pèse ~500 Ko et ne doit rien coûter tant
//  que Supabase reste le fournisseur.
//
//  Module à injection (l'espace de noms firebase, le stockage, l'adresse se
//  passent en paramètre) : testable sans navigateur, comme web/js/intro.js.
// ═══════════════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var VERSION_SDK = '10.14.1';
  var BASE_SDK = 'https://cdn.jsdelivr.net/npm/firebase@' + VERSION_SDK + '/';
  var MODULES_SDK = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'];
  // L'adresse saisie avant l'envoi du lien : Firebase l'exige à nouveau au
  // retour, pour qu'un lien intercepté ne suffise pas à ouvrir le compte.
  var CLE_EMAIL_LIEN = 'sentiq_email_lien';

  function configuree(cfg) {
    return !!(cfg && typeof cfg === 'object' && cfg.apiKey && cfg.projectId && cfg.authDomain);
  }

  // Charge les trois scripts compat l'un après l'autre (l'ordre compte :
  // auth et firestore s'enregistrent sur l'app). Résout tout de suite si le
  // kit est déjà là (tests, second appel).
  function chargerSdk(doc) {
    if (global.firebase && global.firebase.auth && global.firebase.firestore) return Promise.resolve(global.firebase);
    doc = doc || global.document;
    return MODULES_SDK.reduce(function (p, fichier) {
      return p.then(function () {
        return new Promise(function (ok, ko) {
          var s = doc.createElement('script');
          s.src = BASE_SDK + fichier;
          s.onload = function () { ok(); };
          s.onerror = function () { ko(new Error('SDK Firebase introuvable : ' + fichier)); };
          doc.head.appendChild(s);
        });
      });
    }, Promise.resolve()).then(function () { return global.firebase; });
  }

  // Erreur Firebase -> forme { message, code, status } attendue par la page.
  // Les messages reprennent les mots que la page reconnaît déjà (« invalid »,
  // « already registered », « rate »…) : ses messages d'erreur traduits
  // continuent de s'appliquer sans changer une ligne de leurs expressions.
  var MESSAGES = {
    'auth/invalid-credential': 'Invalid login credentials',
    'auth/wrong-password': 'Invalid login credentials',
    'auth/user-not-found': 'Invalid login credentials',
    'auth/invalid-login-credentials': 'Invalid login credentials',
    'auth/email-already-in-use': 'User already registered',
    'auth/too-many-requests': 'Too many requests (rate limit)',
    'auth/quota-exceeded': 'Daily e-mail quota exceeded',
    'auth/network-request-failed': 'Network request failed (fetch)',
    'auth/invalid-email': 'Invalid email',
    'auth/weak-password': 'Weak password',
    'auth/operation-not-allowed': 'Signups not allowed for this provider',
    'auth/unauthorized-continue-uri': 'Unauthorized domain (continue URL)',
    'auth/unauthorized-domain': 'Unauthorized domain',
    'auth/invalid-action-code': 'Link expired or already used',
    'auth/expired-action-code': 'Link expired or already used',
    'auth/requires-recent-login': 'Please sign in again before changing your password',
    'auth/popup-closed-by-user': 'Popup closed',
    'permission-denied': 'Permission denied (rules)',
  };
  function erreur(e) {
    if (!e) return null;
    var code = String(e.code || '');
    return { message: MESSAGES[code] || String(e.message || code || e), code: code || 'inconnu', status: e.status };
  }

  // Utilisateur Firebase -> forme Supabase lue par la page (id, email,
  // last_sign_in_at). connexion_fraiche : la connexion vient d'être faite
  // DANS CETTE PAGE (lien e-mail, Google) — c'est elle qui vaut « saisie du
  // jour » pour la reconnexion quotidienne, jamais un paramètre d'adresse.
  function utilisateur(u, fraiche) {
    if (!u) return null;
    var t = u.metadata && u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime) : null;
    return {
      id: u.uid,
      email: String(u.email || '').toLowerCase(),
      email_verified: !!u.emailVerified,
      last_sign_in_at: t && !isNaN(t) ? t.toISOString() : null,
      connexion_fraiche: !!fraiche,
    };
  }

  // Firestore refuse `undefined` : un aller-retour JSON donne exactement ce
  // que supabase-js aurait envoyé à PostgREST.
  function propre(v) { return JSON.parse(JSON.stringify(v === undefined ? null : v)); }

  // ── Requêtes : sous-ensemble de PostgREST utilisé par la page ──────────
  // select / eq / order / limit / maybeSingle / single, insert / update /
  // upsert / delete. La clé de document est la colonne `id` quand elle
  // existe (profiles, collecte_partagee, agenda…), sinon un identifiant
  // automatique (connexions_log).
  function Requete(client, table) {
    this.client = client; this.table = table; this.op = 'select';
    this.filtres = []; this.tri = null; this.lim = null; this.unique = false; this.valeur = null;
  }
  Requete.prototype.select = function () { return this; };
  Requete.prototype.eq = function (champ, val) { this.filtres.push([champ, val]); return this; };
  Requete.prototype.order = function (champ, o) { this.tri = [champ, o && o.ascending === false ? 'desc' : 'asc']; return this; };
  Requete.prototype.limit = function (n) { this.lim = n; return this; };
  Requete.prototype.maybeSingle = function () { this.unique = true; return this; };
  Requete.prototype.single = Requete.prototype.maybeSingle;
  Requete.prototype.insert = function (v) { this.op = 'insert'; this.valeur = v; return this; };
  Requete.prototype.update = function (v) { this.op = 'update'; this.valeur = v; return this; };
  Requete.prototype.upsert = function (v) { this.op = 'upsert'; this.valeur = v; return this; };
  Requete.prototype['delete'] = function () { this.op = 'delete'; return this; };
  Requete.prototype.then = function (ok, ko) {
    var self = this;
    return self._executer().then(function (data) { return { data: data, error: null }; },
                                 function (e) { return { data: null, error: erreur(e) }; }).then(ok, ko);
  };
  Requete.prototype._idFiltre = function () {
    return this.filtres.length === 1 && this.filtres[0][0] === 'id' ? String(this.filtres[0][1]) : null;
  };
  Requete.prototype._executer = function () {
    var db = this.client.db, col = db.collection(this.table), self = this;
    var maintenant = this.client.maintenant().toISOString();
    var lignes = Array.isArray(this.valeur) ? this.valeur : (this.valeur ? [this.valeur] : []);
    var id = this._idFiltre();
    var resultat = function (rows) { return self.unique ? (rows[0] || null) : rows; };

    if (this.op === 'select') {
      if (id) return col.doc(id).get().then(function (s) { return resultat(s.exists ? [Object.assign({ id: s.id }, s.data())] : []); });
      var q = col;
      this.filtres.forEach(function (f) { q = q.where(f[0], '==', f[1]); });
      if (this.tri) q = q.orderBy(this.tri[0], this.tri[1]);
      if (this.lim) q = q.limit(this.lim);
      return q.get().then(function (snap) { return resultat(snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })); });
    }
    if (this.op === 'insert' || this.op === 'upsert') {
      var ecrites = [];
      return lignes.reduce(function (p, l) {
        return p.then(function () {
          var row = propre(l);
          if (self.op === 'insert' && !row.created_at) row.created_at = maintenant;
          if (self.table === 'profiles') return self.client._ecrireProfil(col, row).then(function (r) { ecrites.push(r); });
          if (row.id !== undefined && row.id !== null) return col.doc(String(row.id)).set(row).then(function () { ecrites.push(row); });
          return col.add(row).then(function (ref) { ecrites.push(Object.assign({ id: ref.id }, row)); });
        });
      }, Promise.resolve()).then(function () { return resultat(ecrites); });
    }
    if (this.op === 'update') {
      if (!id) return Promise.reject({ code: 'filtre-id-requis', message: 'update() sans eq("id", …) non pris en charge' });
      var maj = propre(this.valeur); maj.updated_at = maintenant;
      return col.doc(id).update(maj).then(function () { return resultat([Object.assign({ id: id }, maj)]); });
    }
    if (this.op === 'delete') {
      if (!id) return Promise.reject({ code: 'filtre-id-requis', message: 'delete() sans eq("id", …) non pris en charge' });
      return col.doc(id)['delete']().then(function () { return resultat([]); });
    }
    return Promise.reject({ code: 'operation-inconnue', message: this.op });
  };

  // ── Client ─────────────────────────────────────────────────────────────
  // env : { stockage (localStorage), adresse () -> location.href,
  //         remplacerAdresse (url) -> history.replaceState, maintenant () }
  function creerClient(fb, cfg, options, env) {
    options = options || {}; env = env || {};
    var nom = options.nom || '[DEFAULT]';
    var existante = (fb.apps || []).filter(function (a) { return a.name === nom; })[0];
    var app = existante || (nom === '[DEFAULT]' ? fb.initializeApp(cfg) : fb.initializeApp(cfg, nom));
    var auth = app.auth();
    var db = app.firestore();
    var stockage = env.stockage || null;
    var adresse = env.adresse || function () { return global.location ? global.location.href : ''; };
    var lire = function (k) { try { return stockage ? stockage.getItem(k) : null; } catch (_) { return null; } };
    var ecrire = function (k, v) { try { if (stockage) { if (v === null) stockage.removeItem(k); else stockage.setItem(k, v); } } catch (_) {} };

    // Client « éphémère » (création d'un compte par l'administrateur) : sa
    // session ne doit jamais remplacer celle de l'administrateur, ni survivre
    // au rechargement. Même rôle que persistSession:false côté Supabase.
    var persistance = options.ephemere && fb.auth && fb.auth.Auth
      ? auth.setPersistence(fb.auth.Auth.Persistence.NONE) : Promise.resolve();

    var etat = { fraiche: false, lienEnAttente: null, erreurLien: null, lienTraite: false };

    function pret() {
      return persistance.then(function () {
        if (typeof auth.authStateReady === 'function') return auth.authStateReady();
        return new Promise(function (ok) { var stop = auth.onAuthStateChanged(function () { stop(); ok(); }); });
      });
    }
    function nettoyerAdresse() {
      if (typeof env.remplacerAdresse === 'function') { try { env.remplacerAdresse(String(adresse()).split('?')[0].split('#')[0]); } catch (_) {} }
    }
    // Retour du lien e-mail : fait une fois par page. Sans l'adresse gardée
    // (lien ouvert sur un autre appareil), la page doit la redemander —
    // lienEnAttente() le lui dit, terminerLienEmail(email) conclut.
    function traiterLien() {
      if (etat.lienTraite) return Promise.resolve();
      etat.lienTraite = true;
      var href = String(adresse());
      if (!auth.isSignInWithEmailLink(href)) return Promise.resolve();
      var email = lire(CLE_EMAIL_LIEN);
      if (!email) { etat.lienEnAttente = href; return Promise.resolve(); }
      return conclureLien(email, href).then(function (r) { if (r.error) etat.erreurLien = r.error; });
    }
    function conclureLien(email, href) {
      return auth.signInWithEmailLink(email, href).then(function (cred) {
        ecrire(CLE_EMAIL_LIEN, null); etat.fraiche = true; etat.lienEnAttente = null; nettoyerAdresse();
        return { data: { user: utilisateur(cred.user, true) }, error: null };
      }, function (e) { return { data: { user: null }, error: erreur(e) }; });
    }
    function reponseUtilisateur(cred, fraiche) {
      if (fraiche) etat.fraiche = true;
      var u = utilisateur(cred.user, fraiche);
      return { data: { user: u, session: u ? { user: u } : null }, error: null };
    }
    function echec(e) { return { data: { user: null, session: null }, error: erreur(e) }; }

    var client = {
      fournisseur: 'firebase',
      db: db,
      maintenant: env.maintenant || function () { return new Date(); },
      from: function (table) { return new Requete(client, table); },
      // Profil : le rôle et le statut sont décidés par les règles. On tente
      // d'abord le rôle administrateur — les règles ne l'acceptent que pour
      // l'adresse de l'administrateur, vérifiée — puis le rôle normal. Le
      // code servi ne connaît donc jamais l'adresse de l'administrateur.
      _ecrireProfil: function (col, row) {
        var ref = col.doc(String(row.id));
        if (row.role || row.status) return ref.set(row).then(function () { return row; });
        var admin = Object.assign({}, row, { role: 'admin', status: 'active' });
        var normal = Object.assign({}, row, { role: 'user', status: 'active' });
        return ref.set(admin).then(function () { return admin; }, function (e) {
          if (String(e && e.code) !== 'permission-denied') throw e;
          return ref.set(normal).then(function () { return normal; });
        });
      },
      auth: {
        parLien: true,
        pret: pret,
        getSession: function () {
          return pret().then(traiterLien).then(function () {
            var u = utilisateur(auth.currentUser, etat.fraiche);
            return { data: { session: u ? { user: u } : null }, error: etat.erreurLien };
          }, function (e) { return { data: { session: null }, error: erreur(e) }; });
        },
        lienEnAttente: function () { return !!etat.lienEnAttente; },
        terminerLienEmail: function (email) {
          if (!etat.lienEnAttente) return Promise.resolve({ data: { user: null }, error: { code: 'aucun-lien', message: 'No pending link' } });
          return conclureLien(String(email || '').trim().toLowerCase(), etat.lienEnAttente);
        },
        onAuthStateChange: function (cb) {
          var stop = auth.onAuthStateChanged(function (u) {
            try { cb(u ? 'SIGNED_IN' : 'SIGNED_OUT', u ? { user: utilisateur(u, etat.fraiche) } : null); } catch (_) {}
          });
          return { data: { subscription: { unsubscribe: stop } } };
        },
        signInWithPassword: function (p) {
          return persistance.then(function () { return auth.signInWithEmailAndPassword(p.email, p.password); })
            .then(function (c) { return reponseUtilisateur(c, false); }, echec);
        },
        signUp: function (p) {
          return persistance.then(function () { return auth.createUserWithEmailAndPassword(p.email, p.password); })
            .then(function (c) { return reponseUtilisateur(c, false); }, echec);
        },
        // « Code par e-mail » de Supabase = lien de connexion chez Firebase.
        // Le lien crée le compte s'il n'existe pas (shouldCreateUser).
        signInWithOtp: function (p) {
          var o = (p && p.options) || {};
          var url = o.emailRedirectTo || String(adresse()).split('?')[0].split('#')[0];
          return auth.sendSignInLinkToEmail(p.email, { url: url, handleCodeInApp: true }).then(function () {
            ecrire(CLE_EMAIL_LIEN, String(p.email).toLowerCase());
            return { data: {}, error: null };
          }, function (e) { return { data: null, error: erreur(e) }; });
        },
        verifyOtp: function () {
          return Promise.resolve({ data: null, error: { code: 'lien_seulement', message: 'Use the link received by e-mail (no code with Firebase)' } });
        },
        // Connexion Google : sans mot de passe et sans quota d'e-mail. Fenêtre
        // surgissante d'abord ; si le navigateur la bloque, redirection (la
        // page reprend alors la session au retour, via getSession()).
        signInWithOAuth: function () {
          var fournisseur = new fb.auth.GoogleAuthProvider();
          return persistance.then(function () { return auth.signInWithPopup(fournisseur); })
            .then(function (c) { return reponseUtilisateur(c, true); }, function (e) {
              if (String(e && e.code) === 'auth/popup-blocked' && typeof auth.signInWithRedirect === 'function') {
                return auth.signInWithRedirect(fournisseur).then(function () { return { data: { user: null, session: null }, error: null }; }, echec);
              }
              return echec(e);
            });
        },
        resultatRedirection: function () {
          if (typeof auth.getRedirectResult !== 'function') return Promise.resolve(null);
          return auth.getRedirectResult().then(function (c) { if (c && c.user) { etat.fraiche = true; return utilisateur(c.user, true); } return null; }, function () { return null; });
        },
        // Firebase gère la page de réinitialisation lui-même ; le bouton
        // « Continuer » ramène sur la page d'origine.
        resetPasswordForEmail: function (email, o) {
          var param = o && o.redirectTo ? { url: o.redirectTo } : undefined;
          return auth.sendPasswordResetEmail(email, param).then(function () { return { data: {}, error: null }; },
            function (e) { return { data: null, error: String(e && e.code) === 'auth/user-not-found' ? null : erreur(e) }; });
        },
        updateUser: function (p) {
          var u = auth.currentUser;
          if (!u) return Promise.resolve({ data: { user: null }, error: { code: 'no-session', message: 'No active session' } });
          return u.updatePassword(p.password).then(function () { return { data: { user: utilisateur(u, false) }, error: null }; },
            function (e) { return { data: { user: null }, error: erreur(e) }; });
        },
        signOut: function () {
          return auth.signOut().then(function () { return { error: null }; }, function (e) { return { error: erreur(e) }; });
        },
      },
    };
    return client;
  }

  // ── Point d'entrée de la page ──────────────────────────────────────────
  var _client = null, _nbEphemeres = 0, _chargement = null;
  var api = {
    VERSION_SDK: VERSION_SDK,
    CLE_EMAIL_LIEN: CLE_EMAIL_LIEN,
    configuree: configuree,
    creerClient: creerClient,
    erreur: erreur,
    utilisateur: utilisateur,
    // Vrai dès que la configuration publique est remplie : la page bascule.
    actif: function () { return configuree(global.SENTIQ_FIREBASE_CONFIG); },
    charger: function () {
      if (!api.actif()) return Promise.resolve(null);
      if (!_chargement) _chargement = chargerSdk().then(function () { return api.client(); });
      return _chargement;
    },
    envNavigateur: function () {
      return {
        stockage: (function () { try { return global.localStorage; } catch (_) { return null; } })(),
        adresse: function () { return global.location.href; },
        remplacerAdresse: function (u) { global.history.replaceState(null, '', u); },
      };
    },
    // null tant que le kit n'est pas chargé : la page le traite comme
    // « service indisponible », exactement comme un supabase-js absent.
    client: function () {
      if (!api.actif() || !global.firebase || !global.firebase.auth) return null;
      if (!_client) _client = creerClient(global.firebase, global.SENTIQ_FIREBASE_CONFIG, {}, api.envNavigateur());
      return _client;
    },
    clientEphemere: function () {
      if (!api.actif() || !global.firebase || !global.firebase.auth) return null;
      _nbEphemeres += 1;
      return creerClient(global.firebase, global.SENTIQ_FIREBASE_CONFIG, { nom: 'ephemere-' + _nbEphemeres, ephemere: true }, {});
    },
  };
  global.SentiqFirebase = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
