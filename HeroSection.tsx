/**
 * Mapping partagé catégorie de flux → classes CSS.
 * Utilisé par FeedsList (badges compacts) et NewsHeroFeed (badges avec dot + ring).
 */

/** Version simple : renvoie des classes pour un badge compact (FeedsList) */
export function categoryBadgeClasses(cat: string): string {
  const map: Record<string, string> = {
    'Sécurité': 'bg-red-50 text-red-700 border-red-200',
    'Diplomatie': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Humanitaire': 'bg-orange-50 text-orange-700 border-orange-200',
    'Cyber': 'bg-slate-50 text-slate-700 border-slate-200',
    'Économie': 'bg-teal-50 text-teal-700 border-teal-200',
    'Politique': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Environnement': 'bg-lime-50 text-lime-700 border-lime-200',
    'Santé': 'bg-pink-50 text-pink-700 border-pink-200',
    'Infrastructure': 'bg-amber-50 text-amber-700 border-amber-200',
    'Terrorisme': 'bg-red-50 text-red-700 border-red-200',
    'Migration': 'bg-cyan-50 text-cyan-700 border-cyan-200',
    'Défense': 'bg-rose-50 text-rose-700 border-rose-200',
    'Trafics_illicites': 'bg-red-50 text-red-700 border-red-200',
  };
  return map[cat.replace(/\s/g, '_')] || map[cat] || 'bg-gray-50 text-gray-700 border-gray-200';
}

/** Version enrichie : renvoie ring, dot, et label pour un badge avec icône dot (NewsHeroFeed) */
export interface CategorySeverityStyle {
  ring: string;
  dot: string;
  label: string;
}

export function categorySeverityStyle(cat: string): CategorySeverityStyle {
  const map: Record<string, CategorySeverityStyle> = {
    'Sécurité': { ring: 'ring-red-200 bg-red-50', dot: 'bg-red-500', label: 'Sécurité' },
    'Terrorisme': { ring: 'ring-red-300 bg-red-50', dot: 'bg-red-600', label: 'Terrorisme' },
    'Trafics illicites': { ring: 'ring-red-200 bg-red-50', dot: 'bg-red-500', label: 'Trafics' },
    'Humanitaire': { ring: 'ring-orange-200 bg-orange-50', dot: 'bg-orange-500', label: 'Humanitaire' },
    'Défense': { ring: 'ring-rose-200 bg-rose-50', dot: 'bg-rose-500', label: 'Défense' },
    'Diplomatie': { ring: 'ring-emerald-200 bg-emerald-50', dot: 'bg-emerald-500', label: 'Diplomatie' },
    'Politique': { ring: 'ring-indigo-200 bg-indigo-50', dot: 'bg-indigo-500', label: 'Politique' },
    'Économie': { ring: 'ring-teal-200 bg-teal-50', dot: 'bg-teal-500', label: 'Économie' },
    'Environnement': { ring: 'ring-lime-200 bg-lime-50', dot: 'bg-lime-500', label: 'Environnement' },
    'Santé': { ring: 'ring-pink-200 bg-pink-50', dot: 'bg-pink-500', label: 'Santé' },
    'Cyber': { ring: 'ring-slate-200 bg-slate-50', dot: 'bg-slate-500', label: 'Cyber' },
    'Infrastructure': { ring: 'ring-amber-200 bg-amber-50', dot: 'bg-amber-500', label: 'Infrastructure' },
    'Énergie': { ring: 'ring-yellow-200 bg-yellow-50', dot: 'bg-yellow-500', label: 'Énergie' },
    'Migration': { ring: 'ring-cyan-200 bg-cyan-50', dot: 'bg-cyan-500', label: 'Migration' },
    'Agriculture': { ring: 'ring-green-200 bg-green-50', dot: 'bg-green-500', label: 'Agriculture' },
    'Commerce': { ring: 'ring-violet-200 bg-violet-50', dot: 'bg-violet-500', label: 'Commerce' },
    'Finance': { ring: 'ring-emerald-200 bg-emerald-50', dot: 'bg-emerald-500', label: 'Finance' },
    'Justice': { ring: 'ring-gray-200 bg-gray-50', dot: 'bg-gray-500', label: 'Justice' },
    'Social': { ring: 'ring-rose-200 bg-rose-50', dot: 'bg-rose-500', label: 'Social' },
    'Éducation': { ring: 'ring-sky-200 bg-sky-50', dot: 'bg-sky-500', label: 'Éducation' },
    'Transport': { ring: 'ring-orange-200 bg-orange-50', dot: 'bg-orange-500', label: 'Transport' },
    'Télécommunications': { ring: 'ring-zinc-200 bg-zinc-50', dot: 'bg-zinc-500', label: 'Télécom' },
    'Accident': { ring: 'ring-amber-200 bg-amber-50', dot: 'bg-amber-500', label: 'Accident' },
    'Législation': { ring: 'ring-purple-200 bg-purple-50', dot: 'bg-purple-500', label: 'Législation' },
  };
  return map[cat] || { ring: 'ring-gray-200 bg-gray-50', dot: 'bg-gray-400', label: cat };
}