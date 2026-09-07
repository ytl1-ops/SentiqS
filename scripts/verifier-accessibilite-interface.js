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

// PLAFOND_TEXTES_SOUS_CONTRASTE : nombre de textes rendus qui n'atteignent pas
// le seuil AA (4,5:1, ou 3:1 pour le grand texte). Meme forme que les autres
// cliquets : la dette est nommee, on interdit de l'agrandir.
//
// Audit d'interface du 07/09/2026 : 117 elements sous le seuil, jamais
// mesures parce que le contrôle ne regardait que les NOMS accessibles. Deux
// coupables — le gris secondaire #718096 (une centaine d'usages, 3,41 a 4,02)
// et le jaune de gravite #CA8A04 (2,49 a 2,94), une couleur d'ALERTE portee
// par le nombre « pays en tension ». Corriges le meme jour : 117 -> 0.
//
// La mesure porte sur le DOM RENDU, jamais sur le fichier source : la note
// d'accessibilite de ce produit a deja ete fausse deux fois pour avoir compte
// des attributs dans le source.
const PLAFOND_TEXTES_SOUS_CONTRASTE = 0;

// PLAFOND_CLIQUABLES_SANS_CLAVIER : elements rendus cliquables qu'aucun
// clavier n'atteint — ni balise native, ni tabindex.
//
// Audit du 07/09/2026 : 118 sur 130, dont les huit onglets de modules. Un
// utilisateur au clavier ne pouvait pas changer de vue. Le cliquet des NOMS
// accessibles etait vert pendant ce temps : il mesure une propriete plus
// etroite que la pilotabilite.
//
// Ramene a 61 le meme jour (onglets en role="tab" avec tabindex glissant,
// liens en <span onclick> rendus atteignables). Ce qui reste est presque
// entierement des cartes conteneurs (.acard...). Il DESCEND en convertissant
// une action qui compte, jamais en posant un tabindex sur tout : faire de
// chaque carte un arret de tabulation rendrait le parcours inutilisable, ce
// qui serait une regression pour la personne qu'on pretend aider.
const PLAFOND_CLIQUABLES_SANS_CLAVIER = 61;

const RACINE = path.join(__dirname, '..', 'web');
const PORT = Number(process.env.PORT_A11Y || 8767);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.xml': 'application/xml',
};

