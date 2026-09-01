#!/usr/bin/env node
// Test de fumee : la page de production se charge-t-elle reellement ?
//
// Tous les autres controles lisent le fichier sans jamais l'executer. Ils ne
// voient donc pas une rupture d'execution — une dependance manquante, un
// script charge dans le mauvais ordre, une CSP qui refuse une ressource.
// C'est exactement le risque introduit le jour ou le noyau logique est sorti
// du script inline vers web/js/noyau.js.
//
// Ce controle sert la page sur un serveur local, l'ouvre dans un navigateur
// sans interface, coupe tout acces reseau exterieur (on teste le chargement,
// pas la collecte) et verifie que les fonctions de decision existent, qu'un
// score de pays se calcule, et qu'aucune erreur JS n'a ete levee.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..', 'web');
const PORT = Number(process.env.PORT_FUMEE || 8731);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.xml': 'application/xml', '.txt': 'text/plain', '.mp4': 'video/mp4',
};

let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) {
  console.log('· playwright absent : test de fumee ignore (installez-le pour l\'executer).');
  process.exit(0);
}

const serveur = http.createServer((req, res) => {
  const rel = decodeURIComponent(String(req.url).split('?')[0]);
  const f = path.join(RACINE, rel);
  if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); return res.end();
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise((r) => serveur.listen(PORT, r));
  const base = 'http://localhost:' + PORT;

  const lancement = { args: ['--no-sandbox'] };
  if (process.env.CHROMIUM_PATH) lancement.executablePath = process.env.CHROMIUM_PATH;

  let nav;
  try { nav = await chromium.launch(lancement); }
  catch (e) {
    console.log('· navigateur indisponible : test de fumee ignore (' + (e.message || e).split('\n')[0] + ')');
    serveur.close(); process.exit(0);
  }

  const page = await nav.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e && e.message ? e.message : e)));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push('[console] ' + m.text()); });
  // Rien ne sort vers l'exterieur : on verifie le chargement, pas le reseau.
  await page.route('**', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));

  let sonde;
  try {
    await page.goto(base + '/SentiqS_Web.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    sonde = await page.evaluate(() => { try {
      const noyau = ['getNivKey', 'matchMot', 'dateEvenementMs', 'motsSignificatifs',
                     'plafondLive', 'articlesSontDoublons', 'normaliserAccents'];
      const manquants = noyau.filter((n) => typeof globalThis[n] !== 'function');
      let score = null;
      try { if (typeof calcAlertScore === 'function') { const s = calcAlertScore('BF'); score = s && s.key; } }
      catch (e) { score = 'ERREUR: ' + e.message; }
      return {
        manquants,
        score,
        classifieCritique: typeof classify === 'function'
          && classify('Attentat revendique dans la capitale', { cy: 'SN', cat: 'securite' }).lvl === 'crit',
        nbSources: typeof SRCS !== 'undefined' ? SRCS.length : 0,
      };
      } catch (e) {
        // La sonde elle-meme ne doit jamais planter : quand le script inline
        // n'a pas pu s'executer, c'est le diagnostic qui compte, pas la trace.
        return { manquants: ['sonde interrompue'], score: null, classifieCritique: false,
                 nbSources: 0, panne: String(e && e.message ? e.message : e) };
      }
    });
  } finally {
    await nav.close(); serveur.close();
  }

  // Le reseau est volontairement coupe : ces echecs-la sont attendus.
  const bloquantes = erreurs.filter((e) => !/Failed to fetch|net::ERR|ERR_FAILED|Load failed|ERR_BLOCKED/i.test(e));

  console.log('Fonctions du noyau presentes dans la page : ' + (7 - sonde.manquants.length) + '/7');
  console.log('Sources chargees : ' + sonde.nbSources);
  console.log('Score de pays calculable : ' + sonde.score);
  console.log('Classification d\'un incident : ' + (sonde.classifieCritique ? 'critique, comme attendu' : 'INATTENDUE'));
  console.log('Erreurs JS non liees au reseau : ' + bloquantes.length);
  bloquantes.slice(0, 8).forEach((e) => console.error('   ' + e.slice(0, 200)));

  const ko = sonde.manquants.length || bloquantes.length || !sonde.nbSources
    || !sonde.classifieCritique || !sonde.score || String(sonde.score).startsWith('ERREUR');
  if (ko) {
    if (sonde.panne) console.error('\n✗ Le script inline n\'a pas pu s\'executer : ' + sonde.panne);
    if (sonde.manquants.length) console.error('\n✗ Absentes de la page : ' + sonde.manquants.join(', '));
    console.error('\n✗ La page ne se charge pas correctement.');
    process.exit(1);
  }
  console.log('\n✓ La page se charge, le noyau est en place, les decisions se calculent.');
})();
