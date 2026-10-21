// Bascule Firebase du 21/10/2026 (plan gratuit Spark) — l'adaptateur
// web/js/firebase.js expose à la page la petite partie de supabase-js
// qu'elle utilise. Ces tests le font tourner sur un faux espace de noms
// firebase (auth + firestore en mémoire) : ils vérifient ce que la page
// reçoit, pas Firebase lui-même. L'envoi réel d'un e-mail n'est testable
// qu'avec le projet réel.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const FB = require('../../web/js/firebase.js');
const { HTML, tranche } = require('./_bac');
const RACINE = path.join(__dirname, '../..');
const ACCUEIL = fs.readFileSync(path.join(RACINE, 'web/index.html'), 'utf8');
const REGLES = fs.readFileSync(path.join(RACINE, 'firebase/firestore.rules'), 'utf8');

// ── Faux Firebase ────────────────────────────────────────────────────────
function fauxFirebase(o = {}) {
  const docs = new Map(); // 'table/id' -> objet
  const etat = { utilisateur: null, liensEnvoyes: [], ecritures: [] };
  const err = (code) => Object.assign(new Error(code), { code });
  const utilisateur = (email, uid) => ({ uid: uid || 'u-' + email, email, emailVerified: true, metadata: { lastSignInTime: new Date().toUTCString() }, updatePassword: async () => {} });
  const auth = {
    get currentUser() { return etat.utilisateur; },
    authStateReady: async () => {},
    onAuthStateChanged: (cb) => { cb(etat.utilisateur); return () => {}; },
    setPersistence: async () => {},
    signInWithEmailAndPassword: async (e, p) => { if (p !== 'bon') throw err('auth/invalid-credential'); etat.utilisateur = utilisateur(e); return { user: etat.utilisateur }; },
    createUserWithEmailAndPassword: async (e) => { etat.utilisateur = utilisateur(e); return { user: etat.utilisateur }; },
    sendSignInLinkToEmail: async (e, r) => { if (o.quota) throw err('auth/quota-exceeded'); etat.liensEnvoyes.push({ e, r }); },
    isSignInWithEmailLink: (href) => /oobCode=/.test(href),
    signInWithEmailLink: async (e) => { etat.utilisateur = utilisateur(e); return { user: etat.utilisateur }; },
    signInWithPopup: async () => { etat.utilisateur = utilisateur('g@exemple.org'); return { user: etat.utilisateur }; },
    sendPasswordResetEmail: async () => { throw err('auth/user-not-found'); },
    signOut: async () => { etat.utilisateur = null; },
  };
  const ref = (table, id) => ({
    get: async () => { const k = table + '/' + id; return { exists: docs.has(k), id, data: () => docs.get(k) }; },
    set: async (v) => {
      if (o.refuser && o.refuser(table, v)) throw err('permission-denied');
      etat.ecritures.push([table, id, v]); docs.set(table + '/' + id, v);
    },
    update: async (v) => { const k = table + '/' + id; if (!docs.has(k)) throw err('not-found'); docs.set(k, Object.assign({}, docs.get(k), v)); },
    delete: async () => { docs.delete(table + '/' + id); },
  });
  const requete = (table, filtres = [], tri = null, lim = null) => ({
    where: (c, op, v) => requete(table, filtres.concat([[c, v]]), tri, lim),
    orderBy: (c, d) => requete(table, filtres, [c, d], lim),
    limit: (n) => requete(table, filtres, tri, n),
    doc: (id) => ref(table, id),
    add: async (v) => { const id = 'auto' + docs.size; docs.set(table + '/' + id, v); return { id }; },
    get: async () => {
      let rows = [...docs.entries()].filter(([k]) => k.startsWith(table + '/')).map(([k, v]) => ({ id: k.split('/')[1], data: () => v, v }));
      rows = rows.filter((r) => filtres.every(([c, v]) => r.v[c] === v));
      if (tri) rows.sort((a, b) => (a.v[tri[0]] < b.v[tri[0]] ? -1 : 1) * (tri[1] === 'desc' ? -1 : 1));
      if (lim) rows = rows.slice(0, lim);
      return { docs: rows };
    },
  });
  const app = { name: '[DEFAULT]', auth: () => auth, firestore: () => ({ collection: (t) => requete(t) }) };
  const fb = { apps: [], initializeApp: () => app, auth: Object.assign(() => auth, { GoogleAuthProvider: function () {}, Auth: { Persistence: { NONE: 'none' } } }) };
  return { fb, etat, docs };
}
function stockage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; }
const CFG = { apiKey: 'a', authDomain: 'x.firebaseapp.com', projectId: 'x' };

