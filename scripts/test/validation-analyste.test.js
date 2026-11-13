// Validation des faits par un analyste — 13/11/2026.
//
// Recommandation n° 2 du comparatif avec les plateformes du marché (Factal,
// Seerist, Crisis24 vendent la signature humaine sur un fait). Ces tests
// exercent la vraie cotationArticle() du noyau et le vrai bloc de la page,
// extrait du fichier de production.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { HTML, noyau, tranche, bac } = require('./_bac.js');

const BLOC = tranche('const VALIDATIONS = new Map();', '// Libelles de survenance produits par extraireDateSurvenance');
const V_OK = { decision: 'confirme', source: 'B', info: '2', par: 'analyste@exemple.org', le: '2026-11-13T06:40:00Z', note: '' };
const V_KO = { decision: 'infirme', source: 'E', info: '5', par: 'analyste@exemple.org', le: '2026-11-13T06:41:00Z', note: 'Rumeur démentie par la préfecture' };
const SRC_FIABLE = { id: 's', score: 80 };

test('la tranche contient bien le bloc visé (piège récurrent de tranche())', () => {
  for (const nom of ['function validationDe', 'function fileValidation', 'async function enregistrerValidation', 'function badgeValidation'])
    assert.ok(BLOC.includes(nom), nom + ' absent de la tranche');
});

test('sans validation, la cotation automatique est strictement inchangée', () => {
  assert.strictEqual(noyau.cotationArticle({ verified: true }, SRC_FIABLE, 70).cle, 'confirme');
  assert.strictEqual(noyau.cotationArticle({}, SRC_FIABLE, 70).cle, 'probable');
  assert.strictEqual(noyau.cotationArticle({}, { score: 50 }, 70).cle, 'non_confirme');
  assert.strictEqual(noyau.cotationArticle({}, SRC_FIABLE, 70, null).cle, 'probable');
});

test('une validation bien formée parle avant la règle automatique, avec sa grille', () => {
  const ok = noyau.cotationArticle({}, { score: 50 }, 70, V_OK);
  assert.deepStrictEqual([ok.cle, ok.libelle, ok.grille], ['valide', 'Validé analyste', 'B2']);
  const ko = noyau.cotationArticle({ verified: true }, SRC_FIABLE, 70, V_KO);
  assert.deepStrictEqual([ko.cle, ko.grille], ['infirme', 'E5'], 'un fait recoupé peut être infirmé par l\'analyste');
});

test('une validation incohérente ou incomplète est ignorée, jamais affichée à moitié', () => {
  const cas = [
    Object.assign({}, V_OK, { info: '5' }),        // confirmer une information improbable
    Object.assign({}, V_KO, { info: '2' }),        // infirmer une information probablement vraie
    Object.assign({}, V_OK, { info: '6' }),        // véracité inconnue : ni l'un ni l'autre
    Object.assign({}, V_OK, { source: 'G' }),
    Object.assign({}, V_OK, { par: '' }),
    Object.assign({}, V_OK, { le: 'hier' }),
    Object.assign({}, V_OK, { note: 'x'.repeat(noyau.VALIDATION_NOTE_MAX + 1) }),
    Object.assign({}, V_OK, { decision: 'peut-etre' }),
  ];
  for (const v of cas) {
    assert.strictEqual(noyau.validationValide(v), false, JSON.stringify(v).slice(0, 80));
    assert.strictEqual(noyau.cotationArticle({}, SRC_FIABLE, 70, v).cle, 'probable');
  }
});

test('la clé survit à un changement d\'identifiant, de casse et d\'accents, pas à un changement de pays', () => {
  const a = { id: 'a1', cy: 'CI', title: 'Attaque à Kafolo : deux gendarmes blessés' };
  const b = { id: 'zz-autre', cy: 'CI', title: 'ATTAQUE A KAFOLO — deux gendarmes blesses' };
  assert.strictEqual(noyau.cleValidation(a), noyau.cleValidation(b));
  assert.notStrictEqual(noyau.cleValidation(a), noyau.cleValidation(Object.assign({}, a, { cy: 'BF' })));
  assert.match(noyau.cleValidation(a), /^v[0-9a-z]+$/, 'clé utilisable comme identifiant de document Firestore');
});

