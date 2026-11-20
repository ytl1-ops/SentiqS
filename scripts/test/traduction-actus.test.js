// Traduction FR/EN des actus par le job, et masquage à l'écran des actus pas
// encore traduites — demande de YORO du 19/11/2026 : « des traductions
// automatiques générales selon les langues choisies (FR / ENG). Masquer les
// actus non traduites. »
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { HTML, tranche, bac } = require('./_bac.js');
const { traduireActus, paquets } = require('../lib/traduction-actus.js');

// ── Côté job ────────────────────────────────────────────────────────────
// Faux Google « gtx » : traduit ligne par ligne en préfixant la cible.
function fauxGoogle(journal, opts) {
  const o = opts || {};
  return async (url) => {
    const u = new URL(url);
    if (u.hostname !== 'translate.googleapis.com') return { ok: false };
    const q = u.searchParams.get('q');
    const tl = u.searchParams.get('tl');
    journal.push({ sl: u.searchParams.get('sl'), tl, lignes: q.split('\n').length });
    let lignes = q.split('\n').map((l) => '[' + tl + '] ' + l);
    if (o.fusionner && lignes.length > 1) lignes = [lignes.join(' ')]; // Google a recollé deux lignes
    return { ok: true, json: async () => [lignes.map((l, i) => [l + (i < lignes.length - 1 ? '\n' : ''), 'x'])] };
  };
}
const art = (id, title, analysis, level) => ({ id, title, analysis, level: level || 'mod' });

test('chaque actu reçoit sa traduction dans l\'autre langue, par paquets de même langue', async () => {
  const journal = [];
  const arts = [
    art('a', 'Attaque armée contre un convoi dans le nord du Mali', 'Trois soldats ont été tués hier.'),
    art('b', 'Gunmen kill three soldiers in northern Nigeria', 'The army said the attack happened at dawn.'),
    art('c', 'Ataque armado mata doze pessoas em Cabo Delgado', null, 'crit'),
  ];
  const langues = new Map([
    [arts[0].title, 'fr'], [arts[0].analysis, 'fr'],
    [arts[1].title, 'en'], [arts[1].analysis, 'en'],
    [arts[2].title, 'pt'],
  ]);
  const st = await traduireActus(arts, { langues, fetchFn: fauxGoogle(journal), pauseMs: 0 });
  assert.strictEqual(arts[0].tr.en.t, '[en] ' + arts[0].title);
  assert.strictEqual(arts[0].tr.en.s, '[en] ' + arts[0].analysis);
  assert.strictEqual(arts[0].tr.fr, undefined, 'pas de « traduction » vers la langue d\'origine');
  assert.strictEqual(arts[1].tr.fr.t, '[fr] ' + arts[1].title);
  assert.strictEqual(arts[2].tr.fr.t, '[fr] ' + arts[2].title, 'portugais : vers le français');
  assert.strictEqual(arts[2].tr.en.t, '[en] ' + arts[2].title, 'et vers l\'anglais');
  assert.strictEqual(st.traduits, 6);
  assert.ok(journal.every((j) => j.sl !== 'auto'), 'la langue source est donnée au service');
  assert.ok(journal.length < 6, 'les textes partent par paquets, pas un par un');
});

test('une traduction déjà faite au passage précédent est reprise sans requête', async () => {
  const journal = [];
  const titre = 'Attaque armée contre un convoi dans le nord du Mali';
  const existants = [{ id: 'a', title: titre, tr: { en: { t: 'Armed attack on a convoy in northern Mali' } } }];
  const arts = [art('a', titre)];
  const st = await traduireActus(arts, { existants, langues: new Map([[titre, 'fr']]), fetchFn: fauxGoogle(journal), pauseMs: 0 });
  assert.strictEqual(arts[0].tr.en.t, 'Armed attack on a convoy in northern Mali');
  assert.strictEqual(st.repris, 1);
  assert.strictEqual(journal.length, 0);
});

test('un paquet dont les lignes reviennent recollées est rejoué titre par titre, jamais décalé', async () => {
  const journal = [];
  const arts = [art('a', 'Premier titre assez long pour compter ici'), art('b', 'Second titre assez long pour compter là')];
  const langues = new Map(arts.map((a) => [a.title, 'fr']));
  let n = 0;
  const base = fauxGoogle(journal);
  const fetchFn = async (url) => (n++ === 0 ? fauxGoogle(journal, { fusionner: true })(url) : base(url));
  await traduireActus(arts, { langues, fetchFn, pauseMs: 0 });
  assert.strictEqual(arts[0].tr.en.t, '[en] ' + arts[0].title);
  assert.strictEqual(arts[1].tr.en.t, '[en] ' + arts[1].title);
});

