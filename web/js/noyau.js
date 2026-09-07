// ═══════════════════════════════════════════════════════════════════════════
//  SentiqS — NOYAU LOGIQUE
//
//  Les fonctions de decision du produit : normalisation, correspondance sur
//  le mot entier, mots significatifs, seuils de niveau d'alerte, fraicheur de
//  la donnee verifiee. Elles vivaient dans les 20 000 lignes inline de
//  web/SentiqS_Web.html, d'ou les tests devaient les extraire au vol avec le
//  module vm et des marqueurs de texte — un montage qui cassait des qu'un
//  commentaire bougeait.
//
//  Sorties telles quelles, sans une ligne reecrite : ce fichier est le code
//  de production, pas une copie. La page le charge avant son script inline ;
//  les tests font simplement require('../../web/js/noyau.js').
//
//  N'ajouter ici que de la logique PURE — rien qui touche au DOM, au reseau
//  ou au stockage. C'est ce qui rend ce noyau testable des deux cotes.
// ═══════════════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

// Plafond du nombre de signaux temps reel retenus par pays. Vit ici parce que
// borneRougeVerifie() en depend : le laisser dans la page ferait diverger la valeur
// vue par les tests de celle vue en production.
const MAX_LIVE_EVENTS_PAR_PAYS = 5;

// ── Normalisation des accents ───────────────────────────────────
function normaliserAccents(t) {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Correspondance sur le mot entier ────────────────────────────
const TERMES_AMBIGUS_MASQUES = {
  soudan:  ['soudan du sud', 'sud-soudan', 'sud soudan'],
  guinée:  ['guinée-bissau', 'guinée équatoriale', 'bissau-guinéen', 'bissau-guinéenne'],
  guinee:  ['guinee-bissau', 'guinee equatoriale', 'bissau-guineen', 'bissau-guineenne'],
  guinéen: ['bissau-guinéen', 'bissau-guinéenne'],
  guineen: ['bissau-guineen', 'bissau-guineenne'],
  // Memes pieges dans les autres langues de la presse africaine. Sans ces
  // entrees, « Sudan » et « Guinea » ne pouvaient pas entrer dans
  // PAYS_DETECT : un article sur le Soudan du Sud aurait fait gagner des
  // points au Soudan, exactement comme en francais.
  sudan:   ['south sudan', 'sudão do sul', 'sudao do sul'],
  // « guinea ecuatorial » : ordre des mots espagnol. Sans ce masque, les
  // articles de Diario Rombe et d'Ahora EG (07/09/2026) etaient rattaches a
  // la Guinee (GN) — le seul pays hispanophone suivi perdait sa propre presse.
  guinea:  ['guinea-bissau', 'guinea bissau', 'equatorial guinea', 'guinea ecuatorial', 'guinea equatorial', 'papua new guinea'],
  guiné:   ['guiné-bissau', 'guiné equatorial'],
  guine:   ['guine-bissau', 'guine equatorial'],
  // « Niger Delta » et « Niger State » sont au NIGERIA, et le fleuve Niger
  // traverse cinq pays. Sans masquage, chaque article du delta nigerian
  // faisait gagner des points au Niger — le piege existait deja en francais.
  niger:   ['niger delta', 'niger state', 'niger river', 'delta du niger', 'fleuve niger', 'etat du niger', 'état du niger'],
  // « Maurice Kamto » est un opposant camerounais. Mesure de la collecte
  // n° 851 (07/09/2026) : un article d'AllAfrica Cameroun sur sa candidature
  // etait rattache a l'ile Maurice, classe eleve, et faisait passer l'ile de
  // jaune a orange. Un prenom n'est pas un pays.
  maurice: ['maurice kamto'],
};
function masquerTermesComposes(texte, terme) {
  const masques = TERMES_AMBIGUS_MASQUES[terme];
  if (!masques) return texte;
  let t = texte;
  for (const m of masques) t = t.split(m).join(' '.repeat(m.length));
  return t;
}
function matchMot(texte, terme) {
  const echappe = terme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return new RegExp('(?:^|[^\\p{L}\\p{N}])' + echappe + '(?:$|[^\\p{L}\\p{N}])', 'iu').test(masquerTermesComposes(texte, terme));
  } catch (_) {
    return texte.includes(terme); // repli si le terme contient un caractere problematique pour la regex
  }
}

