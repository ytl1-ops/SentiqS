// Faits du mois pour le rapport GRSCI.
//
// Relecture du rapport d'octobre 2026 (23/10/2026) : le rapport « mensuel » ne
// contenait que les faits des 36 dernières heures — deux pour la Côte d'Ivoire,
// un pour le Bénin — parce que `donneesBulletinPays` ne voit que la fenêtre
// d'actualité. Un compte rendu de rencontre mensuelle doit couvrir le mois.
//
// Chaque passage du job verse donc ses faits notables dans
// web/rapports/GRSCI/faits-AAAA-MM.json, sans doublon, et le rapport lit ce
// cumul. Rien n'est recalculé ici : ce sont les faits que la page a déjà
// retenus (titre, source, date, lien, niveau de l'article, catégorie) ; le
// niveau ne sert qu'à choisir lesquels montrer, il n'est jamais imprimé.
const fs = require('node:fs');
const path = require('node:path');

// Ordre de choix quand un pays a plus de faits que la place disponible.
const RANG = { crit: 0, critical: 0, high: 1, mod: 2 };
// Un mois de collecte peut verser plusieurs centaines de faits par pays ; le
// rapport n'en montre qu'une dizaine. On garde de la marge sans laisser le
// fichier grossir sans fin (il est commité à chaque passage).
const MAX_STOCKES_PAYS = 120;

function cheminCumul(racine, jour) {
  return path.join(racine, 'faits-' + String(jour).slice(0, 7) + '.json');
}

// Un même article revient à chaque passage tant qu'il reste dans la fenêtre :
// le lien l'identifie ; à défaut, le titre normalisé.
function cle(f) {
  if (f.url) return 'u:' + f.url;
  return 't:' + String(f.titre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function rang(f) {
  return f.niveau in RANG ? RANG[f.niveau] : 3;
}

function trier(liste) {
  return liste.slice().sort((a, b) => (rang(a) - rang(b)) || ((b.publieMs || 0) - (a.publieMs || 0)));
}

function lire(racine, jour) {
  try {
    const d = JSON.parse(fs.readFileSync(cheminCumul(racine, jour), 'utf8'));
    if (d && d.mois === String(jour).slice(0, 7) && d.pays) return d;
  } catch (e) { /* premier passage du mois */ }
  return { mois: String(jour).slice(0, 7), pays: {} };
}

function fusionner(anciens, nouveaux) {
  const parCle = new Map();
  for (const f of anciens || []) parCle.set(cle(f), f);
  for (const f of nouveaux || []) {
    if (!f || !f.titre) continue;
    const k = cle(f);
    const deja = parCle.get(k);
    // Un article reclassé plus haut entre deux passages garde son meilleur
    // rang ; sa première date de publication connue ne change pas.
    if (!deja) parCle.set(k, f);
    else if (rang(f) < rang(deja)) parCle.set(k, Object.assign({}, deja, { niveau: f.niveau, cat: f.cat || deja.cat }));
  }
  return trier([...parCle.values()]).slice(0, MAX_STOCKES_PAYS);
}

// Seuls les champs que le rapport lit sont conservés : la cotation et le reste
// du vocabulaire de l'appli n'ont rien à faire dans un document du groupe.
function epurer(f) {
  return { titre: f.titre, url: f.url || null, source: f.source || null, niveau: f.niveau || null, cat: f.cat || null, publieMs: f.publieMs || null };
}

/**
 * Verse les faits du passage dans le cumul du mois et renvoie, par pays, les
 * données d'origine avec `faits` remplacé par le cumul trié.
 * `donnees` : liste d'objets `donneesBulletinPays` (au moins `cy` et `faits`).
 */
function cumuler(racine, jour, donnees) {
  const cumul = lire(racine, jour);
  const sortie = (donnees || []).filter(Boolean).map((d) => {
    const faits = fusionner(cumul.pays[d.cy], (d.faits || []).map(epurer));
    cumul.pays[d.cy] = faits;
    return Object.assign({}, d, { faits });
  });
  fs.mkdirSync(racine, { recursive: true });
  fs.writeFileSync(cheminCumul(racine, jour), JSON.stringify(cumul, null, 1) + '\n');
  return sortie;
}

module.exports = { cumuler, cheminCumul, fusionner, trier, MAX_STOCKES_PAYS };