// ── Bascule ──────────────────────────────────────────────────────────────
test('sans configuration, la page reste sur Supabase', () => {
  assert.strictEqual(FB.configuree(null), false);
  assert.strictEqual(FB.configuree({ apiKey: 'a' }), false, 'une config incomplete ne bascule pas');
  assert.strictEqual(FB.configuree(CFG), true);
  const f = tranche('function getSentinelSupabase()', 'function getClientDonnees()');
  assert.match(f, /if \(_fournisseurFirebase\(\)\) return window\.SentiqFirebase\.client\(\);/);
  assert.match(HTML, /<script src="js\/firebase-config\.js"><\/script>\s*<script src="js\/firebase\.js"><\/script>/);
  assert.match(ACCUEIL, /<script src="js\/firebase-config\.js"><\/script>\s*<script src="js\/firebase\.js"><\/script>/);
});

test('les donnees partagees restent sur Supabase pendant la bascule de la connexion', () => {
  for (const f of ['lireCollectePartagee', 'publierCollectePartagee', 'diagnostiquerCachePartage', 'publierArticlesRagPartages',
    'publierAgendaPartagee', 'lireAgendaPartagee', 'lireConfigEmailjsPartagee', 'publierConfigEmailjsPartagee']) {
    const debut = HTML.indexOf('async function ' + f + '(');
    const corps = HTML.slice(debut, HTML.indexOf('\n}', debut));
    assert.match(corps, /getClientDonnees\(\)/, f + ' doit lire le client de donnees');
    assert.doesNotMatch(corps, /getSentinelSupabase\(\)/, f);
  }
  const d = tranche('function getClientDonnees()', 'function _clientSupabaseEphemere()');
  assert.doesNotMatch(d, /SentiqFirebase/, 'le client de donnees ne bascule jamais vers Firebase');
});

test('la configuration servie ne contient aucun secret de compte de service', () => {
  const cfg = fs.readFileSync(path.join(RACINE, 'web/js/firebase-config.js'), 'utf8');
  assert.doesNotMatch(cfg, /private_key|client_email|BEGIN PRIVATE/);
});

// ── Lien de connexion ────────────────────────────────────────────────────
test('le « code par e-mail » devient un lien, et l\'adresse est gardee pour le retour', async () => {
  const { fb, etat } = fauxFirebase();
  const st = stockage();
  const c = FB.creerClient(fb, CFG, {}, { stockage: st, adresse: () => 'https://site/SentiqS_Web.html' });
  const r = await c.auth.signInWithOtp({ email: 'A@B.org', options: { emailRedirectTo: 'https://site/SentiqS_Web.html' } });
  assert.strictEqual(r.error, null);
  assert.strictEqual(etat.liensEnvoyes[0].r.handleCodeInApp, true);
  assert.strictEqual(st.getItem(FB.CLE_EMAIL_LIEN), 'a@b.org');
  const v = await c.auth.verifyOtp({ email: 'a@b.org', token: '123456', type: 'email' });
  assert.strictEqual(v.error.code, 'lien_seulement');
});

