// Suppression du compte par l'utilisateur lui-même — 13/11/2026.
//
// Exigence du Play Store pour toute application avec comptes : l'utilisateur
// doit pouvoir supprimer son compte depuis l'application ET trouver une page
// web qui dit comment faire. Avant ce jour, seul l'administrateur supprimait
// un compte (règle Firestore « allow delete: if estAdmin() »).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { HTML, tranche } = require('./_bac.js');
const fb = require('../../web/js/firebase.js');

const REGLES = fs.readFileSync(path.join(__dirname, '..', '..', 'firebase', 'firestore.rules'), 'utf8');

function client({ ageMin = 1, role = 'user', echecProfil = false } = {}) {
  const journal = [];
  const u = {
    uid: 'u1', email: 'e@x',
    getIdTokenResult: async () => ({ authTime: new Date(Date.now() - ageMin * 60000).toISOString() }),
    delete: async () => { journal.push('auth'); },
  };
  const docs = { u1: { role } };
  const db = { collection: (c) => ({ doc: (id) => ({
    get: async () => ({ exists: !!docs[id], data: () => docs[id] }),
    delete: async () => { if (echecProfil) throw { code: 'permission-denied' }; journal.push(c + '/' + id); delete docs[id]; },
  }) }) };
  const auth = { currentUser: u, authStateReady: async () => {}, onAuthStateChanged: (cb) => { cb(u); return () => {}; }, isSignInWithEmailLink: () => false };
  const f = { apps: [], initializeApp: () => ({ name: 'x', auth: () => auth, firestore: () => db }) };
  const c = fb.creerClient(f, { apiKey: 'k', projectId: 'p', authDomain: 'd', appId: 'a' }, {}, { stockage: null, adresse: () => 'https://x/', remplacerAdresse() {} });
  return { c, journal };
}

test('une connexion récente : le profil puis le compte sont supprimés, dans cet ordre', async () => {
  const { c, journal } = client();
  const r = await c.auth.supprimerCompte();
  assert.strictEqual(r.error, null);
  assert.deepStrictEqual(journal, ['profiles/u1', 'auth']);
});

test('une connexion ancienne : rien n\'est supprimé, il faut se reconnecter', async () => {
  const { c, journal } = client({ ageMin: 30 });
  const r = await c.auth.supprimerCompte();
  assert.strictEqual(r.error && r.error.code, 'reconnexion');
  assert.deepStrictEqual(journal, []);
});

test('un administrateur ne se supprime pas lui-même', async () => {
  const { c, journal } = client({ role: 'admin' });
  const r = await c.auth.supprimerCompte();
  assert.strictEqual(r.error && r.error.code, 'admin');
  assert.deepStrictEqual(journal, []);
});

test('un refus sur le profil n\'efface pas l\'identité', async () => {
  const { c, journal } = client({ echecProfil: true });
  const r = await c.auth.supprimerCompte();
  assert.ok(r.error);
  assert.deepStrictEqual(journal, []);
});

test('les règles laissent un utilisateur supprimer son propre profil, jamais celui d\'un autre ni un profil admin', () => {
  const i = REGLES.indexOf('match /profiles/');
  const b = REGLES.slice(i, REGLES.indexOf('\n    }', i));
  const del = b.slice(b.indexOf('allow delete'));
  assert.match(del, /request\.auth\.uid == uid/);
  assert.match(del, /resource\.data\.role != 'admin'/);
});

test('Paramètres porte la suppression, confirmée par un mot tapé, en français et en anglais', () => {
  assert.match(HTML, /id="pmSuppression"/);
  assert.match(HTML, /onclick="supprimerMonCompte\(\)"/);
  const f = tranche('async function supprimerMonCompte()', '\n}\n');
  assert.match(f, /SUPPRIMER|DELETE/);
  assert.match(f, /auth\.supprimerCompte\(\)/);
  assert.match(f, /doLogout\(\)/);
  assert.strictEqual((HTML.match(/suppr_titre:'/g) || []).length, 2);
});

test('une page web dit comment supprimer son compte (lien demandé par le Play Store)', () => {
  const p = fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'legal', 'suppression-compte.html'), 'utf8');
  assert.match(p, /Supprimer mon compte/);
  assert.match(p, /Paramètres/);
});
