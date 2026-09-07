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
  assert.match(HTML, /id="stVer">0<\/div><div class="sl"[^>]*>Recoupes<\/div>/);
});

// ── Le cache publie suit la page qui le sert ─────────────────────────────

test('le cache partage est recalcule et dedoublonne avant d\'etre ecrit', () => {
  // publierCollectePartagee() fusionne le cache precedent avec la collecte du
  // jour. Sans recalcul, un article herite garde le verdict de la version qui
  // l'a collecte : le 03/09/2026, un enlevement au Kenya restait « normal »
  // dans le cache publie une heure apres la refonte du tri.
  const f = tranche('async function publierCollectePartagee', 'async function diagnostiquerCachePartage');
  const iRehydrate = f.indexOf('rehydrateArticles(fusionnes)');
  const iDedup = f.indexOf('fusionnes = dedupliquerArticles(fusionnes)');
  const iUpsert = f.indexOf(".upsert({");
  assert.ok(iRehydrate !== -1, 'le cache fusionne doit etre recalcule');
  assert.ok(iDedup !== -1, 'le cache fusionne doit etre dedoublonne');
  assert.ok(iRehydrate < iUpsert && iDedup < iUpsert, 'recalcul et fusion doivent preceder l\'ecriture');
});

test('a la rehydratation, « verifie » se rederive du nombre de sources', () => {
  const f = tranche('function rehydrateArticles', 'function _decodeEntitesHTML');
  assert.match(f, /a\.verified = distinctes\.size >= 2/);
  assert.match(f, /a\.fiable = /);
});

// ── Accidents et non-événements ──────────────────────────────────────────

test('un accident de la route ne peut plus atteindre le niveau critique', () => {
  // Mesure du 06/09/2026 sur le cache publié : cinq des vingt-cinq articles
  // au-dessus du normal étaient des accidents de la route, au même rang
  // qu'une attaque armée. Arbitrage de l'éditeur du produit : l'accident
  // reste très visible — un autocar à vingt-cinq morts doit se voir — mais
  // plafonne à ÉLEVÉ.
  assert.strictEqual(cl('Tragedy In Cabo Verde As Bus Crash Kills 25, Mostly Young People', '', 'CV').lvl, 'high');
  assert.strictEqual(cl('Cap-Vert : au moins 25 personnes tuées dans un accident de bus', '', 'CV').lvl, 'high');
  assert.strictEqual(cl('Law student killed in hit-and-run on Tema Motorway', '', 'GH').lvl, 'high');
});

test('un bilan routier périodique redescend au niveau modéré', () => {
  // « Trois morts sur les routes en moins de 24 heures » n'est pas un
  // événement : c'est une statistique. Elle ouvrait la file d'alerte.
  assert.strictEqual(cl('Trois morts sur les routes en moins de 24 heures', '', 'MU').lvl, 'mod');
  assert.strictEqual(cl('Accident à Canot : un mort et deux blessés graves, le bilan routier grimpe à 105', '', 'MU').lvl, 'mod');
});

test('une attaque contre un véhicule reste une attaque', () => {
  // La garde qui donne son sens au plafond. Chaque titre ci-dessous porte À
  // LA FOIS le vocabulaire de l'accident ET celui de l'agression : sans la
  // garde, le plafond les rangerait avec les carambolages.
  //
  // Premier jet de ce test : « Attaque contre un bus de passagers par des
  // hommes armés ». Il passait sur la version SANS garde — le titre ne
  // contenait aucun mot du motif accident, la garde n'était jamais
  // exercée. Un test qui n'échoue pas sur la panne qu'il prétend couvrir
  // ne vaut rien.
  assert.strictEqual(cl('Gunmen open fire causing bus crash on Kaduna road', '', 'NG').lvl, 'crit');
  assert.strictEqual(cl('Attentat : un véhicule piégé provoque une collision meurtrière', '', 'ML').lvl, 'crit');
  assert.strictEqual(cl('Accident ou attentat ? Un camion fonce sur la foule à Bamako', '', 'ML').lvl, 'crit');
});

