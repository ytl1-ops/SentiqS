// Traductions partagées entre utilisateurs (20/11/2026). Demande de YORO :
// une actu traduite pour un utilisateur ne doit pas être retraduite pour les
// autres. On rejoue le vrai trFetch de la page dans deux contextes séparés
// (deux navigateurs) qui partagent un faux Firestore : le second ne doit
// appeler aucun service de traduction.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { tranche, bac } = require('./_bac');
const TP = require('../../web/js/traductions-partagees.js');

const empreinte = (c, s) => crypto.createHash('sha256').update(c + '\n' + s).digest('hex');
const jwt = (uid) => 'x.' + Buffer.from(JSON.stringify({ user_id: uid, sub: uid })).toString('base64url') + '.y';

// Faux Firestore : batchGet et création seule (409 si le document existe).
function fauxFirestore(o) {
  const docs = new Map();
  const appels = { lectures: 0, ecritures: 0 };
  const fetchFn = async (url, init) => {
    if (o && o.panne) throw new Error('hors ligne');
    const corps = JSON.parse(init.body);
    if (url.endsWith(':batchGet')) {
      appels.lectures += corps.documents.length;
      return { ok: true, json: async () => corps.documents.map((n) => (docs.has(n) ? { found: { name: n, fields: docs.get(n) } } : { missing: n })) };
    }
    const m = url.match(/documents\/traductions\?documentId=([0-9a-f]{64})$/);
    assert.ok(m, 'adresse de création inattendue : ' + url);
    const nom = 'projects/p/databases/(default)/documents/traductions/' + m[1];
    appels.ecritures++;
    if (docs.has(nom)) return { ok: false, status: 409 };
    docs.set(nom, corps.fields);
    return { ok: true, json: async () => ({}) };
  };
  return { docs, appels, fetchFn };
}

function navigateur(store, uid) {
  const services = { appels: 0 };
  const ctx = bac(
    tranche('const TR_PARTAGE_LECTURES_MAX', 'async function _traduireParLots'),
    tranche('async function _traduireParLots', '// preTraduireRapport(textes)'),
    tranche('async function trFetch(', '// ── TRADUCTION DES RAPPORTS'),
  );
  Object.assign(ctx, {
    LANG: 'fr', TR_CACHE: {}, TR_DEJA_BON: new Set(), EXTRAIT_MAX_CARACTERES: 280, TR_CONCURRENCE_MAX: 2,
    detectLangue: (t) => (/\b(the|attack|gunmen|police)\b/i.test(t) ? 'en' : 'fr'),
    _trTexteTraduisible: (t, max) => (t.length <= max ? t : t.slice(0, max) + '…'),
    _trDecodeEntities: (t) => t,
    _fournisseurFirebase: () => true,
    _entetesFirestore: async () => ({ Authorization: 'Bearer ' + jwt(uid) }),
    setTimeout,
    fetch: store.fetchFn,
    window: { SentiqTraductionsPartagees: TP, SENTIQ_FIREBASE_CONFIG: { projectId: 'p' } },
    TR_AGENT_PROVIDERS: [async (t) => { services.appels++; return 'Des hommes armés attaquent un poste de police'; }],
  });
  return { ctx, services };
}
const attendre = () => new Promise((r) => setTimeout(r, 20));
const TITRE = 'Gunmen attack police post';

test('un second navigateur relit la traduction sans appeler de service', async () => {
  const store = fauxFirestore();
  const a = navigateur(store, 'uidA');
  assert.strictEqual(await a.ctx.trFetch(TITRE, 'en', 'fr'), 'Des hommes armés attaquent un poste de police');
  assert.strictEqual(a.services.appels, 1);
  await attendre();
  const nom = 'projects/p/databases/(default)/documents/traductions/' + empreinte('fr', TITRE);
  assert.ok(store.docs.has(nom), 'la traduction est rangée sous l\'empreinte du texte');
  assert.strictEqual(store.docs.get(nom).uid.stringValue, 'uidA');

  const b = navigateur(store, 'uidB');
  assert.strictEqual(await b.ctx.trFetch(TITRE, 'en', 'fr'), 'Des hommes armés attaquent un poste de police');
  assert.strictEqual(b.services.appels, 0, 'aucun service rappelé');
  await attendre();
  assert.strictEqual(store.appels.ecritures, 1, 'rien n\'est réécrit');
});

