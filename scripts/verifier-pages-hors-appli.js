#!/usr/bin/env node
// Pages servies HORS de l'application : accueil, fiches pays (+ hub), pages légales.
//
// POURQUOI CE CONTROLE EXISTE
//
// verifier-accessibilite-interface.js ne regarde que SentiqS_Web.html. Les pages
// que voit un visiteur avant de se connecter — celles que les moteurs de
// recherche indexent — n'étaient mesurées par rien. Le 15/10/2026, une mesure
// sur le rendu réel a trouvé : 3 forfaits sur 4 avec un bouton blanc sur gris
// clair (1,1:1), un titre d'accueil à 1,4:1 sur certains plans de la vidéo,
// 212 textes sous 4,5:1, 106 cibles tactiles sous 24 px, 22 textes sous 10 px
// et deux pages qui débordaient à 390 px de large.
//
// Ce script mesure le DOM APRÈS rendu (clair et sombre pour les pages légales,
// qui suivent la préférence du système), bureau et mobile, réseau extérieur
// coupé. CLIQUET : tous les plafonds sont à 0 ; ils ne remontent pas.
//
// Ce qu'il NE mesure PAS : le texte posé sur la vidéo de fond de l'accueil. Un
// contrôle DOM ne voit pas les pixels de la vidéo ; la mesure image par image
// est décrite dans CLAUDE.md (section « Pages hors appli »).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PLAFOND_CONTRASTE = 0;      // textes rendus sous 4,5:1 (3:1 pour le gros texte)
const PLAFOND_PETIT = 0;          // textes sous 10 px (jeton fs-micro de l'application)
const PLAFOND_CIBLES = 0;         // cibles tactiles sous 24 px (WCAG 2.5.8), liens en ligne exemptés
const PLAFOND_DEBORDEMENT = 0;    // pages qui défilent horizontalement à 390 px

const RACINE = path.join(__dirname, '..', 'web');
const PORT = Number(process.env.PORT_PAGES || 8768);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.xml': 'application/xml', '.mp4': 'video/mp4',
};
const EN_CI = !!(process.env.CI || process.env.GITHUB_ACTIONS);

function abandonner(raison) {
  if (EN_CI) {
    console.error('✗ ' + raison);
    console.error('  En CI ce controle doit mesurer ou echouer, jamais passer en silence.');
    process.exit(1);
  }
  console.log('· ' + raison + ' — controle ignore hors CI.');
  process.exit(0);
}

let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { abandonner('playwright absent'); }

const pages = ['index.html'];
for (const d of ['pays', 'legal']) {
  for (const f of fs.readdirSync(path.join(RACINE, d)).sort()) if (f.endsWith('.html')) pages.push(d + '/' + f);
}