// ── Mots significatifs et doublons ──────────────────────────────
const MOTS_VIDES_DEDUP = new Set([
  'gouvernement','securite','personnes','situation','selon','apres','avant','contre','entre',
  'premier','premiere','nouveau','nouvelle','autorites','president','ministre','ministere',
  'national','nationale','pays','region','regionale','ville','habitants','population',
  'declare','declaration','annonce','affirme','estime','indique','precise','ajoute',
  'plusieurs','certains','autres','cette','cettes','leurs','notamment','egalement','encore',
  'aujourd','hier','demain','matin','soir','journee','semaine','mois','annee',
  'millions','milliards','pourcent','environ','preoccupante','important','importante',
  'government','security','people','situation','according','after','before','against',
  'president','minister','national','country','region','city','several'
, 'depuis']);

// motsSignificatifs(titre) : tokens porteurs de sens d'un titre — accents
// neutralises, mots vides retires, longueur > 4. Isolee et exportee pour
// etre testable hors navigateur (voir scripts/test/dedup.test.js).
function motsSignificatifs(titre) {
  return (titre || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(m => m.length > 4 && !MOTS_VIDES_DEDUP.has(m));
}

// Seuils : 4 mots significatifs communs ET au moins 40% du titre le plus
// court. Le ratio evite qu'un titre tres long ne recoupe n'importe quoi par
// accumulation, le plancher evite les fusions sur trois mots de vocabulaire
// courant. L'appariement se fait sur le MOT ENTIER (Set.has), plus par
// sous-chaine : "region" ne correspond plus a "regionale", ni "attaque" a
// "contre-attaquer".
const DEDUP_MIN_COMMUNS = 4;
const DEDUP_MIN_RATIO   = 0.4;

function titreNormalise(titre) {
  return (titre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// ── Pont entre langues pour le dedoublonnage ────────────────────
// Le meme evenement arrive en francais, en anglais et en portugais, et les
// titres ne partagent alors AUCUN mot : « 25 tuees dans un accident de bus »,
// « Bus crash kills 25 », « Acidente de autocarro faz 25 mortos ». Mesure du
// 06/09/2026 sur le cache publie : l'accident de Fogo (Cap-Vert) y figurait
// CINQ fois, dont trois au niveau eleve, et aucune paire n'etait reconnue.
//
// Le pont n'est pas une traduction. Deux titres sont rapproches s'ils
// portent le MEME NOMBRE (un bilan : 25 morts, 18 blesses — jamais une annee)
// ET un mot de la MEME FAMILLE d'evenement, les familles etant de courtes
// listes de synonymes en trois langues. Le nombre seul serait trop faible
// (« 25 » est partout), la famille seule aussi (deux accidents differents le
// meme jour) ; les deux ensemble, dans le meme pays et la meme fenetre, ne
// designent qu'un fait. Un article sans nombre — les funerailles des
// victimes, par exemple — n'est jamais rapproche : c'est un autre article.
const FAMILLES_EVENEMENT = [
  ['mort', 'morts', 'morte', 'mortes', 'tue', 'tues', 'tuee', 'tuees', 'deces', 'decede', 'decedes',
   'killed', 'kills', 'kill', 'dead', 'death', 'deaths', 'die', 'dies', 'died',
   'mortos', 'mortas', 'morreu', 'morreram', 'muertos', 'muertas', 'fallecidos', 'fallecidas'],
  ['blesse', 'blesses', 'blessee', 'blessees', 'injured', 'injures', 'wounded', 'feridos', 'feridas', 'heridos', 'heridas'],
  ['bus', 'autocar', 'autobus', 'autocarro', 'minibus', 'onibus'],
  ['accident', 'accidents', 'crash', 'crashes', 'acidente', 'acidentes', 'accidente', 'accidentes', 'collision', 'carambolage'],
  ['attaque', 'attaques', 'attack', 'attacks', 'attacked', 'ataque', 'ataques', 'attentat', 'atentado', 'assault'],
  ['enlevement', 'enlevements', 'enleves', 'enlevees', 'kidnap', 'kidnapped', 'kidnapping', 'abduction', 'abducted',
   'rapto', 'raptados', 'raptadas', 'sequestro', 'secuestro', 'secuestrados'],
  ['putsch', 'coup', 'golpe'],
  ['inondation', 'inondations', 'flood', 'floods', 'flooding', 'inundacao', 'inundacoes', 'cheias', 'inundacion', 'inundaciones'],
  ['explosion', 'explosions', 'explosao', 'explosoes', 'blast', 'bombe', 'bombes', 'bomb', 'bombing', 'bomba'],
  ['incendie', 'incendies', 'fire', 'blaze', 'incendio', 'incendios'],
  ['naufrage', 'naufrages', 'shipwreck', 'capsized', 'capsize', 'naufragio', 'naufragios', 'pirogue', 'chavire'],
  ['manifestation', 'manifestations', 'manifestants', 'protest', 'protests', 'protesters', 'manifestacao', 'manifestacoes', 'protesta', 'protestas'],
];
const ANNEE_MIN = 1900;
const ANNEE_MAX = 2100;

// Les nombres d'un titre, hors annees : « 25 morts », « 18 blesses ». Les
// annees sont ecartees parce qu'elles ne designent pas un bilan, et « 2021 »
// rapprocherait n'importe quel anniversaire de n'importe quel autre.
function nombresDuTitre(titre) {
  const out = new Set();
  for (const m of String(titre || '').match(/\d+/g) || []) {
    const n = Number(m);
    if (n >= 2 && !(n >= ANNEE_MIN && n <= ANNEE_MAX)) out.add(n);
  }
  return out;
}

function famillesEvenement(titre) {
  const mots = new Set(titreNormalise(titre).split(' '));
  const out = new Set();
  FAMILLES_EVENEMENT.forEach((famille, i) => { if (famille.some(m => mots.has(m))) out.add(i); });
  return out;
}

function memeEvenementEntreLangues(a, b) {
  const nA = nombresDuTitre(a.title);
  if (!nA.size) return false;
  const nB = nombresDuTitre(b.title);
  if (![...nA].some(n => nB.has(n))) return false;
  const fA = famillesEvenement(a.title);
  if (!fA.size) return false;
  const fB = famillesEvenement(b.title);
  return [...fA].some(f => fB.has(f));
}

function articlesSontDoublons(a, b) {
  // Deux titres strictement identiques sont un doublon, quel que soit leur
  // nombre de mots : « Putin toasts HH victory » (trois mots significatifs)
  // passait sous le plancher de quatre mots et restait en double.
  const na = titreNormalise(a.title);
  if (na && na === titreNormalise(b.title)) return true;
  const motsA = motsSignificatifs(a.title);
  const motsB = motsSignificatifs(b.title);
  if (motsA.length >= DEDUP_MIN_COMMUNS && motsB.length >= DEDUP_MIN_COMMUNS) {
    const setB = new Set(motsB);
    const communs = new Set(motsA.filter(m => setB.has(m))).size;
    if (communs >= DEDUP_MIN_COMMUNS && communs / Math.min(motsA.length, motsB.length) >= DEDUP_MIN_RATIO) return true;
  }
  // Meme langue, pas assez de mots communs — ou langues differentes, aucun
  // mot commun : le pont par nombre et famille d'evenement tranche.
  return memeEvenementEntreLangues(a, b);
}

// ── Seuils de niveau d'alerte ───────────────────────────────────
function getNivKey(total) {
  if (total >= 14) return 'rouge';
  if (total >= 8)  return 'marron';
  if (total >= 5)  return 'orange';
  if (total >= 2)  return 'jaune';
  return 'vert';
}

// ── Fraicheur de la donnee verifiee ─────────────────────────────
const MOIS_FR_IDX = {
  janvier:0, fevrier:1, mars:2, avril:3, mai:4, juin:5,
  juillet:6, aout:7, septembre:8, octobre:9, novembre:10, decembre:11,
  jan:0, fev:1, avr:3, jun:5, jul:6, aou:7, sept:8, sep:8, oct:9, nov:10, dec:11,
};

// PRECISION_DATE : ce que la chaîne saisie permet réellement d'affirmer.
//  'jour'  — 29/06/2026, 2026-06-29, 18-19/01/2026
//  'mois'  — Juin 2026, Juillet-Aout 2025
//  'annee' — 2026, 2020-2026 : trop imprécis pour dater un incident ponctuel
//  null    — non analysable
//
// Une date imprécise n'est PAS traitée comme fraîche : ce serait exactement
// l'hallucination que le reste de l'application s'emploie à empêcher. Elle
// est traitée comme un élément de contexte structurel (poids réduit, sans
// décroissance) et signalée par scripts/verifier-datation-incidents.js, pour
// que la dette éditoriale soit visible au lieu d'être silencieuse.
function dateEvenementMs(txt) {
  if (!txt) return { ms: null, precision: null };
  const s = String(txt).trim();
  const maintenant = Date.now();
  const borne = (ms) => (ms === null || !isFinite(ms)) ? null : Math.min(ms, maintenant);
  const sansAccents = (typeof normaliserAccents === 'function')
    ? normaliserAccents(s.toLowerCase())
    : s.toLowerCase();

  // JJ/MM/AAAA [HHhMM]  et  JJ-JJ/MM/AAAA (on retient le DERNIER jour cité :
  // c'est l'instant le plus récent auquel l'événement a pu se produire).
  let m = s.match(/^(\d{1,2})(?:\s*-\s*(\d{1,2}))?\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})h(\d{2}))?$/);
  if (m) {
    const jour = Number(m[2] || m[1]);
    const h = m[5] !== undefined ? Number(m[5]) : 23;
    const min = m[6] !== undefined ? Number(m[6]) : 59;
    return { ms: borne(Date.UTC(Number(m[4]), Number(m[3]) - 1, jour, h, min)), precision: 'jour' };
  }

  // AAAA-MM-JJ
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { ms: borne(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59)), precision: 'jour' };

  // [Mois-]Mois AAAA — fin du dernier mois cité (Date.UTC(a, idx+1, 0) = son dernier jour)
  m = sansAccents.match(/^([a-z]+)(?:\s*-\s*([a-z]+))?\s+(\d{4})$/);
  if (m) {
    const idx = MOIS_FR_IDX[m[2] || m[1]];
    // Un mot qui n'est pas un mois ("Fin 2025") n'est pas une erreur : on
    // laisse les formats suivants tenter leur chance plutot que d'abandonner
    // ici — c'est ce court-circuit qui rendait "Fin 2025" non analysable.
    if (idx !== undefined) {
      return { ms: borne(Date.UTC(Number(m[3]), idx + 1, 0, 23, 59)), precision: 'mois' };
    }
  }

  // AAAA, AAAA-AAAA, ou une année qualifiée ("Fin 2025", "Debut 2026") —
  // une année seule ne date pas un incident ponctuel.
  m = s.match(/^(\d{4})(?:\s*-\s*(\d{4}))?$/);
  if (m) return { ms: borne(Date.UTC(Number(m[2] || m[1]), 11, 31, 23, 59)), precision: 'annee' };
  m = sansAccents.match(/^(?:fin|debut|mi|courant|vers)\s+(\d{4})$/);
  if (m) return { ms: borne(Date.UTC(Number(m[1]), 11, 31, 23, 59)), precision: 'annee' };

  return { ms: null, precision: null };
}

