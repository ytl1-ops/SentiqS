#!/usr/bin/env node
// Quels incidents décident réellement d'un niveau ?
//
// POURQUOI CE SCRIPT EXISTE
//
// « Faire relire les 172 incidents » est une tache que personne ne commence.
// revue-socle.js a donne l'ordre des pays ; celui-ci reduit le volume.
//
// Tous les incidents ne se valent pas. Certains ne font que s'ajouter a un
// socle deja suffisant : les relire ne changerait rien a ce que voit
// l'utilisateur. D'autres portent le niveau a eux seuls — les retirer ferait
// descendre le pays d'un cran. Ce sont ceux-la qu'il faut verifier en
// premier, et eux seuls sont urgents.
//
// La methode est bete et sure : on retire un incident, on redemande son
// niveau a la page, on regarde s'il a bouge. Le calcul n'est pas
// reimplemente — c'est calcAlertScore de la vraie page qui repond, comme
// partout ailleurs dans ce depot.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..', 'web');
const PORT = Number(process.env.PORT_PORTEURS || 8771);
const SORTIE = process.env.SORTIE_PORTEURS || path.join(__dirname, '..', 'incidents-porteurs.json');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.json': 'application/json' };

let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { console.error('✗ playwright absent.'); process.exit(1); }

const serveur = http.createServer((req, res) => {
  const f = path.join(RACINE, decodeURIComponent(String(req.url).split('?')[0]));
  if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
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
  catch (e) { console.error('✗ navigateur indisponible : ' + String(e.message).split('\n')[0]); serveur.close(); process.exit(1); }

  const page = await nav.newPage();
  // Reseau coupe : on mesure ce que le socle porte a lui seul, sans collecte.
  await page.route('**', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));

  let lignes;
  try {
    await page.goto(base + '/SentiqS_Web.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    lignes = await page.evaluate(() => {
      const ORDRE = ['vert', 'jaune', 'orange', 'marron', 'rouge'];
      const original = ALERTE_EVENTS.slice();
      const out = [];
      for (const c of CYS.filter((x) => x.code !== 'all')) {
        const niveauPlein = calcAlertScore(c.code).key;
        const siens = original.filter((e) => e.cy === c.code);
        for (const inc of siens) {
          // On retire CET incident, et lui seul.
          const sans = original.filter((e) => e !== inc);
          ALERTE_EVENTS.length = 0; ALERTE_EVENTS.push(...sans);
          const niveauSans = calcAlertScore(c.code).key;
          ALERTE_EVENTS.length = 0; ALERTE_EVENTS.push(...original);
          out.push({
            cy: c.code, pays: c.name, niveau: niveauPlein,
            date: inc.date, titre: inc.title, poids: inc.weight, src: inc.src,
            porteur: niveauSans !== niveauPlein,
            niveauSans,
            crans: ORDRE.indexOf(niveauPlein) - ORDRE.indexOf(niveauSans),
          });
        }
      }
      return out;
    });
  } finally { await nav.close(); serveur.close(); }

  const porteurs = lignes.filter((l) => l.porteur);
  fs.writeFileSync(SORTIE, JSON.stringify({ total: lignes.length, porteurs }, null, 2));

  const parPays = new Map();
  for (const p of porteurs) parPays.set(p.cy, (parPays.get(p.cy) || 0) + 1);

  console.log('Incidents verifies examines : ' + lignes.length);
  console.log('Incidents PORTEURS (les retirer fait descendre le pays) : ' + porteurs.length);
  console.log('Pays concernes : ' + parPays.size + '\n');
  console.log('Les ' + porteurs.length + ' incidents a relire en priorite :\n');
  for (const p of porteurs.sort((a, b) =>
    ['vert','jaune','orange','marron','rouge'].indexOf(b.niveau) - ['vert','jaune','orange','marron','rouge'].indexOf(a.niveau)
    || b.crans - a.crans)) {
    console.log('  ' + p.pays.padEnd(22) + p.niveau.padEnd(8) + '→ ' + p.niveauSans.padEnd(8)
      + String(p.date).padEnd(20) + String(p.titre).slice(0, 60));
  }
  console.log('\nLes ' + (lignes.length - porteurs.length) + ' autres incidents peuvent attendre :');
  console.log('les retirer ne changerait rien a ce que voit l\'utilisateur.');
  console.log('\nEcrit dans ' + SORTIE);
})();
