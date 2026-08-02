// ============================================================
// SentiqS — Coordonnées géographiques pour la carte interactive
// 54 pays africains + localités clés des alertes
// ============================================================

export interface GeoCoord {
  lat: number;
  lng: number;
  country: string;
  code?: string;
  region?: string;
}

// Centres des 54 pays africains (capitales ou centre géographique)
export const africaCountryCenters: Record<string, GeoCoord> = {
  'Afrique du Sud': { lat: -26.2041, lng: 28.0473, country: 'Afrique du Sud', code: 'ZA', region: 'Afrique Australe' },
  'Algérie': { lat: 36.7538, lng: 3.0588, country: 'Algérie', code: 'DZ', region: 'Maghreb' },
  'Angola': { lat: -8.8390, lng: 13.2894, country: 'Angola', code: 'AO', region: 'Afrique Australe' },
  'Bénin': { lat: 6.3703, lng: 2.3912, country: 'Bénin', code: 'BJ', region: 'Golfe de Guinée' },
  'Botswana': { lat: -24.6282, lng: 25.9231, country: 'Botswana', code: 'BW', region: 'Afrique Australe' },
  'Burkina Faso': { lat: 12.3714, lng: -1.5197, country: 'Burkina Faso', code: 'BF', region: 'Sahel' },
  'Burundi': { lat: -3.3731, lng: 29.9189, country: 'Burundi', code: 'BI', region: 'Grands Lacs' },
  'Cameroun': { lat: 3.8480, lng: 11.5021, country: 'Cameroun', code: 'CM', region: 'Golfe de Guinée' },
  'Cap-Vert': { lat: 14.9330, lng: -23.5133, country: 'Cap-Vert', code: 'CV', region: "Afrique de l'Ouest" },
  'Centrafrique': { lat: 4.3612, lng: 18.5550, country: 'Centrafrique', code: 'CF', region: 'Afrique Centrale' },
  'Comores': { lat: -11.7022, lng: 43.2551, country: 'Comores', code: 'KM', region: 'Océan Indien' },
  'Congo': { lat: -4.2634, lng: 15.2429, country: 'Congo', code: 'CG', region: 'Afrique Centrale' },
  "Côte d'Ivoire": { lat: 5.3600, lng: -4.0083, country: "Côte d'Ivoire", code: 'CI', region: 'Golfe de Guinée' },
  'Djibouti': { lat: 11.5890, lng: 43.1450, country: 'Djibouti', code: 'DJ', region: "Corne de l'Afrique" },
  'Égypte': { lat: 30.0444, lng: 31.2357, country: 'Égypte', code: 'EG', region: 'Maghreb' },
  'Érythrée': { lat: 15.3333, lng: 38.9333, country: 'Érythrée', code: 'ER', region: "Corne de l'Afrique" },
  'Eswatini': { lat: -26.3167, lng: 31.1333, country: 'Eswatini', code: 'SZ', region: 'Afrique Australe' },
  'Éthiopie': { lat: 9.0320, lng: 38.7469, country: 'Éthiopie', code: 'ET', region: "Afrique de l'Est" },
  'Gabon': { lat: 0.3901, lng: 9.4544, country: 'Gabon', code: 'GA', region: 'Afrique Centrale' },
  'Gambie': { lat: 13.4539, lng: -16.5776, country: 'Gambie', code: 'GM', region: "Afrique de l'Ouest" },
  'Ghana': { lat: 5.6037, lng: -0.1870, country: 'Ghana', code: 'GH', region: 'Golfe de Guinée' },
  'Guinée': { lat: 9.6412, lng: -13.5784, country: 'Guinée', code: 'GN', region: "Afrique de l'Ouest" },
  'Guinée-Bissau': { lat: 11.8636, lng: -15.5977, country: 'Guinée-Bissau', code: 'GW', region: "Afrique de l'Ouest" },
  'Guinée Équatoriale': { lat: 3.7508, lng: 8.7837, country: 'Guinée Équatoriale', code: 'GQ', region: 'Afrique Centrale' },
  'Kenya': { lat: -1.2864, lng: 36.8172, country: 'Kenya', code: 'KE', region: "Afrique de l'Est" },
  'Lesotho': { lat: -29.3151, lng: 27.4863, country: 'Lesotho', code: 'LS', region: 'Afrique Australe' },
  'Liberia': { lat: 6.3004, lng: -10.7969, country: 'Liberia', code: 'LR', region: "Afrique de l'Ouest" },
  'Libye': { lat: 32.8872, lng: 13.1913, country: 'Libye', code: 'LY', region: 'Maghreb' },
  'Madagascar': { lat: -18.8792, lng: 47.5079, country: 'Madagascar', code: 'MG', region: 'Océan Indien' },
  'Malawi': { lat: -13.9833, lng: 33.7833, country: 'Malawi', code: 'MW', region: "Afrique de l'Est" },
  'Mali': { lat: 12.6500, lng: -8.0000, country: 'Mali', code: 'ML', region: 'Sahel' },
  'Maroc': { lat: 33.5731, lng: -7.5898, country: 'Maroc', code: 'MA', region: 'Maghreb' },
  'Maurice': { lat: -20.1667, lng: 57.5000, country: 'Maurice', code: 'MU', region: 'Océan Indien' },
  'Mauritanie': { lat: 18.0858, lng: -15.9785, country: 'Mauritanie', code: 'MR', region: 'Sahel' },
  'Mozambique': { lat: -25.9667, lng: 32.5833, country: 'Mozambique', code: 'MZ', region: 'Afrique Australe' },
  'Namibie': { lat: -22.5667, lng: 17.0833, country: 'Namibie', code: 'NA', region: 'Afrique Australe' },
  'Niger': { lat: 13.5137, lng: 2.1098, country: 'Niger', code: 'NE', region: 'Sahel' },
  'Nigeria': { lat: 9.0820, lng: 8.6753, country: 'Nigeria', code: 'NG', region: 'Golfe de Guinée' },
  'Ouganda': { lat: 0.3476, lng: 32.5825, country: 'Ouganda', code: 'UG', region: 'Grands Lacs' },
  'RDC': { lat: -4.3250, lng: 15.3222, country: 'RDC', code: 'CD', region: 'Afrique Centrale' },
  'Rwanda': { lat: -1.9501, lng: 30.0587, country: 'Rwanda', code: 'RW', region: 'Grands Lacs' },
  'Sao Tomé-et-Principe': { lat: 0.3365, lng: 6.7273, country: 'Sao Tomé-et-Principe', code: 'ST', region: 'Afrique Centrale' },
  'Sénégal': { lat: 14.6937, lng: -17.4441, country: 'Sénégal', code: 'SN', region: "Afrique de l'Ouest" },
  'Seychelles': { lat: -4.6167, lng: 55.4500, country: 'Seychelles', code: 'SC', region: 'Océan Indien' },
  'Sierra Leone': { lat: 8.4844, lng: -13.2344, country: 'Sierra Leone', code: 'SL', region: "Afrique de l'Ouest" },
  'Somalie': { lat: 2.0371, lng: 45.3438, country: 'Somalie', code: 'SO', region: "Corne de l'Afrique" },
  'Soudan': { lat: 15.5007, lng: 32.5599, country: 'Soudan', code: 'SD', region: "Corne de l'Afrique" },
  'Soudan du Sud': { lat: 4.8517, lng: 31.5825, country: 'Soudan du Sud', code: 'SS', region: "Corne de l'Afrique" },
  'Tanzanie': { lat: -6.3690, lng: 34.8888, country: 'Tanzanie', code: 'TZ', region: "Afrique de l'Est" },
  'Tchad': { lat: 12.1128, lng: 15.0492, country: 'Tchad', code: 'TD', region: 'Sahel' },
  'Togo': { lat: 6.1319, lng: 1.2228, country: 'Togo', code: 'TG', region: 'Golfe de Guinée' },
  'Tunisie': { lat: 36.8065, lng: 10.1815, country: 'Tunisie', code: 'TN', region: 'Maghreb' },
  'Zambie': { lat: -15.4167, lng: 28.2833, country: 'Zambie', code: 'ZM', region: 'Afrique Australe' },
  'Zimbabwe': { lat: -17.8292, lng: 31.0522, country: 'Zimbabwe', code: 'ZW', region: 'Afrique Australe' },
};

