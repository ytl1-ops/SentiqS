#!/usr/bin/env node
// Lien vérifié entre le site et l'application Android (TWA), 13/11/2026.
//
// Android n'ouvre le site en plein écran, sans barre d'adresse, que si le
// domaine publie web/.well-known/assetlinks.json avec l'empreinte SHA-256 de
// la clé qui signe l'application. Cette empreinte n'existe qu'une fois l'app
// créée dans la Play Console (Intégrité de l'application > Signature) : elle
// est lue dans la variable TWA_SHA256 du dépôt (Settings > Variables), une ou
// plusieurs empreintes séparées par des virgules, et ce fichier est réécrit
// juste avant la publication sur Firebase Hosting. Sans variable, il garde
// une liste vide : l'application s'ouvre quand même, avec une barre d'adresse.
const fs = require('node:fs');
const path = require('node:path');

const PAQUET = 'com.sentiqs.veille';
const EMPREINTE_RE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function empreintes(texte) {
  return String(texte || '').split(/[,\s]+/).map((e) => e.trim().toUpperCase()).filter(Boolean)
    .map((e) => { if (!EMPREINTE_RE.test(e)) throw new Error('Empreinte SHA-256 illisible : ' + e); return e; });
}

function contenu(liste) {
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: PAQUET, sha256_cert_fingerprints: liste },
  }];
}

module.exports = { PAQUET, empreintes, contenu };

if (require.main === module) {
  const liste = empreintes(process.env.TWA_SHA256);
  const sortie = path.join(__dirname, '..', 'web', '.well-known', 'assetlinks.json');
  fs.writeFileSync(sortie, JSON.stringify(contenu(liste), null, 2) + '\n');
  console.log(liste.length ? `assetlinks.json : ${liste.length} empreinte(s).` : 'assetlinks.json : aucune empreinte (variable TWA_SHA256 absente).');
}