// En CI, un navigateur absent n'est pas une excuse : c'est un controle qui ne
// controle rien. Le 02/09/2026, ce script est entre en CI et rien dans les
// journaux ne permettait de dire s'il avait mesure quoi que ce soit ou s'il
// s'etait tu. Un test muet vaut moins que pas de test — c'est ecrit dans
// CLAUDE.md, et ca vaut aussi pour les controles.
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
    serveur.close();
    abandonner('navigateur indisponible : ' + String(e.message).split('\n')[0]);
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
      // Contraste du texte reellement rendu, fond effectif remonte de parent
      // en parent (une couche translucide ne compte pas comme un fond).
      const canal = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const lum = (c) => 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b);
      const lireRgb = (t) => { const m = String(t).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null; };
      const fondDe = (el) => { let e = el; while (e) { const c = lireRgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; e = e.parentElement; } return { r: 255, g: 255, b: 255 }; };
      const ratio = (f, b) => { const l1 = lum(f), l2 = lum(b); const [h, l] = l1 > l2 ? [l1, l2] : [l2, l1]; return (h + 0.05) / (l + 0.05); };
      const sousContraste = [];
      for (const el of document.querySelectorAll('*')) {
        if (el.children.length || el.offsetParent === null) continue;
        if ((el.textContent || '').trim().length < 2) continue;
        const st = getComputedStyle(el);
        const f = lireRgb(st.color); if (!f) continue;
        const px = parseFloat(st.fontSize), gras = parseInt(st.fontWeight, 10) >= 700;
        const seuil = (px >= 24 || (px >= 18.66 && gras)) ? 3 : 4.5;
        const r = ratio(f, fondDe(el));
        if (r < seuil) sousContraste.push({ txt: (el.textContent || '').trim().slice(0, 40), couleur: st.color, px, ratio: Math.round(r * 100) / 100, seuil });
      }
      // Pilotabilite au clavier : un element cliquable qu'aucune tabulation
      // n'atteint n'existe pas pour qui n'a pas de souris.
      const cliquables = [...document.querySelectorAll('[onclick]')].filter((e) => e.offsetParent !== null);
      const natif = (e) => ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(e.tagName) || e.hasAttribute('tabindex');
      const sansClavier = cliquables.filter((e) => !natif(e));
      const onglets = [...document.querySelectorAll('.ntab')].filter((t) => t.offsetParent !== null);
      const ongletsAtteignables = onglets.filter((t) => t.hasAttribute('tabindex') && t.getAttribute('role') === 'tab').length;
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
        cliquables: cliquables.length,
        sansClavier: sansClavier.length,
        exemplesClavier: [...new Set(sansClavier.map((e) => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]))].slice(0, 6),
        onglets: onglets.length,
        ongletsAtteignables,
        sousContraste: sousContraste.length,
        exemplesContraste: sousContraste
          .sort((a, b) => a.ratio - b.ratio)
          .slice(0, 8)
          .map((e) => e.ratio + ':1 (seuil ' + e.seuil + ') ' + e.px + 'px ' + e.couleur + ' — ' + e.txt),
      };
    });
  } finally { await nav.close(); serveur.close(); }

  console.log('Champs de formulaire : ' + rap.champs + ', dont ' + rap.champsSansNom + ' sans nom accessible');
  console.log('Boutons              : ' + rap.boutons + ', dont ' + rap.boutonsSansNom + ' sans nom accessible');
  console.log('Reperes              : ' + rap.main + ' principal, ' + rap.nav + ' navigation, '
    + rap.h1 + ' titre h1, lien d\'evitement ' + (rap.sautContenu ? 'present' : 'ABSENT'));
  console.log('Langue du document   : ' + (rap.lang || 'ABSENTE'));
  console.log('Onglets de modules   : ' + rap.onglets + ', dont ' + rap.ongletsAtteignables + ' atteignables au clavier');
  console.log('Cliquables           : ' + rap.cliquables + ', dont ' + rap.sansClavier
    + ' hors de portee du clavier, pour un plafond de ' + PLAFOND_CLIQUABLES_SANS_CLAVIER);
  console.log('Contraste            : ' + rap.sousContraste + ' texte(s) sous le seuil AA, pour un plafond de '
    + PLAFOND_TEXTES_SOUS_CONTRASTE);

  const echecs = [];
  if (!rap.lang) echecs.push('L\'attribut lang du document est absent : un lecteur d\'ecran ne sait pas quelle voix employer.');
  if (rap.h1 < 1) echecs.push('Aucun <h1> : la page n\'annonce pas ce qu\'elle est.');
  if (rap.main < 1) echecs.push('Aucun repere de contenu principal (<main> ou role="main").');
  if (rap.nav < 1) echecs.push('Aucun repere de navigation (<nav> ou role="navigation").');
  if (!rap.sautContenu) echecs.push('Aucun lien d\'evitement vers le contenu principal.');
  if (rap.boutonsSansNom > 0) echecs.push(rap.boutonsSansNom + ' bouton(s) sans nom accessible.');
  if (rap.onglets > 0 && rap.ongletsAtteignables < rap.onglets) {
    echecs.push((rap.onglets - rap.ongletsAtteignables) + ' onglet(s) de module hors de portee du clavier : '
      + 'sans eux, on ne peut pas changer de vue autrement qu\'a la souris.');
  }
  if (rap.sansClavier > PLAFOND_CLIQUABLES_SANS_CLAVIER) {
    echecs.push(rap.sansClavier + ' element(s) cliquable(s) qu\'aucune tabulation n\'atteint, pour un plafond de '
      + PLAFOND_CLIQUABLES_SANS_CLAVIER + ' (' + rap.exemplesClavier.join(', ') + ')');
  }
  if (rap.sousContraste > PLAFOND_TEXTES_SOUS_CONTRASTE) {
    echecs.push(rap.sousContraste + ' texte(s) sous le seuil de contraste AA, pour un plafond de '
      + PLAFOND_TEXTES_SOUS_CONTRASTE + ' :\n     ' + rap.exemplesContraste.join('\n     '));
  }
  if (rap.champsSansNom > PLAFOND_CHAMPS_SANS_NOM) {
    echecs.push(rap.champsSansNom + ' champ(s) sans nom accessible, pour un plafond de '
      + PLAFOND_CHAMPS_SANS_NOM + ' : ' + rap.idsSansNom.join(', '));
  }

  if (echecs.length) {
    console.error('\n✗ Accessibilite :');
    echecs.forEach((e) => console.error('   ' + e));
    if (rap.champsSansNom > PLAFOND_CHAMPS_SANS_NOM || rap.boutonsSansNom > 0) {
      console.error('\nUn libelle INVENTE est pire qu\'un libelle absent : il decrit a un utilisateur');
      console.error('de lecteur d\'ecran un autre controle que celui qu\'il manipule. Reprendre le');
      console.error('texte deja visible a l\'ecran a cote du champ.');
    }
    if (rap.sousContraste > PLAFOND_TEXTES_SOUS_CONTRASTE) {
      console.error('\nUn texte sous le seuil se lit mal sur un ecran de portable en plein jour,');
      console.error('exactement la ou cet outil est consulte. Assombrir le jeton plutot que le');
      console.error('texte au cas par cas : la couleur de gravite doit rester la meme partout.');
    }
    process.exit(1);
  }
  if (rap.sansClavier < PLAFOND_CLIQUABLES_SANS_CLAVIER) {
    console.log('\n→ Abaissez PLAFOND_CLIQUABLES_SANS_CLAVIER a ' + rap.sansClavier + ' pour verrouiller le gain.');
  }
  if (rap.sousContraste < PLAFOND_TEXTES_SOUS_CONTRASTE) {
    console.log('\n→ Abaissez PLAFOND_TEXTES_SOUS_CONTRASTE a ' + rap.sousContraste + ' pour verrouiller le gain.');
  }
  if (rap.champsSansNom < PLAFOND_CHAMPS_SANS_NOM) {
    console.log('\n→ Abaissez PLAFOND_CHAMPS_SANS_NOM a ' + rap.champsSansNom + ' pour verrouiller le gain.');
  }
  console.log('\n✓ Reperes presents, champs et boutons nommes, modules pilotables au clavier,\n  contraste du texte rendu conforme.');
})();