// Décroissance : poids plein pendant DECROISSANCE_PLEIN_J, puis décroissance
// linéaire jusqu'à zéro à DECROISSANCE_NULLE_J. Un incident de sûreté reste
// pertinent quelques semaines ; au-delà de six mois il relève de l'historique,
// que l'application traite déjà séparément (HISTORIQUE_MAX_AGE_MS).
const DECROISSANCE_PLEIN_J = 45;
const DECROISSANCE_NULLE_J = 180;
// Part de poids conservée par un élément daté à l'année près ou non daté :
// contexte structurel, jamais une actualité — d'où un poids réduit et constant.
const POIDS_CONTEXTE_NON_DATE = 0.5;

function facteurFraicheur(ageMs) {
  if (!isFinite(ageMs) || ageMs < 0) return 1;
  const jours = ageMs / 86400000;
  if (jours <= DECROISSANCE_PLEIN_J) return 1;
  if (jours >= DECROISSANCE_NULLE_J) return 0;
  return 1 - (jours - DECROISSANCE_PLEIN_J) / (DECROISSANCE_NULLE_J - DECROISSANCE_PLEIN_J);
}

// poidsVerifie(evenement) : poids effectif d'un incident, et fraîcheur associée.
function poidsVerifie(e, maintenant) {
  const now = (maintenant === undefined) ? Date.now() : maintenant;
  const brut = e.weight || 0;
  const { ms, precision } = dateEvenementMs(e.date);
  if (ms === null || precision === 'annee') {
    return { poids: brut * POIDS_CONTEXTE_NON_DATE, fraicheur: 0, precision, ms: null };
  }
  const f = facteurFraicheur(now - ms);
  return { poids: brut * f, fraicheur: f, precision, ms };
}

