#!/usr/bin/env node
// Liste de travail pour la revue du socle vérifié.
//
// POURQUOI CE SCRIPT EXISTE
//
// « Relire les 172 incidents » est une tache que personne ne commence, parce
// qu'elle n'a ni ordre ni fin. Le premier instantane archive permet de la
// transformer en liste priorisee : on sait maintenant, pays par pays, quelle
// part du niveau affiche vient du socle fige, et depuis combien de temps ce
// socle n'a pas ete touche.
//
// Le classement met en tete les pays ou une donnee perimee coute le plus
// cher : niveau eleve + socle ancien + aucune collecte pour le corriger.
//
// Ce script ne juge AUCUN incident. Il dit par ou commencer.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { dateEvenementMs } = require('../web/js/noyau.js');
const { prioriteRevue } = require('./lib/priorisation.js');

const RACINE_HIST = path.join(__dirname, '..', 'web', 'historique');
const cible = process.argv[2] || path.join(__dirname, '../web/SentiqS_Web.html');
const HTML = fs.readFileSync(cible, 'utf8');

function extraire(debut, fin) {
  const i = HTML.indexOf(debut);
  if (i === -1) { console.error('✗ marqueur introuvable : ' + debut); process.exit(1); }
  return HTML.slice(i, HTML.indexOf(fin, i));
}
const bac = {};
vm.createContext(bac);
vm.runInContext(extraire('const ALERTE_EVENTS = [', '\n];') + '\n];\nthis.EV = ALERTE_EVENTS;', bac);
vm.runInContext(extraire('const CYS', '\n];') + '\n];\nthis.CYS = CYS;', bac);
const NOMS = {};
for (const c of bac.CYS || []) if (c && c.code) NOMS[c.code] = c.name;

// Le dernier instantane archive, s'il existe : c'est lui qui dit ce que la
// collecte a REELLEMENT apporte, plutot que ce qu'elle pourrait apporter.
let instantane = null;
if (fs.existsSync(RACINE_HIST)) {
  const jours = fs.readdirSync(RACINE_HIST).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  if (jours.length) {
    try { instantane = JSON.parse(fs.readFileSync(path.join(RACINE_HIST, jours[jours.length - 1]), 'utf8')); }
    catch (_) { instantane = null; }
  }
}
if (!instantane) {
  console.log('· Aucun instantane archive : lancez la collecte planifiee d\'abord.');
  console.log('  Sans lui, ce script ne saurait pas ce que la collecte apporte reellement.');
  process.exit(0);
}

const maintenant = Date.now();

const lignes = instantane.pays.map((p) => {
  const incidents = bac.EV.filter((e) => e.cy === p.code);
  const ages = incidents.map((e) => dateEvenementMs(e.date))
    .filter((d) => d && d.ms).map((d) => Math.floor((maintenant - d.ms) / 86400000));
  // Une date imprecise peut se resoudre a demain : l'age vaut alors zero, pas « -1 j ».
  const plusRecent = ages.length ? Math.max(0, Math.min(...ages)) : null;
  const partSocle = p.total > 0 ? p.verifies / p.total : 0;
  const priorite = prioriteRevue({ ...p, plusRecentJours: plusRecent });
  return { ...p, nom: NOMS[p.code] || p.code, nbIncidents: incidents.length, plusRecent, partSocle, priorite };
}).sort((a, b) => b.priorite - a.priorite);

console.log(`Instantane du ${instantane.jour} — ${instantane.pays.length} pays`);
console.log(`Socle verifie : ${bac.EV.length} incidents\n`);
console.log('    pays                  niveau   incidents  + recent  part socle  collecte');
console.log('    ────────────────────  ───────  ─────────  ────────  ──────────  ────────');
for (const l of lignes.slice(0, 15)) {
  console.log('    ' + l.nom.slice(0, 20).padEnd(22)
    + l.niveau.padEnd(9)
    + String(l.nbIncidents).padStart(6) + '    '
    + (l.plusRecent === null ? '   —' : String(l.plusRecent) + ' j').padStart(8) + '  '
    + (Math.round(l.partSocle * 100) + ' %').padStart(9) + '  '
    + (l.live > 0 ? String(l.live) + ' pt' : 'aucune').padStart(9));
}

const sansCollecte = lignes.filter((l) => l.live === 0).length;
const anciens = lignes.filter((l) => l.plusRecent !== null && l.plusRecent > 60).length;
console.log(`\n${sansCollecte}/${lignes.length} pays sans aucun apport de la collecte ce jour-la.`);
console.log(`${anciens}/${lignes.length} pays dont l'incident verifie le plus recent a plus de 60 jours.`);
console.log('\nLes quinze lignes ci-dessus sont l\'ordre par lequel commencer : niveau eleve,');
console.log('socle ancien, part du socle elevee, et rien dans la collecte pour le corriger.');