test('au retour du lien, la session est ouverte et compte comme la connexion du jour', async () => {
  const { fb } = fauxFirebase();
  const st = stockage(); st.setItem(FB.CLE_EMAIL_LIEN, 'a@b.org');
  let nettoyee = null;
  const c = FB.creerClient(fb, CFG, {}, { stockage: st, adresse: () => 'https://site/SentiqS_Web.html?apiKey=a&oobCode=XYZ&mode=signIn', remplacerAdresse: (u) => { nettoyee = u; } });
  const { data } = await c.auth.getSession();
  assert.strictEqual(data.session.user.email, 'a@b.org');
  assert.strictEqual(data.session.user.connexion_fraiche, true);
  assert.strictEqual(st.getItem(FB.CLE_EMAIL_LIEN), null, 'l\'adresse ne sert qu\'une fois');
  assert.strictEqual(nettoyee, 'https://site/SentiqS_Web.html', 'le code a usage unique quitte la barre d\'adresse');
});

test('une session restauree sans lien n\'est jamais « fraiche » (reconnexion du jour preservee)', async () => {
  const { fb, etat } = fauxFirebase();
  const c = FB.creerClient(fb, CFG, {}, { stockage: stockage(), adresse: () => 'https://site/SentiqS_Web.html#connexion-fraiche' });
  etat.utilisateur = { uid: 'u1', email: 'a@b.org', metadata: {} };
  const { data } = await c.auth.getSession();
  assert.strictEqual(data.session.user.connexion_fraiche, false);
  const f = tranche('async function checkAuth()', 'MODULE PARAMETRES');
  assert.match(f, /session\.user\.connexion_fraiche \|\|/);
});

test('un lien ouvert sur un autre appareil redemande l\'adresse au lieu d\'echouer', async () => {
  const { fb } = fauxFirebase();
  const c = FB.creerClient(fb, CFG, {}, { stockage: stockage(), adresse: () => 'https://site/x?oobCode=1' });
  const { data } = await c.auth.getSession();
  assert.strictEqual(data.session, null);
  assert.strictEqual(c.auth.lienEnAttente(), true);
  const r = await c.auth.terminerLienEmail(' A@B.org ');
  assert.strictEqual(r.data.user.email, 'a@b.org');
  assert.strictEqual(c.auth.lienEnAttente(), false);
  assert.match(HTML, /client\.auth\.lienEnAttente && client\.auth\.lienEnAttente\(\)\) \{\s*try \{\s*const \{ data, error \} = await client\.auth\.terminerLienEmail\(email\)/);
});

// ── Erreurs lues par la page ─────────────────────────────────────────────
function messagePage() {
  const ctx = { t: (k) => k, document: { getElementById: () => null } };
  vm.createContext(ctx);
  vm.runInContext(tranche('function normaliserCodeOtp', 'function _otpErreur') + '\nthis.m = messageErreurOtp;', ctx);
  return ctx.m;
}

test('le quota de 5 liens par jour est dit en clair, avec la sortie Google', async () => {
  const { fb } = fauxFirebase({ quota: true });
  const c = FB.creerClient(fb, CFG, {}, { stockage: stockage() });
  const r = await c.auth.signInWithOtp({ email: 'a@b.org' });
  assert.strictEqual(messagePage()(r.error, true), 'otp_err_quota');
  assert.match(HTML, /otp_err_quota:"Limite quotidienne[^"]*Continuer avec Google/);
});

test('un mauvais mot de passe garde le message que la page reconnait deja', async () => {
  const { fb } = fauxFirebase();
  const c = FB.creerClient(fb, CFG, {}, {});
  const r = await c.auth.signInWithPassword({ email: 'a@b.org', password: 'faux' });
  assert.match(r.error.message, /invalid/i, 'doLogin teste /invalid/i');
  const inscr = FB.erreur({ code: 'auth/email-already-in-use' });
  assert.match(inscr.message, /already registered/i, 'doRegister teste /already registered/');
});

