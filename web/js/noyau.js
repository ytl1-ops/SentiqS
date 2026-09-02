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

function articlesSontDoublons(a, b) {
  const motsA = motsSignificatifs(a.title);
  const motsB = motsSignificatifs(b.title);
  if (motsA.length < DEDUP_MIN_COMMUNS || motsB.length < DEDUP_MIN_COMMUNS) return false;
  const setB = new Set(motsB);
  const communs = new Set(motsA.filter(m => setB.has(m))).size;
  if (communs < DEDUP_MIN_COMMUNS) return false;
  return communs / Math.min(motsA.length, motsB.length) >= DEDUP_MIN_RATIO;
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
  MOTS_VIDES_DEDUP, motsSignificatifs, articlesSontDoublons,
  DEDUP_MIN_COMMUNS, DEDUP_MIN_RATIO,
  getNivKey,
  MOIS_FR_IDX, dateEvenementMs, facteurFraicheur, poidsVerifie,
  DECROISSANCE_PLEIN_J, DECROISSANCE_NULLE_J, POIDS_CONTEXTE_NON_DATE,
  NIVEAUX_ORDRE, NIVEAU_MIN_POUR_ROUGE_AUTO, borneRougeVerifie,
  tendanceNiveaux,
  MAX_LIVE_EVENTS_PAR_PAYS,
};

if (typeof module !== 'undefined' && module.exports) module.exports = API;
else Object.assign(global, API);

})(typeof globalThis !== 'undefined' ? globalThis : this);
