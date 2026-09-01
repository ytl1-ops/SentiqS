#!/usr/bin/env node
// Controle le registre des sources (SRCS) du fichier de production.
//
// Le seuil de fiabilite de 70 (voir getLiveAlertEvents) decide quelles
// sources peuvent produire un signal d'alerte temps reel. 313 des 496
// sources sont sous ce seuil : si un pays n'avait AUCUNE source au-dessus,
// il ne pourrait produire aucun signal, quoi qu'il s'y passe — un angle mort
// total, et invisible.
//
// Verification faite le 01/09/2026 : les 54 pays ont tous au moins une
// source au-dessus du seuil. Cette propriete est vraie par accident, jamais
// defendue. Ce controle la rend obligatoire : retirer la derniere bonne
// source d'un pays echoue desormais bruyamment, au lieu de le rendre
// silencieusement aveugle.
const fs = require('node:fs');
const path = require('node:path');

const cible = process.argv[2] || path.join(__dirname, '../web/SentiqS_Web.html');
const HTML = fs.readFileSync(cible, 'utf8');

const seuilM = HTML.match(/\(a\.score \|\| 0\) >= (\d+)/);
if (!seuilM) { console.error('✗ seuil de fiabilite introuvable dans getLiveAlertEvents'); process.exit(1); }
const SEUIL = Number(seuilM[1]);

const sources = [...HTML.matchAll(/\{id:'([^']+)'[^}]*?cy:'([A-Z]{2,3})'[^}]*?score:(\d+)/g)]
  .map((m) => ({ id: m[1], cy: m[2], score: Number(m[3]) }));
if (!sources.length) { console.error('✗ aucune source lue dans SRCS'); process.exit(1); }

const noms = {};
for (const m of HTML.matchAll(/\{code:'([A-Z]{2})',name:'([^']+)'/g)) if (!noms[m[1]]) noms[m[1]] = m[2];

const parPays = new Map();
for (const s of sources) {
  if (s.cy === 'INT') continue;
  if (!parPays.has(s.cy)) parPays.set(s.cy, []);
  parPays.get(s.cy).push(s);
}

const aveugles = [...parPays.entries()].filter(([, l]) => !l.some((s) => s.score >= SEUIL));
const horsBornes = sources.filter((s) => s.score < 0 || s.score > 100);
const sousSeuil = sources.filter((s) => s.score < SEUIL).length;

console.log(`Sources : ${sources.length}, reparties sur ${parPays.size} pays.`);
console.log(`Seuil de fiabilite pour produire un signal d'alerte : ${SEUIL}.`);
console.log(`  au-dessus du seuil : ${sources.length - sousSeuil}`);
console.log(`  en dessous         : ${sousSeuil} (elles alimentent le Flux, jamais les Alertes)`);

if (horsBornes.length) {
  console.error('\n✗ Score hors de l\'intervalle 0-100 :');
  horsBornes.forEach((s) => console.error(`   ${s.id} (${s.cy}) : ${s.score}`));
  process.exit(1);
}

if (aveugles.length) {
  console.error(`\n✗ ${aveugles.length} pays sans aucune source atteignant le seuil de ${SEUIL} :`);
  aveugles.forEach(([cy, l]) => {
    const meilleure = Math.max(...l.map((s) => s.score));
    console.error(`   ${noms[cy] || cy} — ${l.length} source(s), meilleure note ${meilleure}`);
  });
  console.error('\nCes pays ne peuvent produire AUCUN signal d\'alerte temps reel, quoi qu\'il s\'y passe.');
  console.error('Relevez la note d\'une source fiable, ou ajoutez-en une.');
  process.exit(1);
}

console.log(`\n✓ Chacun des ${parPays.size} pays a au moins une source capable de declencher une alerte.`);
