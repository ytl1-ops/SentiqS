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
  assert.match(req, /^argostranslate==\d+\.\d+\.\d+$/m, 'version exacte');
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
