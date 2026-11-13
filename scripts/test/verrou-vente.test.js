// Bloquants de vente levés le 13/11/2026 (état des lieux du même jour) :
//   1. un utilisateur pouvait se passer lui-même en forfait payant ;
//   2. le cache d'actus et l'agenda étaient lisibles sans compte.
// Les règles Firestore ne sont pas exécutées ici (pas d'émulateur) : ces tests
// gardent leur forme, et le câblage du jeton côté page.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { HTML, tranche } = require('./_bac.js');

const REGLES = fs.readFileSync(path.join(__dirname, '..', '..', 'firebase', 'firestore.rules'), 'utf8');
const bloc = (m) => { const i = REGLES.indexOf('match /' + m + '/'); assert.ok(i > 0, m); return REGLES.slice(i, REGLES.indexOf('\n    }', i)); };

test('un utilisateur ne peut changer ni son forfait, ni son paiement, ni son échéance, ni son accès', () => {
  for (const champ of ['plan', 'paiement', 'echeance', 'dlQuotaOverride', 'accesJusquau', 'createdAt'])
    assert.match(REGLES, new RegExp("inchange\\('" + champ + "'\\)"), champ);
  const upd = bloc('profiles').slice(bloc('profiles').indexOf('allow update'));
  assert.match(upd, /commercialInchange\(\)/, 'la mise à jour par soi-même doit garder les champs commerciaux');
});

test('un compte naît au forfait gratuit, sans paiement ni accès prolongé', () => {
  const cr = bloc('profiles').slice(bloc('profiles').indexOf('allow create'), bloc('profiles').indexOf('allow update'));
  assert.match(cr, /champ\(request\.resource\.data, 'plan'\) in \[null, 'gratuit'\]/);
  for (const c of ['paiement', 'echeance', 'dlQuotaOverride', 'accesJusquau'])
    assert.match(cr, new RegExp("champ\\(request\\.resource\\.data, '" + c + "'\\) == null"), c);
});

test('le cache et l\'agenda partagés ne se lisent plus sans compte actif', () => {
  const b = bloc('collecte_partagee');
  assert.doesNotMatch(b, /allow read: if true/);
  assert.match(b, /allow read: if profilActif\(\)/);
  assert.match(REGLES, /profiles\/\$\(request\.auth\.uid\)\)\.data\.status == 'active'/);
});

test('la page lit le cache et l\'agenda avec le jeton du compte, et ne tente rien sans lui', () => {
  const lec = tranche('async function _entetesFirestore()', 'async function lireCollectePartagee()');
  assert.match(lec, /Authorization: 'Bearer ' \+ jeton/);
  assert.match(lec, /if \(!entetes\) return null;/);
  assert.match(lec, /lire\(window\.SENTIQ_FIREBASE_CONFIG, \{ stockage, entetes \}\)/);
  assert.match(tranche('async function lireAgendaPartagee()', '\n}\n'), /\{ stockage, entetes \}/);
});

test('l\'adaptateur Firebase fournit le jeton d\'identité, null sans session', async () => {
  const fb = require('../../web/js/firebase.js');
  const faux = (u) => {
    const auth = { currentUser: u, authStateReady: async () => {}, setPersistence: async () => {},
      onAuthStateChanged: (cb) => { cb(u); return () => {}; }, isSignInWithEmailLink: () => false };
    return { apps: [], initializeApp: () => ({ name: 'x', auth: () => auth, firestore: () => ({ collection: () => ({}) }) }) };
  };
  const cfg = { apiKey: 'k', projectId: 'p', authDomain: 'd', appId: 'a' };
  const env = { stockage: null, adresse: () => 'https://x/', remplacerAdresse() {} };
  const avec = fb.creerClient(faux({ uid: 'u', email: 'e@x', getIdToken: async () => 'JETON' }), cfg, {}, env);
  assert.strictEqual(await avec.auth.jeton(), 'JETON');
  const sans = fb.creerClient(faux(null), cfg, { nom: 'b' }, env);
  assert.strictEqual(await sans.auth.jeton(), null);
});

test('les contrôles du job lisent avec le compte de service', () => {
  const v = fs.readFileSync(path.join(__dirname, '..', 'verifier-fraicheur-cache.js'), 'utf8');
  assert.match(v, /jetonAcces\(compte, fetch\)/);
  assert.ok(HTML.length > 0);
});
