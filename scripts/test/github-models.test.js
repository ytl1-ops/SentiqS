// GitHub Models en repli de la traduction des actus — demande de YORO du
// 20/11/2026 : « Insère free llmapi de GitHub ».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const modeles = require('../lib/github-models.js');
const { traduireActus } = require('../lib/traduction-actus.js');
const { traduire } = require('../lib/traduction-job.js');

const RACINE = path.join(__dirname, '..', '..');

// Faux GitHub Models : préfixe chaque ligne par la cible, ou répond `forcer`.
function fauxModeles(journal, opts) {
  const o = opts || {};
  return async (url, init) => {
    const u = new URL(url);
    if (u.hostname !== 'models.github.ai') {
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

test('une réponse bien formée est acceptée, appel authentifié par le jeton du job', async () => {
  modeles.reinitialiser({ jeton: 'jeton-du-job', env: {} });
  const journal = [];
  const out = await modeles.traduireLignes(['Attaque armée contre un convoi', 'Grève des enseignants'], 'fr', 'en', { fetchFn: fauxModeles(journal) });
  assert.deepStrictEqual(out, ['[en] Attaque armée contre un convoi', '[en] Grève des enseignants']);
  assert.strictEqual(journal[0].auth, 'Bearer jeton-du-job');
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
  modeles.reinitialiser({ jeton: 'j', env: { GITHUB_MODELS_MAX_REQUETES: '3' } });
  journal.length = 0;
  for (let i = 0; i < 5; i++) await modeles.traduireLignes(['Bonjour à tous'], 'fr', 'en', { fetchFn: fauxModeles(journal) });
  assert.strictEqual(journal.length, 3, 'le budget se règle par GITHUB_MODELS_MAX_REQUETES');
});

test('actus : GitHub Models reprend en un appel le paquet refusé par Google, et rien quand Google répond', async () => {
  const titres = ['Attaque armée contre un convoi dans le nord du Mali', 'Grève générale des transporteurs à Abidjan', 'Inondations meurtrières à Niamey'];
  const langues = new Map(titres.map((t) => [t, 'fr']));

  modeles.reinitialiser({ jeton: 'j', env: {} });
  let journal = [];
  let arts = titres.map((title, i) => ({ id: 'a' + i, title, level: 'high' }));
  const st = await traduireActus(arts, { langues, fetchFn: fauxModeles(journal), pauseMs: 0 });
  assert.strictEqual(journal.length, 1, 'un seul appel pour le paquet');
  assert.ok(arts.every((a) => a.tr.en.t === '[en] ' + a.title));
  assert.strictEqual(st.viaModeles, 3);

  // Google répond : le quota de GitHub Models n'est pas dépensé.
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

test('traduction unitaire : GitHub Models passe entre Google et MyMemory', async () => {
  modeles.reinitialiser({ jeton: 'j', env: {} });
  const hotes = [];
  const fetchFn = async (url, init) => {
    hotes.push(new URL(url).hostname);
    return fauxModeles([])(url, init);
  };
  const out = await traduire('Gunmen kill three soldiers in northern Nigeria', 'en', { fetchFn });
  assert.strictEqual(out, '[fr] Gunmen kill three soldiers in northern Nigeria');
  assert.deepStrictEqual(hotes, ['translate.googleapis.com', 'models.github.ai'], 'MyMemory n\'est pas appelé quand GitHub Models a répondu');
});

test('le jeton ne vit que dans les jobs : la page servie n\'appelle jamais GitHub Models', () => {
  const page = fs.readFileSync(path.join(RACINE, 'web', 'SentiqS_Web.html'), 'utf8');
  assert.ok(!/models\.github\.ai|models\.inference\.ai\.azure/.test(page));
  for (const f of ['traduction-actus.yml', 'collecte-planifiee.yml']) {
    const wf = fs.readFileSync(path.join(RACINE, '.github', 'workflows', f), 'utf8');
    assert.match(wf, /^\s+models: read$/m, f + ' : permission models: read');
    assert.match(wf, /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/, f + ' : jeton passé au script');
  }
});
