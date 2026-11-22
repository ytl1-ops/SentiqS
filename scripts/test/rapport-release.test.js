// Version finale seule dans Git (choix de YORO du 22/11/2026) : le rapport du
// mois en cours part dans une release GitHub, seul le mois clos est commité.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const g = require('../lib/rapport-grsci.js');
const { publier } = require('../publier-rapport-release.js');
const { tranche } = require('./_bac');

const DEPOT = 'ytl1-ops/SentiqS';
function dossier(fichiers, index) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'));
  for (const f of fichiers) fs.writeFileSync(path.join(d, f), 'x');
  if (index) fs.writeFileSync(path.join(d, 'index.json'), JSON.stringify({ rapports: index }));
  return d;
}
const lireIndex = (d) => JSON.parse(fs.readFileSync(path.join(d, 'index.json'), 'utf8')).rapports;

test('le mois en cours part dans sa release, sous le nom du modèle, puis quitte l’arbre', () => {
  const d = dossier(['2026-11.pptx', '2026-11.docx', '2026-11.pdf', '2026-10.pptx'],
    [{ mois: '2026-11', formats: ['pptx', 'docx', 'pdf'], jour: '2026-11-23', genere: '2026-11-23T03:00:00Z' },
     { mois: '2026-10', formats: ['pptx'], jour: '2026-10-31', genere: '2026-11-01T02:00:00Z' }]);
  const appels = [];
  const r = publier({ racine: d, depot: DEPOT, mois: '2026-11', journal() {},
    gh(a) { appels.push(a); if (a[1] === 'view') throw new Error('release not found'); return ''; } });
  assert.strictEqual(r.publie, true);
  assert.deepStrictEqual(appels.map((a) => a[1]), ['view', 'create', 'upload']);
  const envoyes = appels[2].filter((x) => x.includes('Presentation-1-')).map((x) => path.basename(x)).sort();
  assert.deepStrictEqual(envoyes, ['Presentation-1-2026-11.docx', 'Presentation-1-2026-11.pdf', 'Presentation-1-2026-11.pptx']);
  assert.ok(appels[2].includes('--clobber'));
  assert.ok(!fs.existsSync(path.join(d, '2026-11.pptx')), 'retiré de l’arbre');
  assert.ok(fs.existsSync(path.join(d, '2026-10.pptx')), 'le mois clos reste');
  const nov = lireIndex(d).find((x) => x.mois === '2026-11');
  assert.strictEqual(nov.base, 'https://github.com/ytl1-ops/SentiqS/releases/download/rapport-2026-11/');
  // L'index reconstruit au passage suivant garde le mois servi par la release.
  const apres = g.reconstruireIndex(d);
  assert.deepStrictEqual(apres.map((x) => x.mois), ['2026-11', '2026-10']);
  assert.strictEqual(apres[0].base, nov.base);
  assert.strictEqual(apres[1].base, undefined);
});

test('une release en échec ne retire rien : les fichiers sont commités comme avant', () => {
  const d = dossier(['2026-11.pptx'], [{ mois: '2026-11', formats: ['pptx'], jour: '2026-11-23' }]);
  const r = publier({ racine: d, depot: DEPOT, mois: '2026-11', journal() {},
    gh(a) { if (a[1] === 'upload') throw new Error('HTTP 403'); return ''; } });
  assert.strictEqual(r.publie, false);
  assert.ok(fs.existsSync(path.join(d, '2026-11.pptx')));
  assert.strictEqual(lireIndex(d)[0].base, undefined);
});

test('rien d’écrit ce passage-ci : aucune release touchée', () => {
  const d = dossier([], [{ mois: '2026-11', formats: ['pptx'], jour: '2026-11-23', base: g.baseRelease(DEPOT, '2026-11') }]);
  const r = publier({ racine: d, depot: DEPOT, mois: '2026-11', journal() {}, gh() { throw new Error('ne doit pas être appelé'); } });
  assert.strictEqual(r.publie, false);
});

test('le rapport du jour déjà dans sa release n’est pas réécrit, celui du lendemain l’est', () => {
  const base = g.baseRelease(DEPOT, '2026-11');
  const d = dossier([], [{ mois: '2026-11', formats: ['pptx'], jour: '2026-11-23', genere: '2026-11-23T03:00:00Z', base },
    { mois: '2026-10', formats: ['pptx'], jour: '2026-10-31', genere: '2026-11-01T02:00:00Z' }]);
  fs.writeFileSync(path.join(d, '2026-10.pptx'), 'x');
  assert.deepStrictEqual(g.rapportsAActualiser(d, '2026-11-23'), []);
  assert.deepStrictEqual(g.rapportsAActualiser(d, '2026-11-24'), [{ mois: '2026-11', fin: '2026-11-24' }]);
});

test('le mois écoulé, réécrit le 1er, revient dans le dépôt et perd son adresse de release', () => {
  const base = g.baseRelease(DEPOT, '2026-11');
  const d = dossier(['2026-11.pptx', '2026-11.pdf'], [{ mois: '2026-11', formats: ['pptx'], jour: '2026-11-30', genere: '2026-11-30T03:00:00Z', base }]);
  const idx = g.reconstruireIndex(d);
  assert.strictEqual(idx[0].base, undefined);
  assert.deepStrictEqual(idx[0].formats, ['pptx', 'pdf']);
});

test('l’index refuse une autre adresse que celle d’une release', () => {
  assert.ok(g.baseValide(g.baseRelease(DEPOT, '2026-11')));
  for (const b of ['https://exemple.com/x/', 'javascript:alert(1)//', 'https://github.com/a/b/releases/download/autre/']) assert.ok(!g.baseValide(b), b);
  const d = dossier([], [{ mois: '2026-11', formats: ['pptx'], base: 'https://exemple.com/' }]);
  assert.deepStrictEqual(g.reconstruireIndex(d), []);
});

test('le module Rapports télécharge depuis la release quand l’index la donne', () => {
  const src = tranche('function chargerRapportsAuto(){', '// Bulletins quotidiens des 54 pays');
  assert.match(src, /r\.base \+ 'Presentation-1-' \+ r\.mois/);
  assert.match(src, /releases\\\/download\\\/rapport-/);
  const wf = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'collecte-planifiee.yml'), 'utf8');
  const iIndex = wf.indexOf('node scripts/indexer-rapports-grsci.js');
  const iRel = wf.indexOf('node scripts/publier-rapport-release.js');
  const iArch = wf.indexOf("name: Archiver l'instantané du jour");
  assert.ok(iIndex > 0 && iIndex < iRel && iRel < iArch, 'index, puis release, puis commit');
});