// Localités mentionnées dans les alertes avec leurs coordonnées réelles
export const localityCoordinates: Record<string, GeoCoord> = {
  // === BURKINA FASO ===
  'Djibo': { lat: 14.1000, lng: -1.6167, country: 'Burkina Faso', region: 'Sahel' },
  'Arbinda': { lat: 14.2333, lng: -0.8667, country: 'Burkina Faso', region: 'Sahel' },
  'Gorgadji': { lat: 14.0167, lng: -0.5333, country: 'Burkina Faso', region: 'Sahel' },
  'Tongomayel': { lat: 14.0667, lng: -1.4833, country: 'Burkina Faso', region: 'Sahel' },
  'Dori': { lat: 14.0333, lng: -0.0333, country: 'Burkina Faso', region: 'Sahel' },

  // === MALI ===
  'Ansongo': { lat: 15.6650, lng: 0.5020, country: 'Mali', region: 'Sahel' },
  'Ménaka': { lat: 15.9167, lng: 2.4000, country: 'Mali', region: 'Sahel' },
  'Konna': { lat: 14.9500, lng: -3.8833, country: 'Mali', region: 'Sahel' },
  'Kidal-Ville': { lat: 18.4411, lng: 1.4078, country: 'Mali', region: 'Sahel' },
  'Bamako': { lat: 12.6500, lng: -8.0000, country: 'Mali', region: 'Sahel' },

  // === NIGER ===
  'Banibangou': { lat: 15.1000, lng: 2.1000, country: 'Niger', region: 'Sahel' },
  'Guidan Roumdji': { lat: 13.6500, lng: 6.7000, country: 'Niger', region: 'Sahel' },
  'Ouallam': { lat: 14.3167, lng: 2.0833, country: 'Niger', region: 'Sahel' },
  'Téra': { lat: 14.0100, lng: 0.7500, country: 'Niger', region: 'Sahel' },
  'Bosso': { lat: 13.4000, lng: 13.1000, country: 'Niger', region: 'Sahel' },
  'Niamey': { lat: 13.5137, lng: 2.1098, country: 'Niger', region: 'Sahel' },

  // === NIGERIA ===
  'Gwoza': { lat: 11.0833, lng: 13.7000, country: 'Nigeria', region: 'Golfe de Guinée' },
  'Bama': { lat: 11.5167, lng: 13.6833, country: 'Nigeria', region: 'Golfe de Guinée' },
  'Maiduguri': { lat: 11.8333, lng: 13.1500, country: 'Nigeria', region: 'Golfe de Guinée' },
  'Bonny': { lat: 4.4333, lng: 7.1667, country: 'Nigeria', region: 'Golfe de Guinée' },
  'Port Harcourt': { lat: 4.8156, lng: 7.0498, country: 'Nigeria', region: 'Golfe de Guinée' },
  'Jos': { lat: 9.9333, lng: 8.8833, country: 'Nigeria', region: 'Golfe de Guinée' },
  'Warri': { lat: 5.5167, lng: 5.7500, country: 'Nigeria', region: 'Golfe de Guinée' },
  'Katsina': { lat: 12.9900, lng: 7.6000, country: 'Nigeria', region: 'Golfe de Guinée' },
  'Lekki': { lat: 6.4500, lng: 3.6000, country: 'Nigeria', region: 'Golfe de Guinée' },
  'Abuja': { lat: 9.0765, lng: 7.3986, country: 'Nigeria', region: 'Golfe de Guinée' },
  'Lagos': { lat: 6.5244, lng: 3.3792, country: 'Nigeria', region: 'Golfe de Guinée' },

  // === RDC ===
  'Beni': { lat: 0.5000, lng: 29.4667, country: 'RDC', region: 'Afrique Centrale' },
  'Oicha': { lat: 0.7000, lng: 29.5167, country: 'RDC', region: 'Afrique Centrale' },
  'Kayna': { lat: 0.6290, lng: 29.3690, country: 'RDC', region: 'Afrique Centrale' },
  'Lubumbashi': { lat: -11.6667, lng: 27.4667, country: 'RDC', region: 'Afrique Centrale' },
  'Lubero': { lat: -0.1500, lng: 29.2333, country: 'RDC', region: 'Afrique Centrale' },
  'Kinshasa': { lat: -4.3250, lng: 15.3222, country: 'RDC', region: 'Afrique Centrale' },

  // === CAMEROUN ===
  'Kolofata': { lat: 11.1500, lng: 14.0167, country: 'Cameroun', region: 'Golfe de Guinée' },
  'Mora': { lat: 11.0450, lng: 14.1400, country: 'Cameroun', region: 'Golfe de Guinée' },
  'Bamenda': { lat: 5.9333, lng: 10.1667, country: 'Cameroun', region: 'Golfe de Guinée' },

  // === MOZAMBIQUE ===
  'Mocímboa da Praia': { lat: -11.3500, lng: 40.3500, country: 'Mozambique', region: 'Afrique Australe' },
  'Pemba': { lat: -12.9667, lng: 40.5167, country: 'Mozambique', region: 'Afrique Australe' },
  'Gorongosa': { lat: -18.6833, lng: 34.0667, country: 'Mozambique', region: 'Afrique Australe' },

  // === SOMALIE ===
  'Baidoa': { lat: 3.1167, lng: 43.6500, country: 'Somalie', region: "Corne de l'Afrique" },
  'Bosaso': { lat: 11.2833, lng: 49.1833, country: 'Somalie', region: "Corne de l'Afrique" },
  'Mogadiscio': { lat: 2.0371, lng: 45.3438, country: 'Somalie', region: "Corne de l'Afrique" },

  // === TCHAD ===
  'Bol': { lat: 13.4667, lng: 14.7167, country: 'Tchad', region: 'Sahel' },

  // === CÔTE D'IVOIRE ===
  'Bouaké': { lat: 7.6833, lng: -5.0333, country: "Côte d'Ivoire", region: 'Golfe de Guinée' },

  // === GHANA ===
  'Tamale': { lat: 9.4000, lng: -0.8333, country: 'Ghana', region: 'Golfe de Guinée' },
  'Tema': { lat: 5.6333, lng: -0.0167, country: 'Ghana', region: 'Golfe de Guinée' },
  'Accra': { lat: 5.6037, lng: -0.1870, country: 'Ghana', region: 'Golfe de Guinée' },

  // === BÉNIN ===
  'Cotonou': { lat: 6.3703, lng: 2.3912, country: 'Bénin', region: 'Golfe de Guinée' },

  // === TOGO ===
  'Aného': { lat: 6.2333, lng: 1.6000, country: 'Togo', region: 'Golfe de Guinée' },

  // === CONGO ===
  'Impfondo': { lat: 1.6667, lng: 18.0667, country: 'Congo', region: 'Afrique Centrale' },
  'Dolisie': { lat: -4.2000, lng: 12.6667, country: 'Congo', region: 'Afrique Centrale' },

  // === GABON ===
  'Makokou': { lat: 0.5667, lng: 12.8667, country: 'Gabon', region: 'Afrique Centrale' },

  // === CENTRAFRIQUE ===
  'Bria': { lat: 6.5333, lng: 21.9833, country: 'Centrafrique', region: 'Afrique Centrale' },

  // === GUINÉE ÉQUATORIALE ===
  'Malabo': { lat: 3.7508, lng: 8.7837, country: 'Guinée Équatoriale', region: 'Afrique Centrale' },

  // === RWANDA ===
  'Gisenyi': { lat: -1.7000, lng: 29.2500, country: 'Rwanda', region: 'Grands Lacs' },

  // === BURUNDI ===
  'Cibitoke': { lat: -2.8833, lng: 29.1333, country: 'Burundi', region: 'Grands Lacs' },
  'Makamba': { lat: -4.1333, lng: 29.8000, country: 'Burundi', region: 'Grands Lacs' },

  // === OUGANDA ===
  'Moroto': { lat: 2.5333, lng: 34.6667, country: 'Ouganda', region: 'Grands Lacs' },
  'Gulu': { lat: 2.7667, lng: 32.3000, country: 'Ouganda', region: 'Grands Lacs' },

  // === KENYA ===
  'Mandera': { lat: 3.9333, lng: 41.8667, country: 'Kenya', region: "Afrique de l'Est" },
  'Moyale': { lat: 3.5333, lng: 39.0500, country: 'Kenya', region: "Afrique de l'Est" },
  'Lodwar': { lat: 3.1167, lng: 35.6000, country: 'Kenya', region: "Afrique de l'Est" },
  'Nairobi': { lat: -1.2864, lng: 36.8172, country: 'Kenya', region: "Afrique de l'Est" },

  // === TANZANIE ===
  'Kasulu': { lat: -4.5667, lng: 30.1000, country: 'Tanzanie', region: "Afrique de l'Est" },
  'Dodoma': { lat: -6.1731, lng: 35.7419, country: 'Tanzanie', region: "Afrique de l'Est" },

  // === ÉTHIOPIE ===
  'Shire': { lat: 14.1000, lng: 38.2833, country: 'Éthiopie', region: "Afrique de l'Est" },
  'Jijiga': { lat: 9.3500, lng: 42.8000, country: 'Éthiopie', region: "Afrique de l'Est" },
  'Addis-Abeba': { lat: 9.0320, lng: 38.7469, country: 'Éthiopie', region: "Afrique de l'Est" },

  // === SOUDAN ===
  'El Fasher': { lat: 13.6333, lng: 25.3500, country: 'Soudan', region: "Corne de l'Afrique" },
  'Khartoum': { lat: 15.5007, lng: 32.5599, country: 'Soudan', region: "Corne de l'Afrique" },

  // === SOUDAN DU SUD ===
  'Bentiu': { lat: 9.2333, lng: 29.8000, country: 'Soudan du Sud', region: "Corne de l'Afrique" },
  'Yei': { lat: 4.1000, lng: 30.6833, country: 'Soudan du Sud', region: "Corne de l'Afrique" },
  'Juba': { lat: 4.8517, lng: 31.5825, country: 'Soudan du Sud', region: "Corne de l'Afrique" },

  // === DJIBOUTI ===
  'Obock': { lat: 12.2500, lng: 43.2833, country: 'Djibouti', region: "Corne de l'Afrique" },

  // === ÉRYTHRÉE ===
  'Massawa': { lat: 15.6000, lng: 39.4500, country: 'Érythrée', region: "Corne de l'Afrique" },

  // === ALGÉRIE ===
  'In Amenas': { lat: 28.0500, lng: 9.5500, country: 'Algérie', region: 'Maghreb' },
  'Tamanrasset': { lat: 22.7850, lng: 5.5228, country: 'Algérie', region: 'Maghreb' },

  // === MAROC ===
  'Laâyoune': { lat: 27.1500, lng: -13.2000, country: 'Maroc', region: 'Maghreb' },
  'Dakhla': { lat: 23.6833, lng: -15.9333, country: 'Maroc', region: 'Maghreb' },

  // === TUNISIE ===
  'Tunis': { lat: 36.8065, lng: 10.1815, country: 'Tunisie', region: 'Maghreb' },
  'Ben Gardane': { lat: 33.1333, lng: 11.2167, country: 'Tunisie', region: 'Maghreb' },

  // === LIBYE ===
  'Sebha': { lat: 27.0333, lng: 14.4333, country: 'Libye', region: 'Maghreb' },

  // === ÉGYPTE ===
  'Al-Arish': { lat: 31.1333, lng: 33.8000, country: 'Égypte', region: 'Maghreb' },

  // === AFRIQUE DU SUD ===
  'Soweto': { lat: -26.2667, lng: 27.8667, country: 'Afrique du Sud', region: 'Afrique Australe' },
  'Johannesburg': { lat: -26.2041, lng: 28.0473, country: 'Afrique du Sud', region: 'Afrique Australe' },

  // === ZIMBABWE ===
  'Hwange': { lat: -18.3667, lng: 26.5000, country: 'Zimbabwe', region: 'Afrique Australe' },
  'Zvishavane': { lat: -20.3333, lng: 30.0333, country: 'Zimbabwe', region: 'Afrique Australe' },

  // === ZAMBIE ===
  'Solwezi': { lat: -12.1833, lng: 26.4000, country: 'Zambie', region: 'Afrique Australe' },

  // === MADAGASCAR ===
  'Mahajanga': { lat: -15.7167, lng: 46.3167, country: 'Madagascar', region: 'Océan Indien' },

  // === ANGOLA ===
  'Buco-Zau': { lat: -4.8167, lng: 12.5833, country: 'Angola', region: 'Afrique Australe' },
  'Luau': { lat: -10.7000, lng: 22.2333, country: 'Angola', region: 'Afrique Australe' },

  // === NAMIBIE ===
  'Katima Mulilo': { lat: -17.5000, lng: 24.2667, country: 'Namibie', region: 'Afrique Australe' },

  // === MAURICE ===
  'Flic en Flac': { lat: -20.2833, lng: 57.3667, country: 'Maurice', region: 'Océan Indien' },
  'Tamarin': { lat: -20.3333, lng: 57.3833, country: 'Maurice', region: 'Océan Indien' },

  // === SEYCHELLES ===
  'Beau Vallon': { lat: -4.6167, lng: 55.4333, country: 'Seychelles', region: 'Océan Indien' },

  // === COMORES ===
  'Moroni': { lat: -11.7022, lng: 43.2551, country: 'Comores', region: 'Océan Indien' },

  // === SÉNÉGAL ===
  'Bignona': { lat: 12.8500, lng: -16.2333, country: 'Sénégal', region: "Afrique de l'Ouest" },
  'Rufisque': { lat: 14.7167, lng: -17.2667, country: 'Sénégal', region: "Afrique de l'Ouest" },

  // === GUINÉE ===
  'Guéckédou': { lat: 8.5667, lng: -10.1333, country: 'Guinée', region: "Afrique de l'Ouest" },
  'Siguiri': { lat: 11.4167, lng: -9.1667, country: 'Guinée', region: "Afrique de l'Ouest" },

  // === SIERRA LEONE ===
  'Kenema': { lat: 7.8833, lng: -11.1833, country: 'Sierra Leone', region: "Afrique de l'Ouest" },
  'Koidu': { lat: 8.6333, lng: -10.9667, country: 'Sierra Leone', region: "Afrique de l'Ouest" },

  // === LIBERIA ===
  'Ganta': { lat: 7.2333, lng: -8.9833, country: 'Liberia', region: "Afrique de l'Ouest" },

  // === GAMBIE ===
  'Barra': { lat: 13.4833, lng: -16.5500, country: 'Gambie', region: "Afrique de l'Ouest" },

  // === GUINÉE-BISSAU ===
  'Bissau': { lat: 11.8636, lng: -15.5977, country: 'Guinée-Bissau', region: "Afrique de l'Ouest" },

  // === CAP-VERT ===
  'Assomada': { lat: 15.1000, lng: -23.6833, country: 'Cap-Vert', region: "Afrique de l'Ouest" },

  // === MALAWI ===
  'Karonga': { lat: -9.9333, lng: 33.9333, country: 'Malawi', region: "Afrique de l'Est" },

  // === BOTSWANA ===
  'Maun': { lat: -19.9833, lng: 23.4167, country: 'Botswana', region: 'Afrique Australe' },

  // === LESOTHO ===
  'Maseru': { lat: -29.3151, lng: 27.4863, country: 'Lesotho', region: 'Afrique Australe' },

  // === ESWATINI ===
  'Mbabane': { lat: -26.3167, lng: 31.1333, country: 'Eswatini', region: 'Afrique Australe' },

  // === MAURITANIE ===
  'Bassikounou': { lat: 16.9167, lng: -5.9333, country: 'Mauritanie', region: 'Sahel' },

  // === SAO TOMÉ ===
  'São Tomé': { lat: 0.3365, lng: 6.7273, country: 'Sao Tomé-et-Principe', region: 'Afrique Centrale' },
};

// Fonction utilitaire pour trouver les coordonnées d'une localité
export function findLocalityCoord(locality: string, country: string): GeoCoord | null {
  // Cherche d'abord dans les localités connues
  if (localityCoordinates[locality]) return localityCoordinates[locality];

  // Fallback : cherche le centre du pays
  const countryCenter = africaCountryCenters[country];
  if (countryCenter) return countryCenter;

  // Dernier fallback : casse identique mais capitalisation différente
  const lcLocality = locality.toLowerCase();
  for (const key of Object.keys(localityCoordinates)) {
    if (key.toLowerCase() === lcLocality) return localityCoordinates[key];
  }

  return null;
}

// Données d'intensité pour le heatmap — agrégation par localité
export interface HeatPoint {
  lat: number;
  lng: number;
  intensity: number;  // 0-1 scale
  count: number;
  locality: string;
  country: string;
  sevCritical: number;
  sevHigh: number;
  sevMedium: number;
  sevLow: number;
}