test('budget épuisé : rien n\'est envoyé, tout est reporté, et la publication n\'attend pas', async () => {
  const journal = [];
  const arts = [art('a', 'Un titre français assez long pour être détecté')];
  const st = await traduireActus(arts, { langues: new Map([[arts[0].title, 'fr']]), fetchFn: fauxGoogle(journal), echeance: Date.now() - 1, pauseMs: 0 });
  assert.strictEqual(journal.length, 0);
  assert.strictEqual(st.reportes, 1);
  assert.strictEqual(arts[0].tr, undefined);
});

test('langue inconnue ou texte court : rien à traduire, la page l\'affiche tel quel', async () => {
  const journal = [];
  const arts = [art('a', 'Gao'), art('b', 'Umuseke amakuru y\'uyu munsi mu Rwanda', 'Inkuru ndende cyane')];
  const langues = new Map([['Gao', null], [arts[1].title, 'other'], [arts[1].analysis, 'other']]);
  await traduireActus(arts, { langues, fetchFn: fauxGoogle(journal), pauseMs: 0 });
  assert.strictEqual(arts[0].tr, undefined);
  assert.ok(arts[1].tr.fr.t && arts[1].tr.en.t, 'langue locale : le titre part en détection automatique');
  assert.strictEqual(arts[1].tr.fr.s, undefined, 'mais pas le chapô');
  assert.ok(journal.every((j) => j.sl === 'auto'));
});

test('les titres critiques passent avant les chapôs et les faits moins graves', () => {
  const lots = paquets([
    { source: 'fr', cible: 'en', envoye: 'x'.repeat(10), rang: 12 },
    { source: 'en', cible: 'fr', envoye: 'y'.repeat(10), rang: 0 },
  ]).sort((p, q) => p[0].rang - q[0].rang);
  assert.strictEqual(lots[0][0].rang, 0);
});

test('le job traduit avant d\'écrire le cache, sans jamais bloquer la publication', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'collecte-planifiee.js'), 'utf8');
  const iTrad = src.indexOf('await traduireActus(fusionnes');
  const iEcrit = src.indexOf('cacheFirestore.ecrireCache(compteFirebase, fusionnes');
  assert.ok(iTrad > 0 && iEcrit > iTrad, 'la traduction précède l\'écriture du cache');
  assert.match(src.slice(iTrad - 2500, iTrad), /try \{/);
  assert.match(src, /Traduction des actus non faite/);
});

// ── Côté page ───────────────────────────────────────────────────────────
function monte(lang) {
  const c = bac();
  Object.assign(c, {
    LANG: lang, TR_CACHE: {}, setTimeout, EXTRAIT_MAX_CARACTERES: 300,
    _trTexteAffichable: (t) => t, _trTexteTraduisible: (t) => t, _trDecodeEntities: (t) => t,
    redessins: 0, redessinerVuesOuvertes() { c.redessins++; },
    TR_AGENT_PROVIDERS: [async () => { throw new Error('hors ligne'); }],
    estActuModule: () => true,
  });
  vm.runInContext(tranche('const AR_RANGE', '// _trTexteAffichable(texte)'), c);
  vm.runInContext(tranche('const SOC_STOPWORDS', '// ── Sentiment'), c);
  vm.runInContext(tranche('// ── Une seule langue a l\'ecran', '// retraduireActu(id)'), c);
  vm.runInContext(tranche('async function trFetch(', '// ── TRADUCTION DES RAPPORTS'), c);
  vm.runInContext(tranche('const TR_CONCURRENCE_MAX', '// traduireAvantPartage(texte)'), c);
  vm.runInContext(tranche('function L(texte) {', '// ── PAYS = CLÉ'), c);
  return c;
}
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const FR = 'Attaque armée contre un convoi militaire dans le nord du Mali';
const EN = 'Gunmen killed three soldiers after the attack on the convoy';

