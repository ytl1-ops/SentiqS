// Regles de qualite des fiches pays, isolees pour etre testables.
//
// Le controle qui les applique est scripts/verifier-fiches-pays.js. Chacune
// est nee d'un defaut constate sur les pages reellement publiees, pas d'une
// bonne pratique generale.
// ---------------------------------------------------------------------------
// Trois regles ajoutees le 02/09/2026, chacune nee d'un defaut constate.
// ---------------------------------------------------------------------------

const { rapport, composer, lireRgba, SEUIL_AA } = require('./contraste.js');

// Le nom accessible d'une couleur n'existe pas : on lit les jetons declares
// dans la page elle-meme. Chaque fiche embarque son propre <style>, il n'y a
// pas de feuille partagee a interroger.
function jetons(html) {
  const table = {};
  const re = /(--[\w-]+)\s*:\s*([^;}]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) table[m[1]] = m[2].trim();
  return table;
}

// REGLE 1 — aucun jeton CSS reference sans etre defini dans la page.
//
// « color: var(--muted, #6b675f) » a ete livre le 02/09/2026 sur les fiches
// Nigeria, Senegal et Togo. --muted n'existe dans aucune de ces pages : c'est
// le repli qui s'appliquait, un gris concu pour un fond clair pose sur un fond
// quasi noir. Un var() avec repli ne provoque aucune erreur, aucun avertissement,
// et rend une couleur du mauvais theme en silence. C'est precisement ce que ce
// controle rend bruyant.
function jetonsOrphelins(html) {
  const definis = new Set(Object.keys(jetons(html)));
  const vus = new Set();
  const re = /var\(\s*(--[\w-]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) if (!definis.has(m[1])) vus.add(m[1]);
  return [...vus].sort();
}

// REGLE 2 — tout texte doit atteindre le seuil AA (4,5:1) sur son fond.
//
// Mesure du 02/09/2026, avant correction : la note de sources etait a 3,57:1,
// le pied de page a 2,29:1, la date et le fil d'Ariane a 4,10:1. Cinq elements
// de texte sous le seuil sur neuf pages publiques.
//
// Les jetons de ces pages sont des blancs semi-transparents : leur contraste
// n'existe qu'une fois composes sur le fond. On mesure la couleur reellement
// vue, pas la valeur ecrite.
function contrastesInsuffisants(html) {
  const table = jetons(html);
  const fond = table['--bg'];
  if (!fond || !/^#[0-9a-fA-F]{3,6}$/.test(fond)) return [];

  const utilises = new Set();
  const re = /color\s*:\s*var\(\s*(--[\w-]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) utilises.add(m[1]);

  const faibles = [];
  for (const nom of [...utilises].sort()) {
    const brut = table[nom];
    if (!brut) continue;               // deja signale par la regle 1
    const rgba = lireRgba(brut);
    let couleur;
    if (rgba) couleur = composer(rgba.hex, fond, rgba.alpha);
    else if (/^#[0-9a-fA-F]{3,6}$/.test(brut)) couleur = brut;
    else continue;                     // gradient, mot-cle : hors de portee ici
    const r = rapport(couleur, fond);
    if (r < SEUIL_AA) faibles.push(nom + ' (' + r.toFixed(2) + ':1)');
  }
  return faibles;
}

// REGLE 3 — toute fiche publiee porte une date lisible par le lecteur.
//
// Cinq fiches ecrites hors du generateur ne portaient aucune date, ni dans le
// HTML ni dans les donnees structurees. Deux d'entre elles — Mali, Burkina Faso
// — decrivent les situations les plus degradees du perimetre. Une evaluation de
// risque sans date se lit comme si elle etait d'aujourd'hui : c'est le faux
// negatif le plus facile a produire, et le plus cher pour ce metier.
const MOIS = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';
const DATE_LISIBLE = new RegExp('\\d{1,2}\\s+(?:' + MOIS + ')\\s+\\d{4}');

function dateVisible(html) {
  const m = /<p class="meta-fresh">([\s\S]*?)<\/p>/.exec(html);
  if (!m) return null;
  const texte = m[1].replace(/<[^>]+>/g, ' ');
  return DATE_LISIBLE.test(texte) ? texte.replace(/\s+/g, ' ').trim() : null;
}

module.exports = { jetons, jetonsOrphelins, contrastesInsuffisants, dateVisible };
