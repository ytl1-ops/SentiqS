// Chargement rapide des actus et collecte réellement toutes les 30 min —
// 22/11/2026, demande de YORO : « le max d'actu … avec un délai de chargement
// des actu très réduit ».
//
// Mesure qui a motivé la passe : passages n° 1245 à 1252 espacés de 4 à 8 h
// malgré le cron « */30 » ; au-delà de 6 h, chaque visiteur attendait 0 à 45 s
// puis collectait lui-même pendant des minutes, devant un Flux vide. Et un
// nouvel appareil téléchargeait 685 Ko avant sa première actu.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { HTML, tranche } = require('./_bac');
const commun = require('../../web/js/cache-firestore.js');

const RACINE = path.join(__dirname, '..', '..');
const WORKFLOW = fs.readFileSync(path.join(RACINE, '.github/workflows/collecte-planifiee.yml'), 'utf8');
const JOB = fs.readFileSync(path.join(RACINE, 'scripts/collecte-planifiee.js'), 'utf8');

// Un jeu de 54 « pays » à 30 articles chacun, la plupart au niveau normal.
function jeu() {
  const arts = [];
  const t0 = Date.UTC(2026, 10, 22, 12);
  for (let p = 0; p < 54; p++) {
    const cy = p === 0 ? 'CI' : 'P' + p;
    for (let i = 0; i < 30; i++) {
      const lvl = (p * 30 + i) % 17 === 0 ? 'crit' : (p * 30 + i) % 11 === 0 ? 'high' : (p * 30 + i) % 7 === 0 ? 'mod' : 'ok';
      // Dans chaque pays, la seule source fiable (score 80) est la plus ANCIENNE.
      arts.push({ id: cy + '-' + i, cy, level: lvl, score: i === 29 ? 80 : 60, pubDate: t0 - (p * 30 + i) * 60000 });
    }
  }
  return arts;
}

test('la tête garde tout ce qui fait un niveau, un pays muet ou un pays hors alerte', () => {
  const arts = jeu();
  const tete = commun.selectionnerTete(arts);
  const ids = new Set(tete.map((a) => a.id));
  assert.ok(tete.length < arts.length / 2, 'une tête de ' + tete.length + ' articles sur ' + arts.length + ' ne fait rien gagner');
  for (const a of arts) {
    if (a.level !== 'ok') assert.ok(ids.has(a.id), 'article ' + a.level + ' écarté : le niveau d\'alerte baisserait');
    if (a.cy === 'CI') assert.ok(ids.has(a.id), 'la Côte d\'Ivoire, pays pilote, doit être entière');
  }
  const pays = (l, f) => new Set(l.filter(f || (() => true)).map((a) => a.cy));
  assert.deepStrictEqual(pays(tete), pays(arts), 'un pays absent de la tête paraîtrait muet');
  assert.deepStrictEqual(pays(tete, (a) => a.score >= 70), pays(arts, (a) => a.score >= 70),
    'un pays sans source fiable dans la tête paraîtrait hors alerte');
});

test('le job publie la tête après le cache complet, sans bloquer la publication', () => {
  const i = JOB.indexOf('cacheFirestore.ecrireCache(compteFirebase, fusionnes, fetch)');
  const j = JOB.indexOf('commun.selectionnerTete(fusionnes)');
  assert.ok(i > 0 && j > i, 'la tête doit être écrite après le cache complet');
  assert.match(JOB.slice(j - 400, j + 600), /try \{[\s\S]*catch \(e\)/, 'un échec de la tête ne doit pas faire tomber la publication');
});

test('la page lit la tête avant le cache complet quand elle n\'a rien à montrer', () => {
  const init = tranche('async function init() {', '\n}\n');
  const t = init.indexOf('lireTetePartagee()');
  const c = init.indexOf('await lireCollectePartagee()');
  assert.ok(t > 0 && c > t, 'la tête doit être lue avant le cache complet');
  assert.match(init.slice(t - 200, t), /if \(!ALL\.length\)/, 'la tête ne doit pas remplacer un cache local déjà affiché');
});

test('un cache partagé périmé s\'affiche au lieu d\'un écran vide, sans se faire passer pour une collecte', () => {
  const lire = tranche('async function lireCollectePartagee() {', '\n}\n');
  assert.match(lire, /_cachePartagePerime = \{ articles: fs\.articles, ageMs: ageFs \}/);
  const init = tranche('async function init() {', '\n}\n');
  const p = init.indexOf('_afficherArticlesProvisoires(_cachePartagePerime.articles');
  const d = init.indexOf('Math.floor(Math.random() * 45000)');
  assert.ok(p > 0 && d > p, 'le cache périmé doit s\'afficher AVANT l\'attente et la collecte');
  const prov = tranche('function _afficherArticlesProvisoires(', '\n}\n');
  assert.doesNotMatch(prov, /sentinel_lastCollectTs|dbPut/, 'un affichage provisoire ne doit pas dispenser l\'appareil de collecter');
  assert.match(prov, /estRecentReel/, 'la fenêtre d\'actualité s\'applique aussi au provisoire');
});

test('chaque passage relance le suivant à la cadence voulue, sur main seulement', () => {
  assert.match(WORKFLOW, /\n  relance:\n/);
  const r = WORKFLOW.slice(WORKFLOW.indexOf('\n  relance:\n'), WORKFLOW.indexOf('\n  alerte:\n'));
  assert.match(r, /needs: collecte/);
  // Depuis le passage du dépôt en privé (quota de minutes), la chaîne est
  // opt-in : COLLECTE_CHAINEE = '1'. Une variable absente = pas de chaîne.
  assert.match(r, /if: always\(\) && github\.ref == 'refs\/heads\/main' && vars\.COLLECTE_CHAINEE == '1'/);
  assert.match(r, /gh workflow run collecte-planifiee\.yml/);
  assert.match(r, /CADENCE_MIN: \$\{\{ vars\.COLLECTE_CADENCE_MIN \|\| '30' \}\}/);
  assert.match(WORKFLOW, /cancel-in-progress: false/, 'sans file unique, deux chaînes tourneraient en parallèle');
});

test('à 30 min, le cumul n\'est pas commité à chaque passage, l\'état des alertes si', () => {
  const a = WORKFLOW.slice(WORKFLOW.indexOf("- name: Archiver l'instantané du jour"), WORKFLOW.indexOf('\n  relance:\n'));
  assert.match(a, /git status --porcelain web\/historique\)/, 'l\'état des alertes sortantes doit toujours être commité');
  assert.match(a, /-lt 10800/, 'le reste au plus toutes les trois heures');
});
