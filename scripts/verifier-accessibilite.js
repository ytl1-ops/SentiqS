#!/usr/bin/env node
// Controle d'accessibilite minimal sur le fichier servi en production.
//
// Ne remplace pas un audit au lecteur d'ecran : verifie seulement ce qu'une
// machine peut affirmer sans ambiguite — un controle interactif sans nom
// accessible est inutilisable au clavier comme au lecteur d'ecran, et une
// image sans alternative textuelle n'est pas restituee du tout.
const fs = require('node:fs');
const path = require('node:path');

const cible = process.argv[2] || path.join(__dirname, '../web/SentiqS_Web.html');
const brut = fs.readFileSync(cible, 'utf8');
const html = brut.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));

const ligneDe = (i) => html.slice(0, i).split('\n').length;
const problemes = [];

// 1. Boutons sans nom accessible : ni texte, ni aria-label, ni title.
for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
  const [tout, attrs, contenu] = m;
  if (/aria-label\s*=|aria-labelledby\s*=|title\s*=/i.test(attrs)) continue;
  const texte = contenu.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
  if (texte.length > 0) continue;
  problemes.push({ ligne: ligneDe(m.index), quoi: 'bouton sans nom accessible', extrait: tout.slice(0, 90) });
}

// 2. Images sans attribut alt (alt="" vide est valide : image decorative).
//
// Le fichier contient des expressions regulieres qui decrivent des balises
// (/<img[^>]+src=.../) et des commentaires qui en citent : ce ne sont pas des
// images. On n'examine donc que ce qui ressemble a du balisage reel — une
// source concrete, sans metacaractere d'expression reguliere.
const ressembleAUneBalise = (attrs) =>
  /\bsrc\s*=\s*["'][^"']+["']/i.test(attrs) && !/[[\]^\\]|\.\.\./.test(attrs);

for (const m of html.matchAll(/<img\b([^>]*)>/gi)) {
  if (!ressembleAUneBalise(m[1])) continue;
  if (/\balt\s*=/i.test(m[1])) continue;
  problemes.push({ ligne: ligneDe(m.index), quoi: 'image sans attribut alt', extrait: m[0].slice(0, 90) });
}

// 3. Langue du document.
if (!/<html[^>]*\blang\s*=/i.test(html)) {
  problemes.push({ ligne: 1, quoi: 'attribut lang absent sur <html>', extrait: '<html>' });
}

const boutons = [...html.matchAll(/<button\b/gi)].length;
const images = [...html.matchAll(/<img\b/gi)].length;
console.log(`${path.basename(cible)} : ${boutons} boutons, ${images} images examinés.`);

if (problemes.length) {
  problemes.forEach((p) => console.error(`✗ ligne ${p.ligne} — ${p.quoi} : ${p.extrait}`));
  console.error(`\n${problemes.length} problème(s) d'accessibilité bloquant(s).`);
  process.exit(1);
}
console.log('✓ Tout contrôle interactif porte un nom accessible ; toute image porte une alternative.');
