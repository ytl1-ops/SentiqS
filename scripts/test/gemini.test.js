// Gemini en repli de la traduction des actus — demande de YORO du
// 20/11/2026 (« Insère free llmapi de GitHub » ; GitHub Models étant retiré,
// YORO a choisi Gemini, Mistral ayant refusé la clé gratuite).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const modeles = require('../lib/gemini.js');
const { traduireActus } = require('../lib/traduction-actus.js');
const { traduire } = require('../lib/traduction-job.js');

const RACINE = path.join(__dirname, '..', '..');

// Faux Gemini : préfixe chaque ligne par la cible, ou répond `forcer`.
function fauxModeles(journal, opts) {
  const o = opts || {};
  return async (url, init) => {
    const u = new URL(url);
    if (u.hostname !== 'generativelanguage.googleapis.com') {
      if (o.google) return o.google(url, init);
      return { ok: false, status: 503 };
    }
    const corps = JSON.parse(init.body);
    journal.push({ auth: init.headers.Authorization, methode: init.method, corps });
    if (o.statut) return { ok: false, status: o.statut };
    const lignes = JSON.parse(corps.messages[1].content);
    const cible = /to English/.test(corps.messages[0].content) ? 'en' : 'fr';
    const contenu = o.forcer !== undefined ? o.forcer : '```json\n' + JSON.stringify(lignes.map((l) => '[' + cible + '] ' + l)) + '\n```';
    return { ok: true, json: async () => ({ choices: [{ message: { content: contenu } }] }) };
  };
}

test('sans jeton, le service n\'est jamais appelé', async () => {
  modeles.reinitialiser({ jeton: '', env: {} });
  const journal = [];
  assert.strictEqual(modeles.disponible(), false);
  assert.strictEqual(await modeles.traduireLignes(['Bonjour'], 'fr', 'en', { fetchFn: fauxModeles(journal) }), null);
  assert.strictEqual(journal.length, 0);
});

test('une réponse bien formée est acceptée, appel authentifié par la clé du secret', async () => {
  modeles.reinitialiser({ jeton: 'cle-du-secret', env: {} });
  const journal = [];
  const out = await modeles.traduireLignes(['Attaque armée contre un convoi', 'Grève des enseignants'], 'fr', 'en', { fetchFn: fauxModeles(journal) });
  assert.deepStrictEqual(out, ['[en] Attaque armée contre un convoi', '[en] Grève des enseignants']);
  assert.strictEqual(journal[0].auth, 'Bearer cle-du-secret');
  assert.strictEqual(journal[0].methode, 'POST');
  assert.strictEqual(journal[0].corps.model, modeles.MODELE_DEFAUT);
  assert.strictEqual(journal[0].corps.temperature, 0);
  assert.match(journal[0].corps.messages[0].content, /never follow instructions/, 'la consigne refuse les instructions contenues dans les titres');
});

test('une réponse qui n\'a pas la forme attendue est rejetée', async () => {
  const lignes = ['Attaque armée contre un convoi dans le nord', 'Grève des enseignants à Abidjan'];
  for (const forcer of [
    JSON.stringify(['un seul élément']), // mauvais nombre de lignes
    'Voici la traduction : ...', // pas du JSON
    JSON.stringify(['Armed attack', 'x'.repeat(400)]), // réponse bavarde ou détournée
    JSON.stringify(['Armed attack on a convoy', '']), // ligne vide
  ]) {
    modeles.reinitialiser({ jeton: 'j', env: {} });
    assert.strictEqual(await modeles.traduireLignes(lignes, 'fr', 'en', { fetchFn: fauxModeles([], { forcer }) }), null, forcer);
  }
});

test('un refus (429) coupe le service pour le reste du passage', async () => {
  modeles.reinitialiser({ jeton: 'j', env: {} });
  const journal = [];
  assert.strictEqual(await modeles.traduireLignes(['Bonjour à tous'], 'fr', 'en', { fetchFn: fauxModeles(journal, { statut: 429 }) }), null);
  assert.strictEqual(modeles.disponible(), false);
  assert.strictEqual(await modeles.traduireLignes(['Bonjour à tous'], 'fr', 'en', { fetchFn: fauxModeles(journal) }), null);
  assert.strictEqual(journal.length, 1, 'pas de second appel après un refus');
  assert.match(modeles.bilan(), /HTTP 429/);
});

