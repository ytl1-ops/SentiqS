// publierAgendaPartagee (Supabase) est retiree le 15/11/2026 : le job ecrit
// lignesAgendaPartagee() sur Firestore depuis Node. Ces tests fixent la forme
// des lignes partagees, lue par lireAgendaPartagee() sur Firestore.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { tranche } = require('./_bac');

const SRC = tranche('const AGENDA_PARTAGEE_MAX_PAR_APPEL = 200;',
                    '// ligneAgendaPartageeVersEntree(row)');

function monter() {
  const contexte = { Date, estAgendaRecent: () => true, srcName: (p) => 'Source ' + p };
  vm.createContext(contexte);
  vm.runInContext(SRC + '\nthis.lignesAgendaPartagee = lignesAgendaPartagee;', contexte);
  return contexte.lignesAgendaPartagee;
}
const entree = (id, extra) => Object.assign({
  id, title: 'Sommet régional ' + id, analysis: 'Réunion annoncée.',
  _estAgenda: true, _agendaType: 'securite', level: 'orange',
  cy: 'CI', primary: 'src-1', url: 'https://exemple.org/' + id,
  pubDate: Date.now(),
}, extra || {});

test('les lignes partagées gardent les champs lus à la lecture', () => {
  const l = monter()([entree('a')]);
  assert.strictEqual(l.length, 1);
  for (const k of ['id', 'title', 'texte', 'agenda_type', 'niveau', 'cy', 'source', 'link', 'pub_date', 'updated_at']) {
    assert.ok(k in l[0], 'champ absent : ' + k);
  }
  assert.strictEqual(l[0].source, 'Source src-1');
});

test('un article hors agenda ou sans titre n’est pas partagé', () => {
  const l = monter()([entree('a', { _estAgenda: false }), entree('b', { title: '' }), entree('c')]);
  assert.deepStrictEqual(l.map((x) => x.id), ['c']);
});

test('une entrée vide ou absente ne lève pas', () => {
  const f = monter();
  assert.deepStrictEqual(Array.from(f(null)), []);
  assert.deepStrictEqual(Array.from(f([])), []);
});

test('la publication Supabase de l’agenda n’existe plus', () => {
  assert.doesNotMatch(SRC, /async function publierAgendaPartagee|agenda_partagee'\)\.upsert|getClientDonnees/);
});
