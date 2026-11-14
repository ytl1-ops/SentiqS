#!/usr/bin/env node
// Référencement des pages publiques (14/11/2026).
//
// Écrit, à partir de ce qui est réellement dans web/ :
//   - le bloc <head> de l'accueil (web/index.html, entre SEO:debut et SEO:fin) :
//     titre, description, adresse canonique, hreflang FR/EN, Open Graph,
//     Twitter, données structurées Organization / WebSite / FAQPage ;
//   - web/en.html, la version anglaise de l'accueil, à une adresse à elle
//     (hreflang exige une adresse par langue ; un choix mémorisé dans le
//     navigateur est invisible pour un moteur de recherche) ;
//   - web/sitemap.xml.
//
// La FAQ des données structurées est lue dans les <details> de l'accueil et
// traduite par la table de l'accueil (dico-site-en.js) : une FAQ balisée qui
// diverge du texte affiché est une infraction aux règles de Google.
//
//   node scripts/generer-seo.js            écrit les fichiers
//   node scripts/generer-seo.js --verifier échoue si un fichier n'est pas à jour
//                                          (les dates <lastmod> du sitemap,
//                                          qui changent chaque jour avec les
//                                          bulletins, ne comptent pas)
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const WEB = path.join(RACINE, 'web');
// Domaine canonique : voir web/js/domaine-canonique.js pour la raison du choix.
const SITE = 'https://sentiqs-235ce.web.app';

globalThis.SentiqLangue = require(path.join(WEB, 'js', 'langue.js'));
require(path.join(WEB, 'js', 'dico-site-en.js'));
const tr = (t) => globalThis.SentiqLangue.traduire(t);

const lire = (f) => fs.readFileSync(path.join(WEB, f), 'utf8');
const attr = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const texte = (html) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim();
// Un « </script> » dans une chaîne fermerait le bloc JSON-LD.
const jsonLd = (o) => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>';

function faqAccueil(html) {
  const sec = html.slice(html.indexOf('<section id="faq"'));
  const fin = sec.indexOf('</section>');
  const q = [];
  const re = /<details><summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p><\/details>/g;
  let m;
  while ((m = re.exec(sec.slice(0, fin)))) q.push({ question: texte(m[1]), reponse: texte(m[2]) });
  if (q.length < 3) throw new Error('FAQ de l\'accueil introuvable ou incomplète (' + q.length + ' questions)');
  return q;
}

function nombreSources(html) {
  const m = html.match(/De (\d+) sources suivies/);
  if (!m) throw new Error('nombre de sources introuvable dans la FAQ de l\'accueil');
  return m[1];
}

const TEXTES = (n) => ({
  fr: {
    titre: 'SentiqS — Veille sûreté et risque pays sur les 54 pays d\'Afrique',
    description: 'Veille sûreté en temps réel sur les 54 pays d\'Afrique : niveau d\'alerte par pays, faits cotés et recoupés, bulletin quotidien et rapports Word, PDF, PowerPoint. ' + n + ' sources suivies, essai gratuit 72 h.',
    partage: 'Niveaux d\'alerte, faits cotés et recoupés, bulletin quotidien : la veille sûreté des responsables qui opèrent en Afrique.',
    alt: 'SentiqS — veille sûreté sur les 54 pays d\'Afrique',
    locale: 'fr_FR', autre: 'en_GB', adresse: SITE + '/', image: SITE + '/assets/partage-fr.png',
  },
  en: {
    titre: 'SentiqS — Security and country-risk monitoring for all 54 African countries',
    description: 'Real-time security monitoring across all 54 African countries: alert level per country, rated and cross-checked facts, a daily bulletin and Word, PDF, PowerPoint reports. ' + n + ' sources, 72-hour free trial.',
    partage: 'Alert levels, rated and cross-checked facts, a daily bulletin: security monitoring for managers operating in Africa.',
    alt: 'SentiqS — security monitoring across all 54 African countries',
    locale: 'en_GB', autre: 'fr_FR', adresse: SITE + '/en.html', image: SITE + '/assets/partage-en.png',
  },
});

