// Faits « hors sûreté » écartés du rapport mensuel (Présentation 1).
//
// Pourquoi (relecture du 14/11/2026, demande de YORO : « corrige en retirant
// les faits hors sûreté ») : le rapport de novembre ouvrait la Côte d'Ivoire
// sur « Fête de la Toussaint : ce qu'il faut savoir… », puis « Voici comment
// réagir face à un arrêt cardiaque chez un enfant », « Cuisinière à gaz : ce
// que révèle la couleur de la flamme », un appel d'offres du Trésor, un
// chantier de métro. La classification les avait montés au-dessus du normal
// sur un mot (« morts », « sécurité », « crise ») ; le rapport, lui, est lu
// par un responsable sûreté qui juge l'outil à sa première page.
//
// Le filtre s'applique AU MOMENT DU RAPPORT, sur le cumul du mois, et ne
// touche pas au cumul lui-même : une règle corrigée vaut pour tout le mois,
// rétroactivement, et rien n'est perdu.
//
// Deux parties :
// 1. des THÈMES hors sûreté (conseils pratiques, fêtes, finance de marché,
//    chantiers, agriculture, sport, culture, carrière, revue de presse…) ;
// 2. une GARDE : un titre qui porte un vocabulaire d'atteinte (mort, attaque,
//    enlèvement, incendie, manifestation, grève, arrestation…) reste, même sur
//    un de ces thèmes — un festival attaqué n'est pas un festival. Certaines
//    locutions (« fête des morts », « crise de légitimité ») sont retirées
//    avant la garde : elles ne disent aucune atteinte.
//
// En cas de doute, le fait RESTE : un fait de trop coûte une ligne au
// lecteur, un fait de sûreté retiré peut lui coûter une décision.

function norm(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'").replace(/\s+/g, ' ');
}

// Locutions qui contiennent un mot de la garde sans dire une atteinte.
const LOCUTIONS_NEUTRES = [
  /fete des morts/g, /jour des morts/g, /mort-ne[s]?\b/g,
  /enlevement des (marchandises|ordures|dechets|conteneurs|vehicules)/g,
  /gestion de crise/g, /cellule de crise/g, /exercice (de simulation|de secours)/g,
  /annonce mort/g, /millions? de morts/g, /crise de legitimite/g,
  // « manifest » est dans la garde (manifestation de rue) : l'appel d'offres non.
  /manifestation d'interet/g,
];

// Vocabulaire d'atteinte : sa présence garde le fait, quel que soit le thème.
const GARDE_RE = new RegExp([
  "\\btue[es]?\\b", "\\bmort[s]?\\b", "\\bmorte[s]?\\b", "\\bdeces\\b", "\\bmeurtre", "\\bassassin", "\\bhomicide",
  "\\bblesse", "\\battaque", "\\battentat", "\\bexplosion", "\\bexplosif", "\\bembuscade", "\\bfusillade",
  "\\benlev", "\\bkidnapp", "\\botage", "\\brapt", "\\bincendi", "\\bnoyade", "\\beffondrement", "\\binondation",
  "\\bmanifest", "\\bemeute", "\\bheurt", "\\baffrontement", "\\bviolence", "\\bgreve\\b", "\\bgrevistes?\\b",
  "\\barret(e|ation)", "\\binterpell", "\\bgarde a vue\\b", "\\bpoursuivi", "\\bproces\\b", "\\bcondamn",
  "\\bdjihad", "\\bjihad", "\\bterror", "\\bcoup d'etat\\b", "\\bputsch", "\\bmutin", "\\barme[es]?\\b(?! de)",
  "\\bbandit", "\\bbraquage", "\\bvol a main", "\\bcambriol", "\\bescroquer", "\\bfraude\\b", "\\btrafic",
  "\\bdrogue", "\\bevasion\\b", "\\bepidemie", "\\bcholera\\b", "\\bebola\\b", "\\bmpox\\b", "\\bpenurie",
  "\\bkilled\\b", "\\bdead\\b", "\\battack", "\\bkidnap", "\\babduct", "\\bprotest", "\\bclash", "\\barrest",
  "\\bmilitaire", "\\bsecuritaire", "\\bprocureur", "\\bmeur[st]?\\b", "\\bse noie", "\\bnoye", "\\bperi[st]?\\b",
  "\\bgunmen\\b", "\\bbomb", "\\bfire\\b", "\\bblaze\\b", "\\bstrike\\b", "\\bmorto", "\\bataque",
].join('|'));

