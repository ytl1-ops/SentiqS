// Le rapport GRSCI ne doit jamais coûter le reste du passage planifié.
// Passage n° 1141 (27/10/2026) : collecte finie en cinq minutes, puis quinze
// minutes de traductions et de recherche de photos sans fin, et la garde de
// 20 minutes a tué le job avant le commit de l'archive et le PDF.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { limiteGrsciMs, avecDelai, GRSCI_BUDGET_MAX_MS } = require('../lib/fenetre-collecte');
const photos = require('../lib/photos-grsci');

test('le budget GRSCI s’arrête à l’échéance du passage, ou après le plafond sans échéance', () => {
  const t = 1000000;
  assert.strictEqual(limiteGrsciMs((t + 60000) / 1000, t), t + 60000);
  assert.strictEqual(limiteGrsciMs((t + 3600000) / 1000, t), t + GRSCI_BUDGET_MAX_MS);
  assert.strictEqual(limiteGrsciMs(undefined, t), t + GRSCI_BUDGET_MAX_MS);
});

test('une promesse qui ne revient jamais rend la main après le délai', async () => {
  const debut = Date.now();
  const r = await avecDelai(new Promise(() => {}), 50);
  assert.strictEqual(r, null);
  assert.ok(Date.now() - debut < 1000);
  assert.strictEqual(await avecDelai(Promise.resolve('ok'), 1000), 'ok');
});

test('la recherche de photos ne demande plus rien une fois l’échéance passée', async () => {
  let appels = 0;
  const faux = async () => { appels++; return { ok: false }; };
  const faits = [{ url: 'https://a.example/1', liens: [{ url: 'https://a.example/1' }] }, { url: 'https://b.example/2' }];
  await photos.illustrer(faits, faux, Date.now() - 1);
  assert.strictEqual(appels, 0);
  await photos.illustrer(faits, faux, Date.now() + 60000);
  assert.ok(appels > 0, 'dans le budget, la recherche a lieu');
});

test('le job borne chaque traduction et passe l’échéance aux photos', () => {
  const job = fs.readFileSync(path.join(__dirname, '..', 'collecte-planifiee.js'), 'utf8');
  const debut = job.indexOf('RAPPORT MENSUEL GRSCI');
  const bloc = job.slice(debut, job.indexOf('Archive : non ecrite', debut));
  // Les traductions passent par Node (traduction-job.js), plus par trFetch
  // dans la page : depuis le runner, celle-ci ne rendait rien (n° 1142).
  assert.strictEqual((bloc.match(/page\.evaluate\([^\n]*trFetch/g) || []).length, 0, 'plus de traduction par la page');
  const appelsTr = bloc.match(/traduireJob\(/g) || [];
  assert.ok(appelsTr.length >= 2, 'deux appels de traduction attendus');
  const bornes = bloc.match(/avecDelai\(traduireJob\(/g) || [];
  assert.strictEqual(bornes.length, appelsTr.length, 'chaque traduction est bornée dans le temps');
  assert.match(bloc, /illustrer\(illustres, [^)]*limiteGrsci, reduirePhoto\)/);
  assert.match(bloc, /dansBudget\(\)/);
});

// Audit du 15/11/2026 : le rapport de novembre pesait 45 Mo (photos brutes de
// 1,5 Mo, trois fois). Une photo lourde passe par le réducteur ; une photo
// déjà légère, ou un réducteur qui échoue ou ne gagne rien, garde l'originale.
test('les photos du rapport sont allégées, sans jamais perdre l’originale', async () => {
  const photos = require('../lib/photos-grsci.js');
  const jpeg = (w, h, taille) => { const b = Buffer.alloc(taille); b.set([0xFF, 0xD8, 0xFF, 0xC0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255], 0); return b; };
  const lourde = Object.assign({ data: jpeg(2400, 1600, 900000) }, { type: 'jpeg', w: 2400, h: 1600 });
  const r = await photos.alleger(lourde, async () => ({ data: jpeg(1000, 667, 120000) }));
  assert.strictEqual(r.w, 1000);
  assert.strictEqual(r.data.length, 120000);
  assert.strictEqual((await photos.alleger(lourde, async () => { throw new Error('x'); })).data.length, 900000);
  assert.strictEqual((await photos.alleger(lourde, async () => ({ data: jpeg(1000, 667, 950000) }))).data.length, 900000);
  const legere = { data: jpeg(800, 500, 90000), type: 'jpeg', w: 800, h: 500 };
  let appele = false;
  await photos.alleger(legere, async () => { appele = true; return null; });
  assert.strictEqual(appele, false);
});
