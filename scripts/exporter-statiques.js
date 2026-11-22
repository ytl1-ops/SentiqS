#!/usr/bin/env node
'use strict';
// Écrit web/agent/{actus,agenda,validations}.json depuis Firestore (voir
// scripts/lib/exporter-statiques.js). Lancé par le job de collecte avant
// l'archive. Sans compte de service, ou si une lecture échoue, les fichiers
// déjà là sont gardés : un fichier périmé vaut mieux qu'un fichier vide.
const fs = require('fs');
const path = require('path');
const cacheFirestore = require('./lib/cache-firestore-ecriture');
const FR = require('./lib/firestore-rest');
const E = require('./lib/exporter-statiques');

const DOSSIER = path.join(__dirname, '..', 'web', 'agent');

function ecrire(nom, valeur) {
  const f = path.join(DOSSIER, nom + '.json');
  const texte = JSON.stringify(valeur) + '\n';
  if (fs.existsSync(f) && fs.readFileSync(f, 'utf8') === texte) return false;
  fs.mkdirSync(DOSSIER, { recursive: true });
  fs.writeFileSync(f, texte);
  return true;
}

async function principal() {
  const brut = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!brut) { console.log('Fichiers statiques de l\'agent : pas de compte de service, rien à faire.'); return; }
  const compte = JSON.parse(brut);
  const jeton = await cacheFirestore.jetonAcces(compte, fetch);
  const db = FR.client(compte.project_id, jeton, fetch);
  const jobs = [
    ['actus', 'actus_agent', E.actusPubliques],
    ['agenda', 'agenda_agent', E.agendaPublic],
    ['validations', 'validations', E.validationsPubliques],
  ];
  for (const [nom, collection, fn] of jobs) {
    try {
      const docs = await db.lister(collection, 5000);
      const sortie = fn(docs);
      console.log('Fichier statique ' + nom + ' : ' + sortie.length + ' entrée(s)' + (ecrire(nom, sortie) ? ' (modifié).' : ' (inchangé).'));
    } catch (e) {
      console.log('::warning::Fichier statique ' + nom + ' non mis à jour : ' + String(e.message || e).slice(0, 160));
    }
  }
}
principal().catch((e) => { console.log('::warning::Export statique : ' + String(e.message || e).slice(0, 200)); });
