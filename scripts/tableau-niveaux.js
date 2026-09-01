#!/usr/bin/env node
// Tableau des 54 pays : quel niveau chacun affiche AU REPOS, et ce qui le
// porte.
//
// Pourquoi ce script existe. Le niveau d'alerte d'un pays est produit par
// calcAlertScore, qui additionne quatre choses : un socle de 172 incidents
// verifies saisis a la main, 38 facteurs structurels sans date, le signal
// temps reel plafonne, et un bonus historique tres bas. Personne n'a jamais
// vu, pays par pays, laquelle de ces quatre pese vraiment. On reglait donc
// une mecanique sans savoir ce qu'elle dit.
//
// « Au repos » = sans collecte : le live vaut 0. C'est volontaire, et c'est
// la mesure interessante — elle montre le PLANCHER que le socle fige impose
// a chaque pays, donc exactement ce qu'il faudrait deplacer pour que la
// collecte porte le niveau.
//
// Le calcul n'est pas reimplemente : la page de production est chargee dans
// un vrai navigateur et c'est SA fonction qui repond. Une reimplementation
// dirait ce que je crois que le code fait, pas ce qu'il fait.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..', 'web');
const PORT = Number(process.env.PORT_TABLEAU || 8733);
const SORTIE = process.env.SORTIE_TABLEAU || path.join(__dirname, '..', 'niveaux-pays.json');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.xml': 'application/xml', '.txt': 'text/plain', '.mp4': 'video/mp4',
};

let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { console.error('✗ playwright absent.'); process.exit(1); }

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
  catch (e) { console.error('✗ navigateur indisponible : ' + (e.message || e).split('\n')[0]);
              serveur.close(); process.exit(1); }

  const page = await nav.newPage();
  // Reseau coupe : on veut le niveau AU REPOS, sans collecte.
  await page.route('**', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));

  let lignes;
  try {
    await page.goto(base + '/SentiqS_Web.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    lignes = await page.evaluate(() => {
      const SEUILS = { rouge: 14, marron: 8, orange: 5, jaune: 2, vert: 0 };
      const ORDRE = ['vert', 'jaune', 'orange', 'marron', 'rouge'];
      return CYS.filter((c) => c.code !== 'all').map((c) => {
        const s = calcAlertScore(c.code);
        const d = s.debug;
        const rang = ORDRE.indexOf(s.key);
        const suivant = ORDRE[rang + 1] || null;
        const nbIncidents = ALERTE_EVENTS.filter((e) => e.cy === c.code).length;
        const facteurs = (FACTEURS_SPECIAUX[c.code] || []);
        return {
          code: c.code, nom: c.name, drapeau: c.flag,
          niveau: s.key, total: Math.round(s.total * 100) / 100, total100: s.total100,
          // Ce qui porte le niveau, en points bruts.
          incidents: Math.round(d.verifies * 100) / 100,
          facteurs: Math.round(d.specials * 100) / 100,
          live: Math.round(d.liveApplique * 100) / 100,
          historique: Math.round(d.historiqueApplique * 100) / 100,
          nbIncidents, nbFacteurs: facteurs.length,
          // Part MAXIMALE que la collecte pourrait prendre. On ne mesure PAS
          // « quelle part le fige porte quand le live vaut zero » : ce chiffre
          // vaut 100 % par construction et ne dit rien. On mesure le pouvoir
          // que la collecte a, au mieux, une fois son plafond sature.
          totalSiCollecteSaturee: Math.round((s.total - d.liveApplique + d.plafondLive) * 100) / 100,
          partMaxCollecte: (() => {
            const t = s.total - d.liveApplique + d.plafondLive;
            return t > 0 ? Math.round(1000 * d.plafondLive / t) / 10 : null;
          })(),
          // Combien la collecte devrait apporter pour faire monter d'un cran,
          // et si son plafond le lui permet seulement.
          plafondLive: Math.round(d.plafondLive * 100) / 100,
          fraicheurVerifiee: Math.round(d.fraicheurVerifiee * 100) / 100,
          niveauSuivant: suivant,
          manquePourMonter: suivant ? Math.round((SEUILS[suivant] - s.total) * 100) / 100 : null,
          // Le point decisif : meme en saturant son plafond, le pays peut-il
          // atteindre le cran suivant ?
          atteignableParCollecte: suivant
            ? (s.total - d.liveApplique + d.plafondLive) >= SEUILS[suivant] : false,
        };
      });
    });
  } finally { await nav.close(); serveur.close(); }

  lignes.sort((a, b) => b.total - a.total);
  fs.writeFileSync(SORTIE, JSON.stringify(lignes, null, 2));

  const parNiveau = {};
  for (const l of lignes) parNiveau[l.niveau] = (parNiveau[l.niveau] || 0) + 1;
  const bloques = lignes.filter((l) => l.niveauSuivant && !l.atteignableParCollecte);
  const sansSocle = lignes.filter((l) => l.nbIncidents === 0);
  const mediane = (cle) => {
    const v = lignes.map((l) => l[cle]).filter((x) => x !== null && x !== undefined)
      .sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  };
  // Niveau que chaque pays atteindrait si la collecte saturait son plafond.
  const SEUILS = { rouge: 14, marron: 8, orange: 5, jaune: 2 };
  const niveauDe = (t) => t >= 14 ? 'rouge' : t >= 8 ? 'marron' : t >= 5 ? 'orange' : t >= 2 ? 'jaune' : 'vert';
  const inchanges = lignes.filter((l) => niveauDe(l.totalSiCollecteSaturee) === l.niveau);
  const jamaisRouge = lignes.filter((l) => l.totalSiCollecteSaturee < 14);

  console.log('Pays examines : ' + lignes.length + '  (niveau au repos, collecte a zero)');
  console.log('Repartition   : ' + ['rouge', 'marron', 'orange', 'jaune', 'vert']
    .map((k) => k + ' ' + (parNiveau[k] || 0)).join('  ·  '));
  console.log('Pouvoir MAXIMAL de la collecte (plafond sature), mediane : '
    + mediane('partMaxCollecte') + ' % du score');
  console.log('Plafond live median : ' + mediane('plafondLive') + ' points');
  console.log('Pays dont le niveau ne bouge PAS meme collecte saturee : '
    + inchanges.length + '/' + lignes.length);
  console.log('Pays qui ne peuvent JAMAIS atteindre le rouge par la collecte : '
    + jamaisRouge.length + '/' + lignes.length);
  console.log('Pays sans aucun incident verifie : ' + sansSocle.length
    + (sansSocle.length ? ' (' + sansSocle.map((l) => l.code).join(' ') + ')' : ''));
  console.log('Pays que la collecte SEULE ne peut pas faire monter d\'un cran : '
    + bloques.length + '/' + lignes.filter((l) => l.niveauSuivant).length);
  console.log('\nEcrit dans ' + SORTIE);
})();
