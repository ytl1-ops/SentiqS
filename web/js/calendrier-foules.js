// ═══════════════════════════════════════════════════════════════════════════
//  SentiqS — CALENDRIER DES GRANDS RASSEMBLEMENTS (14/11/2026)
//
//  Demande de YORO : un agenda riche des événements qui « drainent du monde »
//  et pèsent donc sur les mouvements de foule et la sûreté d'un pays. La
//  presse n'annonce souvent une Tabaski ou un Magal que la veille ; leur date
//  se calcule. Ce module les calcule, sans réseau ni clé :
//
//  - fêtes musulmanes (Aïd el-Fitr / Korité, Aïd el-Kébir / Tabaski,
//    Maouloud, Achoura / Tamkharit, Nuit du Destin, début du Ramadan) :
//    calendrier Umm al-Qura de la bibliothèque Intl du navigateur. Ce sont des
//    dates ESTIMÉES — l'observation du croissant lunaire peut les décaler d'un
//    jour selon le pays — et l'écran le dit ;
//  - grands pèlerinages nationaux : Grand Magal de Touba (18 safar, Sénégal),
//    Gamou de Tivaouane (Maouloud, Sénégal), pèlerinage marial de Popenguine
//    (lundi de Pentecôte, Sénégal), Martyrs de l'Ouganda à Namugongo (3 juin),
//    Timkat et Meskel (Éthiopie, Érythrée) ;
//  - fêtes chrétiennes à fort déplacement : Pâques (comput grégorien), Noël.
//
//  Les jours fériés officiels de chaque pays viennent, eux, de Nager.Date
//  (web/agenda/externe.json, écrit par scripts/sources-agenda.js) : quand un
//  pays y publie déjà la même fête, le calcul s'efface pour ce pays (une
//  ligne par fait, pas deux).
//
//  Aucun incident n'entre ici : ce sont des calendriers.
//  Module pur, double export : testé par scripts/test/calendrier-foules.test.js.
// ═══════════════════════════════════════════════════════════════════════════
(function (global) {
'use strict';

const JOUR = 86400000;
// Pays où la fête musulmane rassemble l'essentiel de la population ou une
// très large communauté (jour férié dans chacun d'eux).
const PAYS_FETES_MUSULMANES = ['DZ', 'BJ', 'BF', 'CM', 'TD', 'KM', 'CI', 'DJ', 'EG', 'ER', 'ET', 'GM', 'GH', 'GN', 'GW',
  'KE', 'LY', 'ML', 'MR', 'MA', 'NE', 'NG', 'SN', 'SL', 'SO', 'SD', 'TZ', 'TG', 'TN', 'UG'];
// L'Éthiopie et l'Érythrée fêtent Noël le 7 janvier (Genna), pas le 25 décembre ;
// l'Égypte aussi (Noël copte, 7 janvier) : son 25 décembre n'est pas férié.
// Audit du 27/11/2026 : l'agenda annonçait « Noël — Égypte » le 25 décembre.
const PAYS_SANS_NOEL_PUBLIC = ['DZ', 'LY', 'MR', 'MA', 'SO', 'TN', 'DJ', 'KM', 'ET', 'ER', 'EG'];

// Fêtes du calendrier hégirien : [mois, jour].
const FETES_HEGIRE = [
  { cle: 'ramadan', m: 9, j: 1, fr: 'Début du Ramadan', en: 'Start of Ramadan', type: 'religieux', impact: 'faible',
    descFr: 'Premier jour du jeûne. Horaires de travail et de circulation modifiés pendant un mois ; affluence en soirée autour des mosquées et des marchés.',
    descEn: 'First day of the fast. Working and traffic hours change for a month; evening crowds around mosques and markets.' },
  { cle: 'qadr', m: 9, j: 27, fr: 'Nuit du Destin (Laylat al-Qadr)', en: 'Night of Power (Laylat al-Qadr)', type: 'religieux', impact: 'moyen',
    descFr: 'Nuit de prière : très forte affluence dans les mosquées, déplacements nocturnes.', descEn: 'Night of prayer: very large crowds in mosques, night-time travel.' },
  { cle: 'fitr', m: 10, j: 1, fr: 'Aïd el-Fitr (Korité)', en: 'Eid al-Fitr', type: 'religieux', impact: 'moyen',
    descFr: 'Fin du Ramadan. Grandes prières collectives le matin, déplacements familiaux massifs les jours précédents.', descEn: 'End of Ramadan. Large collective prayers in the morning, heavy family travel in the days before.' },
  { cle: 'adha', m: 12, j: 10, fr: 'Aïd el-Kébir (Tabaski)', en: 'Eid al-Adha (Tabaski)', type: 'religieux', impact: 'haut',
    descFr: 'Plus grande fête de l\'année dans une grande partie de l\'Afrique de l\'Ouest : exode vers l\'intérieur, marchés au bétail saturés, routes et gares routières très chargées.',
    descEn: 'The biggest celebration of the year across much of West Africa: travel to home towns, saturated livestock markets, very busy roads and bus stations.' },
  { cle: 'achoura', m: 1, j: 10, fr: 'Achoura (Tamkharit)', en: 'Ashura (Tamkharit)', type: 'religieux', impact: 'faible',
    // 10 mouharram, dix jours APRÈS le nouvel an hégirien (1er mouharram) :
    // la description disait « nouvel an musulman » jusqu'au 27/11/2026.
    descFr: 'Dixième jour de mouharram (Tamkharit au Sénégal) : veillées et rassemblements de quartier en soirée.', descEn: 'Tenth day of Muharram (Tamkharit in Senegal): vigils and neighbourhood gatherings in the evening.' },
  { cle: 'mawlid', m: 3, j: 12, fr: 'Maouloud (naissance du Prophète)', en: 'Mawlid (Prophet\'s birthday)', type: 'religieux', impact: 'moyen',
    descFr: 'Veillées religieuses et grands rassemblements confrériques.', descEn: 'Religious vigils and large brotherhood gatherings.' },
];
const PELERINAGES_HEGIRE = [
  { cle: 'magal', m: 2, j: 18, cy: 'SN', fr: 'Grand Magal de Touba', en: 'Grand Magal of Touba', type: 'religieux', impact: 'haut',
    descFr: 'Pèlerinage mouride : plusieurs millions de fidèles à Touba. Axes Dakar–Touba saturés plusieurs jours avant et après.',
    descEn: 'Mouride pilgrimage: several million faithful in Touba. Dakar–Touba routes saturated for several days before and after.' },
  { cle: 'gamou', m: 3, j: 12, cy: 'SN', fr: 'Gamou de Tivaouane', en: 'Gamou of Tivaouane', type: 'religieux', impact: 'haut',
    descFr: 'Célébration du Maouloud par la confrérie tidiane : très forte affluence à Tivaouane, axes vers Thiès et Dakar chargés.',
    descEn: 'Mawlid celebration by the Tijaniyya: very large crowds in Tivaouane, heavy traffic towards Thiès and Dakar.' },
];

const MOIS_ABBR = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];

// Date hégirienne (Umm al-Qura) d'un jour grégorien. Mise en cache : un
// formateur Intl coûte cher et le même jour est demandé à chaque rendu.
let _fmt = null;
const _cache = new Map();
function hegire(ms) {
  const k = Math.floor(ms / JOUR);
  if (_cache.has(k)) return _cache.get(k);
  let r = null;
  try {
    if (!_fmt) _fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });
    const parts = _fmt.formatToParts(new Date(k * JOUR + 12 * 3600000));
    const j = parseInt((parts.find((p) => p.type === 'day') || {}).value, 10);
    const m = parseInt((parts.find((p) => p.type === 'month') || {}).value, 10);
    if (j && m) r = { j, m };
  } catch (_) { r = null; }
  _cache.set(k, r);
  return r;
}

