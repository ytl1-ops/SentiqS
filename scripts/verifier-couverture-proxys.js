#!/usr/bin/env node
// Verifie que CHAQUE proxy CORS declare dans l'application (CORS_PX, dans
// web/SentiqS_Web.html) est soit intercepte, soit explicitement neutralise
// par le job de collecte planifiee.
//
// Les deux listes vivent dans deux fichiers differents et rien ne les reliait :
// ajouter un proxy cote application sans l'ajouter ici faisait retomber le job
// sur le proxy public — perdant robots.txt, throttle et User-Agent
// identifiable, silencieusement. Ce controle transforme cet oubli en echec.
const fs = require('node:fs');
const path = require('node:path');
const { PROXY_PREFIXES, PREFIXES_NEUTRALISES } = require('./lib/interception-proxy-directe');

const html = fs.readFileSync(path.join(__dirname, '../web/SentiqS_Web.html'), 'utf8');

const debut = html.indexOf('const CORS_PX');
if (debut === -1) { console.error('✗ CORS_PX introuvable dans web/SentiqS_Web.html'); process.exit(1); }
const bloc = html.slice(debut, html.indexOf('];', debut));

// Chaque entree est de la forme (u) => 'https://…' + … : on releve le premier
// litteral http(s) de chaque ligne.
const declares = [...bloc.matchAll(/'(https?:\/\/[^']+)'/g)].map(m => m[1]);
// RSS2JSON est declare a part de CORS_PX (const RSS2JSON = u => '…'), mais il
// est le PREMIER service essaye : l'omettre ici laisserait justement passer
// l'angle mort que ce controle existe pour fermer.
const rss2json = [...html.matchAll(/RSS2JSON\s*=\s*\(?\s*u\s*\)?\s*=>\s*'(https?:\/\/[^']+)'/g)].map(m => m[1]);
const tous = [...new Set([...declares, ...rss2json])];

const couvert = (u) =>
  PROXY_PREFIXES.some(p => u.startsWith(p.prefix) || p.prefix.startsWith(u)) ||
  PREFIXES_NEUTRALISES.some(p => u.startsWith(p) || p.startsWith(u));

const orphelins = tous.filter(u => !couvert(u));

console.log(`Proxys declares dans l'application : ${tous.length}`);
tous.forEach(u => console.log(`  ${couvert(u) ? '✓' : '✗'} ${u}`));

if (orphelins.length) {
  console.error(`\n✗ ${orphelins.length} proxy(s) non couvert(s) par le job de collecte.`);
  console.error("Ajoutez-les a PROXY_PREFIXES (interception) ou a PREFIXES_NEUTRALISES (refus)");
  console.error('dans scripts/lib/interception-proxy-directe.js.');
  process.exit(1);
}
console.log('\n✓ Tous les proxys de l\'application sont couverts par le job.');
