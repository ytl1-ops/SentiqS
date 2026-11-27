// Les « faits marquants » du rapport GRSCI : un texte rédigé par fait au lieu
// d'un titre (demande de YORO du 23/10/2026 : « je veux un rapport avec des
// textes détaillés pour présenter les actu marquantes avec des photos et pas
// un ensemble de titres »).
//
// CE QUI EST RÉDIGÉ, ET CE QUI NE L'EST PAS. Le module n'invente aucun fait :
// - « Contexte » est fait des données du fait (pays, ville quand le texte la
//   nomme, date, rubrique, nombre de médias) ;
// - « Ce que rapportent les sources » CITE le chapô de chaque média, entre
//   guillemets et attribué ; sans chapô, il le dit et renvoie à l'article ;
// - « Enjeux sûreté » est un repère par famille d'événement (attaque,
//   enlèvement, manifestation…), écrit pour un responsable sûreté
//   d'entreprise. C'est une grille, pas une analyse du fait : la page
//   d'ouverture du rapport le dit, et l'analyste la reprend dans le Word.
//
// Pur : ni réseau ni page. Testé par scripts/test/grsci-marquants.test.js.
const { nettoyerTitre } = require('./faits-grsci');

// Langues d'origine qu'un rapport en français ne cite jamais telles quelles.
const LANGUES_ETRANGERES = new Set(['en', 'pt', 'ar']);

// Combien de faits rédigés : quatre pour la Côte d'Ivoire (pays du groupe),
// un par pays de la sous-région. Les autres restent en liste, comme le modèle.
const MARQUANTS_CI = 4;
const MARQUANTS_PAYS = 1;
// Les faits rédigés sont les plus graves ; un fait seulement « modéré » ne
// tient une page entière que s'il n'y a rien de plus grave dans le pays.
const RANG = { crit: 0, high: 1, mod: 2 };

