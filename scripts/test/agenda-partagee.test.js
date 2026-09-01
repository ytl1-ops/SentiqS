// publierAgendaPartagee ne rendait rien — sur aucun chemin, pas meme le
// succes. Le job planifie teste `!pubAgenda.ok` : il lisait donc un echec a
// CHAQUE cycle, y compris les cycles verts, et affichait « a echoue : raison
// inconnue ». Une alarme qui sonne toujours ne signale plus rien.
//
// Ces tests exercent la vraie fonction de production, extraite du monolithe,
// avec un faux client Supabase. Ils fixent le contrat { ok, publiees, raison }
// sur chacun de ses chemins de sortie.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { tranche } = require('./_bac');

const SRC = tranche('const AGENDA_PARTAGEE_MAX_PAR_APPEL = 200;',
                    '// ligneAgendaPartageeVersEntree(row)');

// Monte la fonction de production avec les dependances qu'elle appelle, et un
// client dont on choisit la reponse d'upsert.
function monter({ client = 'defaut', upsert } = {}) {
  const journal = { lignes: null, avertissements: [] };
  const faux = {
    from: () => ({
      upsert: async (lignes) => { journal.lignes = lignes; return upsert || { error: null }; },
    }),
  };
  const contexte = {
    Date,
    console: { warn: (...a) => journal.avertissements.push(a.join(' ')) },
    getSentinelSupabase: () => (client === 'defaut' ? faux : client),
    estAgendaRecent: () => true,
    srcName: (p) => 'Source ' + p,
  };
  vm.createContext(contexte);
  vm.runInContext(SRC + '\nthis.publierAgendaPartagee = publierAgendaPartagee;', contexte);
  return { publier: contexte.publierAgendaPartagee, journal };
}

const entree = (id) => ({
  id, title: 'Sommet régional ' + id, analysis: 'Réunion annoncée.',
  _estAgenda: true, _agendaType: 'securite', level: 'orange',
  cy: 'CI', primary: 'src-1', url: 'https://exemple.org/' + id,
  pubDate: Date.now(),
});

test('une publication réussie rend ok:true et le nombre de lignes', async () => {
  const { publier, journal } = monter();
  const v = await publier([entree('a'), entree('b')]);
  assert.strictEqual(v.ok, true, 'un succès ne doit jamais être lu comme un échec');
  assert.strictEqual(v.publiees, 2);
  assert.strictEqual(journal.lignes.length, 2, 'les lignes doivent bien partir vers Supabase');
});

// C'est le defaut corrige : ce chemin-la rendait undefined, et le job criait.
test('un succès ne produit aucun avertissement', async () => {
  const { publier, journal } = monter();
  const v = await publier([entree('a')]);
  assert.strictEqual(v.ok, true);
  assert.strictEqual(journal.avertissements.length, 0,
    'avertissements émis à tort : ' + journal.avertissements.join(' | '));
});

test('aucune entrée d\'agenda à publier est un succès, pas un échec', async () => {
  const { publier } = monter();
  const ordinaire = { ...entree('a'), _estAgenda: false };
  const v = await publier([ordinaire]);
  assert.strictEqual(v.ok, true, 'le cas courant — rien à publier — ne doit pas alerter');
  assert.strictEqual(v.publiees, 0);
  assert.match(v.raison, /aucune entree/);
});

test('une liste vide est un succès à zéro publication', async () => {
  const { publier } = monter();
  for (const vide of [[], null, undefined]) {
    const v = await publier(vide);
    assert.strictEqual(v.ok, true, 'entrée ' + JSON.stringify(vide));
    assert.strictEqual(v.publiees, 0);
  }
});

test('une erreur Supabase rend ok:false ET sa raison, jamais « inconnue »', async () => {
  const { publier } = monter({ upsert: { error: { message: 'relation agenda_partagee inexistante' } } });
  const v = await publier([entree('a')]);
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.raison, 'relation agenda_partagee inexistante',
    'un échec doit dire pourquoi : c\'est tout l\'intérêt du contrat');
});

test('une exception rend ok:false et son message', async () => {
  const casse = { from: () => { throw new Error('réseau coupé'); } };
  const { publier } = monter({ client: casse });
  const v = await publier([entree('a')]);
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.raison, 'réseau coupé');
});

test('un client Supabase absent est un échec nommé', async () => {
  const { publier } = monter({ client: null });
  const v = await publier([entree('a')]);
  assert.strictEqual(v.ok, false);
  assert.match(v.raison, /client Supabase/);
});

// Un `return;` nu est exactement le defaut d'origine. Interdit toute
// regression vers un chemin de sortie muet.
test('aucun chemin de sortie ne rend undefined', () => {
  const nus = SRC.match(/^\s*(?:if\s*\([^)]*\)\s*)?return\s*;/gm) || [];
  assert.strictEqual(nus.length, 0,
    'return sans verdict trouvé(s) : ' + nus.map((s) => s.trim()).join(' | '));
});

// Le job doit distinguer « pas de verdict » d'un « ok:false ». S'il rebascule
// sur un test falsy, il recommence a crier sur les succes.
test('le job planifié ne traite plus un retour falsy comme un échec nommé', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const job = fs.readFileSync(path.join(__dirname, '../collecte-planifiee.js'), 'utf8');
  const bloc = job.slice(job.indexOf('publierAgendaPartagee(ALL)'));
  assert.doesNotMatch(bloc.slice(0, 900), /a echoue :'[^\n]*raison inconnue/,
    'la fausse alarme « raison inconnue » est revenue');
  assert.match(bloc.slice(0, 900), /typeof pubAgenda\.ok !== 'boolean'/,
    'le job doit distinguer un contrat rompu d\'un échec réel');
});