test('mot de passe oublie : une adresse inconnue ne se revele pas', async () => {
  const { fb } = fauxFirebase();
  const c = FB.creerClient(fb, CFG, {}, {});
  const r = await c.auth.resetPasswordForEmail('inconnu@b.org');
  assert.strictEqual(r.error, null);
});

// ── Profils ──────────────────────────────────────────────────────────────
test('le role admin n\'est retenu que si les regles l\'acceptent, sinon « user »', async () => {
  const refus = (table, v) => table === 'profiles' && v.role === 'admin';
  const { fb, docs } = fauxFirebase({ refuser: refus });
  const c = FB.creerClient(fb, CFG, {}, {});
  const { data, error } = await c.from('profiles').insert({ id: 'u1', email: 'a@b.org', data: { plan: 'gratuit' } }).select('*').maybeSingle();
  assert.strictEqual(error, null);
  assert.strictEqual(data.role, 'user');
  assert.strictEqual(data.status, 'active');
  assert.strictEqual(docs.get('profiles/u1').role, 'user');

  const admin = fauxFirebase();
  const c2 = FB.creerClient(admin.fb, CFG, {}, {});
  const r2 = await c2.from('profiles').insert({ id: 'u2', email: 'x@y.org', data: {} }).select('*').maybeSingle();
  assert.strictEqual(r2.data.role, 'admin', 'accepte par les regles = adresse admin verifiee');
});

test('lecture, mise a jour et suppression d\'un profil par son id, comme PostgREST', async () => {
  const { fb, docs } = fauxFirebase();
  const c = FB.creerClient(fb, CFG, {}, { maintenant: () => new Date('2026-10-21T08:00:00Z') });
  docs.set('profiles/u1', { id: 'u1', email: 'a@b.org', role: 'user', status: 'active', data: { plan: 'gratuit' } });
  const lu = await c.from('profiles').select('*').eq('id', 'u1').maybeSingle();
  assert.strictEqual(lu.data.data.plan, 'gratuit');
  const absent = await c.from('profiles').select('*').eq('id', 'zz').maybeSingle();
  assert.strictEqual(absent.data, null);
  await c.from('profiles').update({ data: { plan: 'pro' } }).eq('id', 'u1');
  assert.strictEqual(docs.get('profiles/u1').data.plan, 'pro');
  assert.strictEqual(docs.get('profiles/u1').updated_at, '2026-10-21T08:00:00.000Z');
  const sansId = await c.from('profiles').update({ role: 'admin' });
  assert.ok(sansId.error, 'une mise a jour sans id ne touche jamais toute la collection');
  await c.from('profiles').delete().eq('id', 'u1');
  assert.strictEqual(docs.has('profiles/u1'), false);
});

test('journal des connexions : insertion datee, lecture triee et bornee', async () => {
  const { fb } = fauxFirebase();
  let n = 0;
  const c = FB.creerClient(fb, CFG, {}, { maintenant: () => new Date(Date.UTC(2026, 9, 21, 8, n++)) });
  for (const e of ['a', 'b', 'c']) await c.from('connexions_log').insert({ email: e + '@x.org', name: undefined, platform: 'web' });
  const { data } = await c.from('connexions_log').select('email,created_at').order('created_at', { ascending: false }).limit(2);
  assert.deepStrictEqual(data.map((r) => r.email), ['c@x.org', 'b@x.org']);
});

test('l\'accueil reprend le profil saisi une seule fois, sans jamais fixer le plan', () => {
  const ctx = { localStorage: stockage(), JSON };
  vm.createContext(ctx);
  vm.runInContext(tranche('function profilInscriptionEnAttente', 'function finaliserConnexion') + '\nthis.f = profilInscriptionEnAttente;', ctx);
  ctx.localStorage.setItem('sentiq_profil_inscription', JSON.stringify({ email: 'A@b.org', profil: { name: 'Awa', organisation: 'X', plan: 'entreprise', role: 'admin' } }));
  const p = ctx.f('a@b.org');
  assert.strictEqual(p.name, 'Awa');
  assert.strictEqual(p.plan, undefined, 'le plan ne vient jamais de l\'appareil');
  assert.strictEqual(p.role, undefined);
  assert.deepStrictEqual(Object.keys(ctx.f('a@b.org')), [], 'repris une seule fois');
  ctx.localStorage.setItem('sentiq_profil_inscription', JSON.stringify({ email: 'autre@b.org', profil: { name: 'Z' } }));
  assert.deepStrictEqual(Object.keys(ctx.f('a@b.org')), [], 'une autre adresse ne recoit rien');
});