// Pâques grégorienne (algorithme de Meeus/Jones/Butcher).
function paques(annee) {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(annee, mois - 1, jour);
}
function bissextile(a) { return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0; }

function fetesFixes(annee) {
  const p = paques(annee);
  // Timkat et Meskel tombent un jour plus tard l'année grégorienne qui
  // précède une année bissextile éthiopienne (calendrier éthiopien).
  const decale = bissextile(annee + 1) ? 1 : 0;
  const tousSaufNoel = (toutes) => toutes.filter((cy) => !PAYS_SANS_NOEL_PUBLIC.includes(cy));
  return [
    { cle: 'paques', ms: p, pays: 'chretiens', fr: 'Pâques', en: 'Easter', type: 'religieux', impact: 'moyen', exact: true,
      descFr: 'Veillée et offices très fréquentés, déplacements familiaux sur le week-end prolongé.', descEn: 'Crowded vigils and services, family travel over the long weekend.' },
    { cle: 'popenguine', ms: p + 50 * JOUR, pays: ['SN'], fr: 'Pèlerinage marial de Popenguine', en: 'Marian pilgrimage of Popenguine', type: 'religieux', impact: 'moyen', exact: true,
      descFr: 'Lundi de Pentecôte : des dizaines de milliers de pèlerins à Popenguine, axe Dakar–Mbour chargé.', descEn: 'Whit Monday: tens of thousands of pilgrims in Popenguine, busy Dakar–Mbour road.' },
    { cle: 'namugongo', ms: Date.UTC(annee, 5, 3), pays: ['UG'], fr: 'Martyrs de l\'Ouganda — Namugongo', en: 'Uganda Martyrs Day — Namugongo', type: 'religieux', impact: 'haut', exact: true,
      descFr: 'Pèlerinage de plusieurs millions de fidèles au sanctuaire de Namugongo, venus de toute la région.', descEn: 'Pilgrimage of several million faithful to the Namugongo shrine, from across the region.' },
    { cle: 'timkat', ms: Date.UTC(annee, 0, 19 + (bissextile(annee) ? 1 : 0)), pays: ['ET', 'ER'], fr: 'Timkat (Épiphanie orthodoxe)', en: 'Timkat (Orthodox Epiphany)', type: 'religieux', impact: 'moyen', exact: true,
      descFr: 'Processions massives, notamment à Addis-Abeba et Gondar.', descEn: 'Massive processions, notably in Addis Ababa and Gondar.' },
    { cle: 'meskel', ms: Date.UTC(annee, 8, 27 + decale), pays: ['ET', 'ER'], fr: 'Meskel', en: 'Meskel', type: 'religieux', impact: 'moyen', exact: true,
      descFr: 'Grand feu de Meskel Square à Addis-Abeba : foule très dense en soirée.', descEn: 'Great bonfire on Meskel Square in Addis Ababa: very dense evening crowd.' },
    { cle: 'noel', ms: Date.UTC(annee, 11, 25), pays: 'chretiens', fr: 'Noël', en: 'Christmas', type: 'religieux', impact: 'moyen', exact: true,
      descFr: 'Veillées et offices très fréquentés, déplacements familiaux et marchés saturés les jours précédents.', descEn: 'Crowded vigils and services, family travel and busy markets in the days before.' },
  ].map((f) => Object.assign(f, { pays: f.pays === 'chretiens' ? 'chretiens' : f.pays, _tousSaufNoel: tousSaufNoel }));
}