function page(arts, session) {
  const c = bac();
  Object.assign(c, {
    ALL: arts, LANG: 'fr', SEUIL_SOURCE_ALERTE: 70, document: { getElementById: () => null },
    gs: (id) => ({ s70: { score: 72 }, s90: { score: 90 }, s50: { score: 50 } })[id] || null,
    estAdmin: (u) => !!u && u.role === 'admin', getSession: () => session || { role: 'reader' },
    estRecentReel: () => true,
  });
  vm.runInContext(BLOC + '\nthis.VALIDATIONS = VALIDATIONS;', c);
  return c;
}

test('la file du matin : Côte d\'Ivoire d\'abord, puis gravité ; sans les faits validés ni les pays non suivis', () => {
  const arts = [
    { id: 'ml', cy: 'ML', level: 'crit', title: 'Embuscade près de Gao', pubDate: 3 },
    { id: 'ci1', cy: 'CI', level: 'mod', title: 'Manifestation à Bouaké', pubDate: 1 },
    { id: 'ci2', cy: 'CI', level: 'high', title: 'Braquage sur l\'axe Abidjan-Yamoussoukro', pubDate: 2 },
    { id: 'ke', cy: 'KE', level: 'crit', title: 'Attaque à Mandera', pubDate: 4 },
    { id: 'ci3', cy: 'CI', level: 'ok', title: 'Inauguration d\'un pont', pubDate: 5 },
    { id: 'ci4', cy: 'CI', level: 'crit', title: 'Déjà validé', pubDate: 6 },
  ];
  const c = page(arts);
  c.VALIDATIONS.set(noyau.cleValidation(arts[5]), V_OK);
  assert.deepStrictEqual(c.fileValidation(arts).map((a) => a.id), ['ci2', 'ml'], 'le modéré à source unique est écarté par règle');
});

// Demande de YORO du 13/11/2026 : « alléger le travail ». Le pré-tri ne lui
// montre que ce qui demande son jugement.
test('pré-tri : critique toujours au jugement, recoupé fiable en lot, modéré à source unique écarté avec motif', () => {
  const S = { f: { score: 80 }, g: { id: 'gn', score: 90, rss: 'https://news.google.com/rss/search?q=x' } };
  const arts = [
    { id: 'c1', cy: 'CI', level: 'crit', verified: true, primary: 'f' },   // critique recoupé : jamais en lot
    { id: 'h1', cy: 'CI', level: 'high', primary: 'f' },                   // élevé, une source : jugement
    { id: 'h2', cy: 'CI', level: 'high', verified: true, primary: 'f' },   // élevé recoupé fiable : lot
    { id: 'm1', cy: 'ML', level: 'mod', _fusionnes: [{}], primary: 'f' },  // modéré recoupé fiable : lot
    { id: 'm2', cy: 'ML', level: 'mod', verified: true, primary: 'g' },    // recoupé, source incapable d'alerter : jugement
    { id: 'm3', cy: 'CI', level: 'mod', primary: 'f' },                    // modéré, une source : écarté
    { id: 'o1', cy: 'CI', level: 'ok', primary: 'f' },                     // normal : hors file
    { id: 'k1', cy: 'KE', level: 'crit', primary: 'f' },                   // pays non suivi : hors file
  ];
  const t = noyau.trierPourValidation(arts, { paysSuivis: ['CI', 'ML'], seuil: 70, sourceDe: (a) => S[a.primary] });
  assert.deepStrictEqual(t.jugement.map((a) => a.id), ['c1', 'h1', 'm2']);
  assert.deepStrictEqual(t.lot.map((a) => a.id), ['h2', 'm1']);
  assert.deepStrictEqual(t.ecartes.map((e) => e.article.id), ['m3']);
  assert.match(t.ecartes[0].motif, /une seule source/);
});

