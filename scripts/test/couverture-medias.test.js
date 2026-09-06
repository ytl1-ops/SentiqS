// La mesure de couverture médiatique : quels médias parlent d'un pays, et
// lesquels la veille ne lit pas encore.
//
// Mesure du 06/09/2026 : treize pays n'ont qu'une seule source capable de
// faire monter un niveau. Les annuaires ouverts ne les couvrent pas non plus
// (Wikidata : zéro média référencé pour l'Érythrée, le Burundi, la Sierra
// Leone, la Guinée équatoriale). Ce que ce module mesure à la place, c'est
// qui publie réellement — voir scripts/lib/moisson-medias.js.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { HTML, tranche } = require('./_bac.js');
const {
  extraireMedias, hotesDuRegistre, requetesGoogleNews, agreger, candidats,
} = require('../lib/moisson-medias.js');

const SRCS = (() => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(tranche('const SRCS=[', '\n];') + '\n];\nthis.S = SRCS;', ctx);
  return ctx.S;
})();

const FLUX = `<?xml version="1.0"?><rss><channel>
<item><title>A</title><source url="https://www.awoko.org">Awoko</source></item>
<item><title>B</title><source url="https://awoko.org/x">Awoko Newspaper</source></item>
<item><title>C</title><source url="https://thesierraleonetelegraph.com">SL Telegraph</source></item>
</channel></rss>`;

test('un média est compté une fois, avec ou sans « www. »', () => {
  // Sans normalisation, awoko.org et www.awoko.org feraient deux candidats
  // pour un seul média — et un média déjà lu par le registre passerait pour
  // une découverte.
  const m = extraireMedias(FLUX);
  assert.strictEqual(m.length, 3);
  assert.deepStrictEqual(m.map((x) => x.hote), ['awoko.org', 'awoko.org', 'thesierraleonetelegraph.com']);
  const a = agreger(m, new Set());
  assert.strictEqual(a.length, 2);
  assert.strictEqual(a[0].hote, 'awoko.org');
  assert.strictEqual(a[0].n, 2);
});

test('les médias lus via une requête « site: » comptent comme déjà lus', () => {
  // Plusieurs dizaines d'entrées du registre lisent un média par une requête
  // Google News « site:exemple.org » plutôt que par son flux natif. Les
  // ignorer ferait « découvrir » des médias que la veille lit déjà.
  const connus = hotesDuRegistre([
    { url: 'https://exemple.org/', rss: 'https://exemple.org/feed/' },
    { url: 'https://news.google.com/search?q=site:slena.gov.sl', rss: 'https://news.google.com/rss/search?q=site%3Aslena.gov.sl&hl=en' },
  ]);
  assert.ok(connus.has('exemple.org'), 'le domaine du site doit être connu');
  assert.ok(connus.has('slena.gov.sl'), 'le domaine cité dans une requête site: doit être connu');
});

test('le registre réel déclare bien ses médias lus par requête « site: »', () => {
  // Cas réel : abidjan.net n'apparaît dans le registre QUE derrière une
  // requête « site:abidjan.net » — aucun champ url ne le cite. Sans la
  // lecture de ces requêtes, la mesure le présenterait comme un média à
  // évaluer alors que la veille le lit déjà tous les jours.
  const connus = hotesDuRegistre(SRCS);
  assert.ok(connus.has('abidjan.net'), 'abidjan.net doit être reconnu comme déjà lu');
  assert.ok(connus.size > 150, 'le registre lit plus de 150 domaines, vu : ' + connus.size);
});

test('seules les requêtes thématiques servent à découvrir', () => {
  // Une requête « site: » ne peut ramener qu'un média, déjà connu : la
  // garder ne ferait qu'ajouter une requête réseau sans rien découvrir.
  const r = requetesGoogleNews([
    { cy: 'SL', rss: 'https://news.google.com/rss/search?q=Sierra+Leone+security+news&hl=en' },
    { cy: 'SL', rss: 'https://news.google.com/rss/search?q=site%3Aslena.gov.sl&hl=en' },
    { cy: 'GM', rss: 'https://news.google.com/rss/search?q=Gambia+security&hl=en' },
    { cy: 'SL', rss: 'https://awoko.org/feed/' },
  ], 'SL');
  assert.deepStrictEqual(r, ['https://news.google.com/rss/search?q=Sierra+Leone+security+news&hl=en']);
});

test('chaque pays a au moins une requête thématique : sinon la mesure est muette pour lui', () => {
  // Cliquet. Un pays sans requête thématique ne produirait aucun candidat —
  // et le rapport le montrerait « bien couvert » exactement comme un pays
  // dont tous les médias sont déjà lus. C'est l'ambiguïté que paysMuet()
  // combat côté interface ; elle ne doit pas revenir par la mesure.
  const pays = [...new Set(SRCS.map((s) => s.cy))].filter((cy) => cy && cy !== 'INT');
  assert.strictEqual(pays.length, 54, 'la veille couvre 54 pays, vu : ' + pays.length);
  const muets = pays.filter((cy) => requetesGoogleNews(SRCS, cy).length === 0);
  assert.deepStrictEqual(muets, [], 'pays sans requête thématique : ' + muets.join(', '));
});

test('un média déjà lu, ou vu une seule fois, n\'est pas un candidat', () => {
  // Sur la moisson du 06/09/2026, 1405 domaines inconnus apparaissaient au
  // moins une fois et 572 au moins deux fois : le seuil écarte la reprise
  // isolée d'une dépêche par un site sans lien avec le pays.
  const a = agreger([
    { hote: 'deja.org', nom: 'Déjà' }, { hote: 'deja.org', nom: 'Déjà' },
    { hote: 'recurrent.sl', nom: 'Récurrent' }, { hote: 'recurrent.sl', nom: 'Récurrent' },
    { hote: 'passage.com', nom: 'De passage' },
  ], new Set(['deja.org']));
  assert.deepStrictEqual(candidats(a).map((m) => m.hote), ['recurrent.sl']);
  assert.deepStrictEqual(candidats(a, 1).map((m) => m.hote), ['recurrent.sl', 'passage.com']);
});

test('la mesure ne note aucune source et n\'écrit jamais dans le registre', () => {
  // Le score de fiabilité est un jugement éditorial (cliquet de
  // verifier-redondance-sources.js). Un outil qui en attribuerait
  // automatiquement viderait ce cliquet de son sens.
  const src = require('node:fs').readFileSync(__dirname + '/../couverture-mediatique.js', 'utf8');
  assert.doesNotMatch(src, /score\s*[:=]\s*\d/, 'aucun score ne doit être attribué');
  assert.doesNotMatch(src, /writeFileSync\([^)]*SentiqS_Web\.html/, 'le registre ne doit jamais être réécrit');
  assert.match(HTML, /const SRCS=\[/, 'le registre reste la seule source de vérité');
});
