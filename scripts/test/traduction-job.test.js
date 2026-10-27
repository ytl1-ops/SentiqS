// Traduction des titres et chapôs du rapport mensuel, faite par Node.
// Passage n° 1142 (27/10/2026) : 15 titres soumis à la page, 0 traduit.
const test = require('node:test');
const assert = require('node:assert');
const { traduire, borne, MAX_CARACTERES } = require('../lib/traduction-job');

const reponse = (corps, ok = true) => ({ ok, json: async () => corps });

test('Google répond : la traduction est rendue, entités décodées', async () => {
  const urls = [];
  const fetchFn = async (u) => { urls.push(u); return reponse([[['Le Niger accuse le Tchad d&#39;une attaque', 'x'], [' de drone', 'y']], null, 'en']); };
  assert.strictEqual(await traduire('Niger accuses Chad of drone attack', 'en', { fetchFn }), 'Le Niger accuse le Tchad d\'une attaque de drone');
  assert.ok(/translate\.googleapis\.com/.test(urls[0]) && /sl=en/.test(urls[0]) && /tl=fr/.test(urls[0]));
});

test('Google en échec : MyMemory prend le relais ; son avertissement de quota n’est pas une traduction', async () => {
  let n = 0;
  const fetchFn = async (u) => {
    n++;
    if (/googleapis/.test(u)) throw new Error('refus');
    return reponse({ responseStatus: 200, responseData: { translatedText: 'Deux soldats renvoyés' } });
  };
  assert.strictEqual(await traduire('Two soldiers fired', 'en', { fetchFn }), 'Deux soldats renvoyés');
  assert.strictEqual(n, 2);
  const quota = async (u) => (/googleapis/.test(u) ? reponse(null, false) : reponse({ responseStatus: 429, responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS' } }));
  assert.strictEqual(await traduire('Two soldiers fired', 'en', { fetchFn: quota }), null);
});

test('aucun moteur, ou texte rendu inchangé : null (le titre garde sa marque de langue)', async () => {
  assert.strictEqual(await traduire('Two soldiers fired', 'en', { fetchFn: async () => { throw new Error('hors ligne'); } }), null);
  const echo = async () => reponse([[['Two soldiers fired', 'Two soldiers fired']]]);
  assert.strictEqual(await traduire('Two soldiers fired', 'en', { fetchFn: echo }), null);
});

test('un moteur qui ne répond jamais est abandonné au délai', async () => {
  const pendu = (u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(new Error('abort'))));
  const t0 = Date.now();
  assert.strictEqual(await traduire('Never answers', 'en', { fetchFn: pendu, delaiMs: 50 }), null);
  assert.ok(Date.now() - t0 < 2000);
});

test('un texte long est coupé avant l’envoi (adresse trop longue sinon)', () => {
  const long = 'mot '.repeat(400);
  assert.ok(borne(long).length <= MAX_CARACTERES + 1);
});