/** Partage les faits (déjà triés par gravité puis date) en rédigés / liste. */
function choisirMarquants(faits, n) {
  const liste = (faits || []).slice();
  const marquants = [];
  for (const f of liste) {
    if (marquants.length >= n) break;
    if (marquants.length && (RANG[f.niveau] ?? 3) > 1) break;
    marquants.push(f);
  }
  return { marquants, autres: liste.filter((f) => !marquants.includes(f)) };
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
  'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const RUBRIQUE = { politique: 'politique', humanitaire: 'sociale', securite: 'sécuritaire', economique: 'économique', economie: 'économique' };

// Familles d'événement, repères et « à surveiller » : web/js/reperes-surete.js,
// partagé avec la fiche de synthèse de la page (26/11/2026).
const { sansAccents, enjeuxSurete, SURVEILLER } = require('../../web/js/reperes-surete');

// L'ANALYSE APRÈS CHAQUE ACTU (demande de YORO du 24/11/2026 : « Présentation 1,
// réalise des analyses après chaque actu publiée »). Comme le reste de ce
// module, elle n'invente rien et n'appelle aucun modèle de langue :
// - « Lecture » dit ce que les données du mois établissent sur le fait : son
//   recoupement, et sa place
//   parmi les faits de même nature relevés dans le pays sur la période
//   (premier, ou n-ième, avec la date du précédent) ;
// - « Implications » reprend le repère par famille d'événement (ENJEUX) ;
// - « À surveiller » donne, par famille, les signaux qui feraient évoluer la
//   lecture — ce qu'un analyste chercherait dans les jours suivants.
// Ni gravité, ni niveau d'alerte, ni score : le modèle du rapport n'en a pas.
const FAMILLE_LIB = {
  coup: 'd\'instabilité institutionnelle', enlevement: 'd\'enlèvement', attaque: 'de violence armée',
  manifestation: 'de mobilisation sociale', criminalite: 'de criminalité', homicide: 'de violence criminelle', drame: 'de drame individuel', politique: 'politique',
  justice: 'judiciaire ou réglementaire', accident: 'accidentel', naturel: 'naturel ou sanitaire', frontiere: 'frontalier ou migratoire',
};
function dateBreve(ms) {
  const d = new Date(ms);
  return (d.getUTCDate() === 1 ? '1er' : d.getUTCDate()) + ' ' + MOIS[d.getUTCMonth()];
}

/**
 * L'analyse d'un fait : { lecture, implications, surveiller }. `faitsPays`
 * est la liste de tous les faits du pays sur la période (le fait compris) :
 * c'est elle qui situe le fait parmi ceux de même nature.
 */
const FAMILLES_INCIDENT = new Set(['coup', 'enlevement', 'attaque', 'manifestation', 'criminalite', 'accident', 'homicide', 'naturel', 'frontiere']);
function analyserFait(f, faitsPays) {
  const famille = enjeuxSurete(f);
  const sources = (f.sources && f.sources.length ? f.sources : [f.source]).filter(Boolean);
  const morceaux = [];
  const recoupe = sources.length > 1
    ? 'recoupé par ' + sources.length + ' médias distincts'
    : 'rapporté par une seule source, à confirmer';
  // Pas de mot de gravité : le niveau qu'attribue la veille à un article
  // (« crit » pour « 2 morts par jour sur les routes ») n'est pas une gravité
  // de terrain, et l'écrire ici l'aurait fait passer pour une.
  morceaux.push('Fait ' + recoupe + '.');
  // La récurrence n'est lue que pour les incidents : « fait politique relevé
  // pour le 13e jour » ne dit rien qu'un lecteur ne sache, la politique fait
  // l'actualité tous les jours.
  if (FAMILLES_INCIDENT.has(famille.cle) && Array.isArray(faitsPays) && f.publieMs) {
    // Un même événement est souvent repris par plusieurs médias sous des
    // titres que le regroupement n'a pas réunis (le naufrage du lac Togo du
    // 9 novembre : deux fiches, qui se comptaient l'une l'autre et faisaient
    // une « série »). Les faits de même nature sont donc comptés par JOUR : un
    // jour avec ce type de fait compte une fois, et celui du fait ne compte pas.
    const jour = (ms) => Math.floor(ms / 86400000);
    const jf = jour(f.publieMs);
    const jours = new Map();
    for (const x of faitsPays) {
      if (!x || x === f || !x.publieMs || jour(x.publieMs) === jf || enjeuxSurete(x).cle !== famille.cle) continue;
      const j = jour(x.publieMs);
      if (!jours.has(j) || x.publieMs > jours.get(j)) jours.set(j, x.publieMs);
    }
    const avant = [...jours.entries()].filter(([j]) => j < jf).sort((a, b) => b[0] - a[0]).map(([, ms]) => ms);
    const apres = [...jours.keys()].filter((j) => j > jf).length;
    const lib = FAMILLE_LIB[famille.cle];
    if (!avant.length) {
      morceaux.push('Premier fait ' + lib + ' relevé dans le pays sur la période'
        + (apres ? ' ; d\'autres ont suivi sur ' + apres + ' jour' + (apres > 1 ? 's.' : '.') : '.'));
    } else {
      const n = avant.length + 1;
      // Trois jours en quatorze avec un fait de même nature : c'est une série,
      // pas un fait isolé — le mot qui change la lecture d'un responsable sûreté.
      const serie = n >= 3 && f.publieMs - avant[1] <= 14 * 86400000;
      morceaux.push('Fait ' + lib + ' relevé dans le pays pour le ' + n + 'e jour distinct sur la période (précédent : '
        + dateBreve(avant[0]) + ')' + (serie ? ' ; une série, pas un fait isolé.' : '.'));
    }
  }
  return { cle: famille.cle, lecture: morceaux.join(' '), implications: famille.texte, surveiller: 'À surveiller : ' + SURVEILLER[famille.cle] };
}

function dateRedigee(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  return JOURS[d.getUTCDay()] + ' ' + (d.getUTCDate() === 1 ? '1er' : d.getUTCDate()) + ' ' + MOIS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

// Une phrase de titre, pas des majuscules : « Le Burkina Faso rétablit… ».
// Un titre tout en capitales (« MALI : LE BILAN HUMAIN S'ALOURDIT… », Mali 24)
// crie au milieu de titres en casse de phrase : il y est ramené. Les noms
// propres sont ceux que le chapô écrit avec une capitale (« Guinée », « Kayes ») ;
// un sigle court (FAMa, ONU, AES) garde ses capitales.
function enCapitales(t) {
  const lettres = t.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
  if (lettres.length < 12) return false;
  return lettres.replace(/[^A-ZÀ-ÖØ-Þ]/g, '').length / lettres.length > 0.8;
}
function casseDePhrase(t, f) {
  const propres = new Map();
  const texte = [f.resumeFr, f.resume].concat((f.extraits || []).map((e) => e && e.resume)).filter(Boolean).join(' ');
  for (const m of texte.matchAll(/(?<![.!?»]\s)(?<![A-Za-zÀ-ÿ])([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ-]+)/g)) propres.set(m[1].toLowerCase(), m[1]);
  const sortie = t.replace(/[A-Za-zÀ-ÖØ-öø-ÿ-]+/g, (mot, pos) => {
    const bas = mot.toLowerCase();
    let r;
    if (propres.has(bas) && !MOTS_COURTS.has(bas)) r = propres.get(bas);
    else if (/^[A-ZÀ-ÖØ-Þ]{2,4}$/.test(mot) && !MOTS_COURTS.has(bas)) r = mot;
    else r = bas;
    return pos === 0 ? r.charAt(0).toUpperCase() + r.slice(1) : r;
  });
  // Après « : » le titre reprend souvent une phrase : « Mali : Le bilan… » non,
  // « Mali : le bilan… » oui (usage de la presse française).
  return sortie;
}
const MOTS_COURTS = new Set(['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'au', 'aux', 'par', 'pour', 'sur', 'dans', 'son', 'sa', 'ses', 'est', 'ont', 'qui', 'que', 'plus', 'mort', 'tue', 'tués', 'deux', 'onze', 'neuf', 'huit', 'sept', 'six', 'cinq', 'dix', 'the', 'and', 'of', 'in', 'to', 'for', 'on', 'at', 'by', 'with', 'from', 'two', 'dead', 'kill', 'lui', 'eux', 'nos', 'vos', 'leur', 'avec', 'sans', 'sous', 'vers', 'chez', 'face', 'mais', 'ou', 'où', 'ni', 'car', 'il', 'ils', 'elle', 'elles', 'on', 'se', 'ce', 'ces', 'cet', 'à', 'fin', 'an', 'ans', 'jour', 'mois', 'nord', 'sud', 'est', 'zone', 'camp', 'vie', 'loi', 'chef', 'roi', 'état', 'etat', 'pays', 'ville', 'bus', 'feu', 'armé', 'arme', 'bilan', 'aide', 'fête', 'fete', 'rue', 'port', 'or', 'riz', 'eau', 'pain', 'gaz', 'prix', 'taux', 'dette', 'vote', 'élu', 'elu', 'élus', 'elus', 'peur', 'deuil', 'drame', 'choc', 'raid', 'coup', 'tir', 'tirs', 'cas', 'mine', 'mines', 'crue', 'pont', 'voie', 'axe', 'poste', 'case', 'salon', 'match', 'club']);
function phraseDe(f) {
  let t = nettoyerTitre(f.titreFr || f.titre).replace(/\s*[.!?…]+\s*$/, '');
  if (enCapitales(t)) t = casseDePhrase(t, f);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const EXTRAITS_MAX = 2;
// 420 caractères jusqu'au 25/11/2026. YORO : « donner plus de texte dans
// l'actu ». Le texte cité vient du début de l'article quand le job a pu le
// lire (`long`, texte-article.js), sinon du chapô du flux. Il reste une COURTE
// citation : entre guillemets, attribuée au média, avec le lien vers
// l'article et « © site » sur la photo — jamais l'article entier.
const EXTRAIT_MAX_CAR = 650;
function couper(t, max) {
  const s = nettoyerTitre(t);
  return s.length > max ? s.slice(0, max).replace(/\s+\S*$/, '') + ' …' : s;
}

/**
 * Le texte d'un fait marquant : { titre, contexte, extraits[], sansExtrait,
 * enjeux, sources, liens[], cotation }. `nomPays` sert au contexte.
 */
function rediger(f, nomPays) {
  const sources = (f.sources && f.sources.length ? f.sources : [f.source]).filter(Boolean);
  const quand = dateRedigee(f.publieMs);
  // Pas de « concernant Côte d'Ivoire » : les noms de pays prennent un
  // article variable ; le lieu est donc donné tel quel, après « Lieu : ».
  const lieu = f.ville ? f.ville + ', ' + nomPays : nomPays;
  const rub = RUBRIQUE[f.cat] || 'diverse';
  const contexte = (quand ? 'Fait rapporté le ' + quand + '. ' : '')
    + 'Lieu : ' + lieu + '. Actualité ' + rub + '. '
    + (sources.length > 1
      ? 'Repris par ' + sources.length + ' médias distincts (' + sources.join(', ') + ') : le fait est recoupé.'
      : 'Une seule source à ce stade' + (sources[0] ? ' (' + sources[0] + ')' : '') + ' : à confirmer par un second média.');
  // Un chapô par média, au plus deux, en français quand la traduction existe.
  const vus = new Set();
  const extraits = [];
  const candidats = (f.extraits && f.extraits.length ? f.extraits
    : ((f.resume || f.texte) ? [{ source: f.source, resume: f.resumeFr || f.resume, url: f.url, langue: f.langue || null, fr: !!f.resumeFr,
      long: f.texteFr || f.texte || null, longFr: !!f.texteFr }] : []));
  for (const e of candidats) {
    if (!e || !(e.resume || e.long) || extraits.length >= EXTRAITS_MAX) continue;
    // Une seule langue par document (YORO, 19/11/2026) : un texte en langue
    // étrangère que le job n'a pas pu traduire n'est pas cité.
    const etranger = LANGUES_ETRANGERES.has(e.langue);
    const chapo = e.resume && (!etranger || e.fr) ? e.resume : null;
    const long = e.long && (!etranger || e.longFr) ? e.long : null;
    // Le début de l'article, quand il dit plus que le chapô (25/11/2026).
    const brut = long && long.length > (chapo || '').length + 40 ? long : chapo;
    if (!brut) continue;
    const k = sansAccents(brut).slice(0, 80);
    if (vus.has(k)) continue;
    vus.add(k);
    extraits.push({ source: e.source || 'la source', texte: couper(brut, EXTRAIT_MAX_CAR) });
  }
  const liens = (f.liens && f.liens.length ? f.liens : (f.url ? [{ source: f.source, url: f.url }] : []))
    .filter((l) => l && typeof l.url === 'string' && /^https?:\/\//.test(l.url));
  return {
    titre: phraseDe(f),
    contexte,
    extraits,
    sansExtrait: extraits.length ? null : 'Les médias n\'en publient que le titre dans leur flux : le détail est à lire dans l\'article (lien ci-dessous).',
    enjeux: enjeuxSurete(f).texte,
    sources,
    liens,
    video: typeof f.video === 'string' && /^https:\/\//.test(f.video) ? f.video : null,
  };
}

// Le texte qui suit chaque citation n'est plus annoncé par « Analyse » (YORO,
// 25/11/2026 : « fait l'analyse en dessous de l'actu sans indiquer
// analyse ») ; ce qu'il est, et d'où il vient, reste dit ici une fois.
const NOTE_REDACTION = 'Faits marquants : textes établis à partir des médias cités, dont les extraits sont reproduits entre guillemets, en courte citation, avec le lien vers l\'article. '
  + 'Le paragraphe qui suit chaque citation situe le fait parmi ceux de même nature relevés dans le pays sur la période ; '
  + 'implications et points à surveiller sont des repères par type d\'événement, à valider et compléter par l\'analyste.';

module.exports = { LANGUES_ETRANGERES, phraseDe, choisirMarquants, rediger, enjeuxSurete, analyserFait, SURVEILLER, MARQUANTS_CI, MARQUANTS_PAYS, NOTE_REDACTION, dateRedigee };
