// Met a jour les balises <lastmod> du sitemap avec la date du jour (UTC).
// Objectif : signaler aux moteurs de recherche une actualisation reguliere du contenu (axe 2 - automatisation).
// Usage : node scripts/update-sitemap-freshness.js
const fs = require('fs');
const path = require('path');

const sitemapPath = path.join(__dirname, '..', 'web', 'sitemap.xml');

if (!fs.existsSync(sitemapPath)) {
  console.log('sitemap.xml introuvable - le point 1 de la feuille de route SEO doit etre fusionne avant d activer cette automatisation.');
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
let xml = fs.readFileSync(sitemapPath, 'utf8');
const updated = xml.replace(/<lastmod>.*?<\/lastmod>/g, '<lastmod>' + today + '</lastmod>');

if (updated === xml) {
  console.log('Aucune balise lastmod trouvee, rien a mettre a jour.');
} else {
  fs.writeFileSync(sitemapPath, updated);
  console.log('sitemap.xml mis a jour avec lastmod=' + today);
}