// Familles de fêtes, pour reconnaître dans les jours fériés officiels une
// fête que le calcul produit aussi (et ne la montrer qu'une fois).
const FAMILLE_FERIE = {
  fitr: /(fitr|korit|aid el seghir|eid al-?fitr|end of ramadan|ramadan feast)/i,
  adha: /(adha|tabaski|kebir|kabir|eid al-?kabir|sacrifice)/i,
  mawlid: /(mawlid|maouloud|mouloud|prophet|nabi|gamou)/i,
  achoura: /(ashura|achoura|tamkharit)/i,
  qadr: /(qadr|leylatoul|destin)/i,
  ramadan: /(start of ramadan|debut du ramadan)/i,
  paques: /(easter|paques|pâques)/i,
  noel: /(christmas|noel|noël)/i,
  timkat: /(timkat|epiphany \(orthodox\)|orthodox epiphany)/i,
  meskel: /(meskel|finding of the true cross)/i,
};

/**
 * evenementsCalendrier(debutMs, finMs, o) → entrées d'agenda (même forme que
 * AGENDA). o.paysConnus : codes des pays suivis (pour « chrétiens » = tous
 * sauf PAYS_SANS_NOEL_PUBLIC) ; o.feriesOfficiels : entrées de externe.json
 * (pour l'effacement des doublons) ; o.lang ; o.nomPays(cy).
 */
