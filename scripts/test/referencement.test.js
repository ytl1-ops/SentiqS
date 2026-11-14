// Référencement des pages publiques (14/11/2026) : domaine canonique,
// hreflang FR/EN, données structurées, sitemap, pages exclues de l'index.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.join(__dirname, '..', '..');
const WEB = path.join(RACINE, 'web');
const lire = (f) => fs.readFileSync(path.join(WEB, f), 'utf8');
const SEO = require('../generer-seo.js');
const D = require('../../web/js/domaine-canonique.js');
const SITE = 'https://sentiqs-235ce.web.app';

const robots = (html) => (html.match(/<meta name="robots" content="([^"]+)"/) || [])[1] || '';
const ldJson = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test('accueil FR/EN et sitemap sont à jour du générateur', () => {
  execFileSync(process.execPath, [path.join(RACINE, 'scripts', 'generer-seo.js'), '--verifier'], { stdio: 'pipe' });
});

test('domaine canonique : GitHub Pages et firebaseapp.com renvoient vers web.app, rien d\'autre ne bouge', () => {
  const l = (href) => { const u = new URL(href); return { hostname: u.hostname, pathname: u.pathname, search: u.search, hash: u.hash }; };
  assert.equal(D.adresseCanonique(l('https://ytl1-ops.github.io/SentiqS/')), SITE + '/');
  assert.equal(D.adresseCanonique(l('https://ytl1-ops.github.io/SentiqS')), SITE + '/');
  assert.equal(D.adresseCanonique(l('https://ytl1-ops.github.io/SentiqS/en.html#tarifs')), SITE + '/en.html#tarifs');
  assert.equal(D.adresseCanonique(l('https://ytl1-ops.github.io/SentiqS/bulletins/ML/dernier.html?x=1')), SITE + '/bulletins/ML/dernier.html?x=1');
  assert.equal(D.adresseCanonique(l('https://sentiqs-235ce.firebaseapp.com/pays/mali.html')), SITE + '/pays/mali.html');
  assert.equal(D.adresseCanonique(l(SITE + '/')), null, 'déjà canonique : pas de boucle');
  assert.equal(D.adresseCanonique(l('http://localhost:8080/index.html')), null, 'bancs de test');
  assert.equal(D.adresseCanonique(l('https://ytl1-ops.github.io/autre-depot/')), null);
  assert.equal(D.adresseCanonique(l('https://sentiqs-235ce.firebaseapp.com/__/auth/handler')), null, 'Firebase Auth');
});

test('l\'application et la page de consentement ne quittent jamais leur adresse et ne sont pas indexées', () => {
  for (const f of ['SentiqS_Web.html', 'abonnement.html']) {
    const h = lire(f);
    assert.ok(!/<script[^>]+domaine-canonique\.js/.test(h), f + ' : les réglages locaux des utilisateurs vivent sur leur adresse');
    assert.match(robots(h), /noindex/, f);
  }
});

test('accueil FR et EN : canonique propre, hreflang croisé, image de partage, données structurées', () => {
  for (const [f, lang, adresse, image] of [['index.html', 'fr', SITE + '/', 'partage-fr.png'], ['en.html', 'en', SITE + '/en.html', 'partage-en.png']]) {
    const h = lire(f);
    assert.ok(h.includes('<html lang="' + lang + '">'), f + ' lang');
    assert.ok(h.includes('<link rel="canonical" href="' + adresse + '">'), f + ' canonique');
    for (const [hl, href] of [['fr', SITE + '/'], ['en', SITE + '/en.html'], ['x-default', SITE + '/']]) {
      assert.ok(h.includes('<link rel="alternate" hreflang="' + hl + '" href="' + href + '">'), f + ' hreflang ' + hl);
    }
    assert.ok(h.includes('<meta property="og:image" content="' + SITE + '/assets/' + image + '">'), f + ' og:image');
    assert.ok(h.includes('summary_large_image'), f + ' carte Twitter');
    // LCP : la photo annoncée en tête est bien la première du décor.
    const premiere = (h.match(/<img class="diapo" src="([^"]+)"/) || [])[1];
    assert.ok(premiere && h.includes('<link rel="preload" as="image" href="' + premiere + '"'), f + ' préchargement de la première photo');
    assert.match(robots(h), /^index/);
    assert.ok(h.indexOf('js/domaine-canonique.js') < h.indexOf('js/intro.js'), 'renvoi avant l\'animation d\'ouverture');
    const graphe = ldJson(h)[0]['@graph'];
    const types = graphe.map((n) => n['@type']);
    assert.deepEqual(types, ['Organization', 'WebSite', 'FAQPage']);
    const faq = graphe[2];
    assert.equal(faq.inLanguage, lang);
    // La FAQ balisée est celle qu'on lit à l'écran (règle de Google).
    const visibles = SEO.faqAccueil(lire('index.html'));
    assert.equal(faq.mainEntity.length, visibles.length);
    if (lang === 'fr') assert.deepEqual(faq.mainEntity.map((q) => q.name), visibles.map((v) => v.question));
    else faq.mainEntity.forEach((q, i) => assert.notEqual(q.name, visibles[i].question, 'question restée en français'));
  }
});

