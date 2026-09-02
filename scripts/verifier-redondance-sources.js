#!/usr/bin/env node
// Redondance des sources capables de declencher une alerte.
//
// POURQUOI CE CONTROLE EXISTE
//
// verifier-sources.js garantit que chaque pays a AU MOINS UNE source
// au-dessus du seuil de fiabilite. C'est le minimum vital, et il etait juste
// de le poser. Mais « au moins une » veut dire que treize pays en ont
// exactement une : Soudan du Sud, Burundi, Congo, Erythree, Gambie,
// Guinee-Bissau, Sierra Leone, Guinee equatoriale, Comores, Lesotho,
// Eswatini, Mozambique, Libye.
//
// Pour ces treize-la, une seule source qui tombe — ou simplement qui ne
// publie rien pendant douze heures — et le pays ne peut plus monter d'un
// cran, quoi qu'il se passe sur le terrain. Le premier instantane archive
// (02/09/2026) le confirme par un autre chemin : 42 pays sur 54 n'ont recu
// aucun apport de la collecte ce jour-la.
//
// CLIQUET : le nombre de pays a source unique ne doit jamais remonter. Il
// descend en ajoutant des sources fiables, ce qui demande de les evaluer
// editorialement — pas de leur attribuer un score au jugé.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PLAFOND_PAYS_SOURCE_UNIQUE = 13;

const cible = process.argv[2] || path.join(__dirname, '../web/SentiqS_Web.html');
const HTML = fs.readFileSync(cible, 'utf8');

const seuilM = HTML.match(/\(a\.score \|\| 0\) >= (\d+)/);
if (!seuilM) { console.error('✗ seuil de fiabilite introuvable dans getLiveAlertEvents'); process.exit(1); }
const SEUIL = Number(seuilM[1]);

const i = HTML.indexOf('const SRCS=[');
if (i === -1) { console.error('✗ SRCS introuvable'); process.exit(1); }
const j = HTML.indexOf('\n];', i);
const bac = {};
vm.createContext(bac);
vm.runInContext(HTML.slice(i, j) + '\n];\nthis.SRCS = SRCS;', bac);

const parPays = new Map();
for (const s of bac.SRCS) {
  if (!s || !s.cy || s.cy === 'INT') continue;
  if (!parPays.has(s.cy)) parPays.set(s.cy, []);
  parPays.get(s.cy).push(s);
}

const fiables = (liste) => liste.filter((s) => (s.score || 0) >= SEUIL).length;
const rangs = [...parPays.entries()].map(([cy, l]) => [cy, l.length, fiables(l)]);
const aveugles = rangs.filter(([, , f]) => f === 0);
const uniques = rangs.filter(([, , f]) => f === 1).map(([cy]) => cy).sort();
const mediane = rangs.map(([, , f]) => f).sort((a, b) => a - b)[Math.floor(rangs.length / 2)];

console.log(`Seuil de fiabilite : ${SEUIL}`);
console.log(`Pays suivis        : ${rangs.length}`);
console.log(`Sources capables de declencher une alerte, mediane par pays : ${mediane}`);
console.log(`Pays a source unique : ${uniques.length}${uniques.length ? '  (' + uniques.join(' ') + ')' : ''}`);

if (aveugles.length) {
  console.error(`\n✗ ${aveugles.length} pays sans AUCUNE source au-dessus du seuil : `
    + aveugles.map(([cy]) => cy).join(' '));
  console.error('   Ces pays ne peuvent jamais etre portes par la collecte.');
  process.exit(1);
}

if (uniques.length > PLAFOND_PAYS_SOURCE_UNIQUE) {
  console.error(`\n✗ ${uniques.length} pays n'ont qu'une seule source capable de declencher une alerte,`);
  console.error(`   pour un plafond de ${PLAFOND_PAYS_SOURCE_UNIQUE}.`);
  console.error('   Une source qui se tait douze heures suffit alors a rendre le pays aveugle.');
  console.error('   Ajoutez une source fiable — apres l\'avoir evaluee, pas en lui attribuant un score au juge.');
  process.exit(1);
}

if (uniques.length < PLAFOND_PAYS_SOURCE_UNIQUE) {
  console.log(`\n→ ${PLAFOND_PAYS_SOURCE_UNIQUE - uniques.length} pays sorti(s) de la source unique.`);
  console.log(`   Abaissez PLAFOND_PAYS_SOURCE_UNIQUE a ${uniques.length} pour verrouiller le gain.`);
}

console.log('\n✓ Chaque pays garde au moins une source d\'alerte, et le nombre de pays');
console.log('  a source unique ne remonte pas.');