// ── Le socle vérifié est un PLANCHER, pas un plafond ───────────────────────
//
// Il exista ici un plafondLive() qui bridait le temps réel d'autant plus que
// le socle vérifié était récent. L'intention était juste — si un humain vient
// de qualifier la situation, la collecte ne doit pas la contredire — mais la
// mesure (scripts/tableau-niveaux.js) a montré qu'il produisait l'inverse :
// le frein était indexé sur l'ancienneté de la SAISIE, pas sur la couverture
// réelle. Les Seychelles, sans un seul incident au dossier, pouvaient
// atteindre l'ORANGE ; le Sénégal, qui en a trois, ne le pouvait pas.
// Vérifier un pays le rendait moins réactif. Neuf des quinze pays alors
// bloqués l'étaient pour cette seule raison.
//
// Le socle vérifié fixe donc désormais le niveau MINIMUM d'un pays — son
// risque structurel, que rien d'autre ne porte — et la collecte monte
// librement au-dessus, bornée par le seul nombre d'articles live retenus
// (MAX_LIVE_EVENTS_PAR_PAYS). Aucun pays ne redescend jamais parce que sa
// donnée a vieilli : c'est la propriété à préserver, et une première
// tentative de décroissance faisait tomber la Somalie, le Kenya et
// l'Éthiopie au VERT.

