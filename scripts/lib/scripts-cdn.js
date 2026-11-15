// Inventaire des scripts tiers chargés par les pages servies (audit du
// 15/11/2026). Une seule lecture, partagée par le test hors ligne
// (scripts/test/integrite-cdn.test.js) et par la vérification réseau de la CI
// (scripts/verifier-integrite-cdn.js) : les deux regardent la même liste.
//
// Trois formes de chargement existent dans web/ :
//   · une balise <script src="https://…"> dans un .html ;
//   · une entrée { src, integrity } de BIBLIOTHEQUES_EXPORT (exports) ;
//   · une affectation s.src = '…' suivie de s.integrity = '…' (EmailJS) ;
//   · le kit Firebase, dont l'adresse est construite par web/js/firebase.js.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..', '..');
const PAGES = ['web/SentiqS_Web.html', 'web/index.html', 'web/en.html'];
// Hôtes de CDN publics dont un fichier peut changer sans que le dépôt bouge.
// pay.google.com et apis.google.com sont exclus : Google ne publie pas
// d'empreinte stable pour ces scripts, qui évoluent sous la même adresse.
const HOTES_CDN = ['cdn.jsdelivr.net', 'cdn.sheetjs.com', 'unpkg.com', 'cdnjs.cloudflare.com'];

function lire(rel) { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); }
function estCdn(url) { try { return HOTES_CDN.includes(new URL(url).hostname); } catch (_) { return false; } }

function inventaire() {
  const res = [];
  for (const page of PAGES) {
    const html = lire(page);
    for (const m of html.matchAll(/<script\b[^>]*\bsrc="(https:[^"]+)"[^>]*>/g)) {
      if (!estCdn(m[1])) continue;
      const integ = (m[0].match(/\bintegrity="([^"]+)"/) || [])[1] || null;
      const cors = /\bcrossorigin="anonymous"/.test(m[0]);
      res.push({ ou: page + ' (balise)', url: m[1], integrity: integ, cors });
    }
    for (const m of html.matchAll(/\bsrc:\s*'(https:[^']+)'(?:,\s*integrity:\s*'([^']+)')?/g)) {
      if (!estCdn(m[1])) continue;
      res.push({ ou: page + ' (BIBLIOTHEQUES_EXPORT)', url: m[1], integrity: m[2] || null, cors: !!m[2] });
    }
    for (const m of html.matchAll(/\b(\w+)\.src\s*=\s*'(https:[^']+)';\s*(?:\1\.integrity\s*=\s*'([^']+)')?/g)) {
      if (!estCdn(m[2])) continue;
      res.push({ ou: page + ' (chargement dynamique)', url: m[2], integrity: m[3] || null, cors: !!m[3] });
    }
  }
  const fb = require(path.join(RACINE, 'web/js/firebase.js'));
  for (const [fichier, integ] of Object.entries(fb.INTEGRITE_SDK || {})) {
    res.push({ ou: 'web/js/firebase.js', url: fb.BASE_SDK + fichier, integrity: integ, cors: true });
  }
  return res;
}

// Une version flottante (« @2 », « @4 », « @latest ») : le CDN sert la
// dernière publiée, donc du code que personne n'a relu.
function versionFlottante(url) {
  const tous = [...url.matchAll(/@([^/]+)\//g)];
  const m = tous[tous.length - 1];
  if (!m) return !/cdn\.sheetjs\.com\/xlsx-\d+\.\d+\.\d+\//.test(url);
  return !/^\d+\.\d+\.\d+$/.test(m[1]);
}

module.exports = { inventaire, versionFlottante, HOTES_CDN, PAGES };