// Thèmes hors sûreté. Chaque famille nomme ce qu'elle retire : une famille
// qui en retire trop se corrige seule, sans toucher aux autres.
const THEMES = {
  conseil_pratique: /\b(voici comment|ce qu'il faut savoir|comment (reagir|choisir|eviter|bien|reconnaitre|preparer)|astuces?|recette|bienfaits?|ce que revele|arret cardiaque|cuisiniere|regime alimentaire|beaute)\b/,
  fete_religieuse: /\b(toussaint|noel|paques|tabaski|maouloud|careme|fete de (la|l'|fin)|celebration|pelerinage|messe)\b/,
  finance_marche: /\b(appel d'offres|bons? (et obligations )?du tresor|obligations? du tresor|emprunt obligataire|emission (simultanee|de titres)|brvm|bourse|dividende|introduction en bourse|resultats? financiers?|chiffre d'affaires|taux directeur|levee de fonds|execution (du budget|budgetaire|des reformes)|rapport d'execution|taux d'execution|sursis a execution|retard dans l'execution|marches publics|budgets? sous tension|recettes mobilisees|depenses executees|crise energetique|reserves sous pression)\b/,
  chantier: /\b(travaux (executes|de construction|de rehabilitation|de reprise|du futur)|mise en service|echangeurs?|premiere pierre|inauguration|inaugure|livraison des travaux|lance le chantier|coup d'envoi des travaux|renovation|revetement|parking|electrification)\b/,
  agriculture_dev: /\b(hectares|agroforesterie|cacaoyeres|production de (cacao|cafe|coton|riz|mais|noix de cajou)|production attendue|riz paddy|campagne (agricole|cotonniere|de commercialisation)|semences|clinique[s]? mobile[s]?|sante reproductive|avenir demographique|dividende demographique|renforce(nt)? les capacites|potentiel economique|erosion cotiere|consommer local|siao|navire-hopital|salubrite|par l'assiette)\b/,
  sante_chronique: /\b(diabete|cancer|tuberculose|inactivite physique|prevalence|bilharziose|hypertension|obesite)\b/,
  sport: /\b(can 20\d\d|qualifs?|qualification[s]? (pour|a) la (can|coupe)|eliminatoires|match|matchday|ligue \d|ligue des champions|championnat|champion(ne)?s|coupe (du monde|d'afrique|de la confederation|inter)|selection nationale|selectionneur|buteur|mercato|footballeur|handball|basket(ball)?|athletisme|lutteurs?|lutte (avec frappe|traditionnelle)|combat royal|special combat|beach wrestling|jeux olympiques| vs )\b/,
  culture_people: /\b(festival|concert|album|clip officiel|film|cinema|miss |artiste|chanteu[rs]e?|comedien|celebrite|kardashian|tupac|mariage de|anniversaire de|defile de mode|vernissage|ecrivains?|celebre (\d+|les)|fausse rumeur|recompensee?s?)\b/,
  // Avis administratifs (27/11/2026) : relus dans la Présentation 1 de Mali
  // et de Niger, classés « élevé » (« AVIS À MANIFESTATION D'INTÉRÊT …
  // RECRUTEMENT D'UN CABINET »). 9 sur les cumuls d'octobre et novembre, tous
  // des appels d'offres ou de candidatures.
  avis_administratif: /\b(manifestation d'interet|avis d'appel|appels? a candidatures?|avis de recrutement|recrutement d'un (cabinet|consultant|bureau)|avis de vacance|dossier d'appel|avis general de passation|demande de cotation|demande de propositions)\b/,
  communication: /\b(tournee (nationale )?d'information|journee portes ouvertes)\b/,
  carriere: /\b(depart a la retraite|admis a la retraite|prise de fonction|passation de (charges|service)|distinction honorifique)\b/,
  presse_opinion: /^(revue de (la )?presse|editorial|edito|chronique|billet|lu pour vous)\b|\brevue de (la )?presse\b/,
  education: /\b(rentree (scolaire|universitaire)|resultats? (du bac|du bepc|du cepe|des examens)|bourses? d'etudes|remise de diplomes|soutenance)\b/,
};

// Un fait qui se passe hors d'Afrique, ou dans un autre pays, sans que le
// titre nomme le pays du rapport ni ses ressortissants : la collecte l'a
// rattaché par erreur (« Congo – Délits fauniques » dans la Côte d'Ivoire,
// « patrouilles à Sydney après l'attaque de Bondi Beach » dans le Ghana).
// Un Ghanéen tué dans le Bronx, lui, concerne le Ghana et reste.
const AILLEURS_RE = /\b(sydney|australie|bondi|barcelone|madrid|espagne|italie|europeen(ne)?s?|etats-unis|bronx|new york|washington|ukraine|liban|israel|gaza|congo|rdc|kinshasa)\b/;
const PEOPLE_ETRANGER_RE = /\b(kardashian|tupac|hollywood|premier league|nba|nfl|beyonce|taylor swift)\b/;
const NATIONAL = {
  CI: /ivoir|abidjan/, BF: /burkin|faso|ouaga/, ML: /\bmali|bamako/, NE: /niger|niamey/, GH: /ghan|accra/,
  TG: /togo|lome/, BJ: /benin|cotonou/, GN: /guine|conakry/, LR: /liberi|monrovia/, SN: /senegal|dakar/,
};


/**
 * Le thème hors sûreté du fait, ou null s'il reste dans le rapport.
 * `f` : un fait du cumul ({ titre, titreFr? }), `cy` : son pays. Seul le titre décide, comme
 * pour la classification (« le titre décide, le corps nuance ») : un chapô
 * qui cite « la sécurité » ne fait pas d'un conseil de cuisine un fait de
 * sûreté, et un chapô anodin ne retire pas une attaque titrée.
 */
function themeHorsSurete(f, cy) {
  const titre = norm(f && (f.titreFr || f.titre));
  if (!titre) return null;
  const nat = NATIONAL[cy];
  if (nat && AILLEURS_RE.test(titre) && !nat.test(titre)) return 'autre_pays';
  let t = titre;
  for (const re of LOCUTIONS_NEUTRES) t = t.replace(re, ' ');
  // Vedettes étrangères et ligues hors d'Afrique : rien ne les rattache à la
  // sûreté du pays, même quand le titre dit « mort » (« L'avocat qui
  // défendait le meurtrier de Tupac Shakur retrouvé mort », rattaché au
  // Sénégal le 13/11/2026).
  if (PEOPLE_ETRANGER_RE.test(titre)) return 'culture_people';
  if (GARDE_RE.test(t)) return null;
  for (const [nom, re] of Object.entries(THEMES)) if (re.test(titre)) return nom;
  return null;
}

// Le sport n'entre dans le rapport que s'il a un impact avéré sur la sûreté
// (YORO, 27/11/2026 : « Retire le sport sauf si après analyse, il a un impact
// avéré sur la sûreté pays ou autre »). La garde générale ne suffit pas ici :
// « attaque », « blessé », « condamné », « frappe fort » ont un sens sportif
// (« Tour du Faso : Tom Wijfje frappe fort », « Football scolaire : 38 jeunes
// à l'assaut de la phase zonale », classés critiques). Mesure sur les cumuls
// d'octobre et novembre 2026 : 38 faits sportifs passaient le filtre ; 8 ont
// un impact (convoi d'un lutteur attaqué, supporters qui s'affrontent, combat
// interdit par le préfet, alerte de la CNDH sur les violences) et restent.
// « lutte contre … » n'est pas un sport, « course-poursuite » non plus, et
// « stade » ne compte qu'avec une majuscule (« à un stade avancé »). « JOJ »
// seul ne fait pas un fait sportif : la presse sénégalaise date tout par
// rapport aux Jeux (grève suspendue « pour les JOJ », budget des armées
// « après les JOJ »), et le dispositif de sécurité des Jeux est de la sûreté.
const SPORT_RE = new RegExp([
  "\\bfootball", "\\bsoccer\\b", "\\bfifa\\b", "\\bla caf\\b", "\\bcoupe (de la caf|assep|du monde|d'afrique|de la confederation)",
  "\\bcan (beach|20\\d\\d|u\\d\\d)", "\\bafcon\\b", "\\bchan 20\\d\\d", "\\bmondial u\\d+", "\\bu1[5-9]\\b", "\\bu2[0-3]\\b",
  "\\bufoa", "\\bmedailles?\\b", "\\bdecroche l'or\\b", "\\btour du faso\\b", "\\bcyclis", "\\bmarathon\\b", "\\bboxe(ur)?s?\\b",
  "\\bbasket", "\\bhandball\\b", "\\bvolley", "\\btennis\\b", "\\bathletisme\\b", "\\blutteurs?\\b",
  "\\blutte (senegalaise|olympique|avec frappe|traditionnelle)", "^lutte ?:", "\\bcombat royal\\b", "\\bopen press\\b",
  "\\blamb\\b", "\\barene nationale\\b", "\\btournoi", "\\bmaracana\\b", "\\bequipe nationale\\b", "\\bselection nationale\\b",
  "\\bselectionneur", "\\bentraineur", "\\bcoach\\b", "\\bmercato\\b", "\\bchampionnat", "\\bchampionship\\b",
  "\\bligue (\\d|des champions)", "\\bpremier league\\b", "\\bmatch(s)?\\b", "\\bderby\\b", "\\bsupporters?\\b",
  "\\bfeguifoot\\b", "\\btribunal arbitral du sport\\b", "\\ble sport\\b", "\\bsportifs?\\b", "\\bsuper eagles\\b",
  "\\bblack stars\\b", "\\bbeach soccer\\b", "\\bqualifs?\\b", "\\beliminatoires\\b",
].join('|'));
const STADE_RE = /\b(Stade|Stadium)\s+[A-ZÉÈ]/;
// Ce qu'un fait sportif doit dire pour rester : une atteinte aux personnes,
// une violence collective, ou une mesure des autorités.
const IMPACT_SPORT_RE = new RegExp([
  "\\btue[es]?\\b", "\\bmort[s]?\\b", "\\bmorte[s]?\\b", "\\bmeurt\\b", "\\bdeces\\b", "\\bblesses\\b", "\\bblessee?s? (grave|par)",
  "\\battaqu(e|es|ee|ees)\\b(?! par l'adversaire)", "\\battentat", "\\baffrontements?\\b", "\\bviolences?\\b", "\\bemeute",
  "\\bbousculade", "\\bheurts?\\b", "\\bhooligan", "\\bvandal", "\\bsaccag", "\\bpillage",
  "\\binterdit\\b", "\\binterdiction\\b", "\\bsecuritaires?\\b", "\\bsecurite\\b", "\\bagents de securite\\b", "\\bhuis clos\\b", "\\bmesures? de securite\\b", "\\bdispositif (securitaire|de securite)",
  "\\barrete?s\\b", "\\binterpell", "\\bterror", "\\bdjihad", "\\bstampede\\b", "\\briots?\\b", "\\bclash", "\\bkilled\\b",
].join('|'));

/** Fait sportif (catégorie ou vocabulaire du titre). */
function estSport(f) {
  if (!f) return false;
  const brut = String(f.titreFr || f.titre || '');
  return f.cat === 'sport' || SPORT_RE.test(norm(brut)) || STADE_RE.test(brut);
}
/** Un fait sportif sans impact avéré sur la sûreté : hors du rapport. */
function estSportSansImpact(f) {
  return estSport(f) && !IMPACT_SPORT_RE.test(norm(f.titreFr || f.titre));
}

function estHorsSurete(f, cy) { return themeHorsSurete(f, cy) !== null; }

module.exports = { themeHorsSurete, estHorsSurete, estSport, estSportSansImpact, THEMES, GARDE_RE };
