// Traducteur hors ligne du job de traduction (22/11/2026). Le passage du
// 22/11/2026 à 8 h UTC a envoyé 766 requêtes en ligne pour 0 traduction :
// Google « gtx » et MyMemory ne répondent plus depuis les runners GitHub.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { traduireActus } = require('../lib/traduction-actus.js');

const art = (id, title, level) => ({ id, title, level: level || 'mod' });
const enPanne = (journal) => async (url) => { journal.push(url); return { ok: false }; };

test('services en ligne en panne : le traducteur local traduit, sans rejouer chaque titre en ligne', async () => {
  const journal = [];
  const appels = [];
  const arts = [];
  const langues = new Map();
  for (let i = 0; i < 60; i++) {
    const t = 'Attaque armée numéro ' + i + ' contre un poste dans le nord';
    arts.push(art('a' + i, t)); langues.set(t, 'fr');
  }
  const local = async (lignes, source, cible) => { appels.push(source + '>' + cible); return lignes.map((l) => '[local ' + cible + '] ' + l); };
  const st = await traduireActus(arts, { langues, fetchFn: enPanne(journal), pauseMs: 0, traducteurLocal: local });
  assert.strictEqual(st.traduits, 60);
  assert.strictEqual(st.locaux, 60);
  assert.ok(arts.every((a) => a.tr.en.t.startsWith('[local en] ')));
  // Trois paquets refusés d'affilée suffisent : Google n'est plus appelé, et
  // aucune requête titre par titre (MyMemory) n'est rejouée.
  assert.ok(journal.length <= 3, journal.length + ' requêtes en ligne');
  assert.ok(appels.every((x) => x === 'fr>en'));
});

test('le local ne devine pas une langue inconnue, et un refus local ne colle rien', async () => {
  const arts = [art('x', 'Wahenga wameshambulia kijiji'), art('y', 'Un titre français assez long pour compter')];
  const langues = new Map([[arts[0].title, 'other'], [arts[1].title, 'fr']]);
  const vus = [];
  const local = async (lignes, source) => { vus.push(source); return null; };
  const st = await traduireActus(arts, { langues, fetchFn: enPanne([]), pauseMs: 0, traducteurLocal: local });
  assert.ok(!vus.includes('auto'));
  assert.strictEqual(st.traduits, 0);
  assert.ok(!arts[1].tr || !arts[1].tr.en || !arts[1].tr.en.t);
});

test('une réponse locale de mauvaise longueur est refusée', async () => {
  const arts = [art('a', 'Premier titre français de la liste'), art('b', 'Second titre français de la liste')];
  const langues = new Map(arts.map((a) => [a.title, 'fr']));
  const st = await traduireActus(arts, { langues, fetchFn: enPanne([]), pauseMs: 0, traducteurLocal: async () => ['une seule'] });
  assert.strictEqual(st.traduits, 0);
});

test('sans traducteur local, le comportement d\'avant est gardé', async () => {
  const journal = [];
  const arts = [art('a', 'Un titre français assez long pour compter')];
  const langues = new Map([[arts[0].title, 'fr']]);
  await traduireActus(arts, { langues, fetchFn: enPanne(journal), pauseMs: 0 });
  assert.ok(journal.some((u) => /translate\.googleapis\.com/.test(u)));
});

test('le workflow installe le traducteur hors ligne sans pouvoir bloquer le passage', () => {
  const wf = fs.readFileSync(path.join(__dirname, '../../.github/workflows/traduction-actus.yml'), 'utf8');
  assert.match(wf, /traducteur-local\.py < \/dev\/null/);
  assert.match(wf, /Installer le traducteur hors ligne\n\s+continue-on-error: true/);
  const req = fs.readFileSync(path.join(__dirname, '../traducteur-local.requirements.txt'), 'utf8');
  // 25/11/2026 : CTranslate2 et SentencePiece en direct, plus de torch.
  assert.match(req, /^ctranslate2==\d+\.\d+\.\d+$/m, 'version exacte');
  assert.match(req, /^sentencepiece==\d+\.\d+\.\d+$/m, 'version exacte');
  assert.doesNotMatch(req, /argostranslate|torch/);
  assert.doesNotMatch(wf, /pip install[^\n]*(argostranslate|pytorch)/);
});

test('une réponse locale partielle range ce qui est traduit, et seulement cela', async () => {
  const arts = [art('a', 'Premier titre français de la liste'), art('b', 'Second titre français de la liste')];
  const langues = new Map(arts.map((a) => [a.title, 'fr']));
  const st = await traduireActus(arts, { langues, fetchFn: enPanne([]), pauseMs: 0, traducteurLocal: async () => ['First title', null] });
  assert.strictEqual(st.traduits, 1);
  assert.strictEqual(st.locaux, 1);
  assert.strictEqual(arts[0].tr.en.t, 'First title');
  assert.ok(!arts[1].tr || !arts[1].tr.en || !arts[1].tr.en.t);
});

