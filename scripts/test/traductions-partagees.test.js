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
const JOB = require('../lib/traductions-partagees-job.js');

const empreinte = (c, s) => crypto.createHash('sha256').update(c + '\n' + s).digest('hex');
const TITRE = 'Gunmen attack police post';
const jwt = (uid) => 'x.' + Buffer.from(JSON.stringify({ user_id: uid, sub: uid })).toString('base64url') + '.y';

// Faux Firestore : batchGet, création seule (409 si le document existe),
// liste, lecture et effacement d'un document. `qui` dit qui écrit
// `traductions` : la page ne doit jamais le faire.
const RAC = 'https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents';
function fauxFirestore(o) {
  const docs = new Map();
  const appels = { lectures: 0, demandes: 0, traductionsParNavigateur: 0 };
  const fetchFn = async (url, init) => {
    init = init || {};
    if (o && o.panne) throw new Error('hors ligne');
    const methode = init.method || 'GET';
    const nomDe = (u) => u.replace('https://firestore.googleapis.com/v1/', '');
    if (url.endsWith(':batchGet')) {
      const corps = JSON.parse(init.body);
      appels.lectures += corps.documents.length;
      return { ok: true, json: async () => corps.documents.map((n) => (docs.has(n) ? { found: { name: n, fields: docs.get(n) } } : { missing: n })) };
    }
    const m = url.match(/^(.*documents)\/(traductions|traductions_demandes)\?documentId=([0-9a-f]{64})$/);
    if (methode === 'POST' && m) {
      const nom = nomDe(m[1]) + '/' + m[2] + '/' + m[3];
      const job = /Bearer jeton-job/.test(init.headers.Authorization);
      if (m[2] === 'traductions' && !job) appels.traductionsParNavigateur++;
      if (m[2] === 'traductions_demandes') appels.demandes++;
      if (docs.has(nom)) return { ok: false, status: 409 };
      docs.set(nom, JSON.parse(init.body).fields);
      return { ok: true, status: 200, json: async () => ({}) };
    }
    if (methode === 'GET' && /traductions_demandes\?pageSize=/.test(url)) {
      const pre = nomDe(RAC) + '/traductions_demandes/';
      return { ok: true, json: async () => ({ documents: [...docs].filter(([n]) => n.startsWith(pre)).map(([n, f]) => ({ name: n, fields: f })) }) };
    }
    if (methode === 'GET') { const n = nomDe(url); return { ok: docs.has(n), status: docs.has(n) ? 200 : 404, json: async () => ({}) }; }
    if (methode === 'DELETE') { docs.delete(nomDe(url)); return { ok: true }; }
    throw new Error('appel inattendu : ' + methode + ' ' + url);
  };
  return { docs, appels, fetchFn };
}
const COMPTE = { project_id: 'p' };
const traduireJob = async (texte) => (texte === TITRE ? 'Des hommes armés attaquent un poste de police' : null);
const servir = (store, o) => JOB.servirDemandes(COMPTE, store.fetchFn, Object.assign({ jeton: 'jeton-job', traduireFn: traduireJob, pauseMs: 0 }, o || {}));
const nomTrad = (c, s) => 'projects/p/databases/(default)/documents/traductions/' + empreinte(c, s);
const nomDem = (c, s) => 'projects/p/databases/(default)/documents/traductions_demandes/' + empreinte(c, s);

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

test('le navigateur dépose une demande, le job traduit, le navigateur suivant relit sans service', async () => {
  const store = fauxFirestore();
  const a = navigateur(store, 'uidA');
  assert.strictEqual(await a.ctx.trFetch(TITRE, 'en', 'fr'), 'Des hommes armés attaquent un poste de police');
  assert.strictEqual(a.services.appels, 1, 'le premier traduit pour lui-même');
  await attendre();
  assert.ok(store.docs.has(nomDem('fr', TITRE)), 'une demande est déposée');
  assert.strictEqual(store.docs.get(nomDem('fr', TITRE)).uid.stringValue, 'uidA');
  assert.ok(!store.docs.has(nomTrad('fr', TITRE)), 'le navigateur ne range aucune traduction');

  const st = await servir(store);
  assert.strictEqual(st.traduites, 1);
  assert.ok(store.docs.has(nomTrad('fr', TITRE)));
  assert.strictEqual(store.docs.get(nomTrad('fr', TITRE)).par.stringValue, 'job');
  assert.ok(!store.docs.has(nomDem('fr', TITRE)), 'la demande servie est effacée');

  const b = navigateur(store, 'uidB');
  assert.strictEqual(await b.ctx.trFetch(TITRE, 'en', 'fr'), 'Des hommes armés attaquent un poste de police');
  assert.strictEqual(b.services.appels, 0, 'aucun service rappelé');
  await attendre();
  assert.strictEqual(store.appels.traductionsParNavigateur, 0, 'aucun navigateur n\'écrit dans traductions');
});

