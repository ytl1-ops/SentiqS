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

test('la garde du job laisse au moins cinq minutes au-dela du plafond de collecte', () => {
  const plafondMin = Number(/COLLECT_TIMEOUT_MS = (\d+) \* 60 \* 1000/.exec(JOB)[1]);
  const gardeMin = Number(/timeout-minutes: (\d+)/.exec(FLUX)[1]);
  // Installation de Playwright (~35 s), publication, archive : mesure sur le
  // passage n° 806, environ deux minutes hors collecte. Cinq de marge.
  assert.ok(gardeMin - plafondMin >= 5, 'garde ' + gardeMin + ' min pour un plafond de ' + plafondMin + ' min : le job serait tue avant de publier');
});

test('la page expose l\'avancement de la collecte, et le job le journalise a l\'arret', () => {
  assert.match(HTML, /window\.COLLECTE_AVANCEMENT = \{ terminees: done, total: total \}/);
  // Dans le source, l'apostrophe est echappee (\') : on l'accepte sous les deux formes.
  assert.match(JOB, /Sources terminées à l\\?'arrêt/);
});