test('profils d\'usage : la vue Finance voit une grève classée sécurité, pas un portrait ni le mot anglais « or »', () => {
  const f = (cat, title) => noyau.correspondProfil({ cat, title }, 'finance');
  assert.strictEqual(f('securite', 'Grève des dockers au port d\'Abidjan'), true);
  assert.strictEqual(f('securite', 'Pénurie de carburant à Bamako'), true);
  assert.strictEqual(f('economique', 'Le cacao en hausse'), true);
  assert.strictEqual(f('securite', 'Portrait du nouveau chef d\'état-major'), false);
  assert.strictEqual(f('securite', 'Soldiers or police attacked near Kafolo'), false);
  assert.strictEqual(noyau.correspondProfil({ cat: 'economique', title: 'BRVM' }, 'surete'), false);
  assert.strictEqual(noyau.correspondProfil({ cat: 'humanitaire', title: 'Inondations' }, 'surete'), true);
  assert.strictEqual(noyau.correspondProfil({ cat: 'x' }, 'tous'), true, 'sans profil, tout passe');
});

test('la validation en lot passe sa grille sans lire le formulaire, et rend vrai ou faux', async () => {
  const a = { id: 'x', cy: 'CI', title: 'Grève au port' };
  const cl = client(false);
  const c = page([a], { role: 'admin' });
  Object.assign(c, { _fournisseurFirebase: () => true, getSentinelSupabase: () => cl, redessinerVuesOuvertes() {}, document: champs({}) });
  assert.strictEqual(await c.enregistrerValidation('x', 'confirme', { source: 'C', info: '2', note: 'Validé en lot' }), true);
  assert.strictEqual(cl.ecrit[1][2].source + cl.ecrit[1][2].info, 'C2');
  assert.strictEqual(await c.enregistrerValidation('x', 'confirme', { source: 'C', info: '5' }), false);
});

test('le Flux filtre par profil et par « Validés analyste »', () => {
  const f = tranche('function getFiltered() {', '\n}\n');
  assert.match(f, /correspondProfil\(x,prof\)/);
  assert.match(f, /fCat==='valides'/);
  assert.ok(HTML.includes('id="profilSel"'));
});

test('la proposition de grille suit la note de la source et le recoupement, sans rien enregistrer', () => {
  const c = page([]);
  assert.deepStrictEqual(Object.assign({}, c.proposerGrille({ primary: 's90', verified: true })), { source: 'B', info: '2' });
  assert.deepStrictEqual(Object.assign({}, c.proposerGrille({ primary: 's70' })), { source: 'C', info: '3' });
  assert.deepStrictEqual(Object.assign({}, c.proposerGrille({ primary: 'inconnu' })), { source: 'F', info: '3' });
});

// Faux client Firestore qui enregistre l'ordre des écritures.
function client(refusJournal) {
  const ecrit = [];
  return {
    ecrit,
    auth: { getSession: async () => ({ data: { session: { user: { id: 'uid1', email: 'analyste@exemple.org' } } } }) },
    from: (table) => ({
      insert: async (v) => { ecrit.push([table, 'insert', v]); return refusJournal ? { error: { message: 'permission-denied' } } : { error: null }; },
      upsert: async (v) => { ecrit.push([table, 'upsert', v]); return { error: null }; },
    }),
  };
}
function champs(valeurs) {
  const els = {};
  for (const [k, v] of Object.entries(valeurs)) els[k] = { value: v, textContent: '' };
  return { getElementById: (id) => els[id] || null };
}

test('enregistrer : le journal d\'abord, puis l\'état ; le journal refusé laisse l\'état intact', async () => {
  const a = { id: 'x', cy: 'CI', title: 'Attaque à Kafolo', link: 'https://exemple.ci/a' };
  for (const refus of [false, true]) {
    const c = page([a], { role: 'admin' });
    const cl = client(refus);
    Object.assign(c, { _fournisseurFirebase: () => true, getSentinelSupabase: () => cl, redessinerVuesOuvertes() {},
      document: champs({ valS_x: 'B', valI_x: '2', valN_x: ' recoupé avec la gendarmerie ', valM_x: '' }) });
    await c.enregistrerValidation('x', 'confirme');
    if (!refus) {
      assert.deepStrictEqual(cl.ecrit.map((e) => e[0] + ':' + e[1]), ['journal_validations:insert', 'validations:upsert']);
      const etat = cl.ecrit[1][2];
      assert.strictEqual(etat.id, noyau.cleValidation(a));
      assert.strictEqual(etat.parUid, 'uid1');
      assert.strictEqual(etat.note, 'recoupé avec la gendarmerie');
      assert.strictEqual(cl.ecrit[0][2].action, 'creation');
      assert.strictEqual(c.validationDe(a).decision, 'confirme');
    } else {
      assert.deepStrictEqual(cl.ecrit.map((e) => e[0]), ['journal_validations']);
      assert.strictEqual(c.validationDe(a), null, 'sans trace, pas de validation');
    }
  }
});

