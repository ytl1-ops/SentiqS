#!/usr/bin/env node
// Sensibilite de la fenetre d'actualite : que gagne chaque heure de plus ?
//
// POURQUOI CE SCRIPT EXISTE
//
// FENETRE_ACTUALITE_MS a ete deplacee trois fois en une soiree (12 h -> 24 h
// -> 36 h le 06/09/2026), chaque fois sur une mesure. Le 06/09 au soir, la
// question « et 48 h ? » a ete tranchee sur un souvenir plutot que sur une
// mesure : sept pays absents avaient leur article le plus frais « a 58 h,
// juste hors fenetre », d'ou la conclusion qu'un elargissement les
// rattraperait. Or 58 h depasse aussi 48 h. La recommandation annoncait
// trois pays gagnes ; la mesure en donne ZERO.
//
// Mesure du 06/09/2026, les 560 sources du registre moissonnees puis
// rejouees a fenetre variable sur la vraie page :
//
//   36 h -> 655 articles, 47 pays      (etat courant)
//   42 h -> 713 articles, 47 pays
//   48 h -> 729 articles, 47 pays      <- aucun pays gagne
//   60 h -> 863 articles, 49 pays      <- + Botswana, + Gambie
//   72 h -> 943 articles, 49 pays
//
// L'article le plus frais de chaque pays encore absent a 36 h :
//   BW 59 h | GM 59 h | ST 83 h | SC 275 h | DJ 295 h | ER 327 h
//   LS : aucun article exploitable, quelle que soit la fenetre.
//
// CE SCRIPT NE TRANCHE RIEN, ET C'EST VOLONTAIRE. Elargir la fenetre fait
// entrer des faits plus anciens presentes comme l'actualite du jour : sur un
// produit de surete, c'est un arbitrage entre un faux negatif (un pays qui
// parait calme faute de signal) et un faux positif (un incident d'avant-hier,
// peut-etre deja resolu, affiche comme courant). Il appartient a l'editeur.
//
// Le script produit le tableau. La decision reste a prendre.
//
// USAGE
//   node scripts/sensibilite-fenetre.js <repertoire-de-flux> [heures...]
//
// <repertoire-de-flux> contient les reponses brutes des flux, nommees <n>.xml,
// et un fichier sources.json decrivant le registre dans le meme ordre. La
// moisson est laissee dehors a dessein : ce script mesure, il ne va pas sur
// le reseau, et deux mesures doivent pouvoir rejouer LE MEME jeu de donnees.
const fs = require('node:fs');
const path = require('node:path');

const CHEMIN_PAGE = process.env.SENTINEL_HTML_PATH
  || path.join(__dirname, '..', 'web', 'SentiqS_Web.html');

const repertoire = process.argv[2];
if (!repertoire) {
  console.error('usage : node scripts/sensibilite-fenetre.js <repertoire-de-flux> [heures...]');
  console.error('        le repertoire contient <n>.xml et sources.json');
  process.exit(2);
}
const FENETRES = process.argv.slice(3).map(Number).filter((n) => n > 0);

// La fenetre courante est LUE dans la page, jamais recopiee ici : un seuil
// recopie se perime au premier arbitrage editorial, et ce script servirait
// alors a mesurer un reglage qui n'existe plus.
function fenetreCouranteH(html) {
  const m = /const FENETRE_ACTUALITE_MS = (\d+) \* 60 \* 60 \* 1000;/.exec(html);
  if (!m) throw new Error('FENETRE_ACTUALITE_MS introuvable dans ' + CHEMIN_PAGE);
  return Number(m[1]);
}

