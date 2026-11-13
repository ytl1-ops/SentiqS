// Application installable et application Android (TWA) — 13/11/2026.
// Le projet Android n'est compilé qu'en CI (.github/workflows/android.yml) :
// ces tests gardent la cohérence entre le site, son manifeste, assetlinks et
// l'application, qu'aucun compilateur ne vérifie.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const R = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(R, ...p), 'utf8');
const al = require('../assetlinks.js');

test('le manifeste pointe des icônes qui existent, dont une « maskable », et une page de départ réelle', () => {
  const m = JSON.parse(lire('web', 'manifest.webmanifest'));
  assert.strictEqual(m.display, 'standalone');
  assert.ok(fs.existsSync(path.join(R, 'web', m.start_url)), m.start_url);
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(R, 'web', i.src)), i.src);
  const tailles = m.icons.map((i) => i.sizes);
  assert.ok(tailles.includes('192x192') && tailles.includes('512x512'));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
});

test('l\'appli et l\'accueil déclarent le manifeste', () => {
  for (const p of ['SentiqS_Web.html', 'index.html']) assert.match(lire('web', p), /<link rel="manifest" href="manifest\.webmanifest">/, p);
});

test('assetlinks, l\'application et l\'hôte Firebase désignent le même paquet et le même site', () => {
  const gradle = lire('android', 'app', 'build.gradle');
  assert.match(gradle, new RegExp("applicationId '" + al.PAQUET.replace(/\./g, '\\.') + "'"));
  const projet = (lire('web', 'js', 'firebase-config.js').match(/projectId:\s*'([^']+)'/) || [])[1];
  assert.match(gradle, new RegExp("def hote = '" + projet + "\\.web\\.app'"));
  const liens = JSON.parse(lire('web', '.well-known', 'assetlinks.json'));
  assert.strictEqual(liens[0].target.package_name, al.PAQUET);
});

test('une empreinte illisible est refusée, une empreinte valide passe en majuscules', () => {
  const ok = Array.from({ length: 32 }, () => 'ab').join(':');
  assert.deepStrictEqual(al.empreintes(ok + ', '), [ok.toUpperCase()]);
  assert.deepStrictEqual(al.empreintes(''), []);
  assert.throws(() => al.empreintes('AB:CD'));
});

test('Firebase Hosting publie .well-known (une règle « **/.* » l\'excluait)', () => {
  const h = JSON.parse(lire('firebase.json')).hosting;
  assert.ok(!h.ignore.includes('**/.*'));
  assert.match(lire('.github', 'workflows', 'gh-pages-deploy.yml'), /node scripts\/assetlinks\.js/);
});

test('l\'application ne demande qu\'Internet et vise la dernière version d\'Android exigée', () => {
  const man = lire('android', 'app', 'src', 'main', 'AndroidManifest.xml');
  assert.deepStrictEqual(man.match(/android\.permission\.[A-Z_]+/g), ['android.permission.INTERNET']);
  assert.match(lire('android', 'app', 'build.gradle'), /targetSdk 36/);
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'])
    assert.ok(fs.existsSync(path.join(R, 'android/app/src/main/res/mipmap-' + d + '/ic_launcher.png')), d);
});