// ── Regles et page ───────────────────────────────────────────────────────
test('les regles Firestore portent ce que faisaient les declencheurs Supabase', () => {
  assert.match(REGLES, /request\.auth\.token\.email_verified == true/, 'admin seulement sur adresse verifiee');
  assert.match(REGLES, /request\.resource\.data\.role == resource\.data\.role/, 'pas de changement de son propre role');
  assert.match(REGLES, /request\.resource\.data\.status == resource\.data\.status/, 'ni de son statut');
  assert.match(REGLES, /allow delete: if estAdmin\(\);/);
  assert.doesNotMatch(REGLES, /allow read, write: if true/);
  // Les adresses des administrateurs vivent dans les regles, jamais dans le
  // code servi. Deux depuis le 21/10/2026, a la demande de YORO.
  const liste = (REGLES.match(/token\.email in \[([^\]]+)\]/) || [])[1] || '';
  const adresses = liste.match(/'[^']+'/g).map((a) => a.slice(1, -1));
  assert.deepStrictEqual(adresses, ['yorot225@gmail.com', 'a3fyee@gmail.com']);
  const adaptateur = fs.readFileSync(path.join(RACINE, 'web/js/firebase.js'), 'utf8');
  for (const a of adresses) assert.ok(!adaptateur.includes(a), a);
});

test('la politique de securite des deux pages autorise Firebase Auth, Firestore et la fenetre Google', () => {
  for (const [nom, page] of [['appli', HTML], ['accueil', ACCUEIL]]) {
    const csp = (page.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
    assert.match(csp, /connect-src[^;]*https:\/\/\*\.googleapis\.com/, nom);
    assert.match(csp, /script-src[^;]*https:\/\/apis\.google\.com/, nom);
    assert.match(csp, /frame-src[^;]*https:\/\/\*\.firebaseapp\.com/, nom);
  }
});

test('le bouton Google n\'apparait qu\'avec Firebase', () => {
  assert.match(HTML, /id="googleBtn" style="display:none"/);
  const f = tranche('function appliquerModeLien()', 'function validerConnexion()');
  assert.match(f, /getElementById\('googleBtn'\); if \(g\) g\.style\.display = 'block'/);
  assert.match(ACCUEIL, /id="suGoogleBtn" onclick="inscriptionGoogle\(\)"/);
});

// Mesure du 21/10/2026 sur la page publiée : plus de 8 s avant l'écran de
// connexion, les trois scripts du kit étant chargés l'un après l'autre.
test('le kit se télécharge en parallèle, exécuté dans l\'ordre', async () => {
  const ajoutes = [];
  const doc = { createElement: () => ({}), head: { appendChild: (s) => ajoutes.push(s) } };
  const p = FB.chargerSdk(doc);
  // Les trois balises sont posées AVANT qu'une seule ait fini de charger.
  assert.strictEqual(ajoutes.length, 3);
  assert.deepStrictEqual(ajoutes.map((s) => s.async), [false, false, false]);
  assert.match(ajoutes[0].src, /firebase-app-compat\.js$/);
  ajoutes.forEach((s) => s.onload());
  await p;
});

test('l\'appli lance le chargement du kit dès l\'ouverture', () => {
  const i = HTML.indexOf('<script src="js/firebase.js"></script>');
  const suite = HTML.slice(i, i + 400);
  assert.match(suite, /SentiqFirebase\.charger\(\)\.catch\(/);
});
