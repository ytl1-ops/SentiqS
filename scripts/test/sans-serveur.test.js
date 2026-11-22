// Sans serveur (22/11/2026) : version hors ligne, sauvegarde chiffrée,
// collecte depuis un PC. Voir docs/sans-serveur.md.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { HTML, tranche } = require('./_bac');
const hl = require('../../web/js/hors-ligne.js');
const sauvegarde = require('../lib/sauvegarde-chiffree');
const restaurer = require('../restaurer-firestore');

const RACINE = path.join(__dirname, '..', '..');

function scriptsDeLaPage() {
  const s = {};
  hl.scriptsLocaux(HTML).concat(['js/hors-ligne.js']).forEach((c) => { s[c] = fs.readFileSync(path.join(RACINE, 'web', c), 'utf8'); });
  return s;
}

test('le fichier hors ligne recopie chaque script local et pose l\'instantané avant tout script', () => {
  const inst = hl.instantaneDepuis([{ id: 'a', title: 'x</script><script>alert(1)</script>', pubDate: 1 }], { nom: 'Test' });
  const out = hl.construire(HTML, scriptsDeLaPage(), inst);
  assert.ok(!/<script\s+src="js\//.test(out), 'un script local reste à charger depuis le site');
  hl.scriptsLocaux(HTML).forEach((s) => { if (s !== 'js/hors-ligne.js') assert.ok(out.includes('<script data-src="' + s + '">'), s); });
  const iInst = out.indexOf('window.SENTIQ_HORS_LIGNE=');
  const iPremier = out.search(/<script(?! data-src="instantane")/);
  assert.ok(iInst > 0 && iInst < out.indexOf('<script data-src="js/noyau.js">'));
  assert.ok(out.indexOf('<script data-src="instantane">') <= iPremier, 'l\'instantané doit précéder tout autre script');
  // Un titre ne referme jamais le script de l'instantané.
  assert.ok(!out.slice(iInst, out.indexOf('</script>', iInst)).includes('<'), 'chevron non échappé dans l\'instantané');
  // Le point d'insertion est dans <head>, pas dans une chaîne d'un script recopié.
  assert.ok(iInst < out.indexOf('<meta name="viewport"'));
});

test('sans la police d\'icônes, rien ne change dans la CSP ; avec, la police est en ligne et autorisée', () => {
  const inst = hl.instantaneDepuis([], {});
  const sans = hl.construire(HTML, scriptsDeLaPage(), inst);
  assert.ok(sans.includes('icons-webfont@'));
  const avec = hl.construire(HTML, scriptsDeLaPage(), inst, { cssIcones: '.ti{font-family:tabler-icons}' });
  assert.ok(avec.includes('<style data-src="icones">'));
  assert.ok(/font-src data: 'self'/.test(avec));
  assert.ok(!/<link\s+rel="stylesheet"\s+href="https:\/\/cdn\.jsdelivr\.net\/npm\/@tabler/.test(avec));
});

test('l\'horloge est ramenée à l\'instantané, une date explicite reste elle-même', () => {
  const T0 = Date.UTC(2026, 10, 1, 12, 0, 0);
  const win = { Date, fetch: null, Response: class { constructor(b, o) { this.body = b; this.status = o.status; } }, SENTIQ_HORS_LIGNE: { t: T0, fichiers: { 'historique/serie.json': { ok: 1 } } } };
  assert.strictEqual(hl.installer(win), true);
  assert.ok(Math.abs(win.Date.now() - T0) < 2000);
  assert.ok(Math.abs(new win.Date().getTime() - T0) < 2000);
  assert.strictEqual(new win.Date(0).getTime(), 0);
  assert.strictEqual(new win.Date(2020, 0, 2).getFullYear(), 2020);
  assert.ok(new win.Date() instanceof Date);
  assert.ok(Math.abs(win.SENTIQ_HORS_LIGNE.vraiMaintenant() - Date.now()) < 2000, 'le bandeau garde la vraie horloge');
  return Promise.all([
    win.fetch('historique/serie.json?v=2').then((r) => assert.strictEqual(r.status, 200)),
    win.fetch('bulletins/index.json').then((r) => assert.strictEqual(r.status, 404)),
  ]);
});

test('la page servie normalement n\'est pas touchée', () => {
  const win = { Date, fetch: () => 'reseau' };
  assert.strictEqual(hl.installer(win), false);
  assert.strictEqual(win.Date, Date);
  assert.strictEqual(win.fetch(), 'reseau');
});

test('le bandeau dit l\'âge réel et prévient quand ce n\'est plus de l\'actualité', () => {
  const t = Date.UTC(2026, 10, 1, 12, 0, 0);
  const frais = hl.texteBandeau({ t }, t + 3 * 3600000, 'fr', 36 * 3600000);
  assert.match(frais.texte, /il y a 3 h/);
  assert.strictEqual(frais.perime, false);
  const vieux = hl.texteBandeau({ t }, t + 4 * 86400000, 'en', 36 * 3600000);
  assert.match(vieux.texte, /4 days ago/);
  assert.match(vieux.texte, /no longer current/);
  assert.strictEqual(vieux.perime, true);
});

test('la page démarre l\'instantané sans serveur d\'identité, et ne collecte jamais', () => {
  const ca = tranche('async function checkAuth() {', 'const _hashAvantSdk');
  assert.ok(ca.indexOf('demarrerHorsLigne()') > 0 && ca.indexOf('demarrerHorsLigne()') < ca.length);
  assert.ok(ca.indexOf('checkCollectorSession') < ca.indexOf('demarrerHorsLigne()'));
  assert.match(tranche('async function doCollect() {', 'if (busy) return;'), /estHorsLigne\(\)/);
  assert.match(tranche('async function trFetch(', 'srcLang = srcLang'), /estHorsLigne\(\)/);
  assert.match(tranche('// Cache local + collecte RSS automatique en arriere-plan', 'await initDB();'), /estHorsLigne\(\)\) \{ _appliquerInstantaneHorsLigne\(\); return; \}/);
  // Le fichier garde la signature de la page : pas de reclassement à l'ouverture.
  assert.match(tranche('function signatureCode() {', 'const t = sc.textContent;'), /hasAttribute\('data-src'\)/);
  // Réservée aux forfaits payants, et jamais via le panneau de partage.
  const tv = tranche('async function telechargerVersionHorsLigne() {', '\n}\n');
  assert.match(tv, /fonctionnalitePayante\(\)/);
  assert.ok(!/dlFile\(/.test(tv));
  assert.match(HTML, /<script src="js\/hors-ligne\.js"><\/script>\s*<script src="js\/noyau\.js">/);
});

test('sauvegarde : relue avec la bonne clé, refusée avec une autre, illisible sans clé', () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const autre = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
  const donnees = { format: 'sentiqs-firestore', projet: 'p', collections: { profiles: [{ id: 'u1', fields: { email: { stringValue: 'yoro@exemple.ci' } } }] } };
  const texte = sauvegarde.chiffrer(donnees, privateKey);
  assert.ok(!texte.includes('yoro@exemple.ci'), 'une adresse en clair dans l\'artefact public');
  assert.deepStrictEqual(sauvegarde.dechiffrer(texte, privateKey), donnees);
  assert.throws(() => sauvegarde.dechiffrer(texte, autre), /autre compte de service/);
});

test('restauration : lecture seule par défaut, --appliquer exige des collections nommées', () => {
  const o = restaurer.options(['s.enc', '--compte', 'c.json']);
  assert.strictEqual(o.appliquer, false);
  const p = restaurer.options(['s.enc', '--collections', 'profiles, paiements_declares', '--appliquer']);
  assert.deepStrictEqual(p.collections, ['profiles', 'paiements_declares']);
  const src = fs.readFileSync(path.join(RACINE, 'scripts/restaurer-firestore.js'), 'utf8');
  assert.ok(!/method:\s*'DELETE'/.test(src), 'la restauration ne supprime jamais');
});

test('le secret du PC et les fichiers produits ne peuvent pas entrer dans le dépôt', () => {
  const gi = fs.readFileSync(path.join(RACINE, '.gitignore'), 'utf8');
  ['outils/pc/compte-service*.json', 'sauvegardes/', '*.json.enc', 'SentiqS-hors-ligne-*.html'].forEach((m) => assert.ok(gi.includes(m), m));
  const ps = fs.readFileSync(path.join(RACINE, 'outils/pc/collecte-locale.ps1'), 'utf8');
  assert.ok(!/Write-Host[^\n]*FIREBASE_SERVICE_ACCOUNT/.test(ps), 'le secret ne s\'affiche jamais');
  assert.match(ps, /sentiqs-235ce\.web\.app/, 'repli sur le miroir Firebase');
});
