#!/usr/bin/env node
/**
 * Generateur de fiches pays SentiqS (Point 3 du plan SEO).
 *
 * REGLE DE SECURITE DU CONTENU :
 * Ce script NE GENERE JAMAIS de contenu securitaire a partir de rien.
 * Il assemble un fichier HTML a partir d'un gabarit
 * (scripts/templates/fiche-country.template.html) et d'un fichier de
 * donnees JSON (data/pays/<slug>.json) que vous devez avoir rempli au
 * prealable a partir de sources verifiees (diplomatie, OSAC, Crisis24,
 * presse locale fiable, ONG reconnues, etc.). Le champ "sources" du
 * fichier JSON est obligatoire et ne doit jamais etre vide : le script
 * refuse de generer la fiche si ce n'est pas le cas, ou si un champ
 * requis du schema (data/pays/schema.json) est manquant.
 *
 * Usage :
 *   node scripts/generate-country-fiche.js <slug> [--force]
 *
 * --force : autorise a ecraser un fichier web/pays/<slug>.html existant.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEMPLATE_PATH = path.join(ROOT, 'scripts', 'templates', 'fiche-country.template.html');
const DATA_DIR = path.join(ROOT, 'data', 'pays');
const OUTPUT_DIR = path.join(ROOT, 'web', 'pays');

const REQUIRED_FIELDS = [
  'iso2', 'slug', 'name', 'namePrep', 'region', 'capital',
  'datePublished', 'dateModified', 'metaDescription', 'keywords',
  'summary', 'threats', 'neighbors', 'sources'
];

function fail(message) {
  console.error('\n✗ Generation refusee : ' + message + '\n');
  process.exit(1);
}

function formatDateHuman(isoDate) {
  const mois = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
  const parts = isoDate.split('-').map(Number);
  const y = parts[0], m = parts[1], d = parts[2];
  if (!y || !m || !d) return isoDate;
  return d + ' ' + mois[m - 1] + ' ' + y;
}

function esc(str) {
  return String(str);
}

function buildNeighborsHtml(neighbors) {
  return neighbors.map(function (n) {
    if (n.available) {
      return '<a class="border-card" href="' + n.slug + '.html">' + n.name + '</a>';
    }
    return '<span class="border-card border-card--soon">' + n.name + ' <em>(fiche a venir)</em></span>';
  }).join('\n');
}

function buildAlertsHtml(alertsSample) {
  if (!alertsSample || alertsSample.length === 0) {
    return '<div class="alert-blur-item"><span class="alert-tag">INFO</span>' +
      '<span class="alert-txt">Configurez les categories d\'alertes (Surete, Social, Infrastructures) dans l\'application SentiqS pour ce pays.</span>' +
      '<span class="alert-time"></span></div>';
  }
  return alertsSample.map(function (a) {
    return '<div class="alert-blur-item"><span class="alert-tag">' + a.tag + '</span>' +
      '<span class="alert-txt">' + a.text + '</span>' +
      '<span class="alert-time">' + a.time + '</span></div>';
  }).join('\n');
}

function validate(data, slugArg) {
  const missing = REQUIRED_FIELDS.filter(function (f) { return data[f] === undefined || data[f] === null || data[f] === ''; });
  if (missing.length) {
    fail('champs obligatoires manquants dans data/pays/' + slugArg + '.json : ' + missing.join(', '));
  }
  if (!Array.isArray(data.sources) || data.sources.length === 0) {
    fail('le champ "sources" est vide. Ajoutez au moins une source verifiee avant de generer la fiche.');
  }
  ['terrorism', 'crime', 'infra'].forEach(function (key) {
    const block = data.threats && data.threats[key];
    if (!block || !block.title || !block.text) {
      fail('le bloc threats.' + key + ' est incomplet (title/text requis).');
    }
  });
  if (!Array.isArray(data.neighbors)) {
    fail('le champ "neighbors" doit etre un tableau.');
  }
}

function main() {
  const slugArg = process.argv[2];
  const force = process.argv.includes('--force');

  if (!slugArg) {
    fail('vous devez indiquer un slug, ex: node scripts/generate-country-fiche.js senegal');
  }

  const dataPath = path.join(DATA_DIR, slugArg + '.json');
  if (!fs.existsSync(dataPath)) {
    fail('fichier de donnees introuvable : data/pays/' + slugArg + '.json. Creez-le d\'abord (voir data/pays/schema.json et data/pays/ghana.json en exemple).');
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch (e) {
    fail('JSON invalide dans data/pays/' + slugArg + '.json : ' + e.message);
  }

  validate(data, slugArg);

  const outputPath = path.join(OUTPUT_DIR, data.slug + '.html');
  if (fs.existsSync(outputPath) && !force) {
    fail('web/pays/' + data.slug + '.html existe deja. Relancez avec --force pour ecraser volontairement.');
  }

  let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  const replacements = {
    '{{NAME}}': esc(data.name),
    '{{NAME_PREP}}': esc(data.namePrep),
    '{{SLUG}}': esc(data.slug),
    '{{META_DESCRIPTION}}': esc(data.metaDescription),
    '{{KEYWORDS}}': esc(data.keywords),
    '{{DATE_PUBLISHED}}': esc(data.datePublished),
    '{{DATE_MODIFIED}}': esc(data.dateModified),
    '{{DATE_MODIFIED_HUMAN}}': formatDateHuman(data.dateModified),
    '{{SUMMARY}}': esc(data.summary),
    '{{THREAT_TERRORISM_TITLE}}': esc(data.threats.terrorism.title),
    '{{THREAT_TERRORISM_TEXT}}': esc(data.threats.terrorism.text),
    '{{THREAT_CRIME_TITLE}}': esc(data.threats.crime.title),
    '{{THREAT_CRIME_TEXT}}': esc(data.threats.crime.text),
    '{{THREAT_INFRA_TITLE}}': esc(data.threats.infra.title),
    '{{THREAT_INFRA_TEXT}}': esc(data.threats.infra.text),
    '{{NEIGHBORS_HTML}}': buildNeighborsHtml(data.neighbors),
    '{{ALERTS_HTML}}': buildAlertsHtml(data.alertsSample),
    '{{CTA_TEXT}}': esc(data.ctaText || ('L\'application SentiqS permet de recevoir des alertes Push et SMS en temps reel et de cartographier vos equipes ' + data.namePrep + ' pour securiser vos activites.'))
  };

  Object.keys(replacements).forEach(function (token) {
    html = html.split(token).join(replacements[token]);
  });

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(outputPath, html, 'utf8');

  console.log('\n✓ Fiche generee : web/pays/' + data.slug + '.html');
  console.log('  Prochaines etapes manuelles :');
  console.log('  1) Ajouter l\'entree dans sitemap.xml');
  console.log('  2) Ajouter le lien dans web/pays/index.html (hub des fiches pays)');
  console.log('  3) Mettre a jour les fiches voisines existantes si ce pays devient disponible pour elles');
}

main();
