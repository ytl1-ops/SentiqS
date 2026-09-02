// Mesure de contraste WCAG, partagee par le controle CI et ses tests.
//
// POURQUOI CE FICHIER EXISTE
//
// La section « Sources » ajoutee aux fiches pays le 02/09/2026 a ete ecrite
// avec « color: var(--muted, #6b675f) ». Le jeton --muted n'existe dans aucune
// de ces pages : c'est donc la valeur de repli qui s'appliquait — un gris
// concu pour un fond clair, pose sur un fond quasi noir (#05080B). Resultat
// mesure : 3,57:1, sous le seuil AA de 4,5:1, sur une note que le lecteur doit
// justement pouvoir lire pour savoir d'ou vient la fiche.
//
// L'erreur etait invisible a la relecture parce qu'un var() avec repli ne
// signale rien : il rend silencieusement une couleur du mauvais theme. D'ou
// deux garde-fous, l'un ici (mesurer), l'autre dans verifier-fiches-pays.js
// (refuser un jeton non defini).

const SEUIL_AA = 4.5;          // texte normal
const SEUIL_AA_GRAND = 3;      // >= 24px, ou >= 18.66px en gras

function canal(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// '#RRGGBB' -> [r, g, b]. Accepte la forme courte '#RGB'.
function composantes(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error('couleur illisible : ' + hex);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function luminance(hex) {
  const [r, g, b] = composantes(hex).map(canal);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rapport(avant, arriere) {
  const a = luminance(avant);
  const b = luminance(arriere);
  const haut = Math.max(a, b);
  const bas = Math.min(a, b);
  return (haut + 0.05) / (bas + 0.05);
}

// Une couleur semi-transparente n'a pas de contraste en soi : elle en a un une
// fois posee sur son fond. On compose avant de mesurer, sinon on mesure une
// couleur que personne ne voit.
function composer(avant, arriere, alpha) {
  const f = composantes(avant);
  const b = composantes(arriere);
  const m = f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// 'rgba(245,247,250,.44)' -> { hex: '#f5f7fa', alpha: 0.44 }. null si autre forme.
function lireRgba(valeur) {
  const m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)$/.exec(String(valeur).trim());
  if (!m) return null;
  const hex = '#' + [1, 2, 3]
    .map((i) => Number(m[i]).toString(16).padStart(2, '0'))
    .join('');
  return { hex, alpha: Number(m[4]) };
}

module.exports = {
  SEUIL_AA, SEUIL_AA_GRAND,
  luminance, rapport, composer, lireRgba, composantes,
};
