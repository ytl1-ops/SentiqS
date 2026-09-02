// Disjoncteur des services externes — voir creerDisjoncteur/avecDisjoncteur
// dans web/js/noyau.js, et son cablage sur la chaine de traduction dans
// web/SentiqS_Web.html.
//
// Ce que ces tests protegent : mesure du 02/09/2026, les trois miroirs de
// Lingva repondent 500, 502 et 403. Ils sont morts, pas lents. Sans
// disjoncteur, chaque titre a traduire les rappelait un par un.
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac, exposer } = require('./_bac.js');
const noyau = require('../../web/js/noyau.js');

test('un disjoncteur neuf est ferme', () => {
  const d = noyau.creerDisjoncteur({ nom: 'x' });
  assert.strictEqual(d.ouvert(), false);
});

test('il s ouvre au seuil, pas avant', () => {
  const d = noyau.creerDisjoncteur({ nom: 'x', seuil: 3 });
  d.echec(); d.echec();
  assert.strictEqual(d.ouvert(), false, 'deux echecs sur trois : encore ferme');
  d.echec();
  assert.strictEqual(d.ouvert(), true);
});

test('un seul succes le referme', () => {
  // Un miroir qui revient doit pouvoir resservir : c'est toute la raison
  // d'en declarer plusieurs.
  const d = noyau.creerDisjoncteur({ nom: 'x', seuil: 2 });
  d.echec(); d.echec();
  assert.strictEqual(d.ouvert(), true);
  d.succes();
  assert.strictEqual(d.ouvert(), false);
  assert.strictEqual(d.echecs(), 0);
});

test('avecDisjoncteur cesse d appeler le reseau une fois ouvert', async () => {
  // Le point de tout l exercice : ne plus PAYER l attente. On compte les
  // appels reellement tentes, pas les erreurs levees.
  let tentes = 0;
  const mort = async () => { tentes += 1; throw new Error('mort'); };
  const p = noyau.avecDisjoncteur(mort, noyau.creerDisjoncteur({ nom: 'lingva', seuil: 2 }));
  for (let i = 0; i < 10; i++) { try { await p('x'); } catch (_) { /* attendu */ } }
  assert.strictEqual(tentes, 2, 'dix demandes, deux appels reseau seulement');
});

test('avecDisjoncteur laisse passer un service qui marche', async () => {
  let tentes = 0;
  const vivant = async (t) => { tentes += 1; return t.toUpperCase(); };
  const p = noyau.avecDisjoncteur(vivant, noyau.creerDisjoncteur({ nom: 'mymemory' }));
  for (let i = 0; i < 5; i++) assert.strictEqual(await p('ok'), 'OK');
  assert.strictEqual(tentes, 5, 'aucun appel ne doit etre court-circuite');
});

test('un echec isole entre deux succes n ouvre rien', async () => {
  let tentes = 0;
  let doitEchouer = false;
  const capricieux = async () => { tentes += 1; if (doitEchouer) throw new Error('hoquet'); return 'ok'; };
  const p = noyau.avecDisjoncteur(capricieux, noyau.creerDisjoncteur({ nom: 'x', seuil: 2 }));
  await p();
  doitEchouer = true;  try { await p(); } catch (_) {}
  doitEchouer = false; await p();
  doitEchouer = true;  try { await p(); } catch (_) {}
  doitEchouer = false; await p();
  assert.strictEqual(tentes, 5, 'un hoquet sur deux ne doit jamais couper le service');
});

test('l erreur du court-circuit dit quel service et combien d echecs', async () => {
  const p = noyau.avecDisjoncteur(async () => { throw new Error('mort'); },
    noyau.creerDisjoncteur({ nom: 'lingva', seuil: 1 }));
  try { await p(); } catch (_) {}
  await assert.rejects(() => p(), /lingva : disjoncteur ouvert apres 1 echecs/);
});

// ── Cablage sur la chaine de traduction ────────────────────────────────────
test('les trois moteurs de traduction portent chacun un disjoncteur', () => {
  const t = tranche('// Chaque moteur porte son disjoncteur', '// _trDecodeEntities');
  assert.match(t, /avecDisjoncteur\(_trViaMyMemory/);
  assert.match(t, /avecDisjoncteur\(_trViaLingva/);
  assert.match(t, /avecDisjoncteur\(_trViaGoogle/);
  assert.match(t, /\? \[/, 'un repli doit exister si le noyau n\'est pas charge');
});

test('la chaine reste utilisable si le noyau n est pas charge', () => {
  // Le noyau est charge par <script src> : s il manquait, la traduction doit
  // continuer de fonctionner sans disjoncteur plutot que de casser la page.
  const ctx = bac(
    'function _trViaMyMemory(){}; function _trViaLingva(){}; function _trViaGoogle(){};',
    'var avecDisjoncteur = undefined; var creerDisjoncteur = undefined;',
    tranche('// Chaque moteur porte son disjoncteur', '// _trDecodeEntities'),
  );
  exposer(ctx, 'TR_AGENT_PROVIDERS');
  assert.strictEqual(ctx.TR_AGENT_PROVIDERS.length, 3);
});

test('le delai des miroirs Lingva est descendu a 4 secondes', () => {
  // Trois miroirs morts a 9 s faisaient attendre 27 s avant le moteur
  // suivant. C est ce qu on lit dans les journaux du run #800.
  const t = tranche('async function _trViaLingva', 'async function _trViaGoogle');
  assert.match(t, /AbortSignal\.timeout\(4000\)/);
  assert.doesNotMatch(t, /AbortSignal\.timeout\(9000\)/);
});
