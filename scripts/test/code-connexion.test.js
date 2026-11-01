// Connexion par CODE à six chiffres pour toute adresse e-mail (01/11/2026).
// Firebase (plan Spark) n'envoie qu'un lien, 5 par jour pour tout le projet ;
// le service gratuit firebase/code-connexion/Code.gs (Google Apps Script)
// émet le code et un jeton personnalisé. Ces tests font tourner :
//   · le VRAI script Apps Script dans un contexte vm, avec de faux services
//     Google (MailApp, CacheService…) et une vraie clé RSA : le jeton émis
//     est vérifié avec la clé publique, comme le ferait Firebase ;
//   · l'adaptateur web/js/firebase.js branché sur ce faux service ;
//   · le câblage des deux pages.
// L'envoi réel d'un e-mail et l'échange réel du jeton ne se testent qu'une
// fois le script déployé par le propriétaire.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const FB = require('../../web/js/firebase.js');
const { HTML, tranche } = require('./_bac');
const RACINE = path.join(__dirname, '../..');
const ACCUEIL = fs.readFileSync(path.join(RACINE, 'web/index.html'), 'utf8');
const SCRIPT = fs.readFileSync(path.join(RACINE, 'firebase/code-connexion/Code.gs'), 'utf8');
const URL_CODE = 'https://script.google.com/macros/s/AKfycbx-test_1/exec';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const CLE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const COMPTE = { project_id: 'sentiqs-235ce', client_email: 'firebase-adminsdk-x@sentiqs-235ce.iam.gserviceaccount.com', private_key: CLE_PEM };

// ── Faux services Google ─────────────────────────────────────────────────
function fauxGoogle(o = {}) {
  const proprietes = new Map(Object.entries(o.proprietes || { COMPTE_SERVICE: JSON.stringify(COMPTE) }));
  const cache = new Map();
  const mails = [];
  const appels = [];
  const comptes = new Map(Object.entries(o.comptes || {})); // email -> { localId, emailVerified, disabled }
  const octets = (buf) => [...buf].map((b) => (b > 127 ? b - 256 : b));
  const ctx = {
    JSON, Date, Math, parseInt, String, console,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_a, t) => octets(crypto.createHash('sha256').update(String(t), 'utf8').digest()),
      getUuid: () => crypto.randomUUID(),
      formatDate: (d) => d.toISOString().slice(0, 10),
      base64EncodeWebSafe: (v) => (typeof v === 'string' ? Buffer.from(v, 'utf8') : Buffer.from(v.map((b) => b & 0xff))).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      computeRsaSha256Signature: (t, cle) => octets(crypto.createSign('RSA-SHA256').update(t).sign(cle)),
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (proprietes.has(k) ? proprietes.get(k) : null),
      setProperty: (k, v) => proprietes.set(k, String(v)),
      deleteProperty: (k) => proprietes.delete(k),
      getKeys: () => [...proprietes.keys()],
    }) },
    CacheService: { getScriptCache: () => ({
      get: (k) => (cache.has(k) ? cache.get(k) : null),
      put: (k, v) => cache.set(k, v),
      remove: (k) => cache.delete(k),
    }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    MailApp: { getRemainingDailyQuota: () => (o.quotaGmail === undefined ? 100 : o.quotaGmail), sendEmail: (m) => mails.push(m) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ t, setMimeType() { return this; } }) },
    UrlFetchApp: { fetch: (url, opt) => {
      appels.push(url);
      const rep = (code, corps) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(corps) });
      if (url === 'https://oauth2.googleapis.com/token') return rep(200, { access_token: 'acces-test' });
      assert.strictEqual(opt.headers.Authorization, 'Bearer acces-test');
      const corps = JSON.parse(opt.payload);
      if (url.endsWith('/accounts:lookup')) { const u = comptes.get(corps.email[0]); return rep(200, u ? { users: [Object.assign({ email: corps.email[0] }, u)] } : {}); }
      if (url.endsWith('/accounts:update')) { for (const u of comptes.values()) if (u.localId === corps.localId) u.emailVerified = corps.emailVerified; return rep(200, {}); }
      if (url.endsWith('/accounts')) { const u = { localId: 'nouveau-' + comptes.size, emailVerified: corps.emailVerified }; comptes.set(corps.email, u); return rep(200, u); }
      return rep(404, {});
    } },
  };
  vm.createContext(ctx);
  vm.runInContext(SCRIPT, ctx);
  const post = (corps) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).t);
  const dernierCode = () => (mails[mails.length - 1].body.match(/: (\d{6})/) || [])[1];
  return { ctx, post, mails, appels, comptes, cache, proprietes, dernierCode };
}
function lireJeton(jwt) {
  const [e, c, s] = jwt.split('.');
  const ok = crypto.createVerify('RSA-SHA256').update(e + '.' + c).verify(publicKey, Buffer.from(s, 'base64url'));
  return { ok, entete: JSON.parse(Buffer.from(e, 'base64url')), charge: JSON.parse(Buffer.from(c, 'base64url')) };
}