// La seule borne qui reste. Le ROUGE est l'affirmation la plus grave de
// l'outil ; la collecte ne peut l'atteindre que là où le dossier humain place
// DÉJÀ le pays au MARRON. Un saut du jaune au rouge sur la seule collecte est
// interdit — c'est exactement ce qu'une rafale d'articles mal dédoublonnés
// produirait. Là où le socle dit déjà « marron », le rouge automatique reste
// possible : ce sont les pays où il compte le plus, et les leur retirer
// serait une régression, pas une protection.
const NIVEAUX_ORDRE = ['vert', 'jaune', 'orange', 'marron', 'rouge'];
const NIVEAU_MIN_POUR_ROUGE_AUTO = 'marron';
function borneRougeVerifie(niveauCalcule, niveauPlancher) {
  if (niveauCalcule !== 'rouge') return niveauCalcule;
  const rang = NIVEAUX_ORDRE.indexOf(niveauPlancher);
  const requis = NIVEAUX_ORDRE.indexOf(NIVEAU_MIN_POUR_ROUGE_AUTO);
  return (rang >= requis) ? 'rouge' : NIVEAU_MIN_POUR_ROUGE_AUTO;
}

// Seconde borne, décidée par l'éditeur le 07/09/2026 : le point qui fait
// FRANCHIR le rouge ne peut pas venir d'un article seul.
//
// Collecte n° 851 : Centrafrique, Niger et Ouganda sont passés au rouge sur
// un seul article élevé chacun — une fraude alimentaire à Bangui, un congrès
// de médecine militaire à Niamey, un sermon de mariage sur les violences
// domestiques. Six pays ont un socle à un ou deux points du seuil : n'importe
// quel titre classé élevé par une source à 70 les faisait basculer, recoupé
// ou non. borneRougeVerifie ne jouait pas, le socle étant déjà marron.
//
// Le rouge automatique exige donc qu'au moins un signal du jour soit
// recoupé par une seconde source (fusion au dédoublonnage) ou classé critique
// (un critique n'entre dans getLiveAlertEvents que corroboré). Là où le
// dossier humain place déjà le pays au rouge, la collecte n'a rien à prouver.
// Effet mesuré sur le cache publié : rouge 8 -> 5, rien d'autre ne bouge.
function borneRougeRecoupe(niveauCalcule, niveauPlancher, eventsLive) {
  if (niveauCalcule !== 'rouge') return niveauCalcule;
  if (niveauPlancher === 'rouge') return 'rouge';
  const porte = (eventsLive || []).some(e => e && (e.recoupe === true || e.niveauArticle === 'crit'));
  return porte ? 'rouge' : NIVEAU_MIN_POUR_ROUGE_AUTO;
}


