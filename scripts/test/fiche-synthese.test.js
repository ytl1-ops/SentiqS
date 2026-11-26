// Fiche de synthèse d'une actu et main courante de l'analyste — 26/11/2026.
//
// Deux éléments repris du prototype SentiqS 2 (dépôt ytl1-ops/SentiqS-2), à la
// demande de YORO. Ces tests exercent le vrai code de la page, extrait du
// fichier de production, et le vrai module de repères partagé avec la
// Présentation 1.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { HTML, tranche, bac } = require('./_bac.js');
const R = require('../../web/js/reperes-surete.js');
const redaction = require('../lib/redaction-grsci.js');

const FICHE = tranche('// FICHE DE SYNTHÈSE D\'UNE ACTU', 'function detailRapportActu(a) {');
const MC = tranche('//  MAIN COURANTE DE L\'ANALYSTE', '// FIN MAIN COURANTE');

test('les tranches contiennent bien le code visé (piège récurrent de tranche())', () => {
  for (const nom of ['function ficheSynthese', 'function ficheSyntheseHtml', 'async function copierFicheSynthese']) assert.ok(FICHE.includes(nom), nom);
  for (const nom of ['function entreeMainCourante', 'async function enregistrerMainCourante', 'async function listerMainCourante']) assert.ok(MC.includes(nom), nom);
});

function bacFiche(lang, voir) {
  const ctx = bac(FICHE);
  Object.assign(ctx, {
    LANG: lang, SentiqReperes: R,
    NIV: { jaune: { label: 'Jaune' } },
    rl: () => ({ jaune: 'Yellow' }),
    niveauAlertePays: () => ctx.NIV.jaune,
    lignePaysArticle: () => ({ nom: lang === 'en' ? 'Ivory Coast' : 'Côte d\'Ivoire', ville: 'Kong' }),
    fmtSurvenance: () => ({ texte: 'hier', inconnue: false }),
    cotationActu: () => ({ cle: 'probable', libelle: 'Probable' }),
    libelleCotationR: (c) => c.libelle,
    libelleNiveauPartage: (l) => ({ high: lang === 'en' ? 'HIGH' : 'ÉLEVÉ' })[l],
    sourcesVisibles: () => voir, srcName: () => 'AIP',
    articleLienDirect: () => 'https://exemple.ci/article',
    L: (t) => t, escHtml: (t) => String(t).replace(/</g, '&lt;'),
    estAdmin: () => false, getSession: () => null, _clientValidation: () => null,
  });
  return ctx;
}
const ACTU = { id: 'a1', cy: 'CI', level: 'high', cat: 'securite', primary: 'aip', srcs: ['aip'],
  title: 'Des hommes armés attaquent un poste de gendarmerie près de Kong', analysis: 'Deux gendarmes blessés.' };

test('la fiche suit le format repris de SentiqS 2, dans l\'ordre', () => {
  const f = bacFiche('fr', true).ficheSynthese(ACTU);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(f.lignes.map((l) => l[0]))), ['Pays', 'Lieu de survenance', 'Date de survenance', 'Niveau du fait', 'Fait',
    'Source et fiabilité', 'Impact sur la sûreté pays', 'À surveiller']);
  const val = Object.fromEntries(f.lignes);
  assert.strictEqual(val['Pays'], 'Côte d\'Ivoire (niveau pays : Jaune)');
  assert.strictEqual(val['Lieu de survenance'], 'Kong');
  assert.strictEqual(val['Source et fiabilité'], 'Probable · source unique — AIP');
});

test('impact et « à surveiller » sont le texte de la Présentation 1, pas une copie', () => {
  const f = Object.fromEntries(bacFiche('fr', true).ficheSynthese(ACTU).lignes);
  const rep = redaction.enjeuxSurete({ titre: ACTU.title, resume: ACTU.analysis, cat: ACTU.cat });
  assert.strictEqual(rep.cle, 'attaque');
  assert.strictEqual(f['Impact sur la sûreté pays'], rep.texte);
  assert.strictEqual(f['À surveiller'].toLowerCase(), redaction.SURVEILLER.attaque.toLowerCase());
});

test('sans droit de voir les sources, la fiche ne nomme ni la source ni le lien', () => {
  const f = bacFiche('fr', false).ficheSynthese(ACTU);
  assert.strictEqual(Object.fromEntries(f.lignes)['Source et fiabilité'], 'Probable · source unique');
  assert.ok(!/AIP|exemple\.ci/.test(f.texte), f.texte);
});

test('en anglais, une seule langue : aucun repère français dans la fiche', () => {
  const f = bacFiche('en', true).ficheSynthese(ACTU);
  const val = Object.fromEntries(f.lignes);
  assert.strictEqual(val['Impact on country security'], R.IMPLICATIONS_EN.attaque);
  assert.ok(!/[éèàù]|sûreté|surveiller/i.test(f.texte.replace(ACTU.title, '')), f.texte);
});

test('chaque famille de repères a sa traduction anglaise', () => {
  for (const e of R.ENJEUX) assert.ok(R.IMPLICATIONS_EN[e.cle], 'IMPLICATIONS_EN.' + e.cle);
  assert.ok(R.IMPLICATIONS_EN[R.CONTEXTE.cle], 'IMPLICATIONS_EN.contexte');
  for (const k of Object.keys(R.ENJEU_PAR_CATEGORIE)) assert.ok(R.IMPLICATIONS_CATEGORIE_EN[k], 'IMPLICATIONS_CATEGORIE_EN.' + k);
  for (const k of Object.keys(R.SURVEILLER)) assert.ok(R.SURVEILLER_EN[k], 'SURVEILLER_EN.' + k);
});

test('la fiche est lue par le détail d\'une actu, jamais par un générateur de document ni par le niveau', () => {
  assert.ok(HTML.includes('    ficheSyntheseHtml(a)+\n'), 'fiche absente du détail');
  const appels = HTML.split('ficheSynthese').length - 1;
  // Définitions (ficheSynthese, ficheSyntheseHtml, copierFicheSynthese), appel du
  // détail, appel de la copie et appel interne du rendu : rien d'autre.
  const lignes = HTML.split('\n').filter((l) => l.includes('ficheSynthese(') || l.includes('ficheSyntheseHtml(') || l.includes('FicheSynthese('));
  assert.ok(lignes.length <= 7, lignes.join('\n'));
  for (const gen of ['function exportWord', 'function exportPDF', 'function exportPPTX', 'function exportExcel', 'function calcAlertScore', 'function getLiveAlertEvents']) {
    const i = HTML.indexOf(gen);
    assert.ok(i !== -1, gen);
    const corps = HTML.slice(i, HTML.indexOf('\nfunction ', i + gen.length));
    assert.ok(!/ficheSynthese|main_courante/.test(corps), gen + ' lit la fiche ou la main courante');
  }
  assert.ok(appels > 0);
});

test('le module de repères est chargé par la page, après le noyau', () => {
  const i = HTML.indexOf('<script src="js/noyau.js"></script>');
  const j = HTML.indexOf('<script src="js/reperes-surete.js"></script>');
  assert.ok(i !== -1 && j > i);
  assert.ok(fs.existsSync(path.join(__dirname, '..', '..', 'web', 'js', 'reperes-surete.js')));
});

// ── Main courante ───────────────────────────────────────────────────────────
const SESSION = { user: { id: 'uid-analyste', email: 'analyste@exemple.org' } };
function bacMc() { return bac(MC + '\nthis.entreeMainCourante = entreeMainCourante; this.MAX = MAIN_COURANTE_MESSAGE_MAX;'); }

test('une inscription est signée de la session, horodatée, rattachée au fait', () => {
  const ctx = bacMc();
  const e = ctx.entreeMainCourante({ message: '  Point fait avec la DSI sur Kong ', pays: 'ci', initiales: 'yt', actu: ACTU }, SESSION, Date.UTC(2026, 10, 26, 21));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(e)), {
    message: 'Point fait avec la DSI sur Kong', pays: 'CI', initiales: 'YT', fait: ACTU.title, url: '',
    par: 'analyste@exemple.org', parUid: 'uid-analyste', le: '2026-11-26T21:00:00.000Z',
  });
});

test('mêmes bornes que les règles Firestore : rien n\'est envoyé hors de ces bornes', () => {
  const ctx = bacMc();
  assert.strictEqual(ctx.entreeMainCourante({ message: 'ok' }, SESSION), null);
  assert.strictEqual(ctx.entreeMainCourante({ message: 'x'.repeat(ctx.MAX + 1) }, SESSION), null);
  assert.strictEqual(ctx.entreeMainCourante({ message: 'Note valable', pays: 'Côte' }, SESSION), null);
  assert.strictEqual(ctx.entreeMainCourante({ message: 'Note valable' }, null), null);
  assert.ok(ctx.entreeMainCourante({ message: 'Note valable', pays: '' }, SESSION));
  const regles = fs.readFileSync(path.join(__dirname, '..', '..', 'firebase', 'firestore.rules'), 'utf8');
  assert.match(regles, /d\.message\.size\(\) >= 3 && d\.message\.size\(\) <= 2000/);
  assert.strictEqual(ctx.MAX, 2000);
});

test('la main courante ne se réécrit ni ne s\'efface, et reste réservée à l\'analyste', () => {
  const regles = fs.readFileSync(path.join(__dirname, '..', '..', 'firebase', 'firestore.rules'), 'utf8');
  const i = regles.indexOf('match /main_courante/{id}');
  assert.ok(i !== -1);
  const bloc = regles.slice(i, regles.indexOf('\n    }\n', i));
  assert.match(bloc, /allow create: if estAdmin\(\)/);
  assert.match(bloc, /allow read: if estAdmin\(\);/);
  assert.match(bloc, /allow update, delete: if false;/);
});