const serveur = http.createServer((req, res) => {
  const f = path.join(RACINE, decodeURIComponent(String(req.url).split('?')[0]));
  if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

// Exécutée dans la page.
function mesurer() {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const sur = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const sombre = matchMedia('(prefers-color-scheme: dark)').matches && /dark/.test(getComputedStyle(document.documentElement).colorScheme);
  const toile = sombre ? { r: 18, g: 18, b: 18, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
  const opacite = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
  const fond = (el) => { const c = []; for (let e = el; e; e = e.parentElement) { const x = parse(getComputedStyle(e).backgroundColor); if (x && x.a > 0) { c.push(x); if (x.a >= 1) break; } } let b = toile; for (let i = c.length - 1; i >= 0; i--) b = sur(c[i], b); return b; };
  const visible = (el) => {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[aria-hidden="true"],[inert]')) return false;
    return opacite(el) > 0.05;
  };
  const nom = (el) => (String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).trim().split(/\s+/)[0] || el.tagName.toLowerCase());
  const res = { contraste: [], petit: [], cibles: [], debordement: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
  document.querySelectorAll('body *').forEach((el) => {
    if (!visible(el)) return;
    const cs = getComputedStyle(el);
    if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      const taille = parseFloat(cs.fontSize);
      if (taille < 10) res.petit.push(nom(el) + '@' + taille);
      const fg = parse(cs.color);
      if (fg) {
        const bg = fond(el), fgm = sur({ ...fg, a: fg.a * opacite(el) }, bg);
        const l1 = lum(fgm), l2 = lum(bg), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const gras = parseInt(cs.fontWeight, 10) >= 700, grand = taille >= 24 || (taille >= 18.66 && gras);
        if (ratio < (grand ? 3 : 4.5)) res.contraste.push(nom(el) + ' ' + ratio.toFixed(1) + ' « ' + el.textContent.trim().slice(0, 28) + ' »');
      }
    }
    if (el.matches('a[href],button,input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea,[role=button],summary')) {
      const r = el.getBoundingClientRect();
      const enLigne = cs.display === 'inline' && el.tagName === 'A' && el.closest('p,li,td,dd,span,small');
      if (!enLigne && (r.width < 24 || r.height < 24)) res.cibles.push(nom(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
  });
  return res;
}

(async () => {
  await new Promise((r) => serveur.listen(PORT, r));
  const base = 'http://localhost:' + PORT;
  const lancement = { args: ['--no-sandbox'] };
  if (process.env.CHROMIUM_PATH) lancement.executablePath = process.env.CHROMIUM_PATH;
  let nav;
  try { nav = await chromium.launch(lancement); }
  catch (e) { serveur.close(); abandonner('navigateur indisponible : ' + String(e.message).split('\n')[0]); }

  const tot = { contraste: [], petit: [], cibles: [], debordement: [] };
  let mesures = 0;
  try {
    for (const [env, vp, mobile] of [['bureau', { width: 1360, height: 860 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
      // Accueil et pages légales existent aussi en anglais depuis le 21/10/2026 :
      // un texte anglais plus long peut déborder là où le français tenait.
      for (const [schema, langue] of [['light', 'fr'], ['dark', 'fr'], ['light', 'en'], ['dark', 'en']]) {
        const ctx = await nav.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce', colorScheme: schema });
        await ctx.addInitScript((lg) => { try { localStorage.setItem('sentinel_lang', lg); } catch (_) {} }, langue);
        await ctx.route('**', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
        for (const p of pages) {
          // L'accueil, les fiches pays et le hub sont sombres dans les deux cas : un seul passage suffit.
          if (schema === 'dark' && !p.startsWith('legal/')) continue;
          // Les fiches pays n'ont pas de version anglaise.
          if (langue === 'en' && p.startsWith('pays/')) continue;
          const page = await ctx.newPage();
          await page.goto(base + '/' + p, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.waitForTimeout(400);
          await page.evaluate(() => document.querySelectorAll('.rv').forEach((e) => e.classList.add('in')));
          const m = await page.evaluate(mesurer);
          const etiquette = env + ' ' + p + (schema === 'dark' ? ' [sombre]' : '') + (langue === 'en' ? ' [EN]' : '');
          m.contraste.forEach((x) => tot.contraste.push(etiquette + ' : ' + x));
          m.petit.forEach((x) => tot.petit.push(etiquette + ' : ' + x));
          m.cibles.forEach((x) => tot.cibles.push(etiquette + ' : ' + x));
          if (m.debordement && env === 'mobile') tot.debordement.push(etiquette);
          mesures++;
          await page.close();
        }
        await ctx.close();
      }
    }
  } catch (e) {
    await nav.close(); serveur.close();
    console.error('✗ Mesure impossible : ' + (e && e.message || e));
    process.exit(1);
  }
  await nav.close(); serveur.close();

  console.log('Pages mesurées        : ' + pages.length + ' (' + mesures + ' rendus : bureau + mobile, clair + sombre pour les pages légales, FR + EN hors fiches pays)');
  console.log('Contraste             : ' + tot.contraste.length + ' texte(s) sous le seuil AA, pour un plafond de ' + PLAFOND_CONTRASTE);
  console.log('Texte sous 10 px      : ' + tot.petit.length + ', pour un plafond de ' + PLAFOND_PETIT);
  console.log('Cibles sous 24 px     : ' + tot.cibles.length + ', pour un plafond de ' + PLAFOND_CIBLES);
  console.log('Débordement à 390 px  : ' + tot.debordement.length + ' page(s), pour un plafond de ' + PLAFOND_DEBORDEMENT);

  const echecs = [];
  const verifier = (liste, plafond, libelle) => {
    if (liste.length > plafond) echecs.push(libelle + ' : ' + liste.length + ' au lieu de ' + plafond + ' au plus\n     ' + liste.slice(0, 8).join('\n     '));
  };
  verifier(tot.contraste, PLAFOND_CONTRASTE, 'Texte sous le seuil AA');
  verifier(tot.petit, PLAFOND_PETIT, 'Texte sous 10 px');
  verifier(tot.cibles, PLAFOND_CIBLES, 'Cibles tactiles sous 24 px');
  verifier(tot.debordement, PLAFOND_DEBORDEMENT, 'Page qui déborde à 390 px');
  if (echecs.length) {
    console.error('\n✗ ' + echecs.join('\n✗ '));
    process.exit(1);
  }
  console.log('\n✓ Accueil, fiches pays et pages légales : contraste, taille de texte, cibles tactiles et mobile conformes.');
})();
