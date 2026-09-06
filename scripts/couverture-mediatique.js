#!/usr/bin/env node
// Quels médias couvrent réellement chaque pays, et lesquels la veille ne
// lit pas encore. Méthode et raison d'être : scripts/lib/moisson-medias.js.
//
// Ne décide rien et n'écrit jamais dans SRCS : le score de fiabilité d'un
// média est un jugement éditorial. Ce script produit la liste ordonnée des
// candidats à évaluer, avec le nombre d'articles qui la justifie.
//
// ATTENTION — NÉCESSITE UN ACCÈS RÉSEAU RÉEL (comme
// scripts/decouvrir-nouvelles-sources.js et
// scripts/verifier-decouverte-flux.js).
//
// Usage :
//   node scripts/couverture-mediatique.js            # les 54 pays
//   node scripts/couverture-mediatique.js SL GM ER   # quelques pays
//   SENTINEL_HTML_PATH=... node scripts/couverture-mediatique.js
//
// Écrit couverture-medias.json (gitignoré) : un bloc par pays, chaque média
// avec son nombre d'articles et s'il est déjà lu par le registre.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { fetchRespectueux } = require('./lib/fetch-respectueux');
const { extraireMedias, hotesDuRegistre, requetesGoogleNews, agreger, candidats } = require('./lib/moisson-medias');

const CHEMIN_HTML = process.env.SENTINEL_HTML_PATH || path.join(__dirname, '..', 'web', 'SentiqS_Web.html');
const HTML = fs.readFileSync(CHEMIN_HTML, 'utf8');

// Le registre est extrait de la page de production, jamais recopié : une
// copie divergerait sans que rien ne le signale.
function lireRegistre() {
  const debut = HTML.indexOf('const SRCS=[');
  const fin = HTML.indexOf('\n];', debut);
  if (debut === -1 || fin === -1) throw new Error('SRCS introuvable dans ' + CHEMIN_HTML);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(HTML.slice(debut, fin) + '\n];\nthis.S = SRCS;', ctx);
  return ctx.S;
}

const SRCS = lireRegistre();
const connus = hotesDuRegistre(SRCS);
const demandes = process.argv.slice(2).map((a) => a.toUpperCase()).filter((a) => /^[A-Z]{2,3}$/.test(a));
const pays = [...new Set(SRCS.map((s) => s.cy))].filter((cy) => cy && cy !== 'INT')
  .filter((cy) => !demandes.length || demandes.includes(cy)).sort();

(async () => {
  const rapport = {};
  for (const cy of pays) {
    const requetes = requetesGoogleNews(SRCS, cy);
    const vus = [];
    let flux = 0;
    for (const url of requetes) {
      const r = await fetchRespectueux(url);
      if (!r.ok) continue;
      flux++;
      vus.push(...extraireMedias(r.texte));
    }
    const tous = agreger(vus, connus);
    const aEvaluer = candidats(tous);
    rapport[cy] = { requetes: requetes.length, fluxLus: flux, articles: vus.length, medias: tous };
    console.log([
      cy.padEnd(4),
      String(vus.length).padStart(4) + ' articles',
      String(tous.length).padStart(3) + ' médias',
      String(tous.filter((m) => m.deja).length).padStart(3) + ' déjà lus',
      String(aEvaluer.length).padStart(3) + ' à évaluer',
    ].join(' | '));
    fs.writeFileSync(path.join(process.cwd(), 'couverture-medias.json'), JSON.stringify(rapport, null, 1));
  }
  const distincts = new Set();
  for (const b of Object.values(rapport)) for (const m of candidats(b.medias)) distincts.add(m.hote);
  console.log('\n' + distincts.size + ' médias distincts à évaluer, sur ' + pays.length + ' pays.');
  console.log('Rapport : couverture-medias.json — aucune source n\'a été ajoutée au registre.');
})();
