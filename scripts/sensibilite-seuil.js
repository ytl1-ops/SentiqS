#!/usr/bin/env node
// Sensibilite du seuil de fiabilite : que change chaque point ?
//
// POURQUOI CE SCRIPT EXISTE
//
// verifier-redondance-sources.js a etabli que treize pays n'ont qu'UNE seule
// source capable de declencher une alerte. La reaction naturelle est
// d'ajouter des sources. La mesure dit autre chose :
//
//   seuil 70 : 13 pays a source unique, mediane 2
//   seuil 68 :  0 pays a source unique, mediane 3
//
// Les 63 sources notees exactement 68 sont les requetes « <Pays> — Securite »
// de Google News, une par pays. Le seuil a 70 les exclut TOUTES du calcul
// d'alerte, a deux points pres. Ce n'est donc pas un manque de sources :
// c'est le seuil qui decide, et personne ne l'avait mesure.
//
// CE SCRIPT NE TRANCHE RIEN, ET C'EST VOLONTAIRE. Descendre le seuil
// laisserait une agregation Google News faire monter le niveau d'alerte d'un
// pays. Sur un produit de surete, c'est un arbitrage entre un faux negatif
// (treize pays aveugles quand leur unique source se tait) et un faux positif
// (une agregation mal ciblee qui alarme). Cet arbitrage appartient a
// l'editeur du produit, pas a un script — et surtout pas a quelqu'un qui n'a
// pas evalue ces flux un par un.
//
// Le script produit le tableau. La decision reste a prendre.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { profilSeuil } = require('./lib/priorisation.js');

const cible = process.argv[2] || path.join(__dirname, '../web/SentiqS_Web.html');
const HTML = fs.readFileSync(cible, 'utf8');

const seuilM = HTML.match(/\(a\.score \|\| 0\) >= (\d+)/);
if (!seuilM) { console.error('✗ seuil introuvable dans getLiveAlertEvents'); process.exit(1); }
const SEUIL_ACTUEL = Number(seuilM[1]);

const i = HTML.indexOf('const SRCS=[');
const j = HTML.indexOf('\n];', i);
const bac = {};
vm.createContext(bac);
vm.runInContext(HTML.slice(i, j) + '\n];\nthis.SRCS = SRCS;', bac);

const sources = bac.SRCS.filter((s) => s && s.cy && s.cy !== 'INT');
const pays = [...new Set(sources.map((s) => s.cy))];

const profil = (seuil) => profilSeuil(sources, seuil);

// Les seuils candidats sont ceux qui existent reellement dans le registre :
// tester 71 ou 69 ne dirait rien, aucune source ne porte ces valeurs.
const valeurs = [...new Set(sources.map((s) => s.score))].sort((a, b) => b - a);

console.log(`Seuil actuel : ${SEUIL_ACTUEL}`);
console.log(`Sources pays : ${sources.length} sur ${pays.length} pays\n`);
console.log('seuil   sources   pays aveugles   pays a source unique   mediane/pays');
console.log('─────   ───────   ─────────────   ────────────────────   ────────────');
for (const v of valeurs.filter((v) => v >= 55)) {
  const p = profil(v);
  const marque = (v === SEUIL_ACTUEL) ? '  ← actuel' : '';
  console.log(
    String(v).padStart(5) + String(p.sources).padStart(10)
    + String(p.aveugles).padStart(16) + String(p.uniques).padStart(23)
    + String(p.mediane).padStart(15) + marque);
}

const actuel = profil(SEUIL_ACTUEL);
const suivant = valeurs.filter((v) => v < SEUIL_ACTUEL)[0];
if (suivant !== undefined) {
  const p = profil(suivant);
  console.log(`\nEn descendant de ${SEUIL_ACTUEL} a ${suivant} :`);
  console.log(`  pays a source unique : ${actuel.uniques} → ${p.uniques}`);
  console.log(`  sources d'alerte     : ${actuel.sources} → ${p.sources} (+${p.sources - actuel.sources})`);
  // Ce qui entrerait n'est PAS homogene, et c'est le coeur de l'arbitrage :
  // une requete Google News et un quotidien national ne se valent pas, meme
  // notes pareil.
  const gagnees = sources.filter((s) => s.score >= suivant && s.score < SEUIL_ACTUEL);
  const agregats = gagnees.filter((s) => /Google News/i.test(String(s.n)));
  const nommees = gagnees.filter((s) => !/Google News/i.test(String(s.n)));
  console.log(`  dont agregations Google News : ${agregats.length}`);
  console.log(`  dont medias nommes           : ${nommees.length}`
    + (nommees.length ? '  (' + nommees.slice(0, 5).map((s) => String(s.n).replace(/\s*\([^)]*\)\s*$/, '')).join(', ')
      + (nommees.length > 5 ? ', …' : '') + ')' : ''));
  console.log('\n  L\'arbitrage n\'est pas « 70 ou 68 » mais « faut-il qu\'une agregation');
  console.log('  Google News puisse faire monter un niveau d\'alerte ? ». Un media nomme');
  console.log('  note 68 pose une question differente : il merite peut-etre 72, et cela');
  console.log('  se decide source par source, pas en deplacant le seuil.');
  console.log('\n  Ce script ne tranche rien. Il donne les nombres.');
}
