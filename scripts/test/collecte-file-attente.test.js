// Collecte planifiée annulée cinq fois de suite (passages 1239 à 1243, du
// 18/11/2026 23 h 56 au 20/11/2026 04 h 09 GMT) : depuis le commit de la
// sonde GDELT, chaque requête réservait un créneau de 1,5 s par domaine.
// Les sources AllAfrica et leurs relais faisaient une file de plus de dix
// minutes, la page les abandonnait et le job ne se terminait plus. Ces tests
// gardent les trois correctifs : pas de file pour un domaine ordinaire, file
// stricte pour un domaine à quota déclaré, sortie forcée du job et étapes
// d'après-collecte exécutées même si la collecte dépasse son temps.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const fr = require('../lib/fetch-respectueux.js');

test('soixante appels paralleles vers un domaine ordinaire ne font pas la queue', async () => {
  const t0 = Date.now();
  await Promise.all(Array.from({ length: 60 }, () => fr.attendreQuota('https://fr.allafrica.com/x')));
  assert.ok(Date.now() - t0 < 2500, 'file de ' + (Date.now() - t0) + ' ms');
});

test('un domaine a quota declare garde son ecart, meme en parallele', async () => {
  fr.DELAIS_PAR_DOMAINE_MS['quota.example.org'] = 60;
  try {
    const t0 = Date.now();
    await Promise.all([1, 2, 3].map(() => fr.attendreQuota('https://quota.example.org/a')));
    assert.ok(Date.now() - t0 >= 110, 'ecart non tenu : ' + (Date.now() - t0) + ' ms');
  } finally { delete fr.DELAIS_PAR_DOMAINE_MS['quota.example.org']; }
});

test('le job sort de lui-meme apres la fermeture du navigateur', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'collecte-planifiee.js'), 'utf8');
  assert.match(src, /process\.exit\(/, 'sortie forcee absente');
  assert.match(src, /Promise\.race\(\[\s*browser\.close\(\)/, 'fermeture du navigateur non bornee');
});

test('la collecte a sa propre garde de temps, et l alerte couvre une annulation', () => {
  const wf = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'collecte-planifiee.yml'), 'utf8');
  const etape = wf.slice(wf.indexOf('- name: Lancer la collecte planifiée'), wf.indexOf('- name: Sauvegarder la mémoire inter-runs'));
  assert.match(etape, /timeout-minutes:\s*\d+/, 'pas de garde au niveau de l etape');
  const garde = Number(etape.match(/timeout-minutes:\s*(\d+)/)[1]);
  const job = Number(wf.match(/collecte:\n\s+runs-on: ubuntu-latest[\s\S]*?timeout-minutes:\s*(\d+)/)[1]);
  assert.ok(job - garde >= 12, 'il faut laisser au moins 12 min au PDF et a l archive (' + job + ' - ' + garde + ')');
  assert.match(wf, /needs\.collecte\.result != 'success'/, 'alerte qui ignore les annulations');
});