function blocSeo(lang, t, faq) {
  const organisation = {
    '@type': 'Organization', '@id': SITE + '/#organisation', name: 'SentiqS', url: SITE + '/',
    logo: { '@type': 'ImageObject', url: SITE + '/icons/icone-512.png', width: 512, height: 512 },
    areaServed: { '@type': 'Place', name: 'Africa' },
  };
  const site = {
    '@type': 'WebSite', '@id': SITE + '/#site', name: 'SentiqS', url: SITE + '/',
    inLanguage: ['fr', 'en'], publisher: { '@id': SITE + '/#organisation' },
  };
  const pageFaq = {
    '@type': 'FAQPage', '@id': t.adresse + '#faq', inLanguage: lang, url: t.adresse,
    mainEntity: faq.map((f) => ({
      '@type': 'Question', name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.reponse },
    })),
  };
  return [
    '<!-- SEO:debut — bloc écrit par scripts/generer-seo.js, ne pas modifier à la main -->',
    '<script src="js/domaine-canonique.js"></script>',
    lang === 'en' ? '<script>window.SENTIQ_LANGUE_PAGE=\'en\';</script>' : '<script>window.SENTIQ_LANGUE_PAGE=\'fr\';</script>',
    '<title>' + attr(t.titre) + '</title>',
    '<meta name="description" content="' + attr(t.description) + '">',
    '<meta name="author" content="SentiqS">',
    // Core Web Vitals : la première photo du décor est le plus grand élément
    // affiché (LCP) ; sans cette annonce, le navigateur ne la découvre
    // qu'après toute la feuille de style de la page.
    '<link rel="preload" as="image" href="assets/capitales/abidjan.jpg" fetchpriority="high">',
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">',
    '<link rel="canonical" href="' + t.adresse + '">',
    '<link rel="alternate" hreflang="fr" href="' + SITE + '/">',
    '<link rel="alternate" hreflang="en" href="' + SITE + '/en.html">',
    '<link rel="alternate" hreflang="x-default" href="' + SITE + '/">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="SentiqS">',
    '<meta property="og:url" content="' + t.adresse + '">',
    '<meta property="og:title" content="' + attr(t.titre) + '">',
    '<meta property="og:description" content="' + attr(t.partage) + '">',
    '<meta property="og:image" content="' + t.image + '">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="' + attr(t.alt) + '">',
    '<meta property="og:locale" content="' + t.locale + '">',
    '<meta property="og:locale:alternate" content="' + t.autre + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + attr(t.titre) + '">',
    '<meta name="twitter:description" content="' + attr(t.partage) + '">',
    '<meta name="twitter:image" content="' + t.image + '">',
    '<meta name="twitter:image:alt" content="' + attr(t.alt) + '">',
    jsonLd({ '@context': 'https://schema.org', '@graph': [organisation, site, pageFaq] }),
    '<!-- SEO:fin -->',
  ].join('\n');
}

function remplacerBloc(html, bloc) {
  const a = html.indexOf('<!-- SEO:debut');
  const b = html.indexOf('<!-- SEO:fin -->');
  if (a < 0 || b < a) throw new Error('marqueurs SEO:debut / SEO:fin introuvables dans web/index.html');
  return html.slice(0, a) + bloc + html.slice(b + '<!-- SEO:fin -->'.length);
}

function accueil() {
  const source = lire('index.html');
  const faqFr = faqAccueil(source);
  const t = TEXTES(nombreSources(source));
  const faqEn = faqFr.map((f) => ({ question: tr(f.question), reponse: tr(f.reponse) }));
  const fr = remplacerBloc(source, blocSeo('fr', t.fr, faqFr));
  let en = remplacerBloc(source, blocSeo('en', t.en, faqEn)).replace('<html lang="fr">', '<html lang="en">');
  en = en.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<!-- Version anglaise de l\'accueil, écrite par scripts/generer-seo.js à partir de index.html : ne pas modifier à la main. -->');
  return { fr, en, faqFr, faqEn };
}