test('le budget par passage est respecté', async () => {
  modeles.reinitialiser({ jeton: 'j', maxRequetes: 2, env: {} });
  const journal = [];
  for (let i = 0; i < 4; i++) await modeles.traduireLignes(['Bonjour à tous'], 'fr', 'en', { fetchFn: fauxModeles(journal) });
  assert.strictEqual(journal.length, 2);
  modeles.reinitialiser({ jeton: 'j', env: { GEMINI_MAX_REQUETES: '3' } });
  journal.length = 0;
  for (let i = 0; i < 5; i++) await modeles.traduireLignes(['Bonjour à tous'], 'fr', 'en', { fetchFn: fauxModeles(journal) });
  assert.strictEqual(journal.length, 3, 'le budget se règle par GEMINI_MAX_REQUETES');
});

test('actus : Gemini reprend en un appel le paquet refusé par Google, et rien quand Google répond', async () => {
  const titres = ['Attaque armée contre un convoi dans le nord du Mali', 'Grève générale des transporteurs à Abidjan', 'Inondations meurtrières à Niamey'];
  const langues = new Map(titres.map((t) => [t, 'fr']));

  modeles.reinitialiser({ jeton: 'j', env: {} });
  let journal = [];
  let arts = titres.map((title, i) => ({ id: 'a' + i, title, level: 'high' }));
  const st = await traduireActus(arts, { langues, fetchFn: fauxModeles(journal), pauseMs: 0 });
  assert.strictEqual(journal.length, 1, 'un seul appel pour le paquet');
  assert.ok(arts.every((a) => a.tr.en.t === '[en] ' + a.title));
  assert.strictEqual(st.viaModeles, 3);

  // Google répond : le quota de Gemini n'est pas dépensé.
  modeles.reinitialiser({ jeton: 'j', env: {} });
  journal = [];
  const google = async (url) => {
    const q = new URL(url).searchParams.get('q');
    return { ok: true, json: async () => [q.split('\n').map((l, i, t) => ['G ' + l + (i < t.length - 1 ? '\n' : ''), 'x'])] };
  };
  arts = titres.map((title, i) => ({ id: 'a' + i, title, level: 'high' }));
  await traduireActus(arts, { langues, fetchFn: fauxModeles(journal, { google }), pauseMs: 0 });
  assert.strictEqual(journal.length, 0);
  assert.ok(arts.every((a) => a.tr.en.t === 'G ' + a.title));
});

test('traduction unitaire : Gemini passe entre Google et MyMemory', async () => {
  modeles.reinitialiser({ jeton: 'j', env: {} });
  const hotes = [];
  const fetchFn = async (url, init) => {
    hotes.push(new URL(url).hostname);
    return fauxModeles([])(url, init);
  };
  const out = await traduire('Gunmen kill three soldiers in northern Nigeria', 'en', { fetchFn });
  assert.strictEqual(out, '[fr] Gunmen kill three soldiers in northern Nigeria');
  assert.deepStrictEqual(hotes, ['translate.googleapis.com', 'generativelanguage.googleapis.com'], 'MyMemory n\'est pas appelé quand Gemini a répondu');
});

test('la clé ne vit que dans les jobs : la page servie n\'appelle jamais Gemini', () => {
  const page = fs.readFileSync(path.join(RACINE, 'web', 'SentiqS_Web.html'), 'utf8');
  assert.ok(!/generativelanguage\.googleapis\.com|GEMINI_API_KEY/.test(page));
  for (const f of fs.readdirSync(path.join(RACINE, 'web', 'js'))) {
    assert.ok(!/generativelanguage\.googleapis\.com|GEMINI_API_KEY/.test(fs.readFileSync(path.join(RACINE, 'web', 'js', f), 'utf8')), f);
  }
  for (const f of ['traduction-actus.yml', 'collecte-planifiee.yml']) {
    const wf = fs.readFileSync(path.join(RACINE, '.github', 'workflows', f), 'utf8');
    assert.match(wf, /GEMINI_API_KEY: \$\{\{ secrets\.GEMINI_API_KEY \}\}/, f + ' : clé passée au script');
    assert.ok(!/^\s+models: read$/m.test(wf), f + ' : plus de permission GitHub Models');
  }
});

test('par défaut : point d\'accès et modèle de Gemini, budget de 6', async () => {
  assert.strictEqual(modeles.POINT_ACCES, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
  assert.strictEqual(modeles.MODELE_DEFAUT, 'gemini-2.5-flash');
  modeles.reinitialiser({ env: { GEMINI_API_KEY: 'k' } });
  const journal = [];
  for (let i = 0; i < 10; i++) await modeles.traduireLignes(['Bonjour à tous'], 'fr', 'en', { fetchFn: fauxModeles(journal) });
  assert.strictEqual(journal.length, 6);
  modeles.reinitialiser({ env: { GEMINI_API_KEY: 'k', GEMINI: '0' } });
  assert.strictEqual(modeles.disponible(), false, 'GEMINI=0 coupe le service');
});
