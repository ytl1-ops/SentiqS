// ═══════════════════════════════════════════════════════════════════════════
//  SentiqS — ASSISTANT DE VEILLE (14/11/2026)
//
//  Demande de YORO : poser une question en langage courant (« Quelle est la
//  situation en Côte d'Ivoire cette semaine ? ») et obtenir une réponse
//  sourcée, cotée, avec les liens vers les actus. Et, en propres termes :
//  « travailler uniquement la base de données générée par l'appli pour
//  éviter toute hallucination », « éviter des répétitions ou redondances
//  improductives ».
//
//  D'où le parti pris : AUCUN modèle de langage ne rédige ici. L'assistant
//  comprend la question (pays, région, période, thème, intention) avec des
//  règles écrites, puis assemble la réponse à partir des données que la page
//  lui passe — niveau calculé, faits collectés et cotés, incidents vérifiés,
//  agenda. Chaque phrase est un gabarit rempli par un chiffre ou un titre de
//  la base : il ne peut rien affirmer que la base ne contienne. Une question
//  à laquelle la base ne répond pas reçoit « je ne sais pas », jamais une
//  supposition. Coût nul, aucune clé, rien ne quitte l'appareil.
//
//  Redondances : les faits rapportés par plusieurs médias sont repliés en un
//  seul (même règle que le rapport mensuel : racines communes, moins de
//  quatre jours d'écart, et le pont entre langues du noyau), avec la liste de
//  leurs sources. Deux médias distincts sur un même fait, c'est la définition
//  du recoupement : le fait replié passe « Confirmé ». Le niveau du pays est
//  dit une fois, l'avertissement de méthode une fois, en pied de réponse.
//
//  Module pur, double export (navigateur / CommonJS) : testé sans navigateur
//  par scripts/test/assistant.test.js.
// ═══════════════════════════════════════════════════════════════════════════
(function (global) {
'use strict';

const noyau = (typeof module !== 'undefined' && module.exports) ? require('./noyau.js') : global;

function norm(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
}
function echapRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function motRe(m) { return new RegExp("(^|[^a-z0-9])" + echapRe(norm(m)) + "($|[^a-z0-9])"); }

// ── Pays et régions ─────────────────────────────────────────────────────────
// Les noms officiels viennent de la page (PAYS_INFO, PAYS_EN). Ici, les noms
// d'usage que la presse et les professionnels emploient, et les gentilés.
const ALIAS_PAYS = {
  CI: ["cote d'ivoire", 'cote d ivoire', 'cote divoire', 'ivory coast', 'ivoirien', 'ivoirienne', 'ivoiriens', 'abidjan'],
  CD: ['rdc', 'rd congo', 'congo-kinshasa', 'congo kinshasa', 'drc', 'dr congo', 'kinshasa', 'congolais de rdc'],
  CG: ['congo-brazzaville', 'congo brazzaville', 'brazzaville'],
  CF: ['rca', 'centrafrique', 'centrafricain', 'centrafricaine', 'bangui'],
  BF: ['burkina', 'burkinabe', 'ouagadougou'],
  ML: ['malien', 'malienne', 'maliens', 'bamako'],
  NE: ['nigerien', 'nigerienne', 'niamey'],
  NG: ['nigerian', 'nigeriane', 'nigerians', 'lagos', 'abuja'],
  GH: ['ghaneen', 'ghaneenne', 'ghanaian', 'accra'],
  TG: ['togolais', 'togolaise', 'lome'],
  BJ: ['beninois', 'beninoise', 'cotonou'],
  SN: ['senegalais', 'senegalaise', 'dakar'],
  CM: ['camerounais', 'camerounaise', 'cameroun', 'yaounde', 'douala'],
  GN: ['guineen', 'guineenne', 'conakry', 'guinee-conakry', 'guinee conakry'],
  GQ: ['guinee equatoriale', 'equatorial guinea', 'malabo'],
  GW: ['guinee-bissau', 'guinee bissau', 'guinea-bissau', 'bissau'],
  SS: ['soudan du sud', 'south sudan', 'juba'],
  SD: ['soudanais', 'khartoum'],
  TD: ['tchadien', 'tchadienne', "n'djamena", 'ndjamena'],
  MR: ['mauritanien', 'mauritanienne', 'nouakchott'],
  ZA: ['afrique du sud', 'south africa', 'sud-africain', 'johannesburg'],
  ET: ['ethiopien', 'ethiopienne', 'addis-abeba', 'addis abeba'],
  KE: ['kenyan', 'kenyane', 'nairobi'],
  SO: ['somalien', 'somalienne', 'mogadiscio', 'mogadishu'],
  MA: ['marocain', 'marocaine', 'rabat'],
  DZ: ['algerien', 'algerienne', 'alger'],
  TN: ['tunisien', 'tunisienne', 'tunis'],
  LY: ['libyen', 'libyenne', 'tripoli'],
  EG: ['egyptien', 'egyptienne', 'le caire', 'cairo'],
  MZ: ['mozambicain', 'cabo delgado', 'maputo'],
  CV: ['cap-vert', 'cabo verde', 'cape verde'],
  ST: ['sao tome', 'sao tome-et-principe'],
  SZ: ['eswatini', 'swaziland'],
};
// Régions : un professionnel dit « le Sahel » ou « l'AES », pas une liste.
const REGIONS = [
  { cle: 'aes', noms: ['aes', 'alliance des etats du sahel', 'confederation des etats du sahel'], pays: ['ML', 'BF', 'NE'], fr: 'pays de l\'AES', en: 'AES countries' },
  { cle: 'sahel', noms: ['sahel', 'sahelien', 'sahelienne'], pays: ['ML', 'BF', 'NE', 'TD', 'MR'], fr: 'Sahel', en: 'the Sahel' },
  { cle: 'golfe', noms: ['golfe de guinee', 'gulf of guinea', 'pays cotiers'], pays: ['CI', 'GH', 'TG', 'BJ', 'NG', 'CM'], fr: 'golfe de Guinée', en: 'the Gulf of Guinea' },
  { cle: 'cedeao', noms: ['cedeao', 'ecowas', "afrique de l'ouest", 'west africa', 'sous-region', 'sous region'], pays: ['BJ', 'CV', 'CI', 'GM', 'GH', 'GN', 'GW', 'LR', 'NG', 'SN', 'SL', 'TG', 'ML', 'BF', 'NE'], fr: 'Afrique de l\'Ouest', en: 'West Africa' },
  { cle: 'grands-lacs', noms: ['grands lacs', 'great lakes', 'est de la rdc', 'eastern drc'], pays: ['CD', 'RW', 'BI', 'UG'], fr: 'Grands Lacs', en: 'the Great Lakes' },
  { cle: 'corne', noms: ["corne de l'afrique", 'horn of africa'], pays: ['ET', 'ER', 'DJ', 'SO', 'SD', 'SS', 'KE'], fr: 'Corne de l\'Afrique', en: 'the Horn of Africa' },
  { cle: 'maghreb', noms: ['maghreb', 'afrique du nord', 'north africa'], pays: ['MA', 'DZ', 'TN', 'LY', 'MR', 'EG'], fr: 'Afrique du Nord', en: 'North Africa' },
];

// Index des noms de pays, du plus long au plus court : « Guinée équatoriale »
// avant « Guinée », « Soudan du Sud » avant « Soudan ». Le mot entier garde
// « Niger » de « Nigeria ».
function indexPays(pays) {
  const entrees = [];
  (pays || []).forEach((p) => {
    const noms = new Set([].concat(p.noms || [], ALIAS_PAYS[p.cy] || []).map(norm).filter(Boolean));
    noms.forEach((n) => entrees.push({ cy: p.cy, n, re: motRe(n) }));
  });
  return entrees.sort((a, b) => b.n.length - a.n.length);
}

function trouverPays(q, index) {
  let reste = ' ' + norm(q) + ' ';
  const trouves = [];
  index.forEach((e) => {
    const m = e.re.exec(reste);
    if (m) {
      if (!trouves.some((t) => t.cy === e.cy)) trouves.push({ cy: e.cy, pos: m.index });
      reste = reste.replace(e.re, '$1 $2');
    }
  });
  // Sigles : seulement s'ils sont écrits en capitales dans la question
  // (« car » est un mot courant en français et en anglais).
  [['RCA', 'CF'], ['CAR', 'CF'], ['RCI', 'CI'], ['RDC', 'CD'], ['DRC', 'CD']].forEach(([s, cy]) => {
    const m = new RegExp('(^|[^A-Za-z])' + s + '($|[^A-Za-z])').exec(String(q || ''));
    if (m && !trouves.some((t) => t.cy === cy)) trouves.push({ cy, pos: m.index });
  });
  // Dans l'ordre de la question : « Mali vs Burkina » se lit dans cet ordre.
  return trouves.sort((a, b) => a.pos - b.pos).map((t) => t.cy);
}

// ── Période ─────────────────────────────────────────────────────────────────
const JOUR = 86400000;
function debutJour(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
const NOMBRES = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, dix: 10, quinze: 15, trente: 30,
  one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, ten: 10, fifteen: 15, thirty: 30 };

function lirePeriode(qn, maintenant, fenetreMs, futur) {
  const nb = (s) => (/^\d+$/.test(s) ? parseInt(s, 10) : NOMBRES[s]);
  let m;
  if (futur) {
    if ((m = qn.match(/(\d+|[a-z]+) (prochains jours|next days|days ahead)/)) && nb(m[1])) {
      return { cle: 'futur', depuis: maintenant, jusqua: maintenant + nb(m[1]) * JOUR, fr: 'les ' + nb(m[1]) + ' prochains jours', en: 'the next ' + nb(m[1]) + ' days' };
    }
    if (/semaine prochaine|next week|7 prochains|cette semaine|this week/.test(qn)) return { cle: 'futur', depuis: maintenant, jusqua: maintenant + 7 * JOUR, fr: 'les 7 prochains jours', en: 'the next 7 days' };
    if (/mois prochain|next month|ce mois|this month/.test(qn)) return { cle: 'futur', depuis: maintenant, jusqua: maintenant + 31 * JOUR, fr: 'les 31 prochains jours', en: 'the next 31 days' };
    return { cle: 'futur', depuis: maintenant, jusqua: maintenant + 30 * JOUR, fr: 'les 30 prochains jours', en: 'the next 30 days' };
  }
  if (/aujourd'?hui|ce jour|today|ce matin|this morning/.test(qn)) return { cle: 'jour', depuis: debutJour(maintenant), jusqua: maintenant, fr: 'aujourd\'hui', en: 'today' };
  if (/\bhier\b|yesterday/.test(qn)) return { cle: 'hier', depuis: debutJour(maintenant) - JOUR, jusqua: debutJour(maintenant), fr: 'hier', en: 'yesterday' };
  if ((m = qn.match(/(\d+|[a-z]+) (derniers jours|dernieres 24|jours|last days|days)\b/)) && nb(m[1]) && !/prochain/.test(qn)) {
    return { cle: 'jours', depuis: maintenant - nb(m[1]) * JOUR, jusqua: maintenant, fr: 'les ' + nb(m[1]) + ' derniers jours', en: 'the last ' + nb(m[1]) + ' days' };
  }
  if ((m = qn.match(/(\d+) ?(h|heures|hours)\b/))) {
    const h = parseInt(m[1], 10);
    return { cle: 'heures', depuis: maintenant - h * 3600000, jusqua: maintenant, fr: 'les ' + h + ' dernières heures', en: 'the last ' + h + ' hours' };
  }
  if (/semaine derniere|semaine passee|last week|past week|7 derniers/.test(qn)) return { cle: 'jours', depuis: maintenant - 7 * JOUR, jusqua: maintenant, fr: 'les 7 derniers jours', en: 'the last 7 days' };
  if (/cette semaine|this week|de la semaine/.test(qn)) {
    const d = new Date(debutJour(maintenant)); const j = (d.getDay() + 6) % 7; // lundi = 0
    return { cle: 'semaine', depuis: d.getTime() - j * JOUR, jusqua: maintenant, fr: 'cette semaine (depuis lundi)', en: 'this week (since Monday)' };
  }
  if (/ce mois|this month|du mois|depuis le debut du mois/.test(qn)) {
    const d = new Date(maintenant); d.setDate(1); d.setHours(0, 0, 0, 0);
    return { cle: 'mois', depuis: d.getTime(), jusqua: maintenant, fr: 'ce mois-ci (depuis le 1er)', en: 'this month (since the 1st)' };
  }
  if (/mois dernier|last month|30 derniers|past month/.test(qn)) return { cle: 'jours', depuis: maintenant - 30 * JOUR, jusqua: maintenant, fr: 'les 30 derniers jours', en: 'the last 30 days' };
  const h = Math.round(fenetreMs / 3600000);
  return { cle: 'fenetre', depuis: maintenant - fenetreMs, jusqua: maintenant, fr: 'les ' + h + ' dernières heures', en: 'the last ' + h + ' hours', parDefaut: true };
}

// ── Thèmes ──────────────────────────────────────────────────────────────────
// Un thème filtre les faits sur leur titre et leur chapô (mots entiers ou
// racines). Il ne reclasse rien : le niveau d'un fait reste celui calculé.
const THEMES = [
  { cle: 'terrorisme', fr: 'attaques et violences armées', en: 'attacks and armed violence',
    q: /(terror|jihad|djihad|attaque|attentat|embuscade|violence|arme|attack|militant|insurg|bandit|groupes? arme|securitaire|security|surete)/,
    re: /(terror|jihad|djihad|attaqu|attentat|embuscad|frappe|drone|tue[se]?\b|morts?\b|killed|attack|militant|insurg|bandit|arme[se]?\b|armed|gunmen|assaillant|jnim|eigs|iswap|boko|shebab|shabaab|m23|adf|explosi|ied|massacr|affrontement|clash)/ },
  { cle: 'enlevement', fr: 'enlèvements', en: 'kidnappings',
    q: /(enlev|kidnap|rapt|otage|hostage|abduct)/, re: /(enlev|kidnap|rapt|otage|hostage|abduct|sequestr)/ },
  { cle: 'manifestation', fr: 'manifestations et grèves', en: 'protests and strikes',
    q: /(manifest|protest|greve|strike|emeute|riot|troubles?|unrest)/, re: /(manifest|protest|greve|strike|emeute|riot|sit-in|marche de|troubles|unrest|contestation|barricad)/ },
  { cle: 'politique', fr: 'politique et élections', en: 'politics and elections',
    q: /(politi|elect|scrutin|vote|campagne|gouvernement|coup d'etat|putsch|junte|junta)/, re: /(elect|scrutin|vote|campagne|candidat|presiden|gouvernement|ministre|coup d'etat|putsch|junte|junta|parlement|assemblee|opposition|parti)/ },
  { cle: 'criminalite', fr: 'criminalité', en: 'crime',
    q: /(crimin|braquage|vol|robbery|trafic|drogue|pirat|cambriol)/, re: /(crimin|braquag|vol a main|robbery|robber|trafic|drogue|cocaine|pirat|cambriol|gang|escroquer|fraud|arnaque)/ },
  { cle: 'humanitaire', fr: 'situation humanitaire', en: 'humanitarian situation',
    q: /(humanit|refugi|deplace|inondation|flood|famine|secheresse|drought)/, re: /(humanit|refugi|deplace|displaced|inond|flood|famine|secheress|drought|faim|hunger|malnutri|sinistr)/ },
  { cle: 'sante', fr: 'santé et épidémies', en: 'health and epidemics',
    q: /(sante|health|epidemi|cholera|ebola|mpox|variole|paludisme|malaria)/, re: /(epidemi|cholera|ebola|mpox|variole|paludisme|malaria|dengue|meningit|fievre|fever|outbreak|vaccin)/ },
  { cle: 'transport', fr: 'routes et déplacements', en: 'roads and travel',
    q: /(route|axe|deplacement|transport|voyage|travel|road|corridor|frontiere|border|checkpoint)/, re: /(route|axe |road|corridor|frontiere|border|checkpoint|barrage|convoi|convoy|aeroport|airport|vol annul|flight|port de|accident)/ },
  { cle: 'economie', fr: 'économie et finance', en: 'economy and finance',
    q: /(econom|financ|inflation|prix|carburant|fuel|penurie|shortage|banque|bank|dette|debt|monnaie|currency|investis)/, re: /(econom|financ|inflation|prix|price|carburant|fuel|penurie|shortage|banque|bank|dette|debt|monnaie|currency|fcfa|naira|cedi|investis|bourse|budget)/ },
];

// ── Intention ───────────────────────────────────────────────────────────────
function lireIntention(qn, nbPays) {
  if (/(ce que (nous|vous|tu|l'appli) ne sai|angle mort|blind spot|pays muets?|ne savons pas|don'?t know|what we do not know|couverture|coverage|zones? d'ombre)/.test(qn)) return 'inconnu';
  if (/(agenda|evenement|evenements|a venir|prevu|prevue|programme|calendrier|colloque|seminaire|salon|festival|concert|match|ceremonie|fete|jour ferie|ferie|tabaski|ramadan|magal|upcoming|scheduled|event|holiday|what'?s planned)/.test(qn)) return 'agenda';
  if (/(pourquoi|qu'est-ce qui (porte|explique|justifie)|ce qui (porte|explique|justifie)|justifi|sur quoi repose|why|explain|what drives|drivers|based on)/.test(qn)) return 'pourquoi';
  if (nbPays >= 2 && /(compar|versus|\bvs\b|entre|difference|plus (dangereux|risque|expose)|which is|between)/.test(qn)) return 'comparer';
  if (nbPays === 0 && /(quels? pays|which countr|les plus (exposes|dangereux|a risque|risques|touches)|most (exposed|dangerous|at risk|affected)|classement|ranking|top \d*|en rouge|en marron|en orange|au rouge|au marron|niveau (rouge|marron|orange)|red|maroon|countries)/.test(qn)) return 'classement';
  if (nbPays >= 2) return 'comparer';
  return 'situation';
}

const NIVEAUX = ['vert', 'jaune', 'orange', 'marron', 'rouge'];
function lireNiveauDemande(qn) {
  if (/\brouge|\bred\b/.test(qn)) return 'rouge';
  if (/\bmarron|maroon|brown/.test(qn)) return 'marron';
  if (/\borange\b/.test(qn)) return 'orange';
  if (/\bjaune|yellow/.test(qn)) return 'jaune';
  return null;
}

/**
 * interpreterQuestion(question, ctx) → ce que la question demande.
 * ctx : { maintenant, fenetreMs, pays: [{ cy, noms: [...] }], paysCourant }
 * Aucune donnée n'est lue ici : seulement la question.
 */
function interpreterQuestion(question, ctx) {
  const c = ctx || {};
  const maintenant = c.maintenant != null ? c.maintenant : Date.now();
  const fenetreMs = c.fenetreMs || 36 * 3600000;
  const qn = ' ' + norm(question) + ' ';
  const index = c._index || indexPays(c.pays || []);
  const pays = trouverPays(question, index);
  const nommes = pays.length;
  const regions = [];
  REGIONS.forEach((r) => { if (r.noms.some((n) => motRe(n).test(qn))) regions.push(r); });
  regions.forEach((r) => r.pays.forEach((cy) => { if (!pays.includes(cy)) pays.push(cy); }));
  const intention = lireIntention(qn, nommes + regions.length);
  const theme = THEMES.find((t) => t.q.test(qn)) || null;
  // « Ici », « ce pays » : le pays déjà choisi dans l'appli, s'il y en a un.
  if (!pays.length && c.paysCourant && /(ici|ce pays|this country|le pays selectionne|mon pays|chez nous)/.test(qn)) pays.push(c.paysCourant);
  // Question sur l'outil : réponse immédiate. Un pays nommé l'emporte (sauf
  // pour le bulletin, qui se demande souvent « pour la Côte d'Ivoire »).
  const faq = trouverFaq(qn);
  const intentionFinale = (faq && (nommes === 0 && !regions.length || faq.cle === 'bulletin')) ? 'faq' : intention;
  const periode = lirePeriode(qn, maintenant, fenetreMs, intentionFinale === 'agenda');
  return {
    question: String(question || '').trim(), pays, regions: regions.map((r) => ({ cle: r.cle, fr: r.fr, en: r.en, pays: r.pays })),
    intention: intentionFinale, faq: intentionFinale === 'faq' ? faq.cle : null, theme: theme ? { cle: theme.cle, fr: theme.fr, en: theme.en } : null,
    periode, niveau: lireNiveauDemande(qn), vide: !norm(question),
  };
}

function themeParCle(cle) { return THEMES.find((t) => t.cle === cle) || null; }
function correspondTheme(fait, themeCle) {
  if (!themeCle) return true;
  const t = themeParCle(themeCle);
  if (!t) return true;
  if (themeCle === 'humanitaire' && fait.cat === 'humanitaire') return true;
  if (themeCle === 'economie' && fait.cat === 'economique') return true;
  if (themeCle === 'politique' && fait.cat === 'politique') return true;
  return t.re.test(norm((fait.titre || '') + ' ' + (fait.titreFr || '') + ' ' + (fait.texte || '')));
}

// ── Regroupement des faits : un fait, une ligne ─────────────────────────────
const RANG_NIVEAU = { crit: 0, high: 1, mod: 2, low: 3 };
const RANG_COTATION = { valide: 0, confirme: 1, probable: 2, non_confirme: 3, infirme: 4 };
const VIDES = new Set(('le la les un une des du de d l et ou en au aux a pour par sur dans avec sans ce cette ces son sa ses leur leurs qui que quoi dont est sont ete apres avant contre entre plus moins tres '
  + 'the of in on at to for and or with by from as is are was were has have after over its their an new says said').split(' '));
function racines(titre, motsPays) {
  const out = new Set();
  norm(titre).split(/[^a-z0-9]+/).forEach((m) => {
    if (m.length < 3 || VIDES.has(m) || motsPays.has(m) || /^\d+$/.test(m)) return;
    out.add(m.slice(0, 5));
  });
  return out;
}
const ECART_MAX_MS = 4 * JOUR;
function nombres(titre) {
  const out = new Set();
  (String(titre || '').match(/\b\d{1,4}\b/g) || []).forEach((n) => { const v = parseInt(n, 10); if (v >= 2 && !(v >= 1900 && v <= 2100)) out.add(v); });
  return out;
}
// Thèmes assez précis pour désigner un type d'événement (les thèmes larges,
// politique, économie, transport, n'en désignent pas).
const THEMES_EVENEMENT = ['terrorisme', 'enlevement', 'manifestation', 'criminalite', 'humanitaire', 'sante'];
function themesEvenement(t) {
  const n = norm(t);
  return new Set(THEMES_EVENEMENT.filter((k) => THEMES.find((x) => x.cle === k).re.test(n)));
}
function memeFait(a, b) {
  if (a.cy !== b.cy) return false;
  if (a.publieMs && b.publieMs && Math.abs(a.publieMs - b.publieMs) > ECART_MAX_MS) return false;
  if (a.url && b.url && a.url === b.url) return true;
  if (noyau.articlesSontDoublons && noyau.articlesSontDoublons({ title: a.titre }, { title: b.titre })) return true;
  if (a.titreFr && b.titreFr && noyau.articlesSontDoublons && noyau.articlesSontDoublons({ title: a.titreFr }, { title: b.titreFr })) return true;
  let commun = 0;
  a._r.forEach((r) => { if (b._r.has(r)) commun++; });
  // Pont local, plus large que celui du noyau (qui sert au dédoublonnage de
  // production et n'est pas touché ici) : un même nombre (un bilan, pas une
  // année) ET un même thème d'événement, à moins de deux jours. « Terrorists
  // abduct 14 students » et « police confirm 14 students abducted » sont un
  // seul enlèvement.
  if (a._n.size && b._n.size && (!a.publieMs || !b.publieMs || Math.abs(a.publieMs - b.publieMs) <= 2 * JOUR)
      && [...a._n].some((n) => b._n.has(n)) && [...a._t].some((t) => b._t.has(t))) return true;
  const min = Math.min(a._r.size, b._r.size);
  if (!min) return false;
  const part = commun / min;
  return (commun >= 3 && part >= 0.6) || (commun >= 4 && part >= 0.5);
}

/**
 * regrouperFaits(faits, nomsPays) : replie les faits qui décrivent le même
 * événement. Le plus grave puis le plus récent porte le titre ; les autres
 * médias sont listés. Deux médias distincts → « Confirmé » (sauf si un
 * analyste a infirmé). Une même source qui republie ne recoupe rien.
 */
function regrouperFaits(faits, nomsPays) {
  const motsPays = new Set();
  Object.values(nomsPays || {}).forEach((n) => norm(n).split(/[^a-z0-9]+/).forEach((m) => m && motsPays.add(m)));
  const tries = (faits || []).filter((f) => f && f.titre).map((f) => Object.assign({}, f, { _r: racines(f.titreFr || f.titre, motsPays), _n: nombres(f.titre), _t: themesEvenement(f.titre + ' ' + (f.titreFr || '')) }))
    .sort((x, y) => ((RANG_NIVEAU[x.niveau] ?? 4) - (RANG_NIVEAU[y.niveau] ?? 4)) || ((y.publieMs || 0) - (x.publieMs || 0)));
  const groupes = [];
  tries.forEach((f) => {
    const g = groupes.find((x) => x.membres.some((m) => memeFait(m, f)));
    if (!g) {
      groupes.push({ membres: [f], fait: { id: f.id, titre: f.titre, titreFr: f.titreFr || null, cy: f.cy, niveau: f.niveau, publieMs: f.publieMs || null,
        url: f.url || null, cotation: f.cotation || 'non_confirme', sources: f.source ? [f.source] : [], liens: f.url ? [{ source: f.source || null, url: f.url }] : [], cat: f.cat || null } });
      return;
    }
    g.membres.push(f);
    const fg = g.fait;
    if (f.source && !fg.sources.includes(f.source)) {
      fg.sources.push(f.source);
      if (f.url && !fg.liens.some((l) => l.url === f.url)) fg.liens.push({ source: f.source, url: f.url });
    }
    if ((RANG_COTATION[f.cotation] ?? 9) < (RANG_COTATION[fg.cotation] ?? 9)) fg.cotation = f.cotation;
    if (!fg.url && f.url) fg.url = f.url;
  });
  return groupes.map((g) => {
    const f = g.fait;
    if (f.sources.length > 1 && f.cotation !== 'valide' && f.cotation !== 'infirme') f.cotation = 'confirme';
    f.reprises = g.membres.length;
    return f;
  });
}

// ── Libellés ────────────────────────────────────────────────────────────────
const LIB = {
  fr: {
    niv: { vert: 'Vert (stable)', jaune: 'Jaune (modéré)', orange: 'Orange (élevé)', marron: 'Marron (critique)', rouge: 'Rouge (grave)' },
    cot: { valide: 'Validé analyste', confirme: 'Confirmé', probable: 'Probable', non_confirme: 'Non confirmé', infirme: 'Infirmé par l\'analyste' },
    cotP: { valide: 'Validés analyste', confirme: 'Confirmés', probable: 'Probables', non_confirme: 'Non confirmés', infirme: 'Infirmés par l\'analyste' },
    grav: { crit: 'critique', high: 'élevé', mod: 'modéré' },
  },
  en: {
    niv: { vert: 'Green (stable)', jaune: 'Yellow (moderate)', orange: 'Orange (high)', marron: 'Maroon (critical)', rouge: 'Red (severe)' },
    cot: { valide: 'Analyst-validated', confirme: 'Confirmed', probable: 'Probable', non_confirme: 'Unconfirmed', infirme: 'Rejected by analyst' },
    cotP: { valide: 'Analyst-validated', confirme: 'Confirmed', probable: 'Probable', non_confirme: 'Unconfirmed', infirme: 'Rejected by analyst' },
    grav: { crit: 'critical', high: 'high', mod: 'moderate' },
  },
};
function pluriel(n, s, p) { return n + ' ' + (n > 1 ? p : s); }
// « au Sénégal », « en Côte d'Ivoire », « aux Comores », « à Maurice ».
const PAYS_AU = ['BJ', 'BF', 'BI', 'CM', 'CV', 'CG', 'GA', 'GH', 'KE', 'LS', 'LR', 'MW', 'ML', 'MA', 'MZ', 'NE', 'NG', 'RW', 'SN', 'SD', 'SS', 'TD', 'TG', 'ZW', 'BW'];
const PAYS_AUX = ['KM', 'SC'];
const PAYS_A = ['MU', 'MG', 'DJ', 'ST'];
function dansPays(cy, nom, lg) {
  if (lg === 'en') return 'in ' + nom;
  if (PAYS_AUX.includes(cy)) return 'aux ' + nom;
  if (PAYS_A.includes(cy)) return 'à ' + nom;
  if (PAYS_AU.includes(cy)) return 'au ' + nom;
  return 'en ' + nom;
}
function decompteCotations(groupes, lg) {
  const c = {};
  groupes.forEach((g) => { c[g.cotation] = (c[g.cotation] || 0) + 1; });
  return ['valide', 'confirme', 'probable', 'non_confirme', 'infirme'].filter((k) => c[k])
    .map((k) => c[k] + ' ' + (c[k] > 1 ? LIB[lg].cotP[k] : LIB[lg].cot[k]).toLowerCase()).join(', ');
}
function phraseTendance(t, lg) {
  if (!t || t.points < 2) return '';
  const L = LIB[lg].niv;
  if (t.crans === 0) return lg === 'en' ? 'unchanged over the last ' + t.points + ' daily readings' : 'inchangé sur les ' + t.points + ' derniers relevés quotidiens';
  const de = L[t.de] ? L[t.de].split(' ')[0] : t.de;
  return t.crans > 0
    ? (lg === 'en' ? 'up from ' + de + ' over the last ' + t.points + ' readings' : 'en hausse, depuis ' + de + ', sur les ' + t.points + ' derniers relevés')
    : (lg === 'en' ? 'down from ' + de + ' over the last ' + t.points + ' readings' : 'en baisse, depuis ' + de + ', sur les ' + t.points + ' derniers relevés');
}

const FAITS_MAX = 8;

/**
 * composerReponse(interp, donnees, lang) → { blocs, suggestions }
 * donnees : {
 *   pays: { CY: { nom, niveau, tendance, angleMort:{muet,horsAlerte,sourceUnique,socleAncien}, socle:[{titre,date,ageJ}], facteurs:[label] } },
 *   faits: [{ id, titre, titreFr, cy, niveau, publieMs, source, url, cotation, cat, texte }],
 *   agenda: [{ titre, dateMs, cy, nomLieu, type, src, surl, estime }],
 *   classement: [{ cy, nom, niveau, total100 }],
 *   couverture: { fenetreH, depuisMs (plus ancien fait disponible), sources: [...] },
 * }
 * Toute phrase est un gabarit rempli par la base. Rien d'autre.
 */
function composerReponse(interp, donnees, lang) {
  const lg = lang === 'en' ? 'en' : 'fr';
  const en = lg === 'en';
  const d = donnees || {};
  const P = d.pays || {};
  const blocs = [];
  const sugg = [];
  const nom = (cy) => (P[cy] && P[cy].nom) || cy;
  const per = interp.periode || {};
  const perLib = en ? per.en : per.fr;

  if (interp.vide) {
    return { blocs: [{ t: 'texte', texte: en ? 'Ask a question about a country, a region, a period or a theme.' : 'Posez une question sur un pays, une région, une période ou un thème.' }], suggestions: exemples(lg) };
  }

  if (interp.intention === 'faq') {
    return { blocs: reponseFaq(interp.faq, d, lg, interp), suggestions: [], faq: true };
  }

  const groupesDe = (cys, theme) => {
    const f = (d.faits || []).filter((x) => cys.includes(x.cy) && (x.publieMs || 0) >= per.depuis && (x.publieMs || 0) <= per.jusqua + 3600000 && correspondTheme(x, theme));
    const nomsP = {}; cys.forEach((cy) => { nomsP[cy] = nom(cy); });
    return regrouperFaits(f, nomsP);
  };
  const blocFaits = (groupes, titre) => {
    if (!groupes.length) return;
    blocs.push({ t: 'faits', titre, faits: groupes.slice(0, FAITS_MAX), plus: Math.max(0, groupes.length - FAITS_MAX) });
  };
  const themeLib = interp.theme ? (en ? interp.theme.en : interp.theme.fr) : '';

  if (interp.intention === 'classement' || (!interp.pays.length && interp.intention !== 'agenda' && interp.intention !== 'inconnu')) {
    const cl = (d.classement || []).slice().sort((a, b) => NIVEAUX.indexOf(b.niveau) - NIVEAUX.indexOf(a.niveau) || (b.total100 || 0) - (a.total100 || 0));
    const filtre = interp.niveau ? cl.filter((p) => p.niveau === interp.niveau) : cl.filter((p) => NIVEAUX.indexOf(p.niveau) >= 2).slice(0, 10);
    if (!interp.pays.length && interp.intention !== 'classement' && !interp.theme) {
      // Question sans pays ni classement explicite : vue d'ensemble.
      const n = {}; cl.forEach((p) => { n[p.niveau] = (n[p.niveau] || 0) + 1; });
      blocs.push({ t: 'texte', texte: en
        ? 'Across the ' + cl.length + ' countries monitored: ' + NIVEAUX.slice().reverse().filter((k) => n[k]).map((k) => n[k] + ' ' + LIB.en.niv[k].split(' ')[0]).join(', ') + '.'
        : 'Sur les ' + cl.length + ' pays suivis : ' + NIVEAUX.slice().reverse().filter((k) => n[k]).map((k) => n[k] + ' en ' + LIB.fr.niv[k].split(' ')[0].toLowerCase()).join(', ') + '.' });
    }
    if (filtre.length) {
      blocs.push({ t: 'liste', titre: interp.niveau
        ? (en ? 'Countries at ' + LIB.en.niv[interp.niveau] : 'Pays au niveau ' + LIB.fr.niv[interp.niveau])
        : (en ? 'Most exposed countries (Orange or above)' : 'Pays les plus exposés (Orange et au-dessus)'),
        items: filtre.map((p) => ({ cy: p.cy, texte: p.nom + ' — ' + LIB[lg].niv[p.niveau] })) });
    } else if (interp.niveau) {
      blocs.push({ t: 'texte', texte: en ? 'No country is currently at ' + LIB.en.niv[interp.niveau] + '.' : 'Aucun pays n\'est actuellement au niveau ' + LIB.fr.niv[interp.niveau] + '.' });
    }
    if (interp.theme) {
      const tous = (d.classement || []).map((p) => p.cy);
      const g = groupesDe(tous, interp.theme.cle).filter((x) => x.niveau === 'crit' || x.niveau === 'high');
      if (g.length) blocFaits(g, en ? 'Most serious facts — ' + themeLib + ', ' + perLib : 'Faits les plus graves — ' + themeLib + ', ' + perLib);
      else blocs.push({ t: 'texte', texte: en ? 'No critical or high fact on ' + themeLib + ' in the database for ' + perLib + '.' : 'Aucun fait critique ou élevé sur ' + themeLib + ' dans la base pour ' + perLib + '.' });
    } else if (interp.intention !== 'classement') {
      const tous = (d.classement || []).map((p) => p.cy);
      const g = groupesDe(tous, null).filter((x) => x.niveau === 'crit');
      blocFaits(g, en ? 'Critical facts, ' + perLib : 'Faits critiques, ' + perLib);
    }
    sugg.push(en ? 'Which countries are at Red?' : 'Quels pays sont au rouge ?');
    if (filtre[0]) sugg.push((en ? 'Situation ' : 'Situation ') + dansPays(filtre[0].cy, filtre[0].nom, lg) + (en ? ' this week' : ' cette semaine'));
    return fin(blocs, sugg, d, lg, interp);
  }

  if (interp.intention === 'inconnu') {
    const cys = interp.pays.length ? interp.pays : Object.keys(P);
    const lignes = [];
    const fam = [
      ['muet', en ? 'no news at all in the window' : 'aucune actu dans la fenêtre'],
      ['horsAlerte', en ? 'news, but no source able to raise the level' : 'des actus, mais aucune source capable de faire monter le niveau'],
      ['sourceUnique', en ? 'a single source able to raise an alert' : 'une seule source capable d\'alerter'],
      ['socleAncien', en ? 'verified incidents more than 90 days old' : 'incidents vérifiés de plus de 90 jours'],
    ];
    fam.forEach(([k, lib]) => {
      const l = cys.filter((cy) => P[cy] && P[cy].angleMort && P[cy].angleMort[k]);
      if (l.length) lignes.push({ texte: lib + ' : ' + l.map(nom).join(', ') });
    });
    if (lignes.length) blocs.push({ t: 'liste', titre: en ? 'What we do not know' : 'Ce que nous ne savons pas', items: lignes });
    else blocs.push({ t: 'texte', texte: en ? 'No blind spot recorded for this scope.' : 'Aucun angle mort relevé sur ce périmètre.' });
    blocs.push({ t: 'texte', texte: en ? 'A country listed here is not more dangerous: it is a country the tool sees poorly.' : 'Un pays listé ici n\'est pas plus dangereux : c\'est un pays que l\'outil voit mal.' });
    return fin(blocs, sugg, d, lg, interp);
  }

  if (interp.intention === 'agenda') {
    const cys = interp.pays;
    const ev = (d.agenda || []).filter((e) => e.dateMs >= per.depuis - JOUR && e.dateMs <= per.jusqua
      && (!cys.length || cys.some((cy) => e.cy === cy || (e.pays || []).includes(cy))))
      .sort((a, b) => a.dateMs - b.dateMs);
    // Un même événement vu par deux sources (fête nationale au calendrier et
    // au jour férié officiel) : une ligne.
    const vus = new Set();
    const uniques = ev.filter((e) => { const k = (e.cy || '') + '|' + new Date(e.dateMs).toISOString().slice(0, 10) + '|' + norm(e.titre).slice(0, 24); if (vus.has(k)) return false; vus.add(k); return true; });
    const zone = cys.length ? cys.map(nom).join(', ') : (en ? 'all countries' : 'tous les pays');
    if (uniques.length) {
      blocs.push({ t: 'agenda', titre: (en ? 'Scheduled — ' : 'Prévu — ') + zone + ', ' + perLib, evenements: uniques.slice(0, 12), plus: Math.max(0, uniques.length - 12) });
      if (uniques.some((e) => e.estime)) blocs.push({ t: 'texte', texte: en ? 'Dates marked “estimated” follow the lunar calendar and may shift by a day depending on the country.' : 'Les dates « estimées » suivent le calendrier lunaire et peuvent varier d\'un jour selon le pays.' });
    } else {
      const ou = cys.length === 1 ? dansPays(cys[0], nom(cys[0]), lg) : (en ? 'for ' + zone : 'pour ' + zone);
      blocs.push({ t: 'texte', texte: en ? 'Nothing scheduled in the agenda ' + ou + ' over ' + perLib + '.' : 'Rien de prévu à l\'agenda ' + ou + ' sur ' + perLib + '.' });
    }
    if (cys[0]) sugg.push('Situation ' + dansPays(cys[0], nom(cys[0]), lg) + (en ? ' this week' : ' cette semaine'));
    return fin(blocs, sugg, d, lg, interp);
  }

  // situation / pourquoi / comparer : un paragraphe par pays.
  const cys = interp.pays.slice(0, interp.intention === 'comparer' ? 6 : 15);
  if (interp.regions.length && interp.intention !== 'comparer') {
    const items = cys.map((cy) => ({ cy, texte: nom(cy) + ' — ' + (P[cy] ? LIB[lg].niv[P[cy].niveau] : '?') }));
    blocs.push({ t: 'liste', titre: (en ? 'Alert levels — ' : 'Niveaux d\'alerte — ') + interp.regions.map((r) => (en ? r.en : r.fr)).join(', '), items });
    const g = groupesDe(cys, interp.theme && interp.theme.cle).filter((x) => x.niveau === 'crit' || x.niveau === 'high');
    if (g.length) blocFaits(g, (en ? 'Main facts' : 'Faits principaux') + (themeLib ? ' — ' + themeLib : '') + ', ' + perLib);
    else blocs.push({ t: 'texte', texte: en ? 'No critical or high fact in the database for ' + perLib + '.' : 'Aucun fait critique ou élevé dans la base pour ' + perLib + '.' });
    return fin(blocs, sugg, d, lg, interp);
  }
  if (interp.intention === 'comparer') {
    blocs.push({ t: 'liste', titre: en ? 'Comparison' : 'Comparaison', items: cys.map((cy) => {
      const g = groupesDe([cy], interp.theme && interp.theme.cle);
      const graves = g.filter((x) => x.niveau === 'crit' || x.niveau === 'high').length;
      return { cy, texte: nom(cy) + ' — ' + (P[cy] ? LIB[lg].niv[P[cy].niveau] : '?') + ' · '
        + (en ? pluriel(g.length, 'fact', 'facts') + ' above normal, ' + graves + ' critical or high'
          : pluriel(g.length, 'fait', 'faits') + ' au-dessus du normal, dont ' + graves + ' critique' + (graves > 1 ? 's' : '') + ' ou élevé' + (graves > 1 ? 's' : '')) };
    }) });
    blocs.push({ t: 'texte', texte: en ? 'Period: ' + perLib + (themeLib ? ', theme: ' + themeLib : '') + '.' : 'Période : ' + perLib + (themeLib ? ', thème : ' + themeLib : '') + '.' });
    return fin(blocs, sugg, d, lg, interp);
  }

  cys.forEach((cy) => {
    const p = P[cy];
    if (!p) { blocs.push({ t: 'texte', texte: en ? 'No data for this country.' : 'Aucune donnée pour ce pays.' }); return; }
    const tend = phraseTendance(p.tendance, lg);
    blocs.push({ t: 'titre', cy, texte: p.nom + ' — ' + LIB[lg].niv[p.niveau] + (tend ? ', ' + tend : '') });
    const g = groupesDe([cy], interp.theme && interp.theme.cle);
    if (interp.intention === 'pourquoi') {
      const socle = (p.socle || []).slice(0, 4);
      if (socle.length) blocs.push({ t: 'liste', titre: en ? 'Verified incidents carrying the level' : 'Incidents vérifiés qui portent le niveau',
        items: socle.map((s) => ({ texte: s.titre + (s.date ? ' (' + s.date + (s.ageJ != null ? (en ? ', ' + s.ageJ + ' days ago' : ', il y a ' + s.ageJ + ' j') : '') + ')' : '') })) });
      if ((p.facteurs || []).length) blocs.push({ t: 'liste', titre: en ? 'Structural factors' : 'Facteurs structurels', items: p.facteurs.slice(0, 5).map((f) => ({ texte: f })) });
      const live = g.filter((x) => x.niveau === 'crit' || x.niveau === 'high');
      blocs.push({ t: 'texte', texte: live.length
        ? (en ? 'Plus ' + pluriel(live.length, 'critical or high fact', 'critical or high facts') + ' collected over ' + perLib + ' (below).'
          : 'S\'y ajoutent ' + pluriel(live.length, 'fait critique ou élevé collecté', 'faits critiques ou élevés collectés') + ' sur ' + perLib + ' (ci-dessous).')
        : (en ? 'No critical or high fact collected over ' + perLib + ': the level rests on the verified base.' : 'Aucun fait critique ou élevé collecté sur ' + perLib + ' : le niveau repose sur le socle vérifié.') });
      blocFaits(live, en ? 'Facts collected' : 'Faits collectés');
    } else {
      if (g.length) {
        blocs.push({ t: 'texte', texte: (en
          ? perLib.charAt(0).toUpperCase() + perLib.slice(1) + ': ' + pluriel(g.length, 'fact', 'facts') + ' above normal' + (themeLib ? ' on ' + themeLib : '') + ' — '
          : perLib.charAt(0).toUpperCase() + perLib.slice(1) + ' : ' + pluriel(g.length, 'fait', 'faits') + ' au-dessus du normal' + (themeLib ? ' sur ' + themeLib : '') + ' — ') + decompteCotations(g, lg) + '.' });
        blocFaits(g, '');
      } else {
        blocs.push({ t: 'texte', texte: en
          ? 'No fact above normal' + (themeLib ? ' on ' + themeLib : '') + ' in the database for ' + perLib + '.'
          : 'Aucun fait au-dessus du normal' + (themeLib ? ' sur ' + themeLib : '') + ' dans la base pour ' + perLib + '.' });
      }
    }
    const am = p.angleMort || {};
    const reserves = [];
    if (am.muet) reserves.push(en ? 'no news received in the window: silence here is not calm' : 'aucune actu reçue dans la fenêtre : ce silence n\'est pas un calme');
    else if (am.horsAlerte) reserves.push(en ? 'no source able to raise the level has published' : 'aucune source capable de faire monter le niveau n\'a publié');
    if (am.sourceUnique) reserves.push(en ? 'a single source able to alert' : 'une seule source capable d\'alerter');
    if (am.socleAncien) reserves.push(en ? 'verified incidents more than 90 days old' : 'incidents vérifiés de plus de 90 jours');
    if (reserves.length) blocs.push({ t: 'note', texte: (en ? 'Caution: ' : 'Réserve : ') + reserves.join(' ; ') + '.' });
    if (d.bulletinsBase) blocs.push({ t: 'lien', texte: (en ? 'Free daily bulletin — ' : 'Bulletin quotidien gratuit — ') + p.nom, url: d.bulletinsBase + cy + '/dernier.html' });
  });
  const c0 = cys[0];
  if (c0 && interp.intention !== 'pourquoi') sugg.push(en ? 'Why is ' + nom(c0) + ' at this level?' : 'Pourquoi ce niveau ' + dansPays(c0, nom(c0), lg) + ' ?');
  if (c0) sugg.push((en ? 'Upcoming events ' : 'Événements à venir ') + dansPays(c0, nom(c0), lg));
  if (c0 && !interp.theme) sugg.push((en ? 'Kidnappings ' : 'Enlèvements ') + dansPays(c0, nom(c0), lg) + (en ? ' this month' : ' ce mois-ci'));
  return fin(blocs, sugg, d, lg, interp);
}

// Pied de réponse : d'où vient la réponse, dit une fois. Et si la période
// demandée remonte avant les données disponibles, on le dit plutôt que de
// laisser croire que rien ne s'est passé.
function fin(blocs, sugg, d, lg, interp) {
  const en = lg === 'en';
  const cov = d.couverture || {};
  const per = interp.periode || {};
  if (interp.intention !== 'agenda' && cov.depuisMs && per.depuis && per.depuis < cov.depuisMs - 3600000) {
    const j = new Date(cov.depuisMs);
    const date = j.toLocaleDateString(en ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long' });
    blocs.push({ t: 'note', texte: en ? 'The database on this device only goes back to ' + date + ' for this scope.' : 'Sur ce périmètre, la base disponible sur cet appareil ne remonte qu\'au ' + date + '.' });
  }
  // L'avertissement de méthode n'est PAS répété sous chaque réponse : il est
  // dit une fois, en tête de la fenêtre (consigne « pas de redondance »).
  return { blocs, suggestions: sugg.slice(0, 3) };
}

function exemples(lg) {
  return lg === 'en'
    ? ['What is the situation in Côte d\'Ivoire this week?', 'Which countries are at Red?', 'Upcoming events in Senegal', 'Kidnappings in the Sahel this month', 'What do we not know?', 'How does the rating work?']
    : ['Quelle est la situation en Côte d\'Ivoire cette semaine ?', 'Quels pays sont au rouge ?', 'Événements à venir au Sénégal', 'Enlèvements au Sahel ce mois-ci', 'Ce que nous ne savons pas', 'Comment fonctionne la cotation ?'];
}


// ── Questions sur l'outil : réponses immédiates ─────────────────────────────
// Demande de YORO du 14/11/2026 (« FAQ instantanée ») : les questions sur
// SentiqS lui-même reçoivent une réponse tout de suite, sans chercher dans
// les faits. Chaque réponse décrit une règle réellement appliquée par le
// code (voir CLAUDE.md) ; les chiffres (sources, fenêtre, forfaits) viennent
// de la page, jamais d'ici.
const FAQ = [
  { cle: 'assistant', q: /(comment tu (fonctionnes?|marches?|reponds)|comment fonctionnes?[- ]tu|comment (marche|fonctionne) l'assistant|qui es[- ]tu|d'ou viennent (tes|les) reponses|tu (inventes|hallucine)|hallucin|how do you work|what are you|where do your answers come)/ },
  { cle: 'cotation', q: /(cotation|que veut dire (confirme|probable|non confirme)|c'est quoi (confirme|probable)|difference entre confirme|what does (confirmed|probable|unconfirmed) mean|\brating\b)/ },
  { cle: 'validation', q: /(validation analyste|valide analyste|qui valide|analyste|analyst)/ },
  { cle: 'niveau', q: /(comment (est )?(calcule|se calcule|fonctionne) (le|un) niveau|calcul du niveau|que (veut dire|signifie)nt? les (couleurs|niveaux)|les cinq niveaux|5 niveaux|how (is|are) (the )?(alert )?levels? (calculated|computed)|what do the colou?rs mean)/ },
  { cle: 'bulletin', q: /(bulletin)/ },
  { cle: 'forfaits', q: /(prix|tarif|forfait|abonnement|abonner|combien (ca )?coute|payer|paiement|pricing|price|subscription|subscribe|how much)/ },
  { cle: 'essai', q: /(essai|periode d'essai|72 ?h|free trial|\btrial\b)/ },
  { cle: 'sources', q: /(d'ou viennent (les|vos) (informations|donnees|actus)|quelles sources|combien de sources|vos sources|which sources|how many sources|where does the (data|information|news) come)/ },
  { cle: 'fenetre', q: /(fenetre d'actualite|36 ?h|pays muet|que veut dire muet|silence|how recent|news window)/ },
  { cle: 'donnees', q: /(mes donnees|confidentialit|vie privee|supprimer mon compte|privacy|my data|delete my account)/ },
  { cle: 'mobile', q: /(sur (mon )?telephone|application mobile|android|iphone|tablette|on (my )?phone|mobile app)/ },
];
function trouverFaq(qn) { return FAQ.find((f) => f.q.test(qn)) || null; }

function reponseFaq(cle, d, lg, interp) {
  const en = lg === 'en';
  const h = (d.couverture && d.couverture.fenetreH) || 36;
  const B = [];
  const t = (fr, enTxt) => B.push({ t: 'texte', texte: en ? enTxt : fr });
  if (cle === 'assistant') {
    t('Je comprends votre question (pays, région, période, thème) avec des règles fixes, puis je rassemble ce que la base de SentiqS contient : niveaux calculés, faits collectés et leur cotation, incidents vérifiés, agenda. Je ne rédige rien et je ne cherche rien hors de l\'application : quand la base ne sait pas, je le dis.',
      'I read your question (country, region, period, theme) with fixed rules, then gather what the SentiqS database holds: computed levels, collected facts and their rating, verified incidents, agenda. I write nothing myself and search nothing outside the application: when the database does not know, I say so.');
    t('Un même fait rapporté par plusieurs médias n\'apparaît qu\'une fois, avec la liste de ses sources.', 'A fact reported by several outlets appears once, with the list of its sources.');
  } else if (cle === 'cotation') {
    B.push({ t: 'liste', titre: en ? 'Rating of a fact' : 'Cotation d\'un fait', items: (en ? [
      'Confirmed: reported by at least two distinct sources (not an official confirmation).',
      'Probable: a single source, rated reliable.',
      'Unconfirmed: a single source, below the reliability threshold.',
      'Analyst-validated / Rejected by analyst: an analyst has reviewed the fact; their decision prevails over the automatic rule.',
    ] : [
      'Confirmé : rapporté par au moins deux sources distinctes (ce n\'est pas une confirmation officielle).',
      'Probable : une seule source, jugée fiable.',
      'Non confirmé : une seule source, sous le seuil de fiabilité.',
      'Validé analyste / Infirmé par l\'analyste : un analyste a examiné le fait ; sa décision prime sur la règle automatique.',
    ]).map((x) => ({ texte: x })) });
  } else if (cle === 'validation') {
    t('Chaque matin avant 7 h GMT, un analyste examine les faits critiques et les faits élevés rapportés par une seule source, et les cote selon la grille de l\'Amirauté (fiabilité de la source de A à F, crédibilité de l\'information de 1 à 6). Sa décision change la cotation affichée, jamais le niveau du pays.',
      'Every morning before 7 am GMT, an analyst reviews critical facts and high facts reported by a single source, and rates them on the Admiralty grid (source reliability A to F, information credibility 1 to 6). The decision changes the rating shown, never the country\'s level.');
  } else if (cle === 'niveau') {
    t('Cinq niveaux : vert (stable), jaune (modéré), orange (élevé), marron (critique), rouge (grave). Le niveau part d\'un socle d\'incidents vérifiés et datés, auquel s\'ajoutent des facteurs structurels et les faits collectés.',
      'Five levels: green (stable), yellow (moderate), orange (high), maroon (critical), red (severe). The level starts from a base of verified, dated incidents, plus structural factors and collected facts.');
    t('La collecte seule ne fait pas passer un pays au rouge : il faut un fait recoupé par une seconde source ou classé critique.', 'Collection alone cannot turn a country red: it takes a fact corroborated by a second source or rated critical.');
  } else if (cle === 'bulletin') {
    t('Chaque jour, un bulletin public et gratuit par pays : niveau, faits cotés, ce qui porte le niveau, ce que nous ne savons pas, liens vers les avis officiels aux voyageurs.',
      'Every day, a free public bulletin for each country: level, rated facts, what drives the level, what we do not know, links to official travel advice.');
    t('Les abonnés peuvent en programmer l\'envoi (pays, heure, e-mail, Telegram ou WhatsApp) depuis Paramètres.', 'Subscribers can schedule its delivery (countries, time, e-mail, Telegram or WhatsApp) from Settings.');
    B.push({ t: 'lien', texte: en ? 'Bulletins for the 54 countries' : 'Bulletins des 54 pays', url: (d.bulletinsBase || 'bulletins/') + 'index.html' });
    (interp.pays || []).slice(0, 3).forEach((cy) => B.push({ t: 'lien', texte: (en ? 'Free daily bulletin — ' : 'Bulletin quotidien gratuit — ') + ((d.pays && d.pays[cy] && d.pays[cy].nom) || cy), url: (d.bulletinsBase || 'bulletins/') + cy + '/dernier.html' }));
  } else if (cle === 'forfaits') {
    const f = d.forfaits || [];
    if (f.length) B.push({ t: 'liste', titre: en ? 'Plans' : 'Forfaits', items: f.map((x) => ({ texte: x.nom + ' — ' + (x.prix ? x.prix.toLocaleString(en ? 'en-GB' : 'fr-FR') + ' FCFA' + (x.periode || '') : (en ? 'free, 72 hours' : 'gratuit, 72 heures')) })) });
    t('Paiement par Orange Money, Wave ou virement ; le forfait est actif à votre prochaine connexion, après vérification du paiement.', 'Payment by Orange Money, Wave or bank transfer; the plan is active at your next sign-in, once the payment is checked.');
  } else if (cle === 'essai') {
    t('L\'essai gratuit dure 72 heures ; votre adresse e-mail suffit, aucune carte bancaire n\'est demandée. Il s\'arrête de lui-même, sans prélèvement.',
      'The free trial lasts 72 hours; your e-mail address is enough, no bank card is asked. It stops by itself, with no charge.');
  } else if (cle === 'sources') {
    t((d.nbSources ? d.nbSources + ' sources suivies' : 'Les sources suivies') + ' : presse nationale, agences de presse, institutions et organisations régionales, collectées plusieurs fois par jour. Chaque source a une note de fiabilité ; seules les mieux notées peuvent faire monter un niveau.',
      (d.nbSources ? d.nbSources + ' sources monitored' : 'Sources monitored') + ': national press, news agencies, institutions and regional organisations, collected several times a day. Each source has a reliability score; only the best-rated can raise a level.');
  } else if (cle === 'fenetre') {
    t('Un article compte comme actualité pendant ' + h + ' heures. Un pays sans actualité dans cette fenêtre est signalé « muet » : ce silence ne veut pas dire calme, c\'est un pays sur lequel l\'outil ne voit rien.',
      'An article counts as news for ' + h + ' hours. A country with no news in that window is flagged “silent”: silence does not mean calm, it is a country the tool cannot see.');
  } else if (cle === 'donnees') {
    t('Votre compte sert à vous connecter et à appliquer votre forfait. Vous pouvez le supprimer vous-même depuis Paramètres, à tout moment et sans frais. Vos questions à l\'assistant restent sur votre appareil.',
      'Your account is used to sign in and apply your plan. You can delete it yourself from Settings, at any time and free of charge. Your questions to the assistant stay on your device.');
  } else if (cle === 'mobile') {
    t('Oui : l\'application s\'ouvre dans le navigateur d\'un ordinateur, d\'une tablette ou d\'un téléphone, avec une présentation adaptée à chaque écran.',
      'Yes: the application opens in the browser of a computer, tablet or phone, with a layout suited to each screen.');
  }
  return B;
}

const API = { FAQ_ASSISTANT: FAQ, interpreterQuestion, composerReponse, regrouperFaits, correspondTheme, indexPays, exemplesAssistant: exemples, THEMES_ASSISTANT: THEMES, REGIONS_ASSISTANT: REGIONS, LIB_ASSISTANT: LIB };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else global.SentiqAssistant = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
