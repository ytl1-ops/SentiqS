// REPÈRES DE SÛRETÉ PAR FAMILLE D'ÉVÉNEMENT — partagés depuis le 26/11/2026.
// Écrits pour la Présentation 1 (scripts/lib/redaction-grsci.js, 23-24/11/2026),
// lus aussi par la page pour la « fiche de synthèse » du détail d'une actu
// (format repris du prototype SentiqS 2, demande de YORO du 26/11/2026).
// Un seul texte pour les deux : une copie dans la page divergerait du rapport.
// Rien n'est inventé ni généré : un repère par famille, reconnue par des mots
// du titre (le chapô seulement à défaut). Aucun niveau, aucun score.
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.SentiqReperes = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
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

// Les mêmes repères en anglais, pour la fiche de synthèse quand l'interface est
// en anglais (une seule langue à l'écran, 21/10/2026). La Présentation 1, en
// français, ne les lit pas. Une clé ajoutée à ENJEUX ou SURVEILLER sans sa
// traduction ici fait échouer scripts/test/fiche-synthese.test.js.
const IMPLICATIONS_EN = {
  coup: 'Institutional instability: curfew, border closures or communication cuts are possible. Check evacuation and business continuity plans, and the means of reaching staff.',
  enlevement: 'Kidnapping risk: keep movements discreet, track staff on assignment and visitors, check crisis procedures and emergency contacts.',
  attaque: 'Armed threat on the roads and localities of the area: reassess overland movements (timing, convoys, fallback routes) and the instructions for nearby sites and staff.',
  manifestation: 'Possible disruption of activity and traffic: avoid gatherings, plan staggered hours or remote work, inform staff.',
  criminalite: 'Ordinary crime: stay alert on journeys and stops, secure sites, vehicles and cash transfers.',
  accident: 'Accidental or technical risk: restate road and fire safety instructions, check the exposure of sites and contractors.',
  drame: 'Individual tragedy: no link established at this stage with the security of sites or staff. No specific measure without new information.',
  homicide: 'Localised criminal or interpersonal violence: nothing at this stage points to a threat aimed at companies or expatriates. Remind staff in the area to stay alert.',
  politique: 'Political climate to follow: tensions possible around deadlines and institutional decisions. Adapt monitoring and movements to sensitive dates.',
  justice: 'Change in the legal and security framework: to include in the country analysis and in briefings for expatriate and local staff.',
  naturel: 'Natural or health risk: anticipate logistical disruption and staff protection measures (vaccination, hygiene instructions, movements).',
  frontiere: 'Border pressure and population movements: follow the status of crossing points and reception areas on the routes used.',
  contexte: 'Context item (procedure, decision, statement or cooperation): it sheds light on the country situation without being an incident on the ground. To include in the country analysis rather than in operational instructions.',
};
const IMPLICATIONS_CATEGORIE_EN = {
  securite: 'Security item to follow: check its impact on sites, routes and staff present in the area.',
  politique: 'Political climate to follow: assess its impact on local stability and movements.',
  humanitaire: 'Social context to follow: possible impact on activity, traffic and the surroundings of sites.',
  economique: 'Possible impact on the business environment, supplies and the security of operations.',
};
const SURVEILLER_EN = {
  coup: 'position of the armed forces, announcements by the junta or government, curfew, status of borders, the airport and telecommunications.',
  enlevement: 'claim of responsibility, ransom demands, new abductions on the same roads, embassy advice.',
  attaque: 'final toll, claim of responsibility, response by the defence forces, spread to neighbouring localities and roads.',
  manifestation: 'duration of the call to action, calls for new mobilisations, response by the authorities, gathering points.',
  criminalite: 'repetition of the modus operandi, roads and hours targeted, police response.',
  politique: 'calendar of deadlines, reactions from the opposition and the street, announced security measures.',
  justice: 'entry into force, first applications, national and international reactions.',
  accident: 'established cause, measures by the authorities, lasting disruption to traffic or activity.',
  naturel: 'change in the number of cases or affected areas, health or restriction measures, road conditions.',
  frontiere: 'opening of crossing points, volume of movements, incidents in reception areas.',
  drame: 'findings of the investigation and any link with a wider context.',
  contexte: 'actual implementation of what is announced, and its effects on the ground.',
  homicide: 'identification and motive of the perpetrators, repetition in the same locality, possible community tensions.',
  categorie: 'follow-up by the authorities and coverage of the subject by other media.',
};
  return { IMPLICATIONS_EN, IMPLICATIONS_CATEGORIE_EN, SURVEILLER_EN, sansAccents, ENJEUX, ENJEU_PAR_CATEGORIE, sansFigure, EVENEMENT_RE, CONTEXTE_RE, CONTEXTE, enjeuxSurete, SURVEILLER };
});
