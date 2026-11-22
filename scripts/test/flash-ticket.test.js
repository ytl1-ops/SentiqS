// Flash sûreté sans secret (22/11/2026) : sans WEBHOOK_ALERTES, le flash
// part en commentaire du ticket GitHub « Flash sûreté » (e-mail de GitHub).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const a = require('../lib/alerte-sortante.js');

function fauxGitHub(tickets) {
  const appels = [];
  const f = async (url, o) => {
    const m = (o && o.method) || 'GET';
    appels.push(m + ' ' + url.replace('https://api.github.com/repos/o/d', ''));
    if (m === 'GET') return { ok: true, json: async () => tickets };
    return { ok: true, status: 201, json: async () => ({}) };
  };
  return { f, appels };
}
const charge = { text: 'SentiqS — 1 pays en aggravation\n\n• Mali : orange → marron (+1)' };

test('sans ticket ouvert, le premier flash le crée', async () => {
  const g = fauxGitHub([]);
  const r = await a.diffuser(charge, { GITHUB_TOKEN: 'x', GITHUB_REPOSITORY: 'o/d' }, g.f);
  assert.ok(r.ok); assert.strictEqual(r.canal, 'ticket');
  assert.deepStrictEqual(g.appels, ['GET /issues?state=open&per_page=100', 'POST /issues']);
});

test('ensuite, chaque flash est un commentaire du même ticket', async () => {
  const g = fauxGitHub([{ number: 7, title: a.TITRE_TICKET_FLASH }]);
  const r = await a.diffuser(charge, { GITHUB_TOKEN: 'x', GITHUB_REPOSITORY: 'o/d' }, g.f);
  assert.ok(r.ok);
  assert.strictEqual(g.appels[1], 'POST /issues/7/comments');
});

test('un webhook configuré garde la priorité sur le ticket', async () => {
  const urls = [];
  const r = await a.diffuser(charge, { WEBHOOK_ALERTES: 'https://hook', GITHUB_TOKEN: 'x', GITHUB_REPOSITORY: 'o/d' },
    async (u) => { urls.push(u); return { ok: true, status: 200 }; });
  assert.ok(r.ok); assert.strictEqual(r.canal, 'webhook'); assert.deepStrictEqual(urls, ['https://hook']);
});

test('sans canal, rien ne part et rien ne lève ; une panne de GitHub ne lève pas non plus', async () => {
  assert.strictEqual((await a.diffuser(charge, {})).ok, false);
  const r = await a.diffuser(charge, { GITHUB_TOKEN: 'x', GITHUB_REPOSITORY: 'o/d' }, async () => { throw new Error('réseau'); });
  assert.strictEqual(r.ok, false);
});

test('le job de collecte passe son jeton GitHub et a le droit d\'écrire un ticket', () => {
  const wf = fs.readFileSync(path.join(__dirname, '../../.github/workflows/collecte-planifiee.yml'), 'utf8');
  assert.match(wf, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(wf, /issues: write/);
  const js = fs.readFileSync(path.join(__dirname, '../collecte-planifiee.js'), 'utf8');
  assert.match(js, /alerteSortante\.diffuser\(message, process\.env\)/);
});
