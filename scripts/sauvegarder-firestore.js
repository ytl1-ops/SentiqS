#!/usr/bin/env node
// Sauvegarde hebdomadaire et chiffrée de Firestore (22/11/2026).
// Voir scripts/lib/sauvegarde-chiffree.js pour le pourquoi du chiffrement.
//
//   FIREBASE_SERVICE_ACCOUNT='{...}' node scripts/sauvegarder-firestore.js [dossier]
//
// Écrit <dossier>/sauvegarde-firebase-AAAA-MM-JJ.json.enc (défaut :
// ./sauvegardes). Les documents sont gardés tels que l'API REST les rend
// (champs typés) : la restauration les réécrit à l'identique, horodatages
// compris. Rien n'est jamais effacé dans Firestore par ce script.
const fs = require('node:fs');
const path = require('node:path');
const { lireCompte, jetonAcces } = require('./lib/cache-firestore-ecriture');
const { chiffrer } = require('./lib/sauvegarde-chiffree');

// Collections que le job reconstruit tout seul : inutile de les garder, et
// « traductions » compte des milliers de documents (quota gratuit de
// 50 000 lectures par jour).
const IGNOREES = new Set(['traductions', 'traductions_demandes', 'bulletins_instantanes']);
const MAX_PAR_COLLECTION = 20000;

function racine(projet) {
  return 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(projet) + '/databases/(default)/documents';
}

async function collections(base, entetes, f) {
  const ids = [];
  let page = '';
  do {
    const r = await f(base + ':listCollectionIds', { method: 'POST', headers: entetes, body: JSON.stringify({ pageSize: 100, pageToken: page || undefined }) });
    if (!r.ok) throw new Error('liste des collections refusée (HTTP ' + r.status + ')');
    const d = await r.json();
    (d.collectionIds || []).forEach((c) => ids.push(c));
    page = d.nextPageToken || '';
  } while (page);
  return ids.sort();
}

async function documents(base, coll, entetes, f) {
  const out = [];
  let page = '';
  do {
    const r = await f(base + '/' + encodeURIComponent(coll) + '?pageSize=300' + (page ? '&pageToken=' + encodeURIComponent(page) : ''), { headers: entetes });
    if (!r.ok) throw new Error('lecture de ' + coll + ' refusée (HTTP ' + r.status + ')');
    const d = await r.json();
    (d.documents || []).forEach((doc) => out.push({ id: String(doc.name).split('/').pop(), fields: doc.fields || {}, updateTime: doc.updateTime }));
    page = d.nextPageToken || '';
  } while (page && out.length < MAX_PAR_COLLECTION);
  return out;
}

async function sauvegarder(compte, f, maintenant) {
  const jeton = await jetonAcces(compte, f);
  const entetes = { Authorization: 'Bearer ' + jeton, 'content-type': 'application/json' };
  const base = racine(compte.project_id);
  const res = { format: 'sentiqs-firestore', projet: compte.project_id, date: new Date(maintenant || Date.now()).toISOString(), collections: {} };
  for (const c of await collections(base, entetes, f)) {
    if (IGNOREES.has(c)) continue;
    res.collections[c] = await documents(base, c, entetes, f);
  }
  return res;
}

async function main() {
  const compte = lireCompte(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (!compte) { console.error('FIREBASE_SERVICE_ACCOUNT absent ou illisible : aucune sauvegarde.'); process.exit(1); }
  const dossier = path.resolve(process.argv[2] || 'sauvegardes');
  const res = await sauvegarder(compte, fetch);
  fs.mkdirSync(dossier, { recursive: true });
  const nom = 'sauvegarde-firebase-' + res.date.slice(0, 10) + '.json.enc';
  fs.writeFileSync(path.join(dossier, nom), chiffrer(res, compte.private_key));
  const lignes = Object.keys(res.collections).map((c) => '  ' + c + ' : ' + res.collections[c].length);
  console.log('Sauvegarde chiffrée écrite : ' + nom + '\n' + lignes.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Sauvegarde Firebase ' + res.date.slice(0, 10) + '\n\n' + lignes.map((l) => '-' + l.trim().replace(/^/, ' ')).join('\n') + '\n'); } catch (_) {}
  }
}

if (require.main === module) main().catch((e) => { console.error('Sauvegarde impossible :', e.message || e); process.exit(1); });
module.exports = { sauvegarder, IGNOREES };
