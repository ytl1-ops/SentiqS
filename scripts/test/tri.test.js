// Le tri : ce qui ouvre la file « a traiter » d'un responsable surete.
//
// Mesure du 03/09/2026 sur le cache de production (262 articles) : vingt
// depassaient le niveau normal, trois interessaient un professionnel. Les
// dix-sept autres tenaient a un mot isole du corps de l'article, a un format
// editorial (journal televise, chronique, communique), ou a une condamnation
// pour un fait ancien. Et dans l'autre sens, « Troops rescue 30 kidnap
// victims » restait au niveau normal : les lexiques etaient francais, 62 des
// 262 titres etaient en anglais.
//
// Chaque cas ci-dessous est un titre reel de ce cache. Le banc de mesure
// scripts/banc-tri.js rejoue l'ensemble ; ces tests figent les cas nommes.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { HTML, tranche, bac, exposer, noyau } = require('./_bac.js');

const contexte = exposer(
  bac(tranche('const CK_CRIT', '//  FIABILITÉ & ANTI-HALLUCINATION')),
  'classify', 'estFormatEditorial', 'estSuiteJudiciaire', 'motsTouches'
);
const { classify } = contexte;
const src = (cy) => ({ cy, cat: 'securite' });

// Le corps est passe apres le titre, comme a la collecte : classify(titre + ' ' + corps, src, titre).
const cl = (titre, corps, cy) => classify(titre + ' ' + (corps || ''), src(cy || 'SN'), titre);

// ── Le titre decide, le corps nuance ─────────────────────────────────────

test('un mot de securite isole dans le corps ne fait plus un niveau eleve', () => {
  // Cas reels : « violence » dans l'appel a l'unite d'un chef coutumier, dans
  // l'annonce d'une journee de priere nationale.
  assert.strictEqual(cl("Nalolo leaders commend President's call for unity",
    'Traditional leaders in Nalolo have commended the President for calling for unity and an end to violence.', 'ZM').lvl, 'mod');
  assert.strictEqual(cl('Namibia to pause for National Prayer Day',
    'The nation will pray against gender-based violence and for peace.', 'NA').lvl, 'mod');
});

test('le meme mot dans le TITRE fait le niveau', () => {
  assert.strictEqual(cl('Violence intercommunautaire dans le centre', '', 'ML').lvl, 'high');
  assert.strictEqual(cl('Attaque contre un convoi militaire', '', 'ML').lvl, 'crit');
});

test('un corps qui aligne plusieurs mots decrit un vrai incident', () => {
  // Titre vague, corps explicite : deux familles de mots critiques suffisent.
  assert.strictEqual(cl('Situation tendue dans la region', 'Une attaque a fait plusieurs morts parmi les villageois.', 'BF').lvl, 'crit');
  // Une seule famille, meme repetee, reste un mot isole.
  assert.strictEqual(cl('Situation tendue dans la region', 'Les attaques, attaque apres attaque, sont evoquees.', 'BF').lvl, 'mod');
});

test('pour un pays a risque, le lien securite doit etre dans le titre pour valoir eleve', () => {
  // « BANQUE — La BMOI securise les paiements » a Madagascar : « securite »
  // n'apparaissait que dans le corps. Elevé avant, modere maintenant.
  assert.strictEqual(cl('BANQUE - La BMOI sécurise les paiements',
    'La banque renforce la securite de ses paiements en ligne.', 'MG').lvl, 'mod');
  // Le meme lien dans le titre : eleve, comme avant.
  assert.strictEqual(cl('Gao : la Police intensifie la lutte contre la criminalité', '', 'ML').lvl, 'high');
  assert.strictEqual(cl('Coup dur pour les terroristes : les FAMa neutralisent un site logistique', '', 'ML').lvl, 'high');
});

test('sans le titre en troisieme argument, le comportement d\'avant est conserve', () => {
  // Anciens appels et anciens tests : tout le texte est traite comme titre.
  assert.strictEqual(classify('Reunion de quartier. Une attaque est evoquee.', src('SN')).lvl, 'crit');
});

// ── Formats editoriaux ───────────────────────────────────────────────────

test('un journal televise, une chronique, un communique du conseil ne sont pas des incidents', () => {
  assert.strictEqual(cl('Journal Télévisé du 02 Septembre 2026',
    'Au sommaire : securite dans le nord, attaque deplorée, economie.', 'ML').lvl, 'ok');
  assert.strictEqual(cl('Les chroniques de Ragidro – Qui a dit pays ruiné ?',
    'Une attaque en regle contre la politique budgetaire.', 'MG').lvl, 'ok');
  assert.strictEqual(cl('Communiqué du conseil des ministres du mercredi 02 septembre 2026',
    'Le conseil a examine la situation securitaire et adopte des mesures.', 'ML').lvl, 'ok');
});

