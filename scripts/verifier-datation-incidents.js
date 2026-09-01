#!/usr/bin/env node
// Verifie que chaque incident "verifie" du fichier de production porte une
// date que l'application sait analyser, et rend visible la dette editoriale.
//
// Pourquoi ce controle existe : le niveau d'alerte affiche pour un pays est
// porte d'abord par ALERTE_EVENTS et FACTEURS_SPECIAUX, saisis a la main. Le
// 01/09/2026, l'incident le plus recent datait de juin 2026 et les 38
// facteurs structurels ne portaient aucune date — sans que rien, ni dans
// l'application ni dans la CI, ne le signale.
//
// Bloquant : une date qu'aucun format connu ne couvre. Elle serait comptee
// comme simple contexte, silencieusement, et personne ne le saurait.
// Non bloquant mais affiche : l'age du socle verifie et les elements non dates.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const cible = process.argv[2] || path.join(__dirname, '../web/SentiqS_Web.html');
const HTML = fs.readFileSync(cible, 'utf8');

function extraire(debut, fin) {
  const i = HTML.indexOf(debut);
  if (i === -1) { console.error('✗ marqueur introuvable : ' + debut); process.exit(1); }
  const j = HTML.indexOf(fin, i);
  if (j === -1) { console.error('✗ fin introuvable pour : ' + debut); process.exit(1); }
  return HTML.slice(i, j);
}

// dateEvenementMs vit dans le noyau logique : on le charge comme la page le
// charge, au lieu de le decouper au vol dans le fichier de production.
const { dateEvenementMs } = require('../web/js/noyau.js');

const bac = {};
vm.createContext(bac);
vm.runInContext(extraire('const ALERTE_EVENTS = [', '\n];') + '\n];\nthis.ALERTE_EVENTS = ALERTE_EVENTS;', bac);
vm.runInContext(extraire('const FACTEURS_SPECIAUX = {', '\n};') + '\n};\nthis.FACTEURS_SPECIAUX = FACTEURS_SPECIAUX;', bac);

const { ALERTE_EVENTS, FACTEURS_SPECIAUX } = bac;

const analyses = ALERTE_EVENTS.map((e) => ({ e, d: dateEvenementMs(e.date) }));
const muets   = analyses.filter((a) => a.d.precision === null);
const annuels = analyses.filter((a) => a.d.precision === 'annee');
const datees  = analyses.filter((a) => a.d.precision === 'jour' || a.d.precision === 'mois');

const plusRecent = datees.reduce((mx, a) => (a.d.ms > mx ? a.d.ms : mx), 0);
const jours = plusRecent ? Math.floor((Date.now() - plusRecent) / 86400000) : null;

const facteurs = Object.values(FACTEURS_SPECIAUX).reduce((n, l) => n + l.length, 0);
const facteursDates = Object.values(FACTEURS_SPECIAUX)
  .reduce((n, l) => n + l.filter((f) => f.revu).length, 0);

console.log(`Incidents verifies : ${ALERTE_EVENTS.length}`);
console.log(`  dates au jour ou au mois : ${datees.length}`);
console.log(`  dates a l'annee pres     : ${annuels.length}  (comptes comme contexte, poids reduit)`);
console.log(`  non analysables          : ${muets.length}`);
console.log(`Facteurs structurels : ${facteurs}, dont ${facteursDates} portant une date de revue (champ « revu »)`);

if (jours !== null) {
  console.log(`\nSocle verifie : l'incident date le plus recent remonte a ${jours} jours.`);
  if (jours > 90) {
    console.log('⚠  Plus de 90 jours. Les niveaux affiches reposent sur une saisie ancienne ;');
    console.log('   le plafond du signal temps reel s\'est ouvert pour compenser (voir plafondLive),');
    console.log('   mais rien ne remplace une revue humaine des incidents.');
  }
}
if (facteursDates < facteurs) {
  console.log(`\n⚠  ${facteurs - facteursDates} facteur(s) structurel(s) sans date de revue.`);
  console.log('   Ils pesent leur bonus plein sans que personne puisse savoir de quand il date.');
  console.log("   Ajoutez un champ revu:'AAAA-MM' au fur et a mesure des revues.");
}

if (muets.length) {
  console.error('\n✗ Date(s) non analysable(s) — elles seraient comptees comme simple contexte, en silence :');
  muets.forEach((a) => console.error(`   ${a.e.cy}  date:'${a.e.date}'  ${String(a.e.title).slice(0, 70)}`));
  console.error('\nAjoutez le format a dateEvenementMs() dans web/SentiqS_Web.html, ou corrigez la saisie.');
  process.exit(1);
}
console.log('\n✓ Toutes les dates d\'incident sont analysables par l\'application.');
