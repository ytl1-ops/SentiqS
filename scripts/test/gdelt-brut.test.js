'use strict';
// Fichiers bruts de GDELT : lecture, table des pays, et la garde qui compte —
// un événement GDELT ne touche jamais au niveau d'alerte.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const g = require('../lib/gdelt-brut');

// Une archive zip à une entrée, écrite à la main (descripteur de données
// compris : tailles à zéro dans le bloc local, comme certains outils).
function zipUneEntree(nom, contenu) {
  const brut = Buffer.from(contenu, 'utf8');
  const comp = zlib.deflateRawSync(brut);
  const n = Buffer.from(nom);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 6); local.writeUInt16LE(8, 8);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10);
  central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(brut.length, 24); central.writeUInt16LE(n.length, 28);
  central.writeUInt32LE(0, 42);
  const offCentral = local.length + n.length + comp.length;
  const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(1, 8); fin.writeUInt16LE(1, 10);
  fin.writeUInt32LE(central.length + n.length, 12); fin.writeUInt32LE(offCentral, 16);
  return Buffer.concat([local, n, comp, central, n, fin]);
}

function ligne(o) {
  const c = new Array(g.NB_COLONNES).fill('');
  c[g.COL.id] = o.id; c[g.COL.racine] = o.racine; c[g.COL.pays] = o.pays; c[g.COL.url] = o.url;
  c[g.COL.nbSources] = String(o.src || 1); c[g.COL.lieu] = o.lieu || '';
  return c.join('\t');
}

test('la table FIPS couvre les 54 pays, chacun une fois, et ne confond pas Niger et Nigeria', () => {
  const iso = Object.values(g.FIPS_VERS_ISO);
  assert.strictEqual(iso.length, 54);
  assert.strictEqual(new Set(iso).size, 54);
  assert.strictEqual(g.FIPS_VERS_ISO.NG, 'NE');
  assert.strictEqual(g.FIPS_VERS_ISO.NI, 'NG');
  // Autres paires piégeuses du FIPS : Congo/RDC, Gabon/Gambie, Zambie/Afrique du Sud.
  assert.strictEqual(g.FIPS_VERS_ISO.CF, 'CG');
  assert.strictEqual(g.FIPS_VERS_ISO.CG, 'CD');
  assert.strictEqual(g.FIPS_VERS_ISO.GB, 'GA');
  assert.strictEqual(g.FIPS_VERS_ISO.GA, 'GM');
  assert.strictEqual(g.FIPS_VERS_ISO.ZA, 'ZM');
  assert.strictEqual(g.FIPS_VERS_ISO.SF, 'ZA');
});

test('la table FIPS couvre exactement les pays des bulletins', () => {
  const { PAYS_BULLETIN } = require('../lib/bulletin');
  const attendus = (Array.isArray(PAYS_BULLETIN) ? PAYS_BULLETIN : Object.keys(PAYS_BULLETIN)).slice().sort();
  assert.deepStrictEqual(Object.values(g.FIPS_VERS_ISO).sort(), attendus);
});

test('lit un export zippé et ne garde que les familles de sûreté en Afrique', () => {
  const texte = [
    ligne({ id: '1', racine: '19', pays: 'NI', url: 'https://a.ng/1', src: 3, lieu: 'Maiduguri, Borno, Nigeria' }),
    ligne({ id: '2', racine: '19', pays: 'NI', url: 'https://a.ng/1', src: 3 }), // même article : une adresse
    ligne({ id: '3', racine: '04', pays: 'NI', url: 'https://a.ng/2' }), // consultation : écartée
    ligne({ id: '4', racine: '14', pays: 'NG', url: 'https://b.ne/1', lieu: 'Niamey, Niger' }),
    ligne({ id: '5', racine: '20', pays: 'FR', url: 'https://c.fr/1' }), // hors Afrique
  ].join('\n') + '\n';
  const ev = g.analyserExport(g.lireZip(zipUneEntree('20261118214500.export.CSV', texte)));
  assert.deepStrictEqual(ev.map((e) => e.id), ['1', '2', '4']);
  const a = g.agreger(ev);
  assert.deepStrictEqual(Object.keys(a), ['NE', 'NG']);
  assert.strictEqual(a.NG.articles, 1);
  assert.strictEqual(a.NG.reprisParPlusieursSources, 1);
  assert.deepStrictEqual(a.NE.familles, { manifestation: 1 });
});

test('un export au mauvais format échoue au lieu de compter de travers', () => {
  assert.throws(() => g.analyserExport('a\tb\tc\n'), /colonnes/);
});

test('les adresses remontent par quarts d\'heure depuis le dernier export annoncé', () => {
  const lu = '150383 297a16b493de7cf6ca809a7cc31d0b93 http://data.gdeltproject.org/gdeltv2/20261118214500.export.CSV.zip\n' +
    '318084 bb27f78ba45f69a17ea6ed7755e9f8ff http://data.gdeltproject.org/gdeltv2/20261118214500.mentions.CSV.zip\n';
  const d = g.dernierExport(lu);
  assert.strictEqual(d, '20261118214500');
  const a = g.adressesExports(d, 3);
  assert.deepStrictEqual(a.map((u) => u.split('/').pop()),
    ['20261118214500.export.CSV.zip', '20261118213000.export.CSV.zip', '20261118211500.export.CSV.zip']);
});

test('GDELT ne touche jamais au niveau d\'alerte', () => {
  // Rien de la page ni du noyau ne lit les fichiers GDELT : le jour où ils
  // seraient affichés, ce sera à côté du niveau, jamais dedans.
  const html = fs.readFileSync(path.join(__dirname, '../../web/SentiqS_Web.html'), 'utf8');
  const noyau = fs.readFileSync(path.join(__dirname, '../../web/js/noyau.js'), 'utf8');
  for (const src of [html, noyau]) assert.ok(!/gdelt-brut|gdelt-signaux/i.test(src));
});