test('le format editorial ne vaut qu\'en tete de titre', () => {
  // « Chronique d'une attaque » au milieu d'un titre est une figure de style,
  // pas une rubrique : le mot critique du titre garde la main.
  assert.strictEqual(cl('Tombouctou, chronique d\'une attaque annoncée', '', 'ML').lvl, 'crit');
});

// ── Suites judiciaires ───────────────────────────────────────────────────

test('une condamnation pour un fait ancien plafonne au niveau modere', () => {
  assert.strictEqual(cl('Condamné aux travaux forcés : au boulot sur le canal Andriantany !',
    'Reconnu coupable du meurtre de son voisin en 2024.', 'MG').lvl, 'mod');
  // Le mot critique dans le titre lui-meme : sans le plafond, ce serait
  // critique. C'est ce cas qui prouve que le plafond agit.
  assert.strictEqual(cl('Condamné à perpétuité pour le meurtre de son voisin', '', 'MG').lvl, 'mod');
  // Le meurtre lui-meme, dans le titre, reste critique.
  assert.strictEqual(cl('Meurtre d\'un commerçant à Kaolack', '', 'SN').lvl, 'crit');
});

// ── Lexique anglais ──────────────────────────────────────────────────────

test('les incidents rapportes en anglais montent enfin', () => {
  assert.strictEqual(cl('Troops neutralise terrorists, rescue 30 kidnap victims in nationwide operations', '', 'NG').lvl, 'crit');
  assert.strictEqual(cl('Six hours of terror: Harrowing abduction ordeal for Standard Group editor', '', 'KE').lvl, 'crit');
  assert.strictEqual(cl('ECG customers in Ketu South protest alleged overbilling', '', 'GH').lvl, 'high');
});

test('« threat » n\'est pas dans le lexique : la rhetorique electorale n\'est pas une menace', () => {
  // « Flogging threat may turn voters against APC » : politique, pas surete.
  assert.strictEqual(cl('2027: Flogging threat may turn voters against APC — PDP', '', 'NG').lvl, 'ok');
});

test('le sport en anglais reste hors surete, meme avec « kidnap »', () => {
  const r = cl('18-yr-old arrested over alleged plot to kidnap Kylian Mbappe', '', 'INT');
  assert.strictEqual(r.cat, 'sport');
  assert.strictEqual(r.lvl, 'ok');
});

// ── Doublons ─────────────────────────────────────────────────────────────

test('deux titres identiques dans le meme pays sont un doublon, meme courts', () => {
  // « Putin toasts HH victory » : trois mots significatifs, sous le plancher
  // de quatre — il restait en double dans le cache publie.
  assert.ok(noyau.articlesSontDoublons({ title: 'Putin toasts HH victory' }, { title: 'Putin toasts HH victory' }));
  assert.ok(noyau.articlesSontDoublons({ title: 'Chiengi couple burnt to death' }, { title: 'Chiengi Couple Burnt To Death' }));
  // Deux faits distincts au vocabulaire proche ne fusionnent pas.
  assert.ok(!noyau.articlesSontDoublons({ title: 'Attaque à Gao' }, { title: 'Attaque à Tombouctou' }));
});

test('la collecte progressive dedoublonne, pas seulement la fin de collecte', () => {
  // Le job planifie s'arrete a 8 min et publie ALL tel quel : sans cette
  // fusion, le cache publie porte des doublons (cinq paires le 03/09/2026).
  const f = tranche('if (done % 20 === 0 || done === total) {', 'if (typeof recalcAlertes');
  assert.match(f, /ALL = dedupliquerArticles\(partial\)/);
});

test('aucune entree du registre ne lit un flux deja lu par une autre', () => {
  const S = exposer(bac(tranche('const SRCS=[', '\n];') + '\n];'), 'SRCS').SRCS;
  const vus = new Map();
  for (const s of S) {
    if (!s.rss) continue;
    assert.ok(!vus.has(s.rss), s.id + ' lit le meme flux que ' + vus.get(s.rss) + ' : ' + s.rss);
    vus.set(s.rss, s.id);
  }
});

// ── « Verifie » veut dire recoupe ────────────────────────────────────────

test('un article fraichement collecte n\'est jamais « verifie » sur la seule note de sa source', () => {
  // Deux points de creation d'article (parseRSS, parseJSON) : les deux.
  assert.match(HTML, /verified: false, fiable: src\.score >= 80/);
  assert.match(HTML, /verified:false, fiable:src\.score>=80/);
  assert.doesNotMatch(HTML, /verified: ?src\.score ?>= ?80/);
});

test('seule la fusion avec une seconde source pose « verifie »', () => {
  const f = tranche('function dedupliquerArticles', 'function attachConfidenceScores');
  assert.match(f, /garde\.verified = true/);
});

test('l\'interface ne promet plus des actualites « verifiees »', () => {
  assert.doesNotMatch(HTML, /note_flux:'Flux opérationnel : actualités vérifiées/);
  assert.match(HTML, /id="stVer">0<\/div><div class="sl">Recoupes<\/div>/);
});
