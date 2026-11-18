#!/usr/bin/env node
'use strict';
// Mesure ce que les fichiers bruts de GDELT disent des 54 pays sur les
// dernières heures (scripts/lib/gdelt-brut.js). Lancé depuis GitHub : le bac
// à sable n'atteint pas data.gdeltproject.org.
//
// Informatif : n'écrit rien dans le dépôt, ne conclut rien. La question qu'il
// doit éclairer avant tout branchement : sur les pays que nos sources laissent
// muets, GDELT voit-il quelque chose, et ce quelque chose tient-il debout ?
//
//   node scripts/sonde-gdelt-brut.js [heures=24] [sortie.json]

const fs = require('fs');
const g = require('./lib/gdelt-brut');

const HEURES = Math.max(1, Math.min(72, Number(process.argv[2]) || 24));
const SORTIE = process.argv[3] || '';
const PARALLELE = 4;

async function telecharger(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'SentiqS-veille/1.0 (sonde GDELT)' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

(async () => {
  const debut = Date.now();
  const lu = (await telecharger(g.BASE + 'lastupdate.txt')).toString('utf8');
  const dernier = g.dernierExport(lu);
  const adresses = g.adressesExports(dernier, HEURES * 4);
  console.log('Dernier export : ' + dernier + ' ; ' + adresses.length + ' fichiers sur ' + HEURES + ' h');

  const evenements = [];
  const echecs = [];
  let octets = 0;
  let file = adresses.slice();
  async function ouvrier() {
    while (file.length) {
      const url = file.shift();
      try {
        const zip = await telecharger(url);
        octets += zip.length;
        evenements.push(...g.analyserExport(g.lireZip(zip)));
      } catch (e) {
        echecs.push(url.split('/').pop() + ' : ' + e.message);
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLELE }, ouvrier));

  const parPays = g.agreger(evenements);
  const tous = Object.values(g.FIPS_VERS_ISO).sort();
  const silencieux = tous.filter((cy) => !parPays[cy]);
  console.log('Fichiers lus : ' + (adresses.length - echecs.length) + '/' + adresses.length +
    ', ' + Math.round(octets / 1024) + ' Ko, ' + Math.round((Date.now() - debut) / 1000) + ' s');
  if (echecs.length) console.log('Échecs : ' + echecs.slice(0, 10).join(' | ') + (echecs.length > 10 ? ' …' : ''));
  console.log('Événements africains retenus : ' + evenements.length + ' lignes, ' +
    Object.values(parPays).reduce((s, p) => s + p.articles, 0) + ' adresses distinctes');
  console.log('Pays avec au moins un événement : ' + Object.keys(parPays).length + '/54');
  console.log('Pays sans rien : ' + (silencieux.join(' ') || 'aucun'));
  console.log('');
  console.log('Pays  Adr.  ≥2 src  Familles                                   Lieux');
  Object.entries(parPays).sort((a, b) => b[1].articles - a[1].articles).forEach(([cy, p]) => {
    const fam = Object.entries(p.familles).map(([f, n]) => f + ' ' + n).join(', ');
    console.log(cy.padEnd(6) + String(p.articles).padStart(4) + String(p.reprisParPlusieursSources).padStart(8) + '  ' +
      fam.padEnd(42) + ' ' + p.lieux.join(' ; '));
  });
  console.log('');
  console.log('Exemples (trois adresses par pays, à relire avant toute conclusion) :');
  Object.entries(parPays).forEach(([cy, p]) => p.exemples.forEach((u) => console.log('  ' + cy + '  ' + u)));

  if (SORTIE) fs.writeFileSync(SORTIE, JSON.stringify({ dernier, heures: HEURES, echecs: echecs.length, parPays, silencieux }, null, 2));
})().catch((e) => {
  console.error('Sonde GDELT (fichiers bruts) : ' + e.message);
  process.exitCode = 0; // informative : ne fait jamais échouer un job
});