// ── Le service (Apps Script) ─────────────────────────────────────────────
test('un code a six chiffres part par e-mail, et le service n\'en garde que l\'empreinte', () => {
  const g = fauxGoogle();
  const r = g.post({ action: 'envoyer', email: ' Awa@Entreprise.CI ' });
  assert.deepStrictEqual(r, { ok: true, duree: 600 });
  assert.strictEqual(g.mails.length, 1);
  assert.strictEqual(g.mails[0].to, 'awa@entreprise.ci');
  const code = g.dernierCode();
  assert.match(code, /^\d{6}$/);
  assert.ok(g.mails[0].subject.startsWith(code), 'le code est lisible dans l\'objet, sans ouvrir le message');
  for (const v of g.cache.values()) assert.ok(!String(v).includes(code), 'jamais le code en clair dans le cache');
});

test('le bon code donne un jeton personnalise Firebase signe par le compte de service', () => {
  const g = fauxGoogle();
  g.post({ action: 'envoyer', email: 'awa@entreprise.ci' });
  const r = g.post({ action: 'verifier', email: 'awa@entreprise.ci', code: g.dernierCode() });
  assert.strictEqual(r.ok, true);
  const j = lireJeton(r.jeton);
  assert.ok(j.ok, 'signature RS256 valide pour la cle publique du compte de service');
  assert.strictEqual(j.entete.alg, 'RS256');
  assert.strictEqual(j.charge.aud, 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit');
  assert.strictEqual(j.charge.iss, COMPTE.client_email);
  assert.strictEqual(j.charge.sub, COMPTE.client_email);
  assert.ok(j.charge.exp - j.charge.iat <= 3600, 'Firebase refuse un jeton de plus d\'une heure');
  assert.strictEqual(j.charge.uid, g.comptes.get('awa@entreprise.ci').localId, 'compte cree a la premiere connexion');
  assert.strictEqual(g.comptes.get('awa@entreprise.ci').emailVerified, true);
});

test('un compte existant (Google, mot de passe) est retrouve par son adresse, pas duplique', () => {
  const g = fauxGoogle({ comptes: { 'yao@exemple.org': { localId: 'uid-google', emailVerified: false } } });
  g.post({ action: 'envoyer', email: 'yao@exemple.org' });
  const r = g.post({ action: 'verifier', email: 'yao@exemple.org', code: g.dernierCode() });
  assert.strictEqual(lireJeton(r.jeton).charge.uid, 'uid-google');
  assert.strictEqual(g.comptes.size, 1);
  assert.strictEqual(g.comptes.get('yao@exemple.org').emailVerified, true, 'la boite vient d\'etre prouvee');
});

test('un compte desactive n\'obtient pas de jeton', () => {
  const g = fauxGoogle({ comptes: { 'x@exemple.org': { localId: 'uid-x', emailVerified: true, disabled: true } } });
  g.post({ action: 'envoyer', email: 'x@exemple.org' });
  const r = g.post({ action: 'verifier', email: 'x@exemple.org', code: g.dernierCode() });
  assert.deepStrictEqual(r, { ok: false, erreur: 'desactive' });
});

test('code faux : refuse, et cinq essais invalident le code', () => {
  const g = fauxGoogle();
  g.post({ action: 'envoyer', email: 'a@b.org' });
  const bon = g.dernierCode();
  const faux = bon === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.deepStrictEqual(g.post({ action: 'verifier', email: 'a@b.org', code: faux }), { ok: false, erreur: 'code' });
  assert.deepStrictEqual(g.post({ action: 'verifier', email: 'a@b.org', code: bon }), { ok: false, erreur: 'code' }, 'plus de devinette apres cinq essais');
});

test('un code ne sert qu\'une fois, et ne vaut que pour son adresse', () => {
  const g = fauxGoogle();
  g.post({ action: 'envoyer', email: 'a@b.org' });
  const code = g.dernierCode();
  assert.deepStrictEqual(g.post({ action: 'verifier', email: 'autre@b.org', code }), { ok: false, erreur: 'code' });
  assert.strictEqual(g.post({ action: 'verifier', email: 'a@b.org', code }).ok, true);
  assert.deepStrictEqual(g.post({ action: 'verifier', email: 'a@b.org', code }), { ok: false, erreur: 'code' });
});

test('un renvoi par minute par adresse, et le plafond quotidien protege le quota Gmail', () => {
  const g = fauxGoogle({ proprietes: { COMPTE_SERVICE: JSON.stringify(COMPTE), QUOTA_JOUR: '2' } });
  assert.strictEqual(g.post({ action: 'envoyer', email: 'a@b.org' }).ok, true);
  assert.deepStrictEqual(g.post({ action: 'envoyer', email: 'a@b.org' }), { ok: false, erreur: 'rate' });
  assert.strictEqual(g.post({ action: 'envoyer', email: 'c@b.org' }).ok, true);
  assert.deepStrictEqual(g.post({ action: 'envoyer', email: 'd@b.org' }), { ok: false, erreur: 'quota' });
  assert.strictEqual(g.mails.length, 2);
  const vide = fauxGoogle({ quotaGmail: 0 });
  assert.deepStrictEqual(vide.post({ action: 'envoyer', email: 'a@b.org' }), { ok: false, erreur: 'quota' });
});

test('sans cle de compte de service, le service le dit au lieu de pretendre envoyer', () => {
  const g = fauxGoogle({ proprietes: {} });
  assert.deepStrictEqual(g.post({ action: 'envoyer', email: 'a@b.org' }), { ok: false, erreur: 'config' });
  assert.strictEqual(g.mails.length, 0);
  assert.strictEqual(JSON.parse(g.ctx.doGet().t).pret, false);
  assert.deepStrictEqual(g.post({ action: 'envoyer', email: 'pas-une-adresse' }), { ok: false, erreur: 'email' });
});

// ── L'adaptateur de la page ──────────────────────────────────────────────
function fauxFirebase() {
  const etat = { utilisateur: null, jetons: [], liens: 0 };
  const auth = {
    get currentUser() { return etat.utilisateur; },
    authStateReady: async () => {}, onAuthStateChanged: (cb) => { cb(etat.utilisateur); return () => {}; },
    isSignInWithEmailLink: () => false,
    sendSignInLinkToEmail: async () => { etat.liens += 1; },
    signInWithCustomToken: async (j) => {
      etat.jetons.push(j);
      const uid = JSON.parse(Buffer.from(j.split('.')[1], 'base64url')).uid;
      etat.utilisateur = { uid, email: 'awa@entreprise.ci', emailVerified: true, metadata: { lastSignInTime: new Date().toUTCString() } };
      return { user: etat.utilisateur };
    },
  };
  const app = { name: '[DEFAULT]', auth: () => auth, firestore: () => ({ collection: () => ({}) }) };
  return { fb: { apps: [], initializeApp: () => app, auth: () => auth }, etat };
}
const CFG = { apiKey: 'a', authDomain: 'x.firebaseapp.com', projectId: 'x' };
// fetch branché sur le vrai script : le chemin complet page -> service -> jeton.
function fetchVers(g) {
  const recus = [];
  const f = async (url, init) => { recus.push({ url, init }); return { json: async () => g.post(JSON.parse(init.body)) }; };
  return { f, recus };
}

test('l\'adresse du service doit etre une application Web Apps Script', () => {
  assert.strictEqual(FB.urlCode(URL_CODE), URL_CODE);
  for (const mauvaise of ['', 'http://script.google.com/macros/s/x/exec', 'https://evil.example/macros/s/x/exec', 'https://script.google.com/macros/s/x/dev']) {
    assert.strictEqual(FB.urlCode(mauvaise), null, mauvaise);
  }
});

test('avec le service : code envoye, verifie, session Firebase ouverte et « fraiche »', async () => {
  const g = fauxGoogle();
  const { f, recus } = fetchVers(g);
  const { fb, etat } = fauxFirebase();
  const c = FB.creerClient(fb, CFG, { urlCode: URL_CODE }, { fetch: f });
  assert.strictEqual(c.auth.parLien, false);
  assert.strictEqual(c.auth.parCode, true);
  const e = await c.auth.signInWithOtp({ email: 'Awa@Entreprise.ci', options: { shouldCreateUser: true } });
  assert.strictEqual(e.error, null);
  assert.strictEqual(etat.liens, 0, 'aucun lien Firebase consomme sur le quota de 5');
  assert.strictEqual(recus[0].url, URL_CODE);
  assert.strictEqual(recus[0].init.headers['Content-Type'], 'text/plain;charset=utf-8', 'requete simple, sans pre-vol CORS');
  const v = await c.auth.verifyOtp({ email: 'awa@entreprise.ci', token: g.dernierCode(), type: 'email' });
  assert.strictEqual(v.error, null);
  assert.strictEqual(etat.jetons.length, 1);
  assert.strictEqual(v.data.user.email, 'awa@entreprise.ci');
  assert.strictEqual(v.data.user.connexion_fraiche, true, 'compte comme la saisie du jour');
});

test('les refus du service gardent les mots que la page reconnait (quota, limite, code)', async () => {
  const reponses = { envoyer: { ok: false, erreur: 'quota' } };
  const f = async (_u, init) => ({ json: async () => reponses[JSON.parse(init.body).action] });
  const { fb } = fauxFirebase();
  const c = FB.creerClient(fb, CFG, { urlCode: URL_CODE }, { fetch: f });
  assert.match((await c.auth.signInWithOtp({ email: 'a@b.org' })).error.message, /quota/i);
  reponses.envoyer = { ok: false, erreur: 'rate' };
  assert.match((await c.auth.signInWithOtp({ email: 'a@b.org' })).error.message, /rate/i);
  reponses.envoyer = { ok: false, erreur: 'config' };
  assert.match((await c.auth.signInWithOtp({ email: 'a@b.org' })).error.message, /error sending/i);
  reponses.verifier = { ok: false, erreur: 'code' };
  const v = await c.auth.verifyOtp({ email: 'a@b.org', token: '123456' });
  assert.doesNotMatch(v.error.message, /quota|rate|link expired/i, 'un code faux reste « code incorrect »');
  const hs = FB.creerClient(fauxFirebase().fb, CFG, { urlCode: URL_CODE }, { fetch: async () => { throw new Error('hors ligne'); } });
  assert.match((await hs.auth.signInWithOtp({ email: 'a@b.org' })).error.message, /network|fetch/i);
});

test('sans adresse de service, la page garde le lien Firebase (comportement d\'avant)', async () => {
  const { fb, etat } = fauxFirebase();
  const c = FB.creerClient(fb, CFG, { urlCode: '' }, { fetch: async () => { throw new Error('ne doit pas etre appele'); } });
  assert.strictEqual(c.auth.parLien, true);
  await c.auth.signInWithOtp({ email: 'a@b.org' });
  assert.strictEqual(etat.liens, 1);
  assert.strictEqual((await c.auth.verifyOtp({})).error.code, 'lien_seulement');
});

// ── Les pages ────────────────────────────────────────────────────────────
test('la politique de securite des deux pages laisse joindre le service de code', () => {
  for (const [nom, page] of [['appli', HTML], ['accueil', ACCUEIL]]) {
    const csp = (page.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
    assert.match(csp, /connect-src[^;]*https:\/\/script\.google\.com/, nom);
    assert.match(csp, /connect-src[^;]*https:\/\/script\.googleusercontent\.com/, nom, 'la reponse arrive apres une redirection');
  }
});

test('avec le service, l\'ecran garde la saisie du code et propose toujours Google', () => {
  const f = tranche('function appliquerModeLien()', 'function validerConnexion()');
  const google = f.indexOf("getElementById('googleBtn')");
  const sortie = f.indexOf('auth.parCode) return;');
  assert.ok(google > -1 && sortie > google, 'Google affiche avant la sortie du mode code');
  assert.ok(f.indexOf("classList.add('mode-lien')") > sortie, 'le mode lien ne s\'applique qu\'apres');
  const dans = (debut, fin) => { const a = ACCUEIL.indexOf(debut); assert.ok(a > -1, debut); return ACCUEIL.slice(a, ACCUEIL.indexOf(fin, a)); };
  const i = dans('function appliquerModeLienInscription()', 'function _suLireProfil()');
  assert.ok(i.indexOf('suGoogleBtn') < i.indexOf('if (!_inscriptionParLien()) return;'));
  // L'accueil verifiait le code sur Supabase meme avec Firebase actif.
  const v = dans('async function verifierCodeInscription()', '</script>');
  assert.match(v, /const client = await _clientInscription\(\);/);
  assert.doesNotMatch(v, /getSentinelSupabase\(\)/);
});

test('la cle du compte de service ne vit jamais dans le code servi', () => {
  const cfg = fs.readFileSync(path.join(RACINE, 'web/js/firebase-config.js'), 'utf8');
  assert.match(cfg, /window\.SENTIQ_CODE_CONNEXION_URL = '[^']*';/);
  assert.doesNotMatch(cfg + SCRIPT, /BEGIN PRIVATE KEY/);
  assert.match(SCRIPT, /getProperty\('COMPTE_SERVICE'\)/, 'la cle est lue dans les proprietes du script');
});
