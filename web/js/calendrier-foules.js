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
// L'Éthiopie et l'Érythrée fêtent Noël le 7 janvier (Genna), pas le 25 décembre.
const PAYS_SANS_NOEL_PUBLIC = ['DZ', 'LY', 'MR', 'MA', 'SO', 'TN', 'DJ', 'KM', 'ET', 'ER'];

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
    descFr: 'Fête du nouvel an musulman, rassemblements de quartier en soirée.', descEn: 'Islamic new year celebration, neighbourhood gatherings in the evening.' },
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
  "new year's eve": 'Saint-Sylvestre', "new year's evey": 'Saint-Sylvestre', 'new year holiday': 'Jour de l\'an', 'day of goodwill': 'Lendemain de Noël',
  'farmers\' day': 'Journée des agriculteurs', 'freedom and democracy day': 'Journée de la liberté et de la démocratie',
};
function titreFerie(h, lang) {
  const en = (h.titreEn || h.titre || '').trim();
  if (lang === 'en') return en;
  const fr = FERIES_FR[en.toLowerCase()];
  if (fr) return fr;
  // Nager.Date écrit parfois « nom local (nom anglais) » : le nom local d'abord.
  const loc = String(h.titre || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  // Un nom propre sans équivalent (« Jamhuri Day ») garde son nom, présenté
  // comme tel : jamais une phrase anglaise seule dans l'interface française.
  if (!loc || loc.toLowerCase() === en.toLowerCase()) return 'Jour férié : ' + en;
  return loc;
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
      _ts: ms, _calendrier: true, _ferie: true,
    };
  }).sort((x, y) => x._ts - y._ts);
}

const API = { evenementsCalendrier, feriesVersAgenda, titreFerie, paques, hegire, PAYS_FETES_MUSULMANES };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else global.SentiqCalendrier = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