test('images de partage : PNG 1200 × 630', () => {
  for (const f of ['partage-fr.png', 'partage-en.png']) {
    const b = fs.readFileSync(path.join(WEB, 'assets', f));
    assert.equal(b.toString('ascii', 1, 4), 'PNG');
    assert.equal(b.readUInt32BE(16), 1200);
    assert.equal(b.readUInt32BE(20), 630);
  }
});

test('sitemap : seulement des pages publiques existantes et indexables, sur le domaine canonique', () => {
  const xml = lire('sitemap.xml');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 60, locs.length + ' adresses');
  for (const u of locs) {
    assert.ok(u.startsWith(SITE + '/'), u);
    const rel = u.slice(SITE.length + 1) || 'index.html';
    const h = lire(rel);
    assert.match(robots(h), /^index/, u + ' est dans le sitemap mais refuse l\'indexation');
    assert.ok(!/legal\/|SentiqS_Web|abonnement|rapports\/|historique\//.test(u), u);
    assert.ok(!/\/\d{4}-\d{2}-\d{2}\.html$/.test(u), u + ' : bulletin daté');
  }
  const dossiers = fs.readdirSync(path.join(WEB, 'bulletins')).filter((d) => /^[A-Z]{2}$/.test(d));
  for (const d of dossiers) assert.ok(locs.includes(SITE + '/bulletins/' + d + '/dernier.html'), d);
  assert.ok(locs.includes(SITE + '/en.html'));
});

test('pages légales : toujours hors de l\'index et hors du sitemap', () => {
  for (const f of fs.readdirSync(path.join(WEB, 'legal')).filter((n) => n.endsWith('.html'))) {
    if (/À COMPLÉTER/.test(lire('legal/' + f))) assert.match(robots(lire('legal/' + f)), /noindex/, f);
  }
  assert.ok(!lire('sitemap.xml').includes('/legal/'));
});

test('robots.txt : rien de public n\'est bloqué, sitemap sur le domaine canonique', () => {
  const r = lire('robots.txt');
  assert.ok(r.includes('Sitemap: ' + SITE + '/sitemap.xml'));
  assert.ok(!/^Disallow:\s*\/\s*$/m.test(r));
});

test('fiches pays : domaine canonique, renvoi et image de partage, gabarit compris', () => {
  const fichiers = fs.readdirSync(path.join(WEB, 'pays')).filter((n) => n.endsWith('.html')).map((n) => path.join(WEB, 'pays', n));
  fichiers.push(path.join(RACINE, 'scripts', 'templates', 'fiche-country.template.html'));
  for (const f of fichiers) {
    const h = fs.readFileSync(f, 'utf8');
    assert.ok(!h.includes('ytl1-ops.github.io'), path.basename(f));
    assert.ok(h.includes('<script src="../js/domaine-canonique.js"></script>'), path.basename(f));
    assert.ok(h.includes('/assets/partage-fr.png'), path.basename(f));
  }
});

test('bulletins : « dernier » indexable et canonique, bulletin daté hors index', () => {
  const B = require('../lib/bulletin.js');
  const d = { cy: 'ML', nom: 'Mali', niveau: 'marron', libelle: 'MARRON', sous: 'Grave', faitsNotables: 3,
    faits: [], socle: [], facteurs: [], angleMort: {} };
  const opts = { jour: '2026-11-14', genereMs: Date.parse('2026-11-14T07:00:00Z') };
  const dernier = B.rendre(d, Object.assign({ dernier: true }, opts));
  const date = B.rendre(d, opts);
  assert.ok(dernier.includes('<title>Mali — bulletin sécurité et sûreté du 14/11/2026 | SentiqS</title>'));
  assert.match(robots(dernier), /^index/);
  assert.ok(dernier.includes('<link rel="canonical" href="' + SITE + '/bulletins/ML/dernier.html">'));
  assert.match(robots(date), /^noindex/);
  for (const h of [dernier, date]) assert.ok(h.includes('<script src="../../js/domaine-canonique.js"></script>'));
  const idx = B.rendreIndex({ pays: {} });
  assert.match(robots(idx), /^index/);
  assert.ok(idx.includes('<script src="../js/domaine-canonique.js"></script>'));
});

test('IndexNow : la clé publiée est lisible, seules les pages du jour sont annoncées', () => {
  const N = require('../indexnow.js');
  const k = N.cle();
  assert.match(k, /^[0-9a-f]{32}$/);
  const xml = '<url>\n<loc>' + SITE + '/bulletins/ML/dernier.html</loc>\n<lastmod>2026-11-14</lastmod>\n</url>'
    + '<url>\n<loc>' + SITE + '/bulletins/NE/dernier.html</loc>\n<lastmod>2026-11-13</lastmod>\n</url>';
  assert.deepEqual(N.adressesDuJour(xml, '2026-11-14'), [SITE + '/', SITE + '/en.html', SITE + '/bulletins/ML/dernier.html']);
});
