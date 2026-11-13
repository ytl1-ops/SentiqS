#!/usr/bin/env node
// Aperçu des visuels d'actu sur les DONNEES REELLES — 20/10/2026.
//
// La direction « Bleu nuit » affiche avec chaque actu l'image que la source
// publie (champ media du flux, aperçu Open Graph) ou, a defaut, un visuel de
// repli (voir visuelActu() dans la page). Ce que ca donne depend entierement
// des flux : un bac a sable sans acces au reseau ne montre que des replis, et
// conclurait que « rien n'a d'image ». Ce script mesure donc sur le cache
// PUBLIE (table collecte_partagee, lecture publique), et photographie la vraie
// page avec ce cache :
//
//   - combien d'articles portent une image, une video, rien ;
//   - les sources qui fournissent le plus et le moins d'images ;
//   - des captures du Flux et du tableau de bord (bureau et telephone).
//
// Rien n'est recalcule a cote : le comptage appelle mediaActu() DANS la page.
// Rien n'est ecrit : seule la lecture du cache passe, toute autre requete
// sortante de la page est refusee sauf les images (c'est ce qu'on mesure).
//
//   node scripts/apercu-visuels.js [dossier-de-sortie]
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..', 'web');
const HTML = fs.readFileSync(path.join(RACINE, 'SentiqS_Web.html'), 'utf8');
const OUT = path.resolve(process.argv[2] || 'apercu-visuels');
const PORT = Number(process.env.PORT_APERCU || 8741);
const constante = (nom) => {
  const m = HTML.match(new RegExp('const ' + nom + "\\s*=\\s*'([^']+)'"));
  if (!m) throw new Error('constante ' + nom + ' introuvable dans la page');
  return m[1];
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' };

// Le cache injecté doit rester en place jusqu'à la capture. Le mode collecteur
// lance une collecte (réseau refusé) et relit le cache partagé — illisible ici
// sans compte depuis le 13/11/2026 — et l'un ou l'autre remettait ALL à vide :
// les captures publiées montraient un Flux vide sur 2 253 articles lus.
// figerCache() réinjecte et neutralise ces deux chemins le temps de la capture.
const FIGER = () => {
  window.figerCache = (arts) => {
    try { doCollect = async () => {}; } catch (_) {}
    try { _appliquerArticlesPartages = () => {}; } catch (_) {}
    // Le Flux attend la traduction de chaque titre étranger avant de
    // s'afficher ; sans réseau elle n'aboutit pas dans le délai de capture et
    // l'écran gardait l'état vide précédent. La capture ne traduit pas.
    try { preTraduireRapport = async () => {}; } catch (_) {}
    ALL = arts;
  };
};

(async () => {
  // Firestore d'abord (le cache y vit depuis la bascule, Supabase a dépassé son
  // quota le 27/10/2026 : HTTP 402), Supabase en repli tant que le cache n'y est pas.
  let ligne = null;
  try {
    const cfgSrc = fs.readFileSync(path.join(RACINE, 'js', 'firebase-config.js'), 'utf8');
    const cfg = { projectId: (cfgSrc.match(/projectId:\s*'([^']+)'/) || [])[1], apiKey: (cfgSrc.match(/apiKey:\s*'([^']+)'/) || [])[1] };
    // Lecture réservée aux comptes depuis le 13/11/2026 : avec le compte de
    // service quand le secret est fourni, sinon la tentative anonyme échoue et
    // l'aperçu se replie, sans faire échouer la PR.
    const ecr = require('./lib/cache-firestore-ecriture');
    const compte = process.env.FIREBASE_SERVICE_ACCOUNT ? ecr.lireCompte(process.env.FIREBASE_SERVICE_ACCOUNT) : null;
    const r = compte ? await ecr.lireCache(compte, fetch) : await require('../web/js/cache-firestore.js').lire(cfg);
    if (r && r.articles.length) ligne = { articles: r.articles, updated_at: r.updated_at };
  } catch (e) { console.error('Cache Firestore illisible : ' + e.message); }
  if (!ligne) {
    const url = constante('SENTINEL_SUPABASE_URL') + '/rest/v1/collecte_partagee?select=articles,updated_at&id=eq.' + constante('COLLECTE_PARTAGEE_ID');
    const cle = constante('SENTINEL_SUPABASE_ANON_KEY');
    const rep = await fetch(url, { headers: { apikey: cle, Authorization: 'Bearer ' + cle } });
    // Informatif (voir apercu-visuels.yml) : sans cache lisible il n'y a rien
    // a mesurer, ce n'est pas un defaut de la PR. Le 30/10/2026 ce cas faisait
    // echouer chaque PR (Firestore 403 tant que les regles ne sont pas
    // publiees, Supabase 402) et rougissait la CI sans rien dire du code.
    if (!rep.ok) { console.log('::warning::Lecture du cache publie impossible : HTTP ' + rep.status + ' — aucun apercu produit.'); process.exit(0); }
    [ligne] = await rep.json();
  }
  const articles = (ligne && ligne.articles) || [];
  console.log('Cache publie du ' + (ligne && ligne.updated_at) + ' : ' + articles.length + ' articles');
  if (!articles.length) { console.log('::warning::Cache publie vide — aucun apercu produit.'); process.exit(0); }
  fs.mkdirSync(OUT, { recursive: true });

  let chromium;
  try { ({ chromium } = require('playwright')); } catch (_) { console.error('playwright absent'); process.exit(1); }
  const serveur = http.createServer((req, res) => {
    const f = path.join(RACINE, decodeURIComponent(String(req.url).split('?')[0]));
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => serveur.listen(PORT, r));
  const base = 'http://localhost:' + PORT;
  const lancement = { args: ['--no-sandbox'] };
  if (process.env.CHROMIUM_PATH) lancement.executablePath = process.env.CHROMIUM_PATH;
  const nav = await chromium.launch(lancement);

  let bilan = null;
  for (const vp of [{ n: 'bureau', w: 1440, h: 900 }, { n: 'mobile', w: 390, h: 844 }]) {
    const ctx = await nav.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    const erreurs = [];
    page.on('pageerror', (e) => erreurs.push(String(e.message || e)));
    // Seules les images sortent : ni collecte, ni Supabase, ni proxys.
    await page.route('**', (r) => {
      const q = r.request();
      if (q.url().startsWith(base) || q.resourceType() === 'image' || q.resourceType() === 'font' || q.resourceType() === 'stylesheet') return r.continue();
      return r.abort();
    });
    await page.addInitScript(() => { try { sessionStorage.setItem('sentinel_intro_vue', '1'); } catch (_) {} });
    await page.addInitScript(FIGER);
    // Le jeton collecteur ouvre la page sans connexion ; la collecte qu'il
    // declenche echoue aussitot (reseau refuse) et ne publie rien.
    await page.goto(base + '/SentiqS_Web.html#collecteur-' + constante('COLLECTOR_TOKEN'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const b = await page.evaluate((arts) => {
      figerCache(arts);
      const recents = ALL.filter((a) => estRecentReel(a));
      const parSource = {};
      let img = 0, video = 0;
      recents.forEach((a) => {
        const m = mediaActu(a);
        const s = (parSource[a.primary] = parSource[a.primary] || { n: srcName(a.primary), total: 0, img: 0 });
        s.total++;
        if (m.img) { img++; s.img++; }
        if (m.video) video++;
      });
      renderFeed(); updStats();
      return { total: ALL.length, recents: recents.length, img, video, parSource: Object.values(parSource) };
    }, articles);
    bilan = bilan || b;
    // Le cache est réinjecté avant chaque vue : la collecte lancée par le jeton
    // collecteur échoue (réseau refusé) et vidait ALL entre l'injection et la
    // capture — les captures publiées jusqu'au 13/11/2026 montraient un Flux
    // vide (« Aucun article ne correspond »), sur 2 253 articles lus.
    const montrer = async (v) => {
      await page.evaluate(({ v, arts }) => {
        figerCache(arts);
        switchView(v, document.querySelector('.ntab[data-view="' + v + '"]'));
        try { renderFeed(); updStats(); if (typeof recalcAlertes === 'function') recalcAlertes(); } catch (_) {}
      }, { v, arts: articles });
      await page.waitForTimeout(6000); // laisse arriver les images des sources
      console.log(vp.n + ' ' + v + ' : ' + (await page.evaluate(() => getFiltered().length)) + ' articles affichables au moment de la capture');
    };
    for (const [nom, vue] of [['flux', 'flux'], ['tableau', 'dashboard']]) {
      await montrer(vue);
      await page.screenshot({ path: path.join(OUT, vp.n + '-' + nom + '.jpg'), type: 'jpeg', quality: 80 });
    }
    console.log(vp.n + ' : erreurs JS ' + erreurs.length + (erreurs.length ? ' — ' + erreurs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  // Captures au format du Play Store (13/11/2026) : téléphone 9:16, 1080 × 1920
  // (360 × 640 à l'échelle 3). Bureau et page d'accueil ne s'y prêtent pas.
  {
    const ctx = await nav.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.route('**', (r) => {
      const q = r.request();
      if (q.url().startsWith(base) || ['image', 'font', 'stylesheet'].includes(q.resourceType())) return r.continue();
      return r.abort();
    });
    await page.addInitScript(() => { try { sessionStorage.setItem('sentinel_intro_vue', '1'); localStorage.setItem('sentinel_lang', 'fr');
      // Les photos des sources appartiennent à leurs auteurs : une fiche
      // commerciale ne les montre pas (réglage « économiser les données »).
      localStorage.setItem('sentinel_aff_images', 'non'); } catch (_) {} });
    await page.addInitScript(FIGER);
    await page.goto(base + '/SentiqS_Web.html#collecteur-' + constante('COLLECTOR_TOKEN'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    // La barre de collecte du mode collecteur n'est pas ce que voit un client.
    await page.addStyleTag({ content: '.proxy-bar,.cbar,#collecteBar{display:none!important}' });
    const dossier = path.join(OUT, 'play-store');
    fs.mkdirSync(dossier, { recursive: true });
    let i = 0;
    for (const vue of ['flux', 'dashboard', 'alertes', 'analyse']) {
      await page.evaluate(({ v, arts }) => {
        // Le Store montre l'appli en français : seulement les actus déjà en
        // français, la capture ne traduisant pas.
        figerCache(arts.filter((x) => typeof detectLangue !== 'function' || detectLangue(String(x.title || '')) === 'fr'));
        switchView(v, document.querySelector('.ntab[data-view="' + v + '"]'));
        try { renderFeed(); updStats(); if (typeof recalcAlertes === 'function') recalcAlertes(); if (v === 'analyse' && typeof updSynthese === 'function') updSynthese(); } catch (_) {}
        window.scrollTo(0, 0);
      }, { v: vue, arts: articles });
      await page.waitForTimeout(6000);
      await page.screenshot({ path: path.join(dossier, (++i) + '-' + vue + '.png') });
    }
    await ctx.close();
  }
  await nav.close(); serveur.close();

  const pct = (x) => (bilan.recents ? Math.round((100 * x) / bilan.recents) : 0) + ' %';
  const lignes = [
    'Articles du cache : ' + bilan.total + ', dont ' + bilan.recents + ' dans la fenetre d\'actualite',
    'Avec image de la source : ' + bilan.img + ' (' + pct(bilan.img) + ')',
    'Avec video : ' + bilan.video,
    'Visuel de repli (aucune image fournie) : ' + (bilan.recents - bilan.img) + ' (' + pct(bilan.recents - bilan.img) + ')',
    '',
    'Sources les plus representees (articles, dont avec image) :',
    ...bilan.parSource.sort((x, y) => y.total - x.total).slice(0, 25).map((s) => '  ' + s.n + ' : ' + s.total + ', ' + s.img + ' avec image'),
  ];
  fs.writeFileSync(path.join(OUT, 'bilan.txt'), lignes.join('\n') + '\n');
  console.log(lignes.join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
