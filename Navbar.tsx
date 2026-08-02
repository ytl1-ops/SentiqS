/**
 * Utilitaires partagés pour les postures (rouge/orange/jaune/vert/non_cote).
 * Centralise les maps de styles, labels, et fonctions de direction utilisées
 * par PostureTimeline, SituationMatrix, CountryGrid, etc.
 */

export const POSTURE_LABELS: Record<string, string> = {
  rouge: 'RESTRICTIVE',
  orange: 'RENFORCÉE',
  jaune: 'VIGILANCE',
  vert: 'NORMALE',
  non_cote: 'NON CÔTÉE',
};

export const POSTURE_LEVEL_ORDER = ['rouge', 'orange', 'jaune', 'vert', 'non_cote'] as const;

/** Classes Tailwind pour le fond (fill) des postures */
export const LEVEL_BG: Record<string, string> = {
  rouge: 'bg-red-600',
  orange: 'bg-orange-500',
  jaune: 'bg-yellow-500',
  vert: 'bg-emerald-600',
  non_cote: 'bg-gray-400',
};

/** Classes Tailwind pour le texte des postures */
export const LEVEL_TEXT: Record<string, string> = {
  rouge: 'text-red-700',
  orange: 'text-orange-600',
  jaune: 'text-yellow-600',
  vert: 'text-emerald-600',
};

/** Classes Tailwind pour les bordures gauches de carte */
export const LEVEL_BORDER: Record<string, string> = {
  rouge: 'border-l-red-600',
  orange: 'border-l-orange-500',
  jaune: 'border-l-yellow-500',
  vert: 'border-l-emerald-500',
};

/** Classes Tailwind pour les dots/badges avec fond clair (utilisé dans PostureTimeline) */
export const LEVEL_DOT_BG: Record<string, string> = {
  rouge: 'bg-red-100 text-red-700 border-red-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  jaune: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  vert: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  non_cote: 'bg-gray-100 text-gray-500 border-gray-200',
};

/** Objets badge complets { bg, text, label } — utilisés par SituationMatrix */
export const LEVEL_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  rouge: { bg: 'bg-red-700', text: 'text-white', label: 'ROUGE' },
  orange: { bg: 'bg-orange-600', text: 'text-white', label: 'ORANGE' },
  jaune: { bg: 'bg-yellow-500', text: 'text-yellow-950', label: 'JAUNE' },
  vert: { bg: 'bg-emerald-600', text: 'text-white', label: 'VERT' },
};

/** Objets styles compacts { bg, text } — utilisés par CountryGrid */
export const LEVEL_STYLES: Record<string, { bg: string; text: string }> = {
  rouge: { bg: 'bg-red-700', text: 'text-white' },
  orange: { bg: 'bg-orange-500', text: 'text-white' },
  jaune: { bg: 'bg-yellow-500', text: 'text-yellow-950' },
  vert: { bg: 'bg-emerald-500', text: 'text-white' },
  none: { bg: 'bg-gray-200', text: 'text-gray-500' },
};

/** Labels courts pour les postures */
export const LEVEL_SHORT_LABELS: Record<string, string> = {
  rouge: 'ROUGE',
  orange: 'ORANGE',
  jaune: 'JAUNE',
  vert: 'VERT',
  none: 'NON CÔTÉ',
};

/** Retourne le label affichable d'un niveau de posture */
export function getPostureLabel(level: string): string {
  return POSTURE_LABELS[level] || level.toUpperCase();
}

/** Détermine la direction d'un changement de posture */
export function getDirection(oldLevel: string, newLevel: string): 'escalation' | 'deescalation' | 'stable' {
  const order: Record<string, number> = { non_cote: -1, vert: 0, jaune: 1, orange: 2, rouge: 3 };
  const oldIdx = order[oldLevel] ?? -1;
  const newIdx = order[newLevel] ?? -1;
  if (newIdx > oldIdx) return 'escalation';
  if (newIdx < oldIdx) return 'deescalation';
  return 'stable';
}