// ── Fraîcheur d'un facteur structurel ──────────────────────────────────────
//
// Les 38 facteurs de FACTEURS_SPECIAUX portent un contexte non daté — « deux
// gouvernements rivaux depuis 2014 », « insurrection active depuis 2017 » —
// et pèsent leur bonus plein sans que personne puisse dire de quand date la
// dernière vérification. Un contexte structurel finit pourtant par cesser
// d'être vrai, et c'est alors le pays qui reste bloqué haut sans raison.
//
// Ce qui suit ne RETRANCHE rien. Dater ces facteurs demande un analyste, pas
// du code, et retirer du poids à partir de dates qu'on n'a pas produirait un
// faux négatif — l'erreur la plus chère de cet outil. On se contente donc de
// rendre la dette visible là où elle se décide, et d'empêcher qu'elle
// grossisse (voir scripts/verifier-datation-incidents.js).
const REVUE_RECOMMANDEE_MOIS = 6;

/**
 * L'âge en mois d'un champ revu:'AAAA-MM'.
 *
 * null si le champ est absent ou illisible. Négatif si la date est dans le
 * futur — cas que la CI doit refuser plutôt que d'afficher « revu il y a -3
 * mois », qui ne veut rien dire.
 */
function ageRevueMois(revu, maintenant) {
  if (typeof revu !== 'string') return null;
  const m = /^(\d{4})-(\d{2})$/.exec(revu.trim());
  if (!m) return null;
  const annee = Number(m[1]);
  const mois = Number(m[2]);
  if (mois < 1 || mois > 12) return null;
  const d = new Date(maintenant || Date.now());
  return (d.getUTCFullYear() - annee) * 12 + (d.getUTCMonth() + 1 - mois);
}

/** Un facteur non daté, ou revu il y a plus de REVUE_RECOMMANDEE_MOIS mois. */
function revueDepassee(revu, maintenant) {
  const age = ageRevueMois(revu, maintenant);
  return age === null || age > REVUE_RECOMMANDEE_MOIS;
}

// ── Disjoncteur pour service externe ───────────────────────────────────────
//
// Mesuré le 02/09/2026, en interrogeant directement les trois moteurs de
// traduction déclarés par l'application :
//
//   MyMemory                        HTTP 200  — répond
//   lingva.ml                       HTTP 500
//   translate.plausibility.cloud    HTTP 502
//   lingva.garudalinux.org          HTTP 403  (Cloudflare)
//   translate.googleapis.com        HTTP 429  (depuis une IP de centre de données)
//
// Les trois miroirs de Lingva sont morts, pas ralentis. Or la chaîne les
// essaie l'un après l'autre avec neuf secondes de patience chacun : dès que
// le quota MyMemory est épuisé, chaque titre à traduire coûtait jusqu'à
// vingt-sept secondes d'attente avant même d'atteindre le dernier moteur.
// C'est ce qu'on lit dans les journaux du run #800.
//
// Un disjoncteur retient l'échec au lieu de le revivre : après `seuil`
// échecs consécutifs, le service est court-circuité pour le reste de la
// session. Un seul succès le referme — un miroir qui revient doit pouvoir
// resservir, c'est toute la raison d'en déclarer plusieurs.
//
// Volontairement sans minuterie de réarmement : une session d'interface dure
// des minutes, pas des jours, et une temporisation ajouterait un état
// difficile à tester pour un gain nul à cette échelle.
const DISJONCTEUR_SEUIL = 2;

