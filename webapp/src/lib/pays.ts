// Référentiel géographique des 54 pays couverts par la plateforme.
//
// Extrait de PAYS_INFO et CY_TO_ZONE de web/SentiqS_Web.html, qui reste la
// source de vérité : ce module en est le portage TypeScript, pas une seconde
// liste à maintenir en parallèle.

export type ZoneId =
  | 'sahel'
  | 'golfe_guinee'
  | 'ao_cotiere'
  | 'afrique_centrale'
  | 'corne_afrique'
  | 'grands_lacs'
  | 'afrique_australe'
  | 'afrique_nord';

export interface PaysInfo {
  flag: string;
  name: string;
  capital: string;
  zone: ZoneId;
}

export const ZONE_LABEL: Record<ZoneId, string> = {
  sahel: 'Sahel',
  golfe_guinee: 'Golfe de Guinée',
  ao_cotiere: "Afrique de l'Ouest côtière",
  afrique_centrale: 'Afrique centrale',
  corne_afrique: "Corne de l'Afrique",
  grands_lacs: 'Grands Lacs',
  afrique_australe: 'Afrique australe',
  afrique_nord: 'Afrique du Nord',
};

export const PAYS_INFO: Record<string, PaysInfo> = {
  AO: { flag: '🇦🇴', name: "Angola", capital: "Luanda", zone: 'afrique_australe' },
  BF: { flag: '🇧🇫', name: "Burkina Faso", capital: "Ouagadougou", zone: 'sahel' },
  BI: { flag: '🇧🇮', name: "Burundi", capital: "Gitega", zone: 'grands_lacs' },
  BJ: { flag: '🇧🇯', name: "Bénin", capital: "Porto-Novo", zone: 'golfe_guinee' },
  BW: { flag: '🇧🇼', name: "Botswana", capital: "Gaborone", zone: 'afrique_australe' },
  CD: { flag: '🇨🇩', name: "RD Congo", capital: "Kinshasa", zone: 'afrique_centrale' },
  CF: { flag: '🇨🇫', name: "Centrafrique", capital: "Bangui", zone: 'afrique_centrale' },
  CG: { flag: '🇨🇬', name: "Congo-Brazzaville", capital: "Brazzaville", zone: 'afrique_centrale' },
  CI: { flag: '🇨🇮', name: "Côte d'Ivoire", capital: "Yamoussoukro", zone: 'golfe_guinee' },
  CM: { flag: '🇨🇲', name: "Cameroun", capital: "Yaoundé", zone: 'afrique_centrale' },
  CV: { flag: '🇨🇻', name: "Cap-Vert", capital: "Praia", zone: 'ao_cotiere' },
  DJ: { flag: '🇩🇯', name: "Djibouti", capital: "Djibouti", zone: 'corne_afrique' },
  DZ: { flag: '🇩🇿', name: "Algérie", capital: "Alger", zone: 'afrique_nord' },
  EG: { flag: '🇪🇬', name: "Égypte", capital: "Le Caire", zone: 'afrique_nord' },
  ER: { flag: '🇪🇷', name: "Érythrée", capital: "Asmara", zone: 'corne_afrique' },
  ET: { flag: '🇪🇹', name: "Éthiopie", capital: "Addis-Abeba", zone: 'corne_afrique' },
  GA: { flag: '🇬🇦', name: "Gabon", capital: "Libreville", zone: 'afrique_centrale' },
  GH: { flag: '🇬🇭', name: "Ghana", capital: "Accra", zone: 'golfe_guinee' },
  GM: { flag: '🇬🇲', name: "Gambie", capital: "Banjul", zone: 'ao_cotiere' },
  GN: { flag: '🇬🇳', name: "Guinée", capital: "Conakry", zone: 'ao_cotiere' },
  GQ: { flag: '🇬🇶', name: "Guinée équatoriale", capital: "Malabo", zone: 'afrique_centrale' },
  GW: { flag: '🇬🇼', name: "Guinée-Bissau", capital: "Bissau", zone: 'ao_cotiere' },
  KE: { flag: '🇰🇪', name: "Kenya", capital: "Nairobi", zone: 'corne_afrique' },
  KM: { flag: '🇰🇲', name: "Comores", capital: "Moroni", zone: 'afrique_australe' },
  LR: { flag: '🇱🇷', name: "Liberia", capital: "Monrovia", zone: 'ao_cotiere' },
  LS: { flag: '🇱🇸', name: "Lesotho", capital: "Maseru", zone: 'afrique_australe' },
  LY: { flag: '🇱🇾', name: "Libye", capital: "Tripoli", zone: 'afrique_nord' },
  MA: { flag: '🇲🇦', name: "Maroc", capital: "Rabat", zone: 'afrique_nord' },
  MG: { flag: '🇲🇬', name: "Madagascar", capital: "Antananarivo", zone: 'afrique_australe' },
  ML: { flag: '🇲🇱', name: "Mali", capital: "Bamako", zone: 'sahel' },
  MR: { flag: '🇲🇷', name: "Mauritanie", capital: "Nouakchott", zone: 'sahel' },
  MU: { flag: '🇲🇺', name: "Maurice", capital: "Port-Louis", zone: 'afrique_australe' },
  MW: { flag: '🇲🇼', name: "Malawi", capital: "Lilongwe", zone: 'afrique_australe' },
  MZ: { flag: '🇲🇿', name: "Mozambique", capital: "Maputo", zone: 'afrique_australe' },
  NA: { flag: '🇳🇦', name: "Namibie", capital: "Windhoek", zone: 'afrique_australe' },
  NE: { flag: '🇳🇪', name: "Niger", capital: "Niamey", zone: 'sahel' },
  NG: { flag: '🇳🇬', name: "Nigeria", capital: "Abuja", zone: 'golfe_guinee' },
  RW: { flag: '🇷🇼', name: "Rwanda", capital: "Kigali", zone: 'grands_lacs' },
  SC: { flag: '🇸🇨', name: "Seychelles", capital: "Victoria", zone: 'afrique_australe' },
  SD: { flag: '🇸🇩', name: "Soudan", capital: "Khartoum", zone: 'corne_afrique' },
  SL: { flag: '🇸🇱', name: "Sierra Leone", capital: "Freetown", zone: 'ao_cotiere' },
  SN: { flag: '🇸🇳', name: "Sénégal", capital: "Dakar", zone: 'ao_cotiere' },
  SO: { flag: '🇸🇴', name: "Somalie", capital: "Mogadiscio", zone: 'corne_afrique' },
  SS: { flag: '🇸🇸', name: "Soudan du Sud", capital: "Djouba", zone: 'corne_afrique' },
  ST: { flag: '🇸🇹', name: "Sao Tomé-et-Principe", capital: "São Tomé", zone: 'afrique_centrale' },
  SZ: { flag: '🇸🇿', name: "Eswatini", capital: "Mbabane", zone: 'afrique_australe' },
  TD: { flag: '🇹🇩', name: "Tchad", capital: "N'Djamena", zone: 'sahel' },
  TG: { flag: '🇹🇬', name: "Togo", capital: "Lomé", zone: 'golfe_guinee' },
  TN: { flag: '🇹🇳', name: "Tunisie", capital: "Tunis", zone: 'afrique_nord' },
  TZ: { flag: '🇹🇿', name: "Tanzanie", capital: "Dodoma", zone: 'grands_lacs' },
  UG: { flag: '🇺🇬', name: "Ouganda", capital: "Kampala", zone: 'corne_afrique' },
  ZA: { flag: '🇿🇦', name: "Afrique du Sud", capital: "Pretoria", zone: 'afrique_australe' },
  ZM: { flag: '🇿🇲', name: "Zambie", capital: "Lusaka", zone: 'afrique_australe' },
  ZW: { flag: '🇿🇼', name: "Zimbabwe", capital: "Harare", zone: 'afrique_australe' },};

/** Nombre de pays sous veille — évite de coder « 54 » en dur dans les vues. */
export const NB_PAYS_COUVERTS = Object.keys(PAYS_INFO).length;

/** Nom usuel FR d'un code pays. `INT` désigne une source panafricaine. */
export function nomPays(cy: string): string {
  if (cy === 'INT') return 'International';
  return PAYS_INFO[cy]?.name ?? cy;
}

export function drapeauPays(cy: string): string {
  if (cy === 'INT') return '🌍';
  return PAYS_INFO[cy]?.flag ?? '🏳️';
}

export function zonePays(cy: string): string {
  const zone = PAYS_INFO[cy]?.zone;
  return zone ? ZONE_LABEL[zone] : 'Panafricain';
}