// --- 25/11/2026 : le traducteur hors ligne passe EN PREMIER ---------------
// Passage du 25/11 à 17 h 19 UTC : Google essayé d'abord, mort depuis les
// runners, et des paquets de 25 lignes ; 649 traduites, 2 380 échecs.

test('le local passe avant Google : aucune requête en ligne quand il traduit tout', async () => {
  const journal = [];
  const fetchFn = async (url) => { journal.push(url); return { ok: true, json: async () => [[['x']]] }; };
  const arts = [];
  const langues = new Map();
  for (let i = 0; i < 90; i++) { const t = 'Gunmen attack village number ' + i + ' in the north'; arts.push(art('a' + i, t)); langues.set(t, 'en'); }
  const tailles = [];
  const local = async (lignes) => { tailles.push(lignes.length); return lignes.map((l) => 'FR ' + l); };
  const st = await traduireActus(arts, { langues, fetchFn, pauseMs: 0, traducteurLocal: local });
  assert.strictEqual(st.locaux, 90);
  assert.strictEqual(journal.length, 0, 'aucune requête en ligne');
  assert.ok(Math.max(...tailles) > 25, 'paquets plus grands que ceux de Google : ' + tailles.join(','));
});

test('une langue sans modèle (« auto ») part toujours en ligne', async () => {
  const journal = [];
  const fetchFn = async (url) => { journal.push(url); return { ok: false }; };
  const arts = [art('s', 'Wahenga wameshambulia kijiji cha mpakani usiku')];
  const langues = new Map([[arts[0].title, 'other']]);
  await traduireActus(arts, { langues, fetchFn, pauseMs: 0, traducteurLocal: async (l) => l.map(() => 'x') });
  assert.ok(journal.length >= 1);
});

test('le pont laisse à un gros paquet un délai proportionnel', async () => {
  const { EventEmitter } = require('node:events');
  const { PassThrough } = require('node:stream');
  const { demarrerTraducteurLocal } = require('../lib/traducteur-local.js');
  const spawn = () => {
    const e = new EventEmitter();
    e.stdout = new PassThrough(); e.stdin = new PassThrough(); e.kill = () => {};
    setImmediate(() => e.stdout.write(JSON.stringify({ pret: true, paires: ['en>fr'] }) + '\n'));
    require('node:readline').createInterface({ input: e.stdin }).on('line', (l) => {
      const r = JSON.parse(l);
      // Répond en 10 ms par ligne : 20 lignes = 200 ms, au-delà du délai de base.
      setTimeout(() => e.stdout.write(JSON.stringify({ id: r.id, lignes: r.lignes.map((x) => 'fr ' + x) }) + '\n'), r.lignes.length * 10);
    });
    return e;
  };
  const tr = await demarrerTraducteurLocal({ spawn, delaiRequeteMs: 50, delaiParLigneMs: 30 });
  const res = await tr(Array.from({ length: 20 }, (_, i) => 'l' + i), 'en', 'fr');
  assert.ok(Array.isArray(res) && res.length === 20, 'paquet traduit, pas compté en échec');
});

test('la collecte et les demandes des navigateurs utilisent le traducteur hors ligne', () => {
  const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  assert.match(lire('collecte-planifiee.js'), /traducteurLocal: local/);
  assert.match(lire('traduire-cache.js'), /traduireFn: traduireLocalDabord\(local\)/);
  const wf = fs.readFileSync(path.join(__dirname, '../../.github/workflows/collecte-planifiee.yml'), 'utf8');
  assert.match(wf, /Installer le traducteur hors ligne\n\s+continue-on-error: true/);
  assert.match(wf, /actions\/cache\/restore@v4[\s\S]*argos-modeles-/);
});

test('le découpage en phrases ne coupe ni « M. Ouattara » ni un titre court', () => {
  const { spawnSync } = require('node:child_process');
  const py = 'import importlib.util,json,sys\n'
    + 's=importlib.util.spec_from_file_location("t",sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\n'
    + 'print(json.dumps([m.decouper(x) for x in json.loads(sys.argv[2])]))';
  const long = 'Le président M. Ouattara a reçu les ministres à Abidjan ce lundi pour une réunion de crise sur la sécurité du nord. '
    + 'Trois attaques ont été signalées. Les forces armées ont renforcé leur présence.';
  const r = spawnSync('python3', ['-I', '-c', py, path.join(__dirname, '../traducteur-local.py'), JSON.stringify(['Titre court. Encore.', long])], { encoding: 'utf8' });
  if (r.error || r.status !== 0) { assert.fail('python3 indisponible ou erreur : ' + (r.stderr || r.error)); }
  const [court, decoupe] = JSON.parse(r.stdout);
  assert.deepStrictEqual(court, ['Titre court. Encore.']);
  assert.strictEqual(decoupe.length, 3);
  assert.match(decoupe[0], /M\. Ouattara/);
});