test('la tranche de la page contient bien les fonctions visées', () => {
  const t = tranche('// ── Une seule langue a l\'ecran', '// retraduireActu(id)');
  assert.match(t, /function semerTraductionsArticles\(/);
  assert.match(t, /function actuLisible\(/);
});

test('à l\'écran, une actu pas dans la langue choisie et pas traduite est masquée', async () => {
  const en = monte('en');
  assert.strictEqual(en.actuLisible({ title: FR }), false, 'titre français en anglais, sans traduction : masqué');
  assert.strictEqual(en.actuLisible({ title: EN }), true, 'déjà en anglais : visible');
  await attendre(400);
  assert.strictEqual(en.actuLisible({ title: FR }), false, 'traduction échouée : reste masqué');
  assert.strictEqual(en.redessins, 1, 'la traduction a été tentée en arrière-plan');
  assert.strictEqual(en.nbActusMasqueesLangue([{ title: FR }, { title: EN }]), 1);
  const fr = monte('fr');
  assert.strictEqual(fr.actuLisible({ title: EN }), false);
  assert.strictEqual(fr.actuLisible({ title: FR }), true);
});

test('la traduction du job (a.tr) rend l\'actu visible et lisible, dans les deux langues', () => {
  const a = { title: FR, analysis: 'Trois soldats ont été tués hier soir par des hommes armés.',
    tr: { en: { t: 'Armed attack on a military convoy in northern Mali', s: 'Three soldiers were killed last night by gunmen.' } } };
  const en = monte('en');
  en.semerTraductionsArticles([a]);
  assert.strictEqual(en.actuLisible(a), true);
  assert.strictEqual(en.L(a.title), 'Armed attack on a military convoy in northern Mali');
  assert.strictEqual(en.L(a.analysis), 'Three soldiers were killed last night by gunmen.');
  const b = { title: EN, tr: { fr: { t: 'Des hommes armés ont tué trois soldats après l\'attaque du convoi' } } };
  const fr = monte('fr');
  fr.semerTraductionsArticles([b]);
  assert.strictEqual(fr.actuLisible(b), true);
  assert.strictEqual(fr.L(b.title), 'Des hommes armés ont tué trois soldats après l\'attaque du convoi');
});

test('rehydrateArticles sème les traductions du cache partagé', () => {
  assert.match(tranche('function rehydrateArticles(arts, opts) {', 'const _sig = signatureCode();'), /semerTraductionsArticles\(arts\)/);
});

test('comptes et niveau d\'alerte ne dépendent pas de la langue ; les listes, si', () => {
  assert.match(tranche('function actusModules(arts) {', '}'), /filter\(estActuModule\)/, 'les comptes restent indépendants de la langue');
  const live = tranche('function getLiveAlertEvents(', '\nfunction ');
  assert.doesNotMatch(live, /actuLisible|actusAffichables/, 'le niveau d\'alerte ne dépend pas de la langue');
  assert.match(tranche('function getFiltered() {', 'return a;'), /actusAffichables\(actusModules\(ALL\)\)/);
  assert.match(HTML, /const _nbMasquees = Math\.max\(0, getFiltered\(true\)\.length - artsTous\.length\)/, 'le Flux dit combien d\'actus attendent');
});

// 19/11/2026, YORO : « Tout type de rapport sera soit en FR soit en ENG selon
// le choix de langue. »
test('un document ne contient que des actus lisibles dans sa langue, et dit combien il en écarte', async () => {
  const en = monte('en');
  vm.runInContext(tranche('function getExportData(){', 'function lvlFr(l){'), en);
  en.ALL = [
    { title: FR, level: 'crit', cy: 'ML' },
    { title: EN, level: 'high', cy: 'NG' },
    { title: 'Des hommes armés ont incendié le marché central de la ville hier soir', level: 'mod', cy: 'BF',
      tr: { en: { t: 'Gunmen set fire to the central market of the town last night' } } },
  ];
  en.filtreZonePaysActif = () => true;
  en.semerTraductionsArticles(en.ALL);
  assert.strictEqual(en.getExportData().length, 3, 'hors document, rien n\'est écarté');
  const doc = en.enDocument(async () => en.getExportData());
  const arts = await doc();
  assert.strictEqual(arts.map(a => a.cy).join(','), 'NG,BF', 'le titre français sans traduction est écarté');
  assert.match(en.noteTraductionRapport(), /^Note: 1 news item\(s\) not included, including 1 critical/);
  assert.doesNotMatch(en.noteTraductionRapport(), /\(EN\)|\(FR\)/);
});