function creerDisjoncteur(options) {
  const o = options || {};
  const seuil = (typeof o.seuil === 'number' && o.seuil > 0) ? o.seuil : DISJONCTEUR_SEUIL;
  let echecs = 0;
  return {
    nom: o.nom || 'service',
    ouvert() { return echecs >= seuil; },
    succes() { echecs = 0; },
    echec() { echecs += 1; },
    echecs() { return echecs; },
  };
}

/**
 * Enveloppe une fonction asynchrone d'un disjoncteur.
 *
 * Quand le disjoncteur est ouvert, on lève immédiatement au lieu d'attendre
 * le réseau : c'est exactement le temps qu'on cherche à ne plus perdre.
 */
function avecDisjoncteur(fn, disjoncteur) {
  const d = disjoncteur || creerDisjoncteur({});
  const enveloppe = async function (...args) {
    if (d.ouvert()) throw new Error(d.nom + ' : disjoncteur ouvert apres ' + d.echecs() + ' echecs');
    try {
      const r = await fn.apply(this, args);
      d.succes();
      return r;
    } catch (e) {
      d.echec();
      throw e;
    }
  };
  enveloppe.disjoncteur = d;
  return enveloppe;
}

// ── Tendance d'un pays sur la série archivée ───────────────────────────────
//
// Une seule implémentation, partagée par l'interface (qui lit
// web/historique/serie.json) et par le job de collecte (via
// scripts/lib/historique.js). Ce dépôt a déjà payé le prix de deux
// implémentations du même calcul : le parsing RSS avait failli être réécrit
// en Node avant qu'on ne décide de piloter la vraie page.
//
// `points` est une suite [jour, niveau] triée du plus ancien au plus récent.
// On retourne null en dessous de deux points : afficher « stable » le
// premier jour serait une affirmation sans mesure, et sur ce produit une
// affirmation sans mesure coûte cher.
function tendanceNiveaux(points, fenetre) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const f = (typeof fenetre === 'number' && fenetre > 1) ? fenetre : 30;
  const vus = points.slice(-f);
  const debut = vus[0], fin = vus[vus.length - 1];
  const rDebut = NIVEAUX_ORDRE.indexOf(debut[1]);
  const rFin = NIVEAUX_ORDRE.indexOf(fin[1]);
  if (rDebut < 0 || rFin < 0) return null;
  return {
    depuis: debut[0], jusqu: fin[0],
    de: debut[1], vers: fin[1],
    crans: rFin - rDebut, points: vus.length,
  };
}

// ── Exposition ─────────────────────────────────────────────────────────────
// Navigateur : les noms deviennent globaux, exactement comme lorsqu'ils
// etaient declares dans le script inline. Node : export CommonJS pour les
// tests. Aucun appelant n'a eu a changer.
const API = {
  normaliserAccents, TERMES_AMBIGUS_MASQUES, masquerTermesComposes, matchMot,
  MOTS_VIDES_DEDUP, motsSignificatifs, titreNormalise, articlesSontDoublons,
  FAMILLES_EVENEMENT, nombresDuTitre, famillesEvenement, memeEvenementEntreLangues,
  DEDUP_MIN_COMMUNS, DEDUP_MIN_RATIO,
  getNivKey,
  MOIS_FR_IDX, dateEvenementMs, facteurFraicheur, poidsVerifie,
  DECROISSANCE_PLEIN_J, DECROISSANCE_NULLE_J, POIDS_CONTEXTE_NON_DATE,
  NIVEAUX_ORDRE, NIVEAU_MIN_POUR_ROUGE_AUTO, borneRougeVerifie, borneRougeRecoupe,
  REVUE_RECOMMANDEE_MOIS, ageRevueMois, revueDepassee,
  DISJONCTEUR_SEUIL, creerDisjoncteur, avecDisjoncteur,
  tendanceNiveaux,
  MAX_LIVE_EVENTS_PAR_PAYS,
};

if (typeof module !== 'undefined' && module.exports) module.exports = API;
else Object.assign(global, API);

})(typeof globalThis !== 'undefined' ? globalThis : this);
