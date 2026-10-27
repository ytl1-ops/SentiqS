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

function sansAccents(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Familles d'événements, testées dans l'ordre : la première qui reconnaît le
// titre ou le chapô donne le repère. Mots en français ET en anglais, comme
// les lexiques de la page (62 titres sur 262 étaient en anglais).
const ENJEUX = [
  { cle: 'coup', re: /\b(coup d.?etat|putsch|junte|mutinerie|mutin|coup attempt|military takeover|junta)\b/,
    texte: 'Instabilité institutionnelle : couvre-feu, fermeture des frontières ou coupure des communications possibles. Vérifier les plans d\'évacuation et de continuité d\'activité, et les moyens de joindre les personnels.' },
  { cle: 'enlevement', re: /\b(enlev|kidnapp|otage|hostage|rapt|abduct)/,
    texte: 'Risque d\'enlèvement : discrétion des déplacements, suivi des personnels en mission et des visiteurs, vérification des procédures de crise et des contacts d\'urgence.' },
  { cle: 'attaque', re: /\b(attaqu|attack|embuscade|ambush|jihad|djihad|terror|insurg|bandits? arm|hommes armes|gunmen|assaillant|engin explosif|\bied\b|kamikaze|suicide bomb|massacre|frappe aerienne|airstrike|drone)/,
    texte: 'Menace armée sur les axes et localités de la zone : réévaluer les déplacements terrestres (horaires, convois, itinéraires de repli) et les consignes des sites et des personnels présents à proximité.' },
  { cle: 'manifestation', re: /\b(manifest|greve|strike|protest|emeute|riot|marche|sit-in|barricade|soulevement|boycott|syndicat)/,
    texte: 'Perturbations possibles de l\'activité et de la circulation : éviter les rassemblements, prévoir des horaires décalés ou le travail à distance, informer les personnels.' },
  { cle: 'criminalite', re: /\b(braquage|braqueur|robbery|vol a main|cambriol|coupeurs? de route|gang|criminal|cybercrim|escroquer|fraude|trafic|drogue|drug)/,
    texte: 'Criminalité de droit commun : vigilance sur les trajets et les arrêts, sécurisation des sites, des véhicules et des transferts de fonds.' },
  { cle: 'politique', re: /\b(election|electoral|scrutin|vote|campagne|candidat|opposition|partis?\b|referendum|constitution|parlement|assemblee nationale|gouvernement|ministre|president|arrestation|arrest|detention)/,
    texte: 'Climat politique à suivre : tensions possibles autour des échéances et des décisions institutionnelles. Adapter la veille et les déplacements aux dates sensibles.' },
  { cle: 'justice', re: /\b(peine de mort|death penalty|condamn|sentenc|tribunal|proces|trial|code penal|loi |law )/,
    texte: 'Évolution du cadre juridique et sécuritaire : à intégrer à l\'analyse pays et à la sensibilisation des personnels expatriés et locaux.' },
  { cle: 'accident', re: /\b(accident|crash|collision|incendie|fire|explosion|effondr|collapse|naufrage|chavir)/,
    texte: 'Risque accidentel ou technique : rappeler les consignes de sécurité routière et incendie, vérifier l\'exposition des sites et des prestataires.' },
  { cle: 'naturel', re: /\b(inondation|flood|pluie|rain|secheresse|drought|epidemi|cholera|ebola|mpox|paludisme|malaria|dengue|sanitaire|outbreak)/,
    texte: 'Risque naturel ou sanitaire : anticiper les perturbations logistiques et les mesures de protection des personnels (vaccination, consignes d\'hygiène, déplacements).' },
  { cle: 'frontiere', re: /\b(frontiere|border|refugi|refugee|deplac|displaced|migrant)/,
    texte: 'Pression aux frontières et mouvements de population : suivre l\'état des points de passage et des zones d\'accueil sur les itinéraires utilisés.' },
];
const ENJEU_PAR_CATEGORIE = {
  securite: 'Fait sécuritaire à suivre : vérifier son incidence sur les sites, les itinéraires et les personnels présents dans la zone.',
  politique: 'Climat politique à suivre : en mesurer l\'incidence sur la stabilité locale et les déplacements.',
  humanitaire: 'Contexte social à suivre : incidence possible sur l\'activité, la circulation et l\'environnement des sites.',
  economique: 'Incidence possible sur l\'environnement des affaires, les approvisionnements et la sûreté des opérations.',
};

function enjeuxSurete(f) {
  // Le titre décide, le chapô ne sert qu'à défaut (même règle que classify) :
  // « Le Burkina Faso rétablit la peine de mort », dont le chapô cite les
  // crimes de terrorisme, est un fait juridique, pas une attaque armée.
  const titre = sansAccents([f.titreFr, f.titre].filter(Boolean).join(' '));
  const chapo = sansAccents([f.resumeFr, f.resume].filter(Boolean).join(' '));
  const famille = ENJEUX.find((e) => e.re.test(titre)) || ENJEUX.find((e) => e.re.test(chapo));
  if (famille) return { cle: famille.cle, texte: famille.texte };
  return { cle: 'categorie', texte: ENJEU_PAR_CATEGORIE[f.cat] || ENJEU_PAR_CATEGORIE.economique };
}

function dateRedigee(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  return JOURS[d.getUTCDay()] + ' ' + (d.getUTCDate() === 1 ? '1er' : d.getUTCDate()) + ' ' + MOIS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

// Une phrase de titre, pas des majuscules : « Le Burkina Faso rétablit… ».
function phraseDe(f) {
  const t = nettoyerTitre(f.titreFr || f.titre).replace(/\s*[.!?…]+\s*$/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const EXTRAITS_MAX = 2;
const EXTRAIT_MAX_CAR = 420;
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
    : (f.resume ? [{ source: f.source, resume: f.resumeFr || f.resume, url: f.url }] : []));
  for (const e of candidats) {
    if (!e || !e.resume || extraits.length >= EXTRAITS_MAX) continue;
    const k = sansAccents(e.resume).slice(0, 80);
    if (vus.has(k)) continue;
    vus.add(k);
    extraits.push({ source: e.source || 'la source', texte: couper(e.resume, EXTRAIT_MAX_CAR) });
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

const NOTE_REDACTION = 'Faits marquants : textes établis à partir des médias cités, dont les chapôs sont reproduits entre guillemets. '
  + 'Les « enjeux sûreté » sont des repères par type d\'événement, à valider et compléter par l\'analyste.';

module.exports = { choisirMarquants, rediger, enjeuxSurete, MARQUANTS_CI, MARQUANTS_PAYS, NOTE_REDACTION, dateRedigee };
