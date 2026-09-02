// Les cliquets : fiches pays et secrets suivis.
//
// Ces deux controles ne corrigent rien — ils empechent une dette existante de
// grossir. Les tests verifient que la dette declaree correspond a la realite,
// pour qu'on ne puisse pas la « resorber » en la reecrivant dans le script.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const RACINE = path.join(__dirname, '..', '..');

function lireConstante(fichier, nom) {
  const src = fs.readFileSync(path.join(RACINE, 'scripts', fichier), 'utf8');
  const m = new RegExp('const ' + nom + ' = \\[([\\s\\S]*?)\\];').exec(src);
  assert.ok(m, nom + ' introuvable dans ' + fichier);
  return (m[1].match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
}

test('la dette des fiches pays correspond exactement a la realite', () => {
  // Si quelqu'un ajoute un slug a la liste au lieu de fournir les donnees, ce
  // test tombe : c'est precisement le contournement que le cliquet vise.
  const dette = lireConstante('verifier-fiches-pays.js', 'DETTE_SANS_DONNEES');
  const fiches = fs.readdirSync(path.join(RACINE, 'web', 'pays'))
    .filter((f) => f.endsWith('.html') && f !== 'index.html')
    .map((f) => f.replace(/\.html$/, ''));
  const reel = fiches
    .filter((s) => !fs.existsSync(path.join(RACINE, 'data', 'pays', s + '.json')))
    .sort();
  assert.deepStrictEqual(dette.slice().sort(), reel,
    'la dette declaree doit etre exactement celle qui existe, ni plus ni moins');
});

test('chaque fiche adossee a des donnees declare au moins une source', () => {
  const dossier = path.join(RACINE, 'data', 'pays');
  for (const f of fs.readdirSync(dossier).filter((f) => f.endsWith('.json') && f !== 'schema.json')) {
    const d = JSON.parse(fs.readFileSync(path.join(dossier, f), 'utf8'));
    assert.ok(Array.isArray(d.sources) && d.sources.length > 0,
      f + ' : le champ sources ne doit jamais etre vide');
  }
});

test('le generateur refuse toujours de produire du contenu sans donnees', () => {
  // La regle de securite du generateur est la raison d'etre du cliquet. Si
  // elle disparaissait, le cliquet garderait une porte qui n'existe plus.
  const src = fs.readFileSync(path.join(RACINE, 'scripts', 'generate-country-fiche.js'), 'utf8');
  assert.match(src, /NE GENERE JAMAIS de contenu securitaire a partir de rien/);
  assert.match(src, /'sources'/, 'sources doit rester un champ requis');
});

test('la dette des secrets suivis correspond exactement a la realite', () => {
  const dette = lireConstante('verifier-secrets-suivis.js', 'DETTE_SUIVIE');
  const suivis = execFileSync('git', ['ls-files'], { cwd: RACINE, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  const reel = suivis
    .filter((f) => /(^|\/)\.env($|\.)/.test(f))
    .filter((f) => !/(^|\/)\.env\.(example|sample|template)$/.test(f))
    .sort();
  assert.deepStrictEqual(dette.slice().sort(), reel);
});

test('gitignore couvre bien les fichiers de secrets', () => {
  // Il les couvre deja ; le probleme est qu'un fichier deja suivi le reste.
  // Ce test garde la regle en place pour les fichiers a venir.
  const gi = fs.readFileSync(path.join(RACINE, '.gitignore'), 'utf8');
  assert.match(gi, /^\.env$/m);
  assert.match(gi, /^\.env\.\*$/m);
  assert.match(gi, /^!\.env\.example$/m);
});