test('enregistrer une décision incohérente ou sans droits n\'écrit rien', async () => {
  const a = { id: 'x', cy: 'CI', title: 'Attaque à Kafolo' };
  const cl = client(false);
  const c = page([a], { role: 'admin' });
  Object.assign(c, { _fournisseurFirebase: () => true, getSentinelSupabase: () => cl, redessinerVuesOuvertes() {},
    document: champs({ valS_x: 'B', valI_x: '5', valN_x: '', valM_x: '' }) });
  await c.enregistrerValidation('x', 'confirme');
  const lecteur = page([a], { role: 'reader' });
  Object.assign(lecteur, { _fournisseurFirebase: () => true, getSentinelSupabase: () => cl,
    document: champs({ valS_x: 'B', valI_x: '2', valN_x: '', valM_x: '' }) });
  await lecteur.enregistrerValidation('x', 'confirme');
  assert.strictEqual(cl.ecrit.length, 0);
});

test('le bouton « Valider » n\'apparaît que pour l\'analyste ; le badge pour tous', () => {
  const a = { id: 'x', cy: 'CI', title: 'Attaque à Kafolo', pubDate: 0 };
  const fx = { _fournisseurFirebase: () => true, getSentinelSupabase: () => ({}), escHtml: (s) => String(s),
    fmtFull: () => '13/11', libelleCotationR: (c) => c.libelle };
  const lecteur = Object.assign(page([a]), fx);
  assert.strictEqual(lecteur.badgeValidation(a), '');
  lecteur.VALIDATIONS.set(noyau.cleValidation(a), V_OK);
  assert.match(lecteur.badgeValidation(a), /Validé analyste · B2/);
  assert.doesNotMatch(lecteur.badgeValidation(a), /ouvrirValidation/);
  const admin = Object.assign(page([a], { role: 'admin' }), fx);
  assert.match(admin.badgeValidation(a), /ouvrirValidation\('x'\)/);
});

test('la page passe la validation partout où elle cote un fait, et nulle part dans le niveau d\'alerte', () => {
  // Les deux appels directs qui restent sont ceux des données du JOB (bulletin
  // quotidien, rapport mensuel) : le job n'a pas de session et ne lit pas les
  // validations. Tout ce que l'utilisateur voit passe par cotationActu().
  const directs = (HTML.match(/cotationArticle\(a, [^\n]*SEUIL_SOURCE_ALERTE\)/g) || []).length;
  assert.strictEqual(directs, 2, 'un nouvel appel direct ignorerait la validation de l\'analyste');
  assert.match(tranche('function carteUneHtml(a) {', '\n}\n'), /cotationActu\(a, src\)/);
  assert.match(tranche('function detailRapportActu(a) {', '\n}\n'), /cotationActu\(a\)/);
  assert.ok(HTML.includes("(typeof badgeValidation==='function' ? badgeValidation(a) : '')"), 'badge absent de la carte du Flux');
  const score = tranche('function calcAlertScore(', '\nfunction ');
  assert.ok(score.length > 200 && !/validationDe|VALIDATIONS/.test(score), 'la validation ne doit pas toucher au niveau');
});

test('les règles Firestore : écriture réservée à l\'admin en son nom, journal ni modifiable ni effaçable', () => {
  const r = fs.readFileSync(path.join(__dirname, '..', '..', 'firebase', 'firestore.rules'), 'utf8');
  const bloc = (m) => { const i = r.indexOf('match /' + m + '/'); assert.ok(i > 0, m); return r.slice(i, r.indexOf('\n    }', i)); };
  assert.match(bloc('validations'), /allow delete: if false/);
  assert.match(bloc('validations'), /allow create, update: if estAdmin\(\)/);
  assert.match(bloc('journal_validations'), /allow update, delete: if false/);
  assert.match(bloc('journal_validations'), /allow read: if estAdmin\(\)/);
  assert.match(r, /d\.parUid == request\.auth\.uid/);
  assert.match(r, /d\.decision == 'confirme' && d\.info in \['1', '2', '3'\]/);
});