function evenementsCalendrier(debutMs, finMs, o) {
  const opts = o || {};
  const en = opts.lang === 'en';
  const connus = opts.paysConnus || [];
  const nomPays = opts.nomPays || ((cy) => cy);
  const feries = opts.feriesOfficiels || [];
  const out = [];
  const ajouter = (f, ms, pays, estime) => {
    let liste = (pays === 'chretiens' ? connus.filter((cy) => !PAYS_SANS_NOEL_PUBLIC.includes(cy)) : pays).slice();
    const fam = FAMILLE_FERIE[f.cle];
    if (fam) {
      liste = liste.filter((cy) => !feries.some((h) => h.cy === cy && Math.abs(Date.parse(h.date + 'T12:00:00Z') - ms) <= 2 * JOUR
        && fam.test((h.titreEn || '') + ' ' + (h.titre || ''))));
    }
    if (!liste.length) return;
    const d = new Date(ms);
    const cyLib = liste.length === 1 ? nomPays(liste[0])
      : (en ? liste.length + ' countries' : liste.length + ' pays');
    out.push({
      id: 'cal-' + f.cle + '-' + new Date(ms).toISOString().slice(0, 10),
      day: String(d.getUTCDate()).padStart(2, '0'), month: MOIS_ABBR[d.getUTCMonth()], year: String(d.getUTCFullYear()), hour: '',
      title: (en ? f.en : f.fr) + (estime ? (en ? ' (estimated date)' : ' (date estimée)') : ''),
      desc: (en ? f.descEn : f.descFr) + (estime ? (en ? ' Date computed from the Umm al-Qura calendar; it depends on the sighting of the crescent moon and may vary by one day between countries.'
        : ' Date calculée d\'après le calendrier Umm al-Qura ; elle dépend de l\'observation du croissant lunaire et peut varier d\'un jour selon le pays.') : ''),
      type: f.type, status: 'planifie', cy: cyLib, _pays: liste, impact: f.impact,
      src: en ? 'SentiqS calendar (computed)' : 'Calendrier SentiqS (calcul)', surl: null,
      _ts: ms, _calendrier: true, _estime: !!estime,
    });
  };
  // Fêtes hégiriennes : on parcourt les jours de la période.
  for (let t = Math.floor(debutMs / JOUR) * JOUR; t <= finMs; t += JOUR) {
    const h = hegire(t);
    if (!h) break; // Intl sans calendrier islamique : on ne devine pas
    FETES_HEGIRE.forEach((f) => { if (h.m === f.m && h.j === f.j) ajouter(f, t, PAYS_FETES_MUSULMANES, true); });
    PELERINAGES_HEGIRE.forEach((f) => { if (h.m === f.m && h.j === f.j) ajouter(f, t, [f.cy], true); });
  }
  const a0 = new Date(debutMs).getUTCFullYear(), a1 = new Date(finMs).getUTCFullYear();
  for (let a = a0; a <= a1; a++) {
    fetesFixes(a).forEach((f) => { if (f.ms >= Math.floor(debutMs / JOUR) * JOUR && f.ms <= finMs) ajouter(f, f.ms, f.pays, false); });
  }
  return out.sort((x, y) => x._ts - y._ts);
}

