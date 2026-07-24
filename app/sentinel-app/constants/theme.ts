export const Colors = {
  primary:    '#1B6CA8',
  primaryLight:'#E6F1FB',
  dark:       '#0D1F2D',
  success:    '#166534',
  successBg:  '#DCFCE7',
  warning:    '#B45309',
  warningBg:  '#FEF3C7',
  danger:     '#991B1B',
  dangerBg:   '#FEE2E2',
  purple:     '#6B21A8',
  purpleBg:   '#F3E8FF',
  text:       '#111827',
  textSecond: '#6B7280',
  textMuted:  '#9CA3AF',
  border:     '#E5E7EB',
  surface:    '#F9FAFB',
  white:      '#FFFFFF',
  black:      '#000000',
};

export const Fonts = {
  regular:  'System',
  medium:   'System',
  bold:     'System',
  mono:     'Courier New',
};

export const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24,
};

export const Radius = {
  sm: 6, md: 10, lg: 16, xl: 24, full: 999,
};

export const FontSize = {
  xs: 10, sm: 11, base: 13, md: 14, lg: 16, xl: 18, xxl: 22, display: 28,
};

export const LineHeight = {
  tight: 1.2, normal: 1.4, relaxed: 1.6, loose: 1.7,
};

export const FontWeight = {
  regular: '400' as const, medium: '500' as const, semibold: '600' as const, bold: '700' as const, extrabold: '800' as const,
};

export const PLANS_CONFIG = [
  { slug: 'trial',       name: 'Essai gratuit', duration: '72 heures', price: 'Gratuit',    badge: '50 articles', color: Colors.success },
  { slug: 'starter',     name: 'Starter',       duration: '7 jours',   price: '2 500 FCFA', badge: null,          color: Colors.primary },
  { slug: 'monthly',     name: 'Mensuel',        duration: '30 jours',  price: '7 500 FCFA', badge: '⭐ Populaire', color: Colors.primary },
  { slug: 'quarterly',   name: 'Trimestriel',    duration: '90 jours',  price: '18 000 FCFA',badge: '-20%',        color: Colors.primary },
  { slug: 'annual',      name: 'Annuel',          duration: '365 jours', price: '55 000 FCFA',badge: '-39%',        color: Colors.dark },
  { slug: 'institution', name: 'Institution',     duration: '1 an · 10 users', price: '150 000 FCFA', badge: 'Multi', color: Colors.purple },
];

export const COUNTRIES_CEDEAO = [
  { code: 'BJ', name: 'Bénin' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'GM', name: 'Gambie' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GN', name: 'Guinée' },
  { code: 'GW', name: 'Guinée-Bissau' },
  { code: 'LR', name: 'Libéria' },
  { code: 'ML', name: 'Mali' },
  { code: 'MR', name: 'Mauritanie' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'SN', name: 'Sénégal' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'TG', name: 'Togo' },
  { code: 'CM', name: 'Cameroun' },
];
