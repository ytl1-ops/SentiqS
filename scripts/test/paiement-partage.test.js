// Le paiement déclaré n'atteignait jamais l'administrateur (test fondateur du
// 13/11/2026) : la déclaration du client et les numéros Mobile Money vivaient
// dans le localStorage de chaque navigateur. Le client ne voyait aucun numéro,
// l'administrateur une file toujours vide. Ces tests rejouent le vrai code de
// la page contre une fausse base partagée (mêmes appels que l'adaptateur
// Firebase), et la forme des règles Firestore.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { tranche, bac, exposer } = require('./_bac.js');

const REGLES = fs.readFileSync(path.join(__dirname, '..', '..', 'firebase', 'firestore.rules'), 'utf8');
const bloc = (m) => { const i = REGLES.indexOf('match /' + m + '/'); assert.ok(i > 0, m); return REGLES.slice(i, REGLES.indexOf('\n    }', i)); };

// Fausse base : une Map par collection, le sous-ensemble PostgREST de l'adaptateur.
function fausseBase(utilisateur) {
  const tables = {};
  const t = (n) => (tables[n] = tables[n] || new Map());
  let auto = 0;
  function req(table) {
    const r = { op: 'select', f: [], v: null, un: false };
    const api = {
      select() { return api; }, eq(c, v) { r.f.push([c, v]); return api; },
      order() { return api; }, limit() { return api; }, maybeSingle() { r.un = true; return api; },
      insert(v) { r.op = 'insert'; r.v = v; return api; }, upsert(v) { r.op = 'upsert'; r.v = v; return api; },
      update(v) { r.op = 'update'; r.v = v; return api; },
      then(ok, ko) {
        const col = t(table);
        let data;
        if (r.op === 'select') {
          data = [...col.entries()].map(([id, d]) => Object.assign({ id }, d)).filter((d) => r.f.every(([c, v]) => d[c] === v));
          if (r.un) data = data[0] || null;
        } else if (r.op === 'insert' || r.op === 'upsert') {
          const id = r.v.id || ('auto' + (++auto));
          col.set(id, JSON.parse(JSON.stringify(r.v)));
          data = [Object.assign({ id }, r.v)];
        } else if (r.op === 'update') {
          const id = r.f[0][1];
          col.set(id, Object.assign({}, col.get(id), r.v));
          data = [];
        }
        return Promise.resolve({ data, error: null }).then(ok, ko);
      },
    };
    return api;
  }
  return {
    tables: t,
    from: req,
    auth: { getSession: async () => ({ data: { session: utilisateur ? { user: utilisateur } : null } }) },
  };
}

// DOM minimal : chaque id demandé devient un objet simple.
function fauxDocument() {
  const els = {};
  return {
    els,
    getElementById(id) {
      return (els[id] = els[id] || { id, value: '', innerHTML: '', textContent: '', className: '', disabled: false,
        classList: { add() {}, remove() {} } });
    },
  };
}

const PLANS = [{ key: 'pro', nom: 'Pro', prix: 39000, periode: '/mois' }];

function page({ base, session, users, local = {} }) {
  const doc = fauxDocument();
  const store = new Map(Object.entries(local));
  const ctx = bac(
    tranche('function escHtml(str) {', '// ── Anti-404'),
    'var SUPPORT_CONTACT_EMAIL = "support@exemple.test";',
    tranche('const PAYMETHODS_KEY', '// ── GESTION CLIENTÈLE'),
    tranche('const PAIEMENTS_KEY', 'function openReclamation() {'),
  );
  Object.assign(ctx, {
    document: doc,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    _ls: (f, d) => { try { return f(); } catch (_) { return d; } },
    _fournisseurFirebase: () => !!base,
    getSentinelSupabase: () => base,
    getSession: () => session,
    getUsers: () => users,
    getPricing: () => PLANS,
    estAdmin: (u) => !!u && u.role === 'admin',
    refreshUsersDepuisSupabase: async () => users,
    activations: [],
    activerAbonnementEtEnvoyerCode(email, plan) { ctx.activations.push([email, plan]); },
    pmMsg(txt, type) { ctx.dernierMsg = [type, txt]; },
    renderPaymethods() {}, setTimeout() {},
  });
  exposer(ctx, 'PAYMETHODS_DEFAUT', 'NUMERO_ENCAISSEMENT');
  return { ctx, doc, store };
}

const CLIENT = { id: 'uid-client', email: 'client@exemple.test' };

test('le client voit le numéro Orange Money et Wave au moment de payer', async () => {
  const { ctx, doc } = page({ base: fausseBase(CLIENT), session: { email: CLIENT.email, name: 'Client', role: 'user' }, users: [] });
  await ctx.openPaiementDeclare();
  const html = doc.els.pdMoyens.innerHTML;
  assert.match(html, /Orange Money/);
  assert.match(html, /Wave/);
  assert.match(html, /\+225 07 47 70 84 40/);
  assert.match(html, /39 000|39 000/, 'le montant du forfait est affiché');
  // MTN et Moov n'ont pas de numéro : ils ne sont pas proposés.
  assert.doesNotMatch(html, /MTN|Moov/);
  assert.strictEqual(doc.els.pdEnvoyer.disabled, false);
});

test("un ancien numéro vide en local n'efface pas le numéro par défaut", () => {
  const { ctx } = page({ base: null, session: {}, users: [],
    local: { sentinel_paymethods_v1: JSON.stringify([{ id: 'orange', actif: true, detail: '' }]) } });
  assert.strictEqual(ctx.getPaymethods().find((m) => m.id === 'orange').detail, '+225 07 47 70 84 40');
});

