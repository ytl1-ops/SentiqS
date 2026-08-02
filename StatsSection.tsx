/**
 * Mapping partagé sévérité → classes CSS dot.
 * Utilisé par CountryAlertCard, Timeline30d, et tout composant affichant des incidents.
 */

export const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-emerald-500',
};

export const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Critique',
  high: 'Élevé',
  medium: 'Modéré',
  low: 'Faible',
};

export const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-50 text-red-700',
  high: 'bg-orange-50 text-orange-700',
  medium: 'bg-yellow-50 text-yellow-700',
  low: 'bg-emerald-50 text-emerald-700',
};

export const SEVERITY_STRIPE: Record<string, string> = {
  critical: 'border-l-4 border-l-red-500',
  high: 'border-l-4 border-l-orange-500',
  medium: 'border-l-4 border-l-yellow-500',
  low: 'border-l-4 border-l-emerald-500',
};

export const SEVERITY_BG: Record<string, string> = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-yellow-400',
  low: 'bg-emerald-400',
};

export const SEVERITY_BADGE_BORDERED: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};