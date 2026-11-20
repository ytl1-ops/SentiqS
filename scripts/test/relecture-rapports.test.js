// Relecture des documents du 14/11/2026 (« les rendus doivent être agencés
// comme après un traitement de texte par un expert ; vérifie également les
// autres types de rapport »). Exports de l'appli et bulletin quotidien : ce
// que la lecture des documents générés a trouvé et que ces tests gardent.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { HTML, tranche, bac } = require('./_bac.js');
const B = require('../lib/bulletin.js');

function monte(lang) {
  const c = bac();
  Object.assign(c, {
    LANG: lang, TR_CACHE: {}, setTimeout, EXTRAIT_MAX_CARACTERES: 300,
    _trTexteAffichable: (t) => t, _trTexteTraduisible: (t) => t, _trDecodeEntities: (t) => t,
    redessinerVuesOuvertes() {},
    TR_AGENT_PROVIDERS: [async () => { throw new Error('hors ligne'); }],
  });
  vm.runInContext(tranche('const AR_RANGE', '// _trTexteAffichable(texte)'), c);
  vm.runInContext(tranche('const SOC_STOPWORDS', '// ── Sentiment'), c);
  vm.runInContext(tranche('// ── Une seule langue a l\'ecran', '// retraduireActu(id)'), c);
  vm.runInContext(tranche('async function trFetch(', '// ── TRADUCTION DES RAPPORTS'), c);
  vm.runInContext(tranche('const TR_CONCURRENCE_MAX', '// traduireAvantPartage(texte)'), c);
  vm.runInContext(tranche('function L(texte) {', '// ── PAYS = CLÉ'), c);
  return c;
}
const ANGLAIS = 'Gunmen killed three soldiers after the attack on the convoy';
const ARABE = 'هجوم مسلح على قافلة عسكرية في شمال مالي';

// 19/11/2026 (YORO : « tout type de rapport sera soit en FR soit en ENG ») :
// plus jamais le texte d'une autre langue dans un document, ni « (EN) … ».
test('dans un document, un texte non traduit n\'est jamais imprimé dans sa langue, ni « Traduction en cours… »', () => {
  const c = monte('fr');
  c.TR_CACHE['fr:' + ANGLAIS] = ANGLAIS; // traduction échouée
  vm.runInContext('_docEnCours++', c);
  assert.strictEqual(c.L(ANGLAIS), 'Texte en anglais — non traduit, voir la source');
  assert.strictEqual(c.L(ANGLAIS, true), '', 'un texte secondaire non traduit est omis');
  assert.strictEqual(c.L(ARABE), 'Texte en arabe — non traduit, voir la source');
  vm.runInContext('_docEnCours--', c);
  // L'écran ne change pas : une seule langue, ou la mention.
  assert.strictEqual(c.L(ANGLAIS), 'Texte en anglais — traduction indisponible pour le moment');
});

test('tous les points d\'entrée d\'un document se construisent en contexte document', () => {
  for (const f of ['exportWord', 'exportPDF', 'exportPPTX', 'exportExcel', 'exportCSV', 'apercuRapport', 'apercuSynthese', 'genererImageRapportBlob', '_envoyerRapportCanalInterne']) {
    assert.match(HTML, new RegExp('\\n' + f + ' = enDocument\\(' + f + '\\);'), f);
  }
});

test('un pays sans niveau encore connu est calculé, jamais imprimé « vert » par défaut', () => {
  const c = bac();
  Object.assign(c, { LAST_NIV_PAR_PAYS: {}, PAYS_INFO: { SD: {} }, NIV: { vert: { label: 'VERT' }, rouge: { label: 'ROUGE' } }, calcAlertScore: () => ({ key: 'rouge' }) });
  vm.runInContext(tranche('function niveauAlertePays(cy) {', '// _cyNivTexteEtCouleur(cy)'), c);
  assert.strictEqual(c.niveauAlertePays('SD').label, 'ROUGE');
  assert.strictEqual(c.LAST_NIV_PAR_PAYS.SD, 'rouge');
});

test('bulletin : ni « dont 0 recoupé », ni date de revue au format machine, ni titre seul en bas de page', () => {
  const d = { cy: 'CI', nom: "Côte d'Ivoire", niveau: 'jaune', libelle: 'JAUNE', sous: 'Modéré', fenetreH: 36, faitsNotables: 4,
    faits: [{ cotation: { cle: 'probable' } }] };
  const p = B.phraseEnBref(d, null);
  assert.doesNotMatch(p, /dont 0/);
  assert.match(p, /aucun recoupé par une seconde source/);
  assert.match(B.phraseEnBref(Object.assign({}, d, { faits: [{ cotation: { cle: 'confirme' } }, { cotation: { cle: 'confirme' } }] }), null), /dont 2 recoupés/);
  assert.strictEqual(B.moisRevu('2026-10'), 'octobre 2026');
  const html = B.rendre(Object.assign(d, {
    total100: 22, confiance: { cle: 'faible', libelle: 'faible', motif: 'x' }, motifPlafond: null, articlesDuJour: 0,
    faits: [], faitsNotables: 0, socle: [], facteurs: [{ label: 'Pression nord', bonus: 1, revu: '2026-10' }],
    angleMort: { muet: false, horsAlerte: false, sourceUnique: false, socleAncien: false, sourcesAlerte: 5 },
  }), { jour: '2026-11-14', genereMs: Date.now() });
  assert.match(html, /revu en octobre 2026/);
  assert.match(html, /@media print\{[^}]*\}?[^@]*h2\{break-after:avoid\}/);
});