test('un lot (Flux, rapport) est cherché en une seule lecture groupée', async () => {
  const store = fauxFirestore();
  const a = navigateur(store, 'uidA');
  await a.ctx._traduireParLots([TITRE, 'The police said']);
  await attendre();
  const b = navigateur(store, 'uidB');
  const avant = store.appels.lectures;
  await b.ctx._traduireParLots([TITRE, 'The police said']);
  assert.strictEqual(b.services.appels, 0);
  assert.strictEqual(store.appels.lectures - avant, 2, 'deux documents demandés, une fois chacun');
});

test('« Traduire maintenant » passe outre la traduction partagée', async () => {
  const store = fauxFirestore();
  const a = navigateur(store, 'uidA');
  await a.ctx.trFetch(TITRE, 'en', 'fr');
  await attendre();
  const b = navigateur(store, 'uidB');
  await b.ctx.trFetch(TITRE, 'en', 'fr', true);
  assert.strictEqual(b.services.appels, 1);
});

test('Firestore injoignable : le navigateur traduit comme avant', async () => {
  const a = navigateur(fauxFirestore({ panne: true }), 'uidA');
  assert.strictEqual(await a.ctx.trFetch(TITRE, 'en', 'fr'), 'Des hommes armés attaquent un poste de police');
  assert.strictEqual(a.services.appels, 1);
});

test('lire refuse un document qui porte un autre texte que celui demandé', async () => {
  const store = fauxFirestore();
  const k = empreinte('fr', TITRE);
  store.docs.set('projects/p/databases/(default)/documents/traductions/' + k,
    { c: { stringValue: 'fr' }, s: { stringValue: 'autre texte' }, t: { stringValue: 'Fausse' } });
  const m = await TP.lire({ projectId: 'p' }, { Authorization: 'x' }, [{ cible: 'fr', s: TITRE }], store.fetchFn);
  assert.strictEqual(m.size, 0);
});

test('ecrire refuse une traduction identique à la source ou sans auteur', async () => {
  const store = fauxFirestore();
  assert.strictEqual(await TP.ecrire({ projectId: 'p' }, { Authorization: 'x' }, 'u', 'fr', 'Bonjour', 'Bonjour', store.fetchFn), false);
  assert.strictEqual(await TP.ecrire({ projectId: 'p' }, { Authorization: 'x' }, null, 'fr', 'Hello', 'Bonjour', store.fetchFn), false);
  assert.strictEqual(await TP.ecrire({ projectId: 'p' }, { Authorization: 'x' }, 'u', 'de', 'Hello', 'Hallo', store.fetchFn), false);
  assert.strictEqual(store.appels.ecritures, 0);
});

test('l\'identifiant du compte est lu dans le jeton', () => {
  assert.strictEqual(TP.uidDuJeton(jwt('abc')), 'abc');
  assert.strictEqual(TP.uidDuJeton('pas un jeton'), null);
});

test('les règles : clé = empreinte, création seule, jamais listées, page charge le module', () => {
  const regles = fs.readFileSync(path.join(__dirname, '../../firebase/firestore.rules'), 'utf8');
  const bloc = regles.slice(regles.indexOf('match /traductions/{cle}'), regles.indexOf('// Validation des faits', regles.indexOf('match /traductions/{cle}')));
  assert.match(bloc, /allow list: if false;/);
  assert.match(bloc, /allow update: if false;/);
  assert.match(regles, /cle == hashing\.sha256\(d\.c \+ '\\n' \+ d\.s\)\.toHexString\(\)\.lower\(\)/);
  assert.match(regles, /d\.uid == request\.auth\.uid/);
  const html = fs.readFileSync(path.join(__dirname, '../../web/SentiqS_Web.html'), 'utf8');
  assert.ok(html.includes('<script src="js/traductions-partagees.js"></script>'));
});
