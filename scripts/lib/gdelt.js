'use strict';
// GDELT — signal secondaire de la collecte (décision de YORO, 18/11/2026).
//
// Le projet GDELT indexe en continu la presse mondiale et publie sa liste
// d'articles par une API libre et gratuite, sans clé (DOC 2.0,
// api.gdeltproject.org). Il élargit le Flux sur les pays restés muets faute
// de flux RSS local (voir « Silence n'est pas calme », CLAUDE.md).
//
// Ce que GDELT n'est PAS ici : une source capable d'alerter. Ses entrées du
// registre sont notées 60, sous le seuil 70 de getLiveAlertEvents : elles
// nourrissent le Flux, la couverture et l'historique, jamais le niveau. Un
// agrégateur qui ramasse tout ne vaut pas un média lu ; c'est la même règle
// que pour les requêtes Google News.
//
// Une requête par aire linguistique, et non par pays : l'API demande une
// requête toutes les cinq secondes au plus (fetch-respectueux le respecte),
// et 54 requêtes coûteraient près de cinq minutes à chaque collecte. Le pays
// de chaque article est ensuite reconnu dans son titre par la page, comme
// pour toute source régionale.
//
// Les noms sont écrits dans la langue des articles demandés : une requête en
// anglais avec « Afrique du Sud » ne trouve rien (piège du 06/09/2026).
const API = 'https://api.gdeltproject.org/api/v2/doc/doc';
const DELAI_MIN_MS = 5500;

// Thèmes de la configuration du projet : sécurité, politique, humanitaire
// (pas de cyber). Thèmes GKG de GDELT.
const THEMES = ['TERROR', 'KILL', 'ARMEDCONFLICT', 'KIDNAP', 'PROTEST', 'MILITARY',
  'SECURITY_SERVICES', 'REBELLION', 'ARREST', 'REFUGEES', 'ELECTION', 'COUP'];

const REQUETES = [
  { id: 'gdelt_ouest_fr', nom: 'Afrique de l\'Ouest (fr)', langue: 'french',
    pays: ['Sénégal', 'Mali', 'Burkina Faso', 'Niger', 'Guinée', 'Côte d\'Ivoire', 'Togo', 'Bénin', 'Mauritanie'] },
  { id: 'gdelt_centre_fr', nom: 'Afrique centrale et océan Indien (fr)', langue: 'french',
    pays: ['Cameroun', 'Tchad', 'Centrafrique', 'Gabon', 'Congo', 'RDC', 'Burundi', 'Comores', 'Djibouti', 'Madagascar'] },
  { id: 'gdelt_ouest_en', nom: 'Afrique de l\'Ouest (en)', langue: 'english',
    pays: ['Nigeria', 'Ghana', 'Liberia', 'Sierra Leone', 'Gambia', 'Cape Verde', 'Guinea-Bissau'] },
  { id: 'gdelt_est_en', nom: 'Afrique de l\'Est et Corne (en)', langue: 'english',
    pays: ['Kenya', 'Uganda', 'Tanzania', 'Ethiopia', 'Somalia', 'South Sudan', 'Sudan', 'Eritrea', 'Rwanda', 'Seychelles', 'Mauritius'] },
  { id: 'gdelt_australe_en', nom: 'Afrique australe (en)', langue: 'english',
    pays: ['South Africa', 'Zimbabwe', 'Zambia', 'Malawi', 'Mozambique', 'Botswana', 'Namibia', 'Lesotho', 'Eswatini', 'Angola'] },
  { id: 'gdelt_nord_en', nom: 'Afrique du Nord (en)', langue: 'english',
    pays: ['Libya', 'Egypt', 'Tunisia', 'Algeria', 'Morocco'] },
  { id: 'gdelt_lusophone_pt', nom: 'Afrique lusophone (pt)', langue: 'portuguese',
    pays: ['Angola', 'Moçambique', 'Cabo Verde', 'Guiné-Bissau', 'São Tomé'] },
  { id: 'gdelt_gq_es', nom: 'Guinée équatoriale (es)', langue: 'spanish',
    pays: ['Guinea Ecuatorial'] },
];

const terme = (t) => (/\s|-|'/.test(t) ? '"' + t + '"' : t);

// themes=false donne la requête sans filtre de thème (sonde de comparaison).
function requeteGdelt(r, o) {
  o = o || {};
  const pays = r.pays.length > 1 ? '(' + r.pays.map(terme).join(' OR ') + ')' : terme(r.pays[0]);
  const themes = o.themes === false ? '' : ' (' + THEMES.map((t) => 'theme:' + t).join(' OR ') + ')';
  return pays + themes + ' sourcelang:' + r.langue;
}

function urlGdelt(r, o) {
  o = o || {};
  const p = new URLSearchParams({ query: requeteGdelt(r, o), mode: 'artlist', format: o.format || 'rss',
    maxrecords: String(o.max || 75), timespan: o.timespan || '36h', sort: 'datedesc' });
  return API + '?' + p.toString();
}

module.exports = { API, DELAI_MIN_MS, THEMES, REQUETES, requeteGdelt, urlGdelt };