// Libellés français des jours fériés les plus courants de Nager.Date (qui
// les publie en anglais). Le reste garde son nom local.
const FERIES_FR = {
  "new year's day": 'Jour de l\'an', 'christmas day': 'Noël', 'christmas eve': 'Veille de Noël', "st. stephen's day": 'Lendemain de Noël',
  'boxing day': 'Lendemain de Noël', 'independence day': 'Fête de l\'indépendance', 'national day': 'Fête nationale',
  'republic day': 'Fête de la République', "international women's day": 'Journée internationale des femmes', 'international women’s day': 'Journée internationale des femmes',
  "women's day": 'Journée des femmes', 'revolution day': 'Fête de la Révolution', 'liberation day': 'Fête de la Libération',
  'armed forces day': 'Journée des forces armées', 'unity day': 'Journée de l\'unité', 'national peace day': 'Journée nationale de la paix',
  "martyrs' day": 'Journée des martyrs', 'martyrs day': 'Journée des martyrs', 'youth day': 'Fête de la jeunesse', "national heroes' day": 'Journée des héros nationaux',
  "heroes' day": 'Journée des héros', 'constitution day': 'Fête de la Constitution', 'democracy day': 'Fête de la démocratie',
  'easter sunday': 'Pâques', 'easter monday': 'Lundi de Pâques', 'good friday': 'Vendredi saint', 'labour day': 'Fête du travail',
  'ascension day': 'Ascension', 'whit monday': 'Lundi de Pentecôte', 'assumption day': 'Assomption', "all saints' day": 'Toussaint',
  'immaculate conception': 'Immaculée Conception', 'the feast of the immaculate conception': 'Immaculée Conception', 'human rights day': 'Journée des droits de l\'homme',
  'christmas day (orthodox)': 'Noël orthodoxe', 'orthodox christmas': 'Noël orthodoxe', 'coptic christmas': 'Noël copte',
  'proclamation of independence day': 'Proclamation de l\'indépendance', 'proclamation of independence': 'Proclamation de l\'indépendance',
  "new year's eve": 'Saint-Sylvestre', "new year's evey": 'Saint-Sylvestre', 'day of goodwill': 'Lendemain de Noël',
  'farmers\' day': 'Journée des agriculteurs', 'freedom and democracy day': 'Journée de la liberté et de la démocratie',
  // Audit du 27/11/2026 : ces fêtes s'affichaient en portugais, en swahili,
  // en amharique ou en arabe dans l'interface française.
  'amazigh new year': 'Nouvel an amazigh (Yennayer)', carnival: 'Carnaval', 'holy saturday': 'Samedi saint',
  'liberation day': 'Fête de la Libération', 'day of the liberation of southern africa': 'Journée de la libération de l\'Afrique australe',
  'são tomé day': 'Fête de São Tomé', "heroes's day": 'Journée des héros', 'remembrance day': 'Journée du souvenir',
  "people's sovereignty day": 'Journée de la souveraineté du peuple', 'vodoun festival': 'Fête du vodoun (religions endogènes)',
  'zanzibar revolution day': 'Fête de la Révolution de Zanzibar', 'orthodox epiphany': 'Timkat (Épiphanie orthodoxe)',
  'epiphany (orthodox)': 'Timkat (Épiphanie orthodoxe)', 'adwa victory day': 'Victoire d\'Adoua',
  'revolution day 2011 / national police day': 'Fête de la Révolution du 25 janvier et de la Police',
  'day of reconciliation': 'Journée de la réconciliation', 'renovation day': 'Fête de la Rénovation',
  'nigerien republic day': 'Fête de la République', 'national decoration day': 'Journée nationale de la décoration',
  'new year holiday': 'Lendemain du jour de l\'an', 'korité': 'Aïd el-Fitr (Korité)', 'leylatoul qadr': 'Nuit du Destin (Laylat al-Qadr)',
};
// Pays dont Nager.Date publie le nom local EN FRANÇAIS : ailleurs, le nom
// local est en portugais, en swahili, en arabe ou en amharique, et ne doit
// pas s'afficher seul dans l'interface française (une seule langue).
const PAYS_NOM_LOCAL_FR = ['BJ', 'BF', 'BI', 'CM', 'CF', 'KM', 'CG', 'CD', 'CI', 'DJ', 'GA', 'GN', 'MG', 'ML', 'NE', 'RW', 'SN', 'SC', 'TD', 'TG'];
// « (Roughly Date) » : Nager.Date dit lui-même que la date est approchée.
const APPROCHEE_RE = /\s*\(roughly date\)\s*$/i;
const PONT_RE = /\s*\(ponte\)\s*$/i;
function titreFerie(h, lang) {
  let en = (h.titreEn || h.titre || '').trim();
  const approchee = APPROCHEE_RE.test(en) || APPROCHEE_RE.test(String(h.titre || ''));
  const pont = PONT_RE.test(en);
  en = en.replace(APPROCHEE_RE, '').replace(PONT_RE, '').trim();
  const suffixe = approchee ? (lang === 'en' ? ' (estimated date)' : ' (date estimée)') : '';
  const md = String(h.date || '').slice(5);
  const base = FERIES_FR[en.toLowerCase()];
  if (lang === 'en') {
    let t = en.replace(/new year's evey/i, "New Year's Eve");
    if (base === 'Jour de l\'an' && md !== '01-01') t = "Day after New Year's Day";
    else if ((base === 'Lendemain de Noël' && md !== '12-26') || (base === 'Noël' && md !== '12-25')) t += ' (substitute day)';
    return (pont ? 'Bridge day: ' : '') + t + suffixe;
  }
  let fr = base;
  if (!fr) {
    // Nager.Date écrit parfois « nom local (nom anglais) » : le nom local, s'il
    // est en français (pays francophone, écriture latine).
    const loc = String(h.titre || '').replace(APPROCHEE_RE, '').split(' (')[0].trim();
    const latin = !/[^\u0000-ɏ’]/.test(loc);
    if (loc && latin && loc.toLowerCase() !== en.toLowerCase() && PAYS_NOM_LOCAL_FR.includes(h.cy)) fr = loc;
    // Un nom propre sans équivalent (« Jamhuri Day ») garde son nom, présenté
    // comme tel : jamais une phrase étrangère seule dans l'interface française.
    else fr = 'Jour férié : ' + en;
  }
  // Un jour reporté ou un second jour porte le même nom anglais que la fête :
  // le dire, sinon « Jour de l'an » s'affiche le 1er ET le 2 janvier.
  if (fr === 'Jour de l\'an' && md !== '01-01') fr = 'Lendemain du jour de l\'an';
  else if (fr === 'Lendemain de Noël' && md !== '12-26') fr = 'Lendemain de Noël (jour reporté)';
  else if (fr === 'Noël' && md !== '12-25') fr = 'Noël (jour reporté)';
  return (pont ? 'Pont : ' : '') + fr + suffixe;
}

// Famille d'une fête officielle (FAMILLE_FERIE), pour la réunir à la même
// fête calculée.
function familleFerie(h) {
  const t = (h.titreEn || '') + ' ' + (h.titre || '');
  return Object.keys(FAMILLE_FERIE).find((k) => FAMILLE_FERIE[k].test(t)) || null;
}

/**
 * feriesVersAgenda(liste, lang, nomPays) : les jours fériés officiels en
 * entrées d'agenda. Le même jour férié, à la même date, dans plusieurs pays
 * (Noël dans 42 pays, le jour de l'an dans 50) devient UNE ligne qui liste
 * ses pays : quarante-deux lignes « Noël » ne disent rien de plus qu'une.
 */
function feriesVersAgenda(liste, lang, nomPays) {
  const en = lang === 'en';
  const groupes = new Map();
  (liste || []).filter((h) => h && h.date && h.cy).forEach((h) => {
    // Clé sur le libellé français : « Boxing Day » et « St. Stephen's Day »
    // sont le même lendemain de Noël.
    const k = h.date + '|' + titreFerie(h, 'fr').toLowerCase();
    if (!groupes.has(k)) groupes.set(k, { h, pays: [] });
    const g = groupes.get(k);
    if (!g.pays.includes(h.cy)) g.pays.push(h.cy);
  });
  return [...groupes.values()].map(({ h, pays }) => {
    const ms = Date.parse(h.date + 'T00:00:00Z');
    const d = new Date(ms);
    const cyLib = pays.length === 1 ? (nomPays ? nomPays(pays[0]) : pays[0]) : (en ? pays.length + ' countries' : pays.length + ' pays');
    return {
      id: 'ferie-' + pays.join('') .slice(0, 12) + '-' + h.date + '-' + String(h.titreEn || '').length,
      day: String(d.getUTCDate()).padStart(2, '0'), month: MOIS_ABBR[d.getUTCMonth()], year: String(d.getUTCFullYear()), hour: '',
      title: titreFerie(h, lang), type: 'ceremonie', status: 'planifie', cy: cyLib, _pays: pays, impact: 'faible',
      desc: en ? 'Official public holiday: administrations and many businesses closed; ceremonies or parades possible depending on the day.'
        : 'Jour férié officiel : administrations et nombreux commerces fermés ; cérémonies ou défilés possibles selon la fête.',
      src: en ? 'Official public holidays (Nager.Date)' : 'Jours fériés officiels (Nager.Date)', surl: pays.length === 1 ? (h.surl || 'https://date.nager.at') : 'https://date.nager.at',
      _ts: ms, _calendrier: true, _ferie: true, _famille: familleFerie(h),
    };
  }).sort((x, y) => x._ts - y._ts);
}


/**
 * fusionnerCalendrier(calc, off, lang, nomPays) : une fête, un jour, UNE ligne.
 * Audit du 27/11/2026 : « Noël — 42 pays » (fériés officiels) côtoyait
 * « Noël — 2 pays » (calcul, pour les pays que Nager.Date ne couvre pas), et
 * « Aïd el-Fitr — 29 pays » côtoyait « Korité — Mali » le même jour. Quand une
 * fête officielle et la même fête calculée tombent le même jour, leurs pays
 * sont réunis sur une ligne : celle du calcul si sa date est estimée (la
 * ligne le dit, avec les pays où elle est officielle), sinon celle du férié.
 */
function fusionnerCalendrier(calc, off, lang, nomPays) {
  const en = lang === 'en';
  const jour = (ms) => Math.floor(ms / JOUR);
  const libelle = (pays) => (pays.length === 1 ? (nomPays ? nomPays(pays[0]) : pays[0]) : (en ? pays.length + ' countries' : pays.length + ' pays'));
  const restants = (off || []).slice();
  const out = (calc || []).map((c) => {
    const cle = String(c.id || '').replace(/^cal-/, '').replace(/-\d{4}-\d\d-\d\d$/, '');
    const memes = restants.filter((o) => o._famille === cle && jour(o._ts) === jour(c._ts));
    if (!memes.length) return c;
    memes.forEach((o) => restants.splice(restants.indexOf(o), 1));
    const officiels = [...new Set(memes.flatMap((o) => o._pays || []))];
    const tous = [...new Set([...(c._pays || []), ...officiels])];
    if (!c._estime) {
      const base = memes[0];
      return Object.assign({}, base, { _pays: [...new Set([...officiels, ...(c._pays || [])])], cy: libelle(tous) });
    }
    const noms = officiels.map((cy) => (nomPays ? nomPays(cy) : cy)).join(', ');
    return Object.assign({}, c, {
      _pays: tous, cy: libelle(tous),
      desc: c.desc + (en ? ' Official date published for: ' + noms + '.' : ' Date officielle publiée pour : ' + noms + '.'),
    });
  });
  return out.concat(restants).sort((x, y) => x._ts - y._ts);
}

// Date d'un événement écrite en toutes lettres (« du 25 au 27 novembre »,
// « le 5 janvier », « du 19 novembre au 19 décembre 2026 », « November 30 »,
// « 3 de diciembre ») → { debutMs, finMs } à midi UTC, ou null : sans date
// écrite, rien n'est deviné. Partagée par la page (agenda détecté dans le
// Flux) et par l'agent de recherche (scripts/lib/agent-recherche.js).
// Sans année : l'occurrence passée si elle tombe dans les 60 jours qui
// précèdent la publication (un compte rendu du 26/11 qui parle « du
// 10 novembre »), sinon la suivante (un article du 28/12 qui annonce « le
// 5 janvier »). Jusqu'au 27/11/2026 une date déjà passée de plus de trois
// jours était renvoyée à l'année suivante.
const MOIS_TEXTE = {
  janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6, aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9, dezembro: 11,
  enero: 0, febrero: 1, marzo: 2, mayo: 4, junio: 5, julio: 6, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};
const PASSE_MAX_J = 60;
function dateAnnoncee(texte, publieMs) {
  const noms = Object.keys(MOIS_TEXTE).join('|');
  // Un lieu qui porte une date n'est pas une date : « stade du 1er mai de
  // Boké » datait l'article au 1er mai 2027 (mesuré le 27/11/2026).
  const t = String(texte || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(new RegExp('\\b(?:stade|stadium|place|square|boulevard|bd|avenue|av|rue|street|road|pont|carrefour|rond-point|lycee|college|ecole|universite|quartier|cite|marche|hopital|monument|camp|caserne|aeroport)\\s+(?:du\\s+|de\\s+|des\\s+|of\\s+)?\\d{1,2}(?:er)?\\s+(?:' + noms + ')\\b', 'g'), ' ');
  const pub = publieMs || Date.now();
  const an = (j, m, y) => {
    if (y) return Date.UTC(Number(y), m, Number(j), 12);
    const a = new Date(pub).getUTCFullYear();
    const passe = [a - 1, a].map((x) => Date.UTC(x, m, Number(j), 12)).filter((ms) => ms <= pub + JOUR).pop();
    if (passe !== undefined && pub - passe <= PASSE_MAX_J * JOUR) return passe;
    return [a, a + 1].map((x) => Date.UTC(x, m, Number(j), 12)).find((ms) => ms > pub + JOUR) || Date.UTC(a + 1, m, Number(j), 12);
  };
  const ok = (j) => Number(j) >= 1 && Number(j) <= 31;
  // « du 19 novembre au 19 décembre [2026] »
  let m = new RegExp('\\b(\\d{1,2})(?:er)?\\s+(' + noms + ')\\s*(?:-|au|to|a|–)\\s*(?:le\\s+)?(\\d{1,2})(?:er)?\\s+(' + noms + ')\\b(?:\\s+(20\\d\\d))?').exec(t);
  if (m && ok(m[1]) && ok(m[3])) {
    const fin = an(m[3], MOIS_TEXTE[m[4]], m[5]);
    const mFin = new Date(fin);
    let debut = Date.UTC(mFin.getUTCFullYear(), MOIS_TEXTE[m[2]], Number(m[1]), 12);
    if (debut > fin) debut = Date.UTC(mFin.getUTCFullYear() - 1, MOIS_TEXTE[m[2]], Number(m[1]), 12);
    return { debutMs: debut, finMs: fin };
  }
  // « du 25 au 27 novembre [2026] », « 25-27 novembre », « 25 et 26 novembre »
  m = new RegExp('\\b(\\d{1,2})(?:er)?\\s*(?:-|au|et|to|a|–)\\s*(\\d{1,2})\\s+(' + noms + ')\\b(?:\\s+(20\\d\\d))?').exec(t);
  if (m && ok(m[1]) && ok(m[2])) {
    const fin = an(m[2], MOIS_TEXTE[m[3]], m[4]);
    let debut = Date.UTC(new Date(fin).getUTCFullYear(), MOIS_TEXTE[m[3]], Number(m[1]), 12);
    if (debut > fin) debut = fin;
    return { debutMs: debut, finMs: fin };
  }
  // « 25 novembre [2026] », « le 1er décembre », « 3 de diciembre »
  m = new RegExp('\\b(\\d{1,2})(?:er|st|nd|rd|th)?\\s+(?:de\\s+)?(' + noms + ')\\b(?:\\s+(?:de\\s+)?(20\\d\\d))?').exec(t);
  if (m && ok(m[1])) { const d = an(m[1], MOIS_TEXTE[m[2]], m[3]); return { debutMs: d, finMs: d }; }
  // « November 25[, 2026] »
  m = new RegExp('\\b(' + noms + ')\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(20\\d\\d))?').exec(t);
  if (m && ok(m[2])) { const d = an(m[2], MOIS_TEXTE[m[1]], m[3]); return { debutMs: d, finMs: d }; }
  return null;
}

/**
 * statutParDate(debutMs, finMs, maintenant, statut) : le statut d'un
 * événement daté suit sa date. Audit du 27/11/2026 : le sommet de la CEDEAO
 * du 2 juillet s'affichait encore « URGENT » en tête de l'agenda fin novembre,
 * et un événement annoncé pour le 5 décembre passait « ACHEVÉ » 24 h après la
 * parution de l'article qui l'annonçait. Passé le dernier jour : achevé ;
 * entre le premier et le dernier jour : en cours ; à venir : le statut donné
 * (planifié, surveillance, urgent), jamais « achevé » ni « en cours ».
 */
function statutParDate(debutMs, finMs, maintenant, statut) {
  const d0 = Math.floor(debutMs / JOUR) * JOUR;
  const f1 = Math.floor(Math.max(finMs || debutMs, debutMs) / JOUR) * JOUR + JOUR;
  if (maintenant >= f1) return 'acheve';
  if (maintenant >= d0) return 'en-cours';
  return (statut === 'acheve' || statut === 'en-cours' || !statut) ? 'planifie' : statut;
}

const API = { evenementsCalendrier, feriesVersAgenda, fusionnerCalendrier, titreFerie, familleFerie, dateAnnoncee, statutParDate, paques, hegire, PAYS_FETES_MUSULMANES };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else global.SentiqCalendrier = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
