#!/usr/bin/env node
// Accessibilite de l'interface reellement servie.
//
// POURQUOI CE CONTROLE EXISTE
//
// Le 02/09/2026, une mesure sur le DOM rendu — et non sur le source — a
// montre : aucun repere de structure, aucun <h1>, et 64 champs de formulaire
// sur 103 sans nom accessible. La grille d'evaluation notait pourtant
// l'accessibilite a 3 sur 5, sur la foi de `prefers-reduced-motion` et du
// travail fait sur les contrastes. C'etait une note d'ambiance.
//
// Ce script mesure le DOM APRES rendu, parce que l'essentiel de cette
// interface est construit par JavaScript : compter les attributs dans le
// fichier source ne dit rien de ce que voit un lecteur d'ecran.
//
// CLIQUET : le nombre de champs sans nom accessible ne doit jamais remonter.
// Il est fait pour descendre.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Etat au moment de la pose du cliquet. Descendre ce nombre au fur et a
// mesure ; le remonter reviendrait a renoncer au seul garde-fou.
const PLAFOND_CHAMPS_SANS_NOM = 0;

const RACINE = path.join(__dirname, '..', 'web');
const PORT = Number(process.env.PORT_A11Y || 8767);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.xml': 'application/xml',
};

let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) {
  console.log('· playwright absent : controle d\'accessibilite ignore.');
  process.exit(0);
}

const serveur = http.createServer((req, res) => {
  const f = path.join(RACINE, decodeURIComponent(String(req.url).split('?')[0]));
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
    console.log('· navigateur indisponible : controle ignore (' + String(e.message).split('\n')[0] + ')');
    serveur.close(); process.exit(0);
  }

  const page = await nav.newPage();
  // Reseau exterieur coupe : on mesure la structure, pas la collecte.
  await page.route('**', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));

  let rap;
  try {
    await page.goto(base + '/SentiqS_Web.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    rap = await page.evaluate(() => {
      const nomme = (c) => !!(
        c.getAttribute('aria-label') || c.getAttribute('title') || c.getAttribute('placeholder') ||
        (c.id && document.querySelector('label[for="' + CSS.escape(c.id) + '"]')) ||
        (c.closest('label') && c.closest('label').textContent.replace(/\s+/g, '').length)
      );
      const champs = [...document.querySelectorAll('input,select,textarea')].filter((c) => c.type !== 'hidden');
      const sansNom = champs.filter((c) => !nomme(c));
      const boutons = [...document.querySelectorAll('button,[role="button"]')];
      const btnSansNom = boutons.filter((b) => !(
        b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent.trim()
      ));
      return {
        lang: document.documentElement.getAttribute('lang'),
        h1: document.querySelectorAll('h1').length,
        main: document.querySelectorAll('main,[role="main"]').length,
        nav: document.querySelectorAll('nav,[role="navigation"]').length,
        sautContenu: !!document.querySelector('.saut-contenu'),
        champs: champs.length,
        champsSansNom: sansNom.length,
        idsSansNom: sansNom.map((c) => c.id || '(' + c.tagName.toLowerCase() + ' sans id)').slice(0, 30),
        boutons: boutons.length,
        boutonsSansNom: btnSansNom.length,
      };
    });
  } finally { await nav.close(); serveur.close(); }

  console.log('Champs de formulaire : ' + rap.champs + ', dont ' + rap.champsSansNom + ' sans nom accessible');
  console.log('Boutons              : ' + rap.boutons + ', dont ' + rap.boutonsSansNom + ' sans nom accessible');
  console.log('Reperes              : ' + rap.main + ' principal, ' + rap.nav + ' navigation, '
    + rap.h1 + ' titre h1, lien d\'evitement ' + (rap.sautContenu ? 'present' : 'ABSENT'));
  console.log('Langue du document   : ' + (rap.lang || 'ABSENTE'));

  const echecs = [];
  if (!rap.lang) echecs.push('L\'attribut lang du document est absent : un lecteur d\'ecran ne sait pas quelle voix employer.');
  if (rap.h1 < 1) echecs.push('Aucun <h1> : la page n\'annonce pas ce qu\'elle est.');
  if (rap.main < 1) echecs.push('Aucun repere de contenu principal (<main> ou role="main").');
  if (rap.nav < 1) echecs.push('Aucun repere de navigation (<nav> ou role="navigation").');
  if (!rap.sautContenu) echecs.push('Aucun lien d\'evitement vers le contenu principal.');
  if (rap.boutonsSansNom > 0) echecs.push(rap.boutonsSansNom + ' bouton(s) sans nom accessible.');
  if (rap.champsSansNom > PLAFOND_CHAMPS_SANS_NOM) {
    echecs.push(rap.champsSansNom + ' champ(s) sans nom accessible, pour un plafond de '
      + PLAFOND_CHAMPS_SANS_NOM + ' : ' + rap.idsSansNom.join(', '));
  }

  if (echecs.length) {
    console.error('\n✗ Accessibilite :');
    echecs.forEach((e) => console.error('   ' + e));
    console.error('\nUn libelle INVENTE est pire qu\'un libelle absent : il decrit a un utilisateur');
    console.error('de lecteur d\'ecran un autre controle que celui qu\'il manipule. Reprendre le');
    console.error('texte deja visible a l\'ecran a cote du champ.');
    process.exit(1);
  }
  if (rap.champsSansNom < PLAFOND_CHAMPS_SANS_NOM) {
    console.log('\n→ Abaissez PLAFOND_CHAMPS_SANS_NOM a ' + rap.champsSansNom + ' pour verrouiller le gain.');
  }
  console.log('\n✓ Reperes de structure presents, tous les champs et boutons ont un nom accessible.');
})();
