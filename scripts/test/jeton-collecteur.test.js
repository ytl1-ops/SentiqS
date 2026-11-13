// Le jeton du collecteur se lit dans le code servi. Colle dans un
// navigateur ordinaire, il ouvrait l'interface sans compte (test fondateur
// du 13/11/2026). Il ne vaut plus que dans un navigateur automatise.
const { test } = require('node:test');
const assert = require('node:assert');
const { tranche, bac, HTML } = require('./_bac.js');

const jeton = (HTML.match(/const COLLECTOR_TOKEN = '([^']+)'/) || [])[1];
const ctx = bac(
  tranche('const COLLECTOR_TOKEN', '\n') + '\n',
  tranche('function sessionCollecteurAutorisee', 'function checkCollectorSession')
);

test('le jeton est encore lisible par le job (collecte-planifiee.js le lit dans la page)', () => {
  assert.ok(jeton && jeton.length >= 20);
});

test('un navigateur ordinaire avec le bon jeton n ouvre pas de session', () => {
  assert.strictEqual(ctx.sessionCollecteurAutorisee('#collecteur-' + jeton, { webdriver: false }), false);
  assert.strictEqual(ctx.sessionCollecteurAutorisee('#collecteur-' + jeton, {}), false);
});

test('un navigateur automatise avec le bon jeton ouvre la session', () => {
  assert.strictEqual(ctx.sessionCollecteurAutorisee('#collecteur-' + jeton, { webdriver: true }), true);
});

test('un mauvais jeton est refuse meme automatise', () => {
  assert.strictEqual(ctx.sessionCollecteurAutorisee('#collecteur-faux', { webdriver: true }), false);
});

test('checkCollectorSession consulte la garde avant d ouvrir la session', () => {
  const f = tranche('function checkCollectorSession', '\n}\n');
  const iGarde = f.indexOf('sessionCollecteurAutorisee(');
  const iSession = f.indexOf('_MEM_SESSION');
  assert.ok(iGarde !== -1 && iGarde < iSession);
});