test('une commémoration et un avis de police ne sont pas des incidents', () => {
  // Deux titres réels du cache du 06/09/2026, tous deux en CRITIQUE :
  // une cérémonie du souvenir et un rappel réglementaire sur les drones.
  assert.strictEqual(cl('12 police officers killed in line of duty to be remembered', '', 'ZA').lvl, 'mod');
  assert.strictEqual(cl('Plateau Police warn against illegal drone operations', '', 'NG').lvl, 'mod');
  // L'incident lui-même, lui, reste critique.
  assert.strictEqual(cl('Twelve police officers killed in ambush', '', 'ZA').lvl, 'crit');
});

test('les flux réparés le 06/09/2026 ne repointent pas vers leur adresse morte', () => {
  // Recensement du 06/09/2026 : sur les 110 sources natives capables
  // d'alerter, trente ne répondaient plus — douze en 404 (adresse du flux
  // périmée) et treize en 403 (le site refuse notre robot).
  //
  // Huit des douze ont été réparées avec scripts/lib/decouverte-source.js.
  // Trois d'entre elles couvrent des pays alors absents du cache :
  //   Le Faso (Burkina)     66 articles, dernier il y a 1 h
  //   Hiiraan (Somalie)     20 articles, dernier il y a 1 h
  //   The Citizen (Tanzanie) 40 articles, dernier il y a 5 h
  //
  // Ce test ne vérifie pas que les nouvelles adresses répondent — cela
  // demande le réseau, et c'est le rôle de verifier-decouverte-flux.js. Il
  // interdit seulement de revenir aux adresses dont on a MESURÉ qu'elles
  // renvoient 404.
  const MORTES = [
    'https://lefaso.net/rss.php',
    'https://www.pressafrik.com/feed/',
    'https://www.hiiraan.com/rss/news_fr.xml',
    'https://www.dakaractu.com/rss.xml',
    'https://www.thecitizen.co.tz/rss"',
    'rdf/saotomeprincipe/headlines.rdf',
    'rdf/swaziland/headlines.rdf',
  ];
  const trouvees = MORTES.filter((u) => HTML.includes(u));
  assert.deepStrictEqual(trouvees, [], 'adresses mesurées mortes, revenues dans le registre : ' + trouvees.join(', '));
});

test('la methode declaree correspond a l adresse reelle du flux', () => {
  // Invariant introduit apres la reparation du 07/09/2026 : STP-Press etait
  // interrogee par une requete Google News alors que l'agence publie un flux
  // natif. Corriger l'adresse SANS corriger rss_method laisserait le registre
  // mentir sur ce qu'il interroge — et rss_method sert a lire le registre,
  // a compter les proxys, et a decider comment traiter la reponse.
  const SRCS = exposer(bac(tranche('const SRCS=[', '\n];') + '\n];'), 'SRCS').SRCS;
  const menteurs = [];
  for (const s of SRCS) {
    // L'hote est lu par URL, pas par expression : un premier jet cherchait
    // « (^|.)news.google.com/ » et ne reconnaissait aucune des 318 requetes
    // Google News du registre, faute du « // » qui les precede.
    let hote = '';
    try { hote = new URL(s.rss || '').hostname.toLowerCase(); } catch (_) { hote = ''; }
    const estGoogle = hote === 'news.google.com';
    const ditGoogle = /google news/i.test(s.rss_method || '');
    if (estGoogle !== ditGoogle) {
      menteurs.push(s.id + ' : rss=' + (estGoogle ? 'Google News' : 'natif')
        + ' mais rss_method=' + (s.rss_method || '(absent)'));
    }
  }
  assert.deepStrictEqual(menteurs, [], 'sources dont la methode ne correspond pas au flux :\n  ' + menteurs.join('\n  '));
});
