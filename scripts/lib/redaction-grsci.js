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
  { cle: 'attaque', re: /\b(attaqu|attack|embuscade|ambush|jihad|djihad|terror|insurg|bandits? arm|hommes armes|gunmen|assaillant|engin explosif|\bied\b|kamikaze|suicide bomb|massacre|frappe aerienne|airstrike|frappes? de drone|attaque de drone|drone strike)/,
    texte: 'Menace armée sur les axes et localités de la zone : réévaluer les déplacements terrestres (horaires, convois, itinéraires de repli) et les consignes des sites et des personnels présents à proximité.' },
  { cle: 'manifestation', re: /\b(manifest|greve|strike|protest|emeute|riot|marche pacifique|marche de protestation|sit-in|barricade|soulevement|boycott|syndicat)/,
    texte: 'Perturbations possibles de l\'activité et de la circulation : éviter les rassemblements, prévoir des horaires décalés ou le travail à distance, informer les personnels.' },
  { cle: 'criminalite', re: /\b(braquage|braqueur|robbery|vol a main|cambriol|coupeurs? de route|gang|criminal|cybercrim|escroquer|fraude|trafic|drogue|drug)/,
    texte: 'Criminalité de droit commun : vigilance sur les trajets et les arrêts, sécurisation des sites, des véhicules et des transferts de fonds.' },
  // Avant « homicide » depuis le 24/11/2026 : « trois enfants tués dans un
  // accident » est un accident.
  { cle: 'accident', re: /\b(accident|crash|collision|incendie|fire|explosion|effondr|collapse|naufrage|chavir)/,
    texte: 'Risque accidentel ou technique : rappeler les consignes de sécurité routière et incendie, vérifier l\'exposition des sites et des prestataires.' },
  // Ajoutée le 24/11/2026 avec l'analyse : un suicide ou une noyade recevait
  // le repère « climat politique » de sa rubrique.
  { cle: 'drame', re: /\b(se donne la mort|s.est donne la mort|suicid|noyade|noye|retrouve sans vie|retrouvee sans vie|corps sans vie)/,
    texte: 'Drame individuel : aucun lien établi à ce stade avec la sûreté des sites ou des personnels. Pas de mesure particulière sans élément nouveau.' },
  // Ajoutée le 24/11/2026 avec l'analyse : « un instituteur tué à la machette »
  // tombait dans la famille politique par un mot du chapô.
  { cle: 'homicide', re: /\b(tue[es]?\b|tuee?s\b|meurtr|assassin|homicide|machette|poignard|egorge|lynch|killed|murder|stabbed|shot dead)/,
    texte: 'Violence criminelle ou interpersonnelle, localisée : rien n\'indique à ce stade une menace dirigée contre les entreprises ou les expatriés. Rappeler la vigilance aux personnels de la zone.' },
  { cle: 'politique', re: /\b(election|electoral|scrutin|vote|campagne|candidat|opposition|partis?\b|referendum|constitution|parlement|assemblee nationale|gouvernement|ministre|president|arrestation|arrest|detention)/,
    texte: 'Climat politique à suivre : tensions possibles autour des échéances et des décisions institutionnelles. Adapter la veille et les déplacements aux dates sensibles.' },
  { cle: 'justice', re: /\b(peine de mort|death penalty|condamn|sentenc|tribunal|proces|trial|code penal|loi |law |reclusion|cour d.assises|session criminelle)/,
    texte: 'Évolution du cadre juridique et sécuritaire : à intégrer à l\'analyse pays et à la sensibilisation des personnels expatriés et locaux.' },
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

