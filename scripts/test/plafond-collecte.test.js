// Le plafond de temps de la collecte planifiee, et ce qu'on en mesure.
//
// Le job s'arrete a un plafond et publie ce qu'il a. Le 03/09/2026 (passage
// n° 806) : arret a 8 min, 25 sources fraiches couvrant 20 pays sur 54. Le
// plafond passe a 11 min ; la garde du job suit ; et le journal dit desormais
// combien de sources etaient traitees a l'arret — sans ce nombre, on ne peut
// pas savoir si une minute de plus sert a quelque chose.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { HTML } = require('./_bac.js');

const JOB = fs.readFileSync(path.join(__dirname, '..', 'collecte-planifiee.js'), 'utf8');
const FLUX = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'collecte-planifiee.yml'), 'utf8');

const { fenetreCollecteMs, COLLECTE_MINIMUM_MS } = require('../lib/fenetre-collecte.js');

test('la garde du job laisse de la marge au-dela de l\'echeance de collecte', () => {
  const echeanceMin = Number(/COLLECTE_ECHEANCE_EPOCH=\$\(\( \$\(date \+%s\) \+ (\d+)\*60 \)\)/.exec(FLUX)[1]);
  const gardeMin = Number(/timeout-minutes: (\d+)/.exec(FLUX)[1]);
  const plafondMin = Number(/COLLECT_TIMEOUT_MS = (\d+) \* 60 \* 1000/.exec(JOB)[1]);
  assert.ok(plafondMin <= echeanceMin, 'le plafond de collecte doit tenir dans l\'echeance');
  assert.ok(gardeMin - echeanceMin >= 3, 'garde ' + gardeMin + ' min pour une echeance a ' + echeanceMin + ' min : pas assez pour publier et archiver');
});

test('la fenetre de collecte raccourcit quand l\'installation a mange le budget', () => {
  const plafond = 11 * 60 * 1000;
  const t0 = 1_700_000_000_000;
  // Sans echeance : le plafond.
  assert.strictEqual(fenetreCollecteMs(plafond, undefined, t0), plafond);
  // Echeance a 16 min, installation rapide (1 min ecoulee) : le plafond tient.
  assert.strictEqual(fenetreCollecteMs(plafond, (t0 / 1000) + 15 * 60, t0), plafond);
  // Installation de 7 min (cas des passages 812 et 814) : il reste 9 min avant
  // l'echeance, moins la reserve — la collecte se raccourcit au lieu de faire
  // tuer le job.
  const restant = fenetreCollecteMs(plafond, (t0 / 1000) + 9 * 60, t0);
  assert.ok(restant < plafond && restant <= 9 * 60 * 1000 - 90 * 1000, 'fenetre ' + restant);
  // Budget deja epuise : jamais moins de deux minutes de collecte.
  assert.strictEqual(fenetreCollecteMs(plafond, (t0 / 1000) + 30, t0), COLLECTE_MINIMUM_MS);
});

test('le navigateur est mis en cache et un passage tue par sa garde declenche l\'alerte', () => {
  assert.match(FLUX, /uses: actions\/cache@v4\s+with:\s+path: ~\/\.cache\/ms-playwright/, 'le telechargement de Chromium (7 min les 03 et 04/09) doit etre mis en cache');
  assert.match(FLUX, /if: failure\(\) \|\| cancelled\(\)/, 'un job annule par sa garde doit ouvrir l\'incident, pas se taire');
  assert.match(JOB, /fenetreCollecteMs\(\)/, 'le job doit utiliser la fenetre adaptative');
});

test('la page expose l\'avancement de la collecte, et le job le journalise a l\'arret', () => {
  assert.match(HTML, /window\.COLLECTE_AVANCEMENT = \{ terminees: done, total: total \}/);
  // Dans le source, l'apostrophe est echappee (\') : on l'accepte sous les deux formes.
  assert.match(JOB, /Sources terminées à l\\?'arrêt/);
});