async function mesurer() {
  const html = fs.readFileSync(CHEMIN_PAGE, 'utf8');
  const courante = fenetreCouranteH(html);
  const largeurs = (FENETRES.length ? FENETRES : [courante, courante + 6, courante + 12, courante + 24, courante + 36])
    .filter((v, i, t) => t.indexOf(v) === i).sort((a, b) => a - b);

  const sources = JSON.parse(fs.readFileSync(path.join(repertoire, 'sources.json'), 'utf8'));
  const { chromium } = require('playwright');
  const nav = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  try {
    const page = await nav.newPage();
    // Chromium n'atteint pas le reseau ici, et n'a pas a l'atteindre : on
    // mesure sur des flux deja captures.
    await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await page.goto('file://' + CHEMIN_PAGE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof parseRSS === 'function'
      && typeof extraireDateSurvenance === 'function', { timeout: 30000 });

    const articles = [];
    for (let i = 0; i < sources.length; i++) {
      let xml;
      try { xml = fs.readFileSync(path.join(repertoire, i + '.xml'), 'utf8'); } catch { continue; }
      if (!xml || xml.length < 200) continue;
      let lot;
      try {
        lot = await page.evaluate(({ xml, src }) => (parseRSS(xml, src) || [])
          .filter((a) => a && a.cy && a.cy !== 'INT' && a.pubDate)
          .map((a) => {
            const surv = extraireDateSurvenance(a);
            return {
              cy: a.cy, niveau: a.level, titre: (a.title || '').slice(0, 58),
              pubH: (Date.now() - a.pubDate) / 3600000,
              survH: (Date.now() - surv.ts) / 3600000,
              // Une date jugee non fiable est ecartee quelle que soit la
              // fenetre : l'elargir ne la rattraperait pas.
              nonFiable: sourceDateNonFiable(a),
            };
          }), { xml, src: sources[i] });
      } catch { continue; }
      articles.push(...lot);
    }

    // Un article compte si SA PUBLICATION et SON EVENEMENT tiennent tous deux
    // dans la fenetre — les deux conditions d'estRecentReel.
    const retenus = (h) => articles.filter((a) => !a.nonFiable && a.pubH < h && a.survH < h);

    console.log('page mesuree      : ' + CHEMIN_PAGE);
    console.log('fenetre courante  : ' + courante + ' h');
    console.log('articles analyses : ' + articles.length + ' (sur ' + sources.length + ' sources declarees)\n');
    console.log('fenetre | articles | pays | critiques | eleves | pays gagnes');
    let precedent = null;
    for (const h of largeurs) {
      const r = retenus(h);
      const pays = new Set(r.map((a) => a.cy));
      const n = (k) => r.filter((a) => a.niveau === k).length;
      const gagnes = precedent ? [...pays].filter((c) => !precedent.has(c)) : [];
      console.log(
        String(h + ' h').padStart(7) + ' | ' + String(r.length).padStart(8) + ' | ' + String(pays.size).padStart(4)
        + ' | ' + String(n('crit')).padStart(9) + ' | ' + String(n('high')).padStart(6)
        + ' | ' + (precedent ? (gagnes.join(', ') || 'aucun') : '-')
        + (h === courante ? '   <- courante' : '')
      );
      precedent = pays;
    }

    const couvertsCourant = new Set(retenus(courante).map((a) => a.cy));
    const tousPays = [...new Set(articles.map((a) => a.cy))].sort();
    const absents = tousPays.filter((cy) => !couvertsCourant.has(cy));
    console.log('\nPour chaque pays absent a ' + courante + ' h, son article le plus frais :');
    if (!absents.length) console.log('  (aucun pays absent)');
    for (const cy of absents) {
      const cands = articles
        .filter((a) => a.cy === cy && !a.nonFiable)
        .sort((x, y) => Math.max(x.pubH, x.survH) - Math.max(y.pubH, y.survH));
      const m = cands[0];
      console.log('  ' + cy + ' : ' + (m
        ? Math.round(Math.max(m.pubH, m.survH)) + ' h — ' + m.titre
        : 'aucun article exploitable, quelle que soit la fenetre'));
    }
    console.log('\nCe tableau ne recommande rien : elargir la fenetre fait entrer des faits');
    console.log('plus anciens presentes comme l\'actualite du jour. L\'arbitrage est editorial.');
  } finally {
    await nav.close();
  }
}

mesurer().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