// « s'attaque aux violences », « s'attaque au chômage » : le verbe au sens
// figuré n'est pas une attaque armée (dépistage du VIH classé « violence
// armée », relu le 24/11/2026).
function sansFigure(t) {
  // « loi de finances » est un budget, pas une évolution du cadre pénal.
  return t.replace(/\bloi de finances\w*( rectificative)?/g, ' budget ').replace(/\bs.attaqu\w*\s+(a|au|aux|a la|a l.)\s*(la |le |les |l.)?(violence|pauvrete|chomage|defi|probleme|corruption|maladie|vih|sida|paludisme|inegalite|cherte|vie chere|fleau|racine|question|dossier|contrainte)\w*/g, ' ');
}
// UN FAIT DE CONTEXTE N'EST PAS UN INCIDENT (24/11/2026). Relu sur le cumul de
// novembre en écrivant l'analyse : « Burkina Faso : le Parquet fait le point
// sur les poursuites pour faits de terrorisme », « Blanchiment d'argent et
// terrorisme : le Mali muscle la surveillance… », « Les plans de Donald Trump
// pour Assimi Goïta face au terrorisme » recevaient le repère « menace armée
// sur les axes ». Un titre qui parle d'une procédure, d'une déclaration, d'une
// rencontre ou d'une coopération, sans aucun mot d'événement, reçoit le repère
// de contexte. Le titre seul en décide : c'est lui qui dit de quoi parle l'actu.
// « Kozah / session d'assises : quatre accusés condamnés… pour enlèvement » est
// une procédure : « enlèvement » n'est pas compté ici comme un mot d'événement.
const EVENEMENT_RE = /\b(tue[es]?\b|tuee?s\b|morts?\b|attaqu|embuscade|frappe|explos|blesse|assassin|incendie|accident|fusillade|affrontement|combats?\b|greve|manifest|emeute|killed|dead|attack|ambush|injur|clash|protest)/;
const CONTEXTE_RE = /\b(lutte contre|face au|face a la|poursuites|parquet|proces\b|juges?\b|jugement|condamn|tribunal|assises|reclusion|plans?\b|strategie|cooperation|partenariat|formation|formes?\b|atelier|seminaire|conference|sommet|forum|debat|sensibilis|recoit|audience|visite|dessous|tribune|interview|entretien|plaidoyer|condoleances|remaniement|nomination|nomme|surveillance)/;
const CONTEXTE = { cle: 'contexte', texte: 'Fait de contexte (procédure, décision, déclaration ou coopération) : il éclaire la situation du pays sans être un incident sur le terrain. À intégrer à l\'analyse pays plutôt qu\'aux consignes opérationnelles.' };
function enjeuxSurete(f) {
  // Le titre décide, le chapô ne sert qu'à défaut (même règle que classify) :
  // « Le Burkina Faso rétablit la peine de mort », dont le chapô cite les
  // crimes de terrorisme, est un fait juridique, pas une attaque armée.
  const titre = sansFigure(sansAccents([f.titreFr, f.titre].filter(Boolean).join(' ')));
  const chapo = sansFigure(sansAccents([f.resumeFr, f.resume].filter(Boolean).join(' ')));
  if (CONTEXTE_RE.test(titre) && !EVENEMENT_RE.test(titre)) return { cle: CONTEXTE.cle, texte: CONTEXTE.texte };
  const famille = ENJEUX.find((e) => e.re.test(titre)) || ENJEUX.find((e) => e.re.test(chapo));
  if (famille) return { cle: famille.cle, texte: famille.texte };
  return { cle: 'categorie', texte: ENJEU_PAR_CATEGORIE[f.cat] || ENJEU_PAR_CATEGORIE.economique };
}

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
const SURVEILLER = {
  coup: 'position des forces armées, annonces de la junte ou du gouvernement, couvre-feu, état des frontières, de l\'aéroport et des télécommunications.',
  enlevement: 'revendication, demandes de rançon, nouveaux rapts sur les mêmes axes, consignes des ambassades.',
  attaque: 'bilan définitif, revendication, riposte des forces de défense, extension aux localités et axes voisins.',
  manifestation: 'durée du mot d\'ordre, appels à de nouvelles mobilisations, réponse des autorités, points de rassemblement.',
  criminalite: 'répétition du mode opératoire, axes et horaires visés, réponse policière.',
  politique: 'calendrier des échéances, réactions de l\'opposition et de la rue, mesures de sécurité annoncées.',
  justice: 'entrée en vigueur, premières applications, réactions nationales et internationales.',
  accident: 'cause établie, mesures des autorités, perturbations durables de la circulation ou de l\'activité.',
  naturel: 'évolution du nombre de cas ou des zones touchées, mesures sanitaires ou de restriction, état des routes.',
  frontiere: 'ouverture des points de passage, volume des déplacements, incidents dans les zones d\'accueil.',
  drame: 'conclusions de l\'enquête et lien éventuel avec un contexte plus large.',
  contexte: 'mise en œuvre effective de ce qui est annoncé, et ses effets sur le terrain.',
  homicide: 'identification et mobile des auteurs, répétition dans la même localité, tensions communautaires éventuelles.',
  categorie: 'suites données par les autorités et reprise du sujet par d\'autres médias.',
};
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
    : (f.resume ? [{ source: f.source, resume: f.resumeFr || f.resume, url: f.url, langue: f.langue || null, fr: !!f.resumeFr }] : []));
  for (const e of candidats) {
    if (!e || !e.resume || extraits.length >= EXTRAITS_MAX) continue;
    // Une seule langue par document (YORO, 19/11/2026) : un chapô en langue
    // étrangère que le job n'a pas pu traduire n'est pas cité.
    if (LANGUES_ETRANGERES.has(e.langue) && !e.fr) continue;
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
  + 'Chaque actu est suivie d\'une analyse : la lecture situe le fait parmi ceux de même nature relevés dans le pays sur la période ; '
  + 'implications et points à surveiller sont des repères par type d\'événement, à valider et compléter par l\'analyste.';

module.exports = { LANGUES_ETRANGERES, phraseDe, choisirMarquants, rediger, enjeuxSurete, analyserFait, SURVEILLER, MARQUANTS_CI, MARQUANTS_PAYS, NOTE_REDACTION, dateRedigee };