// ── Sitemap ────────────────────────────────────────────────────────────────
function datesBulletin(dossier) {
  try {
    return fs.readdirSync(path.join(WEB, 'bulletins', dossier))
      .map((f) => (f.match(/^(\d{4}-\d{2}-\d{2})\.html$/) || [])[1]).filter(Boolean).sort();
  } catch (_) { return []; }
}

function pagesPubliques() {
  const pages = [];
  pages.push({ loc: SITE + '/', alternates: true });
  pages.push({ loc: SITE + '/en.html', alternates: true });
  const pays = fs.readdirSync(path.join(WEB, 'pays')).filter((f) => f.endsWith('.html')).sort();
  for (const f of pays) pages.push({ loc: SITE + '/pays/' + f });
  const dossiers = fs.readdirSync(path.join(WEB, 'bulletins'))
    .filter((d) => /^[A-Z]{2}$/.test(d) && fs.existsSync(path.join(WEB, 'bulletins', d, 'dernier.html'))).sort();
  let plusRecent = '';
  for (const d of dossiers) {
    const dates = datesBulletin(d);
    const der = dates[dates.length - 1] || '';
    if (der > plusRecent) plusRecent = der;
    pages.push({ loc: SITE + '/bulletins/' + d + '/dernier.html', lastmod: der });
  }
  if (fs.existsSync(path.join(WEB, 'bulletins', 'index.html'))) {
    pages.splice(2, 0, { loc: SITE + '/bulletins/index.html', lastmod: plusRecent });
  }
  return pages;
}

function sitemap() {
  const lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Écrit par scripts/generer-seo.js (aussi relancé à chaque déploiement, pour les dates des bulletins). -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
  for (const p of pagesPubliques()) {
    lignes.push('<url>', '<loc>' + p.loc + '</loc>');
    if (p.lastmod) lignes.push('<lastmod>' + p.lastmod + '</lastmod>');
    if (p.alternates) {
      lignes.push('<xhtml:link rel="alternate" hreflang="fr" href="' + SITE + '/"/>',
        '<xhtml:link rel="alternate" hreflang="en" href="' + SITE + '/en.html"/>',
        '<xhtml:link rel="alternate" hreflang="x-default" href="' + SITE + '/"/>');
    }
    lignes.push('</url>');
  }
  lignes.push('</urlset>', '');
  return lignes.join('\n');
}

const sansDates = (xml) => xml.replace(/<lastmod>[^<]*<\/lastmod>\n?/g, '');

function principal(argv) {
  const verifier = argv.includes('--verifier');
  const { fr, en, faqFr, faqEn } = accueil();
  // Une question restée en français dans la FAQ anglaise : il manque son
  // entrée dans dico-site-en.js.
  faqEn.forEach((f, i) => {
    if (f.question === faqFr[i].question || f.reponse === faqFr[i].reponse) {
      throw new Error('FAQ non traduite dans dico-site-en.js : « ' + faqFr[i].question + ' »');
    }
  });
  const fichiers = { 'index.html': fr, 'en.html': en, 'sitemap.xml': sitemap() };
  const ecarts = [];
  for (const [f, contenu] of Object.entries(fichiers)) {
    const chemin = path.join(WEB, f);
    const actuel = fs.existsSync(chemin) ? fs.readFileSync(chemin, 'utf8') : null;
    const egal = f === 'sitemap.xml' ? actuel !== null && sansDates(actuel) === sansDates(contenu) : actuel === contenu;
    if (verifier) { if (!egal) ecarts.push(f); continue; }
    if (actuel !== contenu) { fs.writeFileSync(chemin, contenu); console.log('écrit : web/' + f); }
  }
  if (verifier && ecarts.length) {
    console.error('Pas à jour : ' + ecarts.map((f) => 'web/' + f).join(', ') + ' — lancer node scripts/generer-seo.js');
    process.exit(1);
  }
  if (verifier) console.log('Référencement à jour (accueil FR/EN, sitemap).');
}

module.exports = { SITE, faqAccueil, pagesPubliques, sitemap, accueil };
if (require.main === module) principal(process.argv.slice(2));