test('un navigateur dont le service rend une fausse traduction ne la propage pas', async () => {
  const store = fauxFirestore();
  const a = navigateur(store, 'uidA');
  a.ctx.TR_AGENT_PROVIDERS = [async () => 'Fausse traduction alarmante'];
  await a.ctx.trFetch(TITRE, 'en', 'fr');
  await attendre();
  await servir(store);
  const b = navigateur(store, 'uidB');
  assert.strictEqual(await b.ctx.trFetch(TITRE, 'en', 'fr'), 'Des hommes armés attaquent un poste de police');
  assert.strictEqual(store.docs.get(nomTrad('fr', TITRE)).t.stringValue, 'Des hommes armés attaquent un poste de police');
});

test('le job : clé falsifiée effacée, traduction déjà rangée jamais réécrite, échec gardé puis périmé', async () => {
  const store = fauxFirestore();
  const now = Date.parse('2026-11-20T06:00:00Z');
  const champs = (c, s, at) => ({ c: { stringValue: c }, s: { stringValue: s }, l: { stringValue: 'en' }, uid: { stringValue: 'u' }, at: { timestampValue: at } });
  // clé d'un autre texte
  store.docs.set(nomDem('fr', 'autre'), champs('fr', TITRE, '2026-11-20T05:00:00Z'));
  // texte déjà rangé
  store.docs.set(nomTrad('fr', 'Déjà'), { c: { stringValue: 'fr' }, s: { stringValue: 'Déjà' }, t: { stringValue: 'Première' } });
  store.docs.set(nomDem('fr', 'Déjà'), champs('fr', 'Déjà', '2026-11-20T05:00:00Z'));
  // intraduisible, récent puis ancien
  store.docs.set(nomDem('fr', 'Récent'), champs('fr', 'Récent', '2026-11-20T05:00:00Z'));
  store.docs.set(nomDem('fr', 'Ancien'), champs('fr', 'Ancien', '2026-11-10T05:00:00Z'));
  const st = await servir(store, { maintenant: now });
  assert.strictEqual(st.invalides, 1);
  assert.ok(!store.docs.has(nomDem('fr', 'autre')));
  assert.ok(!store.docs.has(nomTrad('fr', 'autre')), 'rien n\'est rangé sous une clé falsifiée');
  assert.strictEqual(store.docs.get(nomTrad('fr', 'Déjà')).t.stringValue, 'Première');
  assert.ok(store.docs.has(nomDem('fr', 'Récent')), 'un échec récent reste pour le passage suivant');
  assert.ok(!store.docs.has(nomDem('fr', 'Ancien')), 'un échec ancien est effacé');
});

test('un lot (Flux, rapport) est cherché en une seule lecture groupée', async () => {
  const store = fauxFirestore();
  const a = navigateur(store, 'uidA');
  await a.ctx._traduireParLots([TITRE, 'The police said']);
  await attendre();
  assert.strictEqual(store.appels.demandes, 2);
  await servir(store, { traduireFn: async () => 'La police a dit' });
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
  await servir(store);
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
  store.docs.set(nomTrad('fr', TITRE),
    { c: { stringValue: 'fr' }, s: { stringValue: 'autre texte' }, t: { stringValue: 'Fausse' } });
  const m = await TP.lire({ projectId: 'p' }, { Authorization: 'x' }, [{ cible: 'fr', s: TITRE }], store.fetchFn);
  assert.strictEqual(m.size, 0);
});

test('l\'identifiant du compte est lu dans le jeton', () => {
  assert.strictEqual(TP.uidDuJeton(jwt('abc')), 'abc');
  assert.strictEqual(TP.uidDuJeton('pas un jeton'), null);
});

test('demander : seulement une cible fr/en, avec un auteur, jamais vers sa propre langue', async () => {
  const store = fauxFirestore();
  const e = { Authorization: 'x' };
  assert.strictEqual(await TP.demander({ projectId: 'p' }, e, null, 'fr', 'Hello', 'en', store.fetchFn), false);
  assert.strictEqual(await TP.demander({ projectId: 'p' }, e, 'u', 'de', 'Hello', 'en', store.fetchFn), false);
  assert.strictEqual(await TP.demander({ projectId: 'p' }, e, 'u', 'fr', 'Bonjour', 'fr', store.fetchFn), false);
  assert.strictEqual(store.appels.demandes, 0);
  assert.strictEqual(typeof TP.ecrire, 'undefined', 'le module de la page ne sait pas écrire une traduction');
});

test('les règles : traductions écrites par le seul job, demandes en création seule', () => {
  const regles = fs.readFileSync(path.join(__dirname, '../../firebase/firestore.rules'), 'utf8');
  const bloc = (m) => regles.slice(regles.indexOf(m), regles.indexOf('}', regles.indexOf(m) + m.length));
  assert.match(bloc('match /traductions/{cle} {'), /allow list, create, update: if false;/);
  assert.match(bloc('match /traductions_demandes/{cle} {'), /allow get, list, update, delete: if false;/);
  assert.match(regles, /cle == hashing\.sha256\(d\.c \+ '\\n' \+ d\.s\)\.toHexString\(\)\.lower\(\)/);
  assert.match(regles, /d\.uid == request\.auth\.uid/);
  const html = fs.readFileSync(path.join(__dirname, '../../web/SentiqS_Web.html'), 'utf8');
  assert.ok(html.includes('<script src="js/traductions-partagees.js"></script>'));
});