test("les numéros publiés par l'administrateur sont lus dans la base partagée, et n'y injectent aucun balisage", async () => {
  const base = fausseBase(CLIENT);
  base.tables('moyens_paiement').set('courant', { methodes: [
    { id: 'mtn', actif: true, detail: '05 11 22 33 44' },
    { id: 'orange', actif: true, detail: '<img src=x onerror=alert(1)>', nom: '<b>pirate</b>' },
  ] });
  const { ctx, doc } = page({ base, session: { email: CLIENT.email }, users: [] });
  await ctx.openPaiementDeclare();
  const html = doc.els.pdMoyens.innerHTML;
  assert.match(html, /MTN Mobile Money/);
  assert.match(html, /05 11 22 33 44/);
  assert.doesNotMatch(html, /<img|<b>pirate/);
});

test("la déclaration du client arrive dans la base partagée, à son nom de session, et l'administrateur la voit", async () => {
  const base = fausseBase(CLIENT);
  const { ctx, doc, store } = page({ base, session: { email: CLIENT.email, name: 'Client', role: 'user' }, users: [] });
  await ctx.openPaiementDeclare();
  doc.els.pdForfait.value = 'pro';
  doc.els.pdMoyen.value = 'wave';
  doc.els.pdReference.value = 'WV-123456';
  assert.strictEqual(await ctx.submitPaiementDeclare(), true);
  const lignes = [...base.tables('paiements_declares').values()];
  assert.strictEqual(lignes.length, 1);
  assert.strictEqual(lignes[0].uid, CLIENT.id);
  assert.strictEqual(lignes[0].email, CLIENT.email);
  assert.strictEqual(lignes[0].statut, 'a_verifier');
  assert.strictEqual(lignes[0].moyen, 'Wave');
  assert.ok(!store.has('sentinel_paiements_declares_v1'), "plus rien n'est écrit dans le seul navigateur du client");

  // L'administrateur, sur un AUTRE navigateur, lit la même base.
  const admin = { email: 'admin@exemple.test', role: 'admin' };
  const p2 = page({ base, session: admin, users: [{ email: CLIENT.email }] });
  await p2.ctx.renderPaiementsAdmin();
  assert.match(p2.doc.els.paiementsBody.innerHTML, /WV-123456/);
  assert.strictEqual(p2.doc.els.paiementsCount.textContent, '1 en attente');
  const id = [...base.tables('paiements_declares').keys()][0];
  assert.strictEqual(await p2.ctx.pmConfirmerPaiement(id), true);
  assert.strictEqual(base.tables('paiements_declares').get(id).statut, 'confirme');
  assert.deepStrictEqual(p2.ctx.activations, [[CLIENT.email, 'pro']]);
});

test("sans session partagée, la page ne prétend pas que la déclaration est partie", async () => {
  const { ctx, doc } = page({ base: fausseBase(null), session: { email: 'x@y' }, users: [] });
  await ctx.openPaiementDeclare();
  doc.els.pdForfait.value = 'pro'; doc.els.pdMoyen.value = 'orange'; doc.els.pdReference.value = 'R1';
  assert.strictEqual(await ctx.submitPaiementDeclare(), false);
  assert.match(doc.els.pdMsg.innerHTML, /impossible/);
});

test("ce que le client a saisi est échappé dans la file de l'administrateur", async () => {
  const base = fausseBase(null);
  base.tables('paiements_declares').set('p1', { uid: 'u', email: 'c@x', nom: '<script>x</script>', plan: 'Pro',
    moyen: 'Wave', reference: '"><img src=x>', note: '<b>n</b>', statut: 'a_verifier', date: '2026-11-13T10:00:00Z' });
  const { ctx, doc } = page({ base, session: { email: 'a@x', role: 'admin' }, users: [] });
  await ctx.renderPaiementsAdmin();
  const html = doc.els.paiementsBody.innerHTML;
  assert.doesNotMatch(html, /<script>|<img|<b>n/);
});

test("une confirmation sans compte correspondant ne sort pas la déclaration de la file", async () => {
  const base = fausseBase(null);
  base.tables('paiements_declares').set('p1', { uid: 'u', email: 'inconnu@x', plan: 'Pro', planKey: 'pro',
    moyen: 'Wave', reference: 'R', note: '', statut: 'a_verifier', date: '2026-11-13T10:00:00Z' });
  const { ctx } = page({ base, session: { email: 'a@x', role: 'admin' }, users: [] });
  await ctx.renderPaiementsAdmin();
  assert.strictEqual(await ctx.pmConfirmerPaiement('p1'), false);
  assert.strictEqual(base.tables('paiements_declares').get('p1').statut, 'a_verifier');
  assert.deepStrictEqual(ctx.activations, []);
});

test('règles : le client déclare à son nom, ne lit que les siennes, seul l\'admin tranche', () => {
  const b = bloc('paiements_declares');
  assert.match(b, /allow create: if connecte\(\) && declarationBienFormee/);
  assert.match(b, /resource\.data\.uid == request\.auth\.uid \|\| estAdmin\(\)/);
  assert.match(b, /allow update: if estAdmin\(\)/);
  assert.match(b, /affectedKeys\(\)\s*\.hasOnly\(\['statut', 'traitePar', 'traiteLe', 'updated_at'\]\)/);
  assert.match(b, /allow delete: if false/);
  assert.match(REGLES, /d\.uid == request\.auth\.uid/);
  assert.match(REGLES, /d\.email == request\.auth\.token\.email/);
  assert.match(REGLES, /d\.statut == 'a_verifier'/);
  const m = bloc('moyens_paiement');
  assert.match(m, /allow read: if connecte\(\)/);
  assert.match(m, /allow write: if estAdmin\(\) && id == 'courant'/);
});
