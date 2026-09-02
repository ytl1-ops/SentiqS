// ============================================================
// SentiqS — archive des niveaux d'alerte, jour par jour.
//
// POURQUOI CE FICHIER EXISTE
//
// Le cache partagé expire à six heures et rien ne lui survit. Un produit de
// veille qui ne garde aucune trace ne peut ni montrer une trajectoire, ni
// justifier après coup pourquoi un pays était orange le 12, ni mesurer ses
// propres faux positifs. Chaque question de qualité posée sur ce dépôt s'est
// heurtée au même mur : « on ne le saura qu'en comptant sur plusieurs
// cycles » — et personne ne comptait.
//
// Ce module ne calcule aucun niveau. Il reçoit ceux que la page de
// production a calculés elle-même (voir scripts/collecte-planifiee.js) et
// s'occupe seulement de les ranger, un instantané par jour.
//
// UN SEUL INSTANTANÉ PAR JOUR, et c'est délibéré. Le job tourne cinq à
// quinze fois par jour ; enregistrer chaque passage produirait un bruit que
// personne ne lirait et un commit toutes les vingt minutes. Le premier
// passage de la journée fait foi.
// ============================================================

const fs = require('node:fs');
const path = require('node:path');
// Le classement des niveaux et le calcul de tendance vivent dans le noyau,
// partages avec l'interface : deux implementations du meme calcul finiraient
// par diverger, et c'est la trajectoire affichee a l'utilisateur qui en
// paierait le prix.
const { NIVEAUX_ORDRE, tendanceNiveaux } = require('../../web/js/noyau.js');

// 90 jours dans la série servie à l'interface. Au-delà, l'archive
// quotidienne reste sur disque mais ne transite plus par le réseau : la
// courbe d'un trimestre suffit à voir une tendance, et le fichier reste
// sous 150 Ko.
const JOURS_SERIE = 90;

/** Le jour d'un horodatage, en UTC, au format AAAA-MM-JJ. */
function jourUTC(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

/**
 * Normalise les lignes brutes venues du navigateur en un instantané.
 *
 * Les lignes sont volontairement maigres : code, niveau, total, et la
 * décomposition du score. C'est ce qu'il faut pour rejouer une décision,
 * pas une copie de l'article.
 */
function construireInstantane({ jour, commit, pays }) {
  if (!jour || !/^\d{4}-\d{2}-\d{2}$/.test(jour)) {
    throw new Error('jour attendu au format AAAA-MM-JJ, reçu : ' + jour);
  }
  const lignes = (Array.isArray(pays) ? pays : [])
    .filter((p) => p && typeof p.code === 'string' && p.code !== 'all')
    .map((p) => ({
      code: p.code,
      niveau: NIVEAUX_ORDRE.includes(p.niveau) ? p.niveau : 'vert',
      total: arrondi(p.total),
      verifies: arrondi(p.verifies),
      facteurs: arrondi(p.facteurs),
      live: arrondi(p.live),
      historique: arrondi(p.historique),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
  return { jour, commit: commit || null, pays: lignes };
}

function arrondi(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function cheminDuJour(racine, jour) {
  return path.join(racine, jour + '.json');
}

/**
 * Écrit l'instantané du jour s'il n'existe pas déjà.
 *
 * Retourne le chemin écrit, ou null si la journée était déjà couverte. Le
 * refus d'écraser est le mécanisme « un par jour » : il ne dépend d'aucun
 * état conservé entre deux runs, ce qui le rend correct même si le job est
 * relancé à la main.
 */
function ecrireInstantane(racine, instantane) {
  fs.mkdirSync(racine, { recursive: true });
  const cible = cheminDuJour(racine, instantane.jour);
  if (fs.existsSync(cible)) return null;
  fs.writeFileSync(cible, JSON.stringify(instantane) + '\n');
  return cible;
}

/** Les instantanés présents sur disque, du plus ancien au plus récent. */
function lireSerie(racine) {
  if (!fs.existsSync(racine)) return [];
  return fs.readdirSync(racine)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(racine, f), 'utf8')); }
      catch (_) { return null; }   // un fichier corrompu ne doit pas casser la série
    })
    .filter(Boolean);
}

/**
 * La série compacte que l'interface télécharge : par pays, la suite des
 * niveaux datés, limitée aux JOURS_SERIE derniers instantanés.
 *
 * Format volontairement court — `{ MA: [['2026-09-02','orange'], ...] }` —
 * parce que ce fichier part sur le réseau à chaque ouverture de la page.
 */
function construireSerie(instantanes, jours = JOURS_SERIE) {
  const retenus = instantanes.slice(-jours);
  const parPays = {};
  for (const inst of retenus) {
    for (const p of inst.pays || []) {
      (parPays[p.code] = parPays[p.code] || []).push([inst.jour, p.niveau]);
    }
  }
  return { genere: new Date().toISOString(), jours: retenus.map((i) => i.jour), pays: parPays };
}

/**
 * Tendance d'un pays dans une série compacte. Simple adaptateur : le calcul
 * lui-même est celui du noyau, donc exactement celui que l'interface
 * applique aux mêmes données.
 */
function tendance(serie, code, fenetre = 30) {
  return tendanceNiveaux((serie && serie.pays && serie.pays[code]) || [], fenetre);
}

module.exports = {
  JOURS_SERIE, NIVEAUX_ORDRE,
  jourUTC, construireInstantane, cheminDuJour, ecrireInstantane,
  lireSerie, construireSerie, tendance,
};
