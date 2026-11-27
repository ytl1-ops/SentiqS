#!/usr/bin/env node
// Rejoue le classement COURANT (niveau, catégorie) sur les faits déjà versés
// dans un cumul du mois (web/rapports/mensuel/faits-AAAA-MM.json).
//
// Pourquoi : `cumuler` ne revoit un fait que s'il repasse dans la collecte.
// Sans ce rejeu, un correctif de classement (audit du 27/11/2026 : une
// piqûre de scorpion en « politique ») ne prenait effet que sur les faits du
// lendemain, et la Présentation 1 du mois gardait les anciennes erreurs.
//
// Le classement est la vraie classify() de la page, extraite du fichier servi
// comme le font les tests et banc-tri.js : rien n'est réimplémenté. La
// catégorie de la source vient du registre SRCS de la même page. La cotation
// n'est jamais touchée.
//
//   node scripts/reclasser-cumul.js 2026-11 [2026-10 …]   (écrit les fichiers)
//   node scripts/reclasser-cumul.js --essai 2026-11         (n'écrit rien)
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { bac, exposer } = require('./test/_bac.js');
const faitsGrsci = require('./lib/faits-grsci');

const RACINE = path.join(__dirname, '..');
const RACINE_MENSUEL = path.join(RACINE, 'web', 'rapports', 'mensuel');

let _classeur = null;
function classeur() {
  if (_classeur) return _classeur;
  const html = fs.readFileSync(process.env.SENTINEL_HTML_PATH || path.join(RACINE, 'web', 'SentiqS_Web.html'), 'utf8');
  const tr = (a, b) => { const i = html.indexOf(a); const j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('marqueur absent : ' + a); return html.slice(i, j); };
  const { classify } = exposer(bac(tr('const CK_CRIT', '//  FIABILITÉ & ANTI-HALLUCINATION')), 'classify');
  const SRCS = vm.runInNewContext(tr('const SRCS=[', '\n];').replace('const SRCS=', '(') + '\n])');
  const parNom = new Map(SRCS.map((s) => [s.n, s]));
  _classeur = (f, cy) => {
    const s = parNom.get(f.source);
    const titre = String(f.titre || '');
    return classify(titre + ' ' + String(f.resume || ''), { cy, cat: s ? s.cat : 'securite' }, titre);
  };
  return _classeur;
}

// reclasserCumul(cumul) : met à jour niveau et catégorie de chaque fait, rend
// la liste des changements (pour le journal et la mesure).
function reclasserCumul(cumul) {
  const classer = classeur();
  // Le niveau versé vient de l'article entier, le rejeu ne lit que son chapô :
  // il n'est donc remplacé que par une règle qui abaisse expressément
  // (attaque d'animal, conseil pratique) ou quand le fait passe au sport ou à
  // la culture. La catégorie, elle, suit toujours la règle courante.
  return faitsGrsci.reclasser(cumul, (f, cy) => {
    const r = classer(f, cy);
    const hors = r.cat === 'sport' || r.cat === 'culture';
    return { niveau: (r.plafond || hors) ? r.lvl : f.niveau, cat: r.cat };
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const essai = args.includes('--essai');
  for (const mois of args.filter((a) => /^\d{4}-\d{2}$/.test(a))) {
    const cumul = faitsGrsci.lireCumul(RACINE_MENSUEL, mois);
    const changes = reclasserCumul(cumul);
    const compte = {};
    changes.forEach((c) => { for (const k of ['niveau', 'cat']) if (c.avant[k] !== c.apres[k]) { const e = k + ' ' + c.avant[k] + ' → ' + c.apres[k]; compte[e] = (compte[e] || 0) + 1; } });
    console.log(mois + ' : ' + changes.length + ' fait(s) reclassé(s)');
    Object.entries(compte).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log('  ' + n + '  ' + k));
    if (!essai && changes.length) faitsGrsci.ecrireCumul(RACINE_MENSUEL, cumul);
  }
}
module.exports = { reclasserCumul };
