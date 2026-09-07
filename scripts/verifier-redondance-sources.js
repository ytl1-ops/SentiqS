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
//
// Descente du 06/09/2026 : 13 -> 4. Elle vient de l'integration de 71 medias
// locaux, mesures par scripts/couverture-mediatique.js puis notes 72 par
// l'editeur du produit. La nuance compte et doit rester ecrite : la note a
// ete posee EN BLOC, sur la mesure de couverture, et non media par media
// apres lecture editoriale. Les quatre pays qui restent — Erythree, Guinee
// equatoriale, Guinee-Bissau, Lesotho — n'ont aucun media local avec un flux
// vivant : la mesure n'a rien trouve a leur donner, ce n'est pas un oubli.
//
// Descente du 07/09/2026 : 4 -> 3. Le Lesotho sort de la liste avec Sunday
// Express, trouve en testant nominativement les grands titres du pays plutot
// qu'en passant par les annuaires ouverts. Meme reserve que ci-dessus : la
// note de 72 a ete posee par l'editeur sur la mesure de publication, pas
// apres une lecture editoriale du titre.
//
// Les trois qui restent — Erythree, Guinee equatoriale, Guinee-Bissau — n'ont
// toujours aucun media local a flux vivant. Pour l'Erythree c'est mesure : la
// presse d'Etat n'expose aucun flux, et les sites trouves sont des
// publications de la diaspora. Les Seychelles ne sont PAS dans cette liste
// mais meritent la meme prudence : leur seul flux vivant (SBC) publie en
// creole seychellois, que les lexiques ne lisent pas.
//
// Descente du 07/09/2026, second passage : 3 -> 1. La Guinee equatoriale
// (Ahora EG) et la Guinee-Bissau (O Democrata GB, plus l'agence ANG lue en
// flux natif) sortent de la liste, par la meme methode nominative. Reste
// l'Erythree, seule, et c'est mesure : la presse d'Etat n'expose aucun flux
// et les sites trouves sont des publications de la diaspora. Ce plafond ne
// descendra a zero qu'avec une source erythreenne reelle, pas avec une
// source de complaisance.
//
// Remontee du 07/09/2026 : 1 -> 13. La seule fois ou ce plafond monte, et
// voici pourquoi. Les 94 medias notes 72 EN BLOC (les 71 du 06/09 et les
// 23 du 07/09, tous marques col:'#4B5563') l'avaient ete sur une mesure de
// publication, jamais apres lecture. L'editeur a tranche : ils redescendent
// a 68, sous le seuil de 70, en attendant une lecture titre par titre. Ils
// restent au registre et alimentent le flux, mais ne peuvent plus faire
// monter un niveau d'alerte. La dette reelle reapparait donc : treize pays
// n'ont qu'une seule source capable d'alerter (BI CG ER GM GQ GW KM LS LY
// MZ SL SS SZ). Le plafond dit la dette mesuree, pas la dette souhaitee ;
// il redescendra a mesure que les medias relus retrouvent 72.
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
