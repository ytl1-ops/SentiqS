#!/usr/bin/env node
// Retour arrière depuis une sauvegarde chiffrée (22/11/2026).
//
//   node scripts/restaurer-firestore.js <sauvegarde.json.enc> --compte <compte-service.json>
//        → lit la sauvegarde et dit ce qu'elle contient. Ne touche à rien.
//   ... --collections profiles,paiements_declares --appliquer
//        → réécrit ces documents dans Firestore, à l'identique.
//   ... --dechiffrer sortie.json
//        → écrit la sauvegarde en clair sur ce PC (données personnelles :
//          ne pas la laisser traîner, ne jamais la mettre dans le dépôt).
//
// Le compte se lit dans le fichier JSON du compte de service (--compte) ou
// dans FIREBASE_SERVICE_ACCOUNT. La restauration ne SUPPRIME jamais un
// document : un document créé après la sauvegarde reste en place.
// --appliquer exige --collections : on restaure ce qu'on a choisi, pas tout
// par réflexe (réécrire « collecte_partagee » remettrait un cache d'actus
// vieux d'une semaine).
const fs = require('node:fs');
const { lireCompte, jetonAcces } = require('./lib/cache-firestore-ecriture');
const { dechiffrer } = require('./lib/sauvegarde-chiffree');

function options(argv) {
  const o = { fichier: null, compte: null, collections: null, appliquer: false, dechiffrer: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--compte') o.compte = argv[++i];
    else if (a === '--collections') o.collections = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--appliquer') o.appliquer = true;
    else if (a === '--dechiffrer') o.dechiffrer = argv[++i];
    else if (!o.fichier) o.fichier = a;
  }
  return o;
}

async function restaurer(sauvegarde, compte, collections, f) {
  const jeton = await jetonAcces(compte, f);
  const base = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(compte.project_id) + '/databases/(default)/documents';
  const entetes = { Authorization: 'Bearer ' + jeton, 'content-type': 'application/json' };
  const bilan = {};
  for (const c of collections) {
    const docs = sauvegarde.collections[c];
    if (!docs) throw new Error('collection absente de la sauvegarde : ' + c);
    let n = 0;
    for (const d of docs) {
      const r = await f(base + '/' + encodeURIComponent(c) + '/' + encodeURIComponent(d.id), { method: 'PATCH', headers: entetes, body: JSON.stringify({ fields: d.fields }) });
      if (!r.ok) throw new Error('écriture de ' + c + '/' + d.id + ' refusée (HTTP ' + r.status + ') après ' + n + ' document(s)');
      n++;
    }
    bilan[c] = n;
  }
  return bilan;
}

async function main() {
  const o = options(process.argv.slice(2));
  if (!o.fichier) { console.error('Usage : node scripts/restaurer-firestore.js <sauvegarde.json.enc> --compte <compte-service.json> [--collections a,b --appliquer] [--dechiffrer sortie.json]'); process.exit(2); }
  const compte = lireCompte(o.compte ? fs.readFileSync(o.compte, 'utf8') : process.env.FIREBASE_SERVICE_ACCOUNT);
  if (!compte) { console.error('Compte de service introuvable : --compte <fichier.json> ou FIREBASE_SERVICE_ACCOUNT.'); process.exit(2); }
  const s = dechiffrer(fs.readFileSync(o.fichier, 'utf8'), compte.private_key);
  console.log('Sauvegarde du ' + s.date + ', projet ' + s.projet + ' :');
  Object.keys(s.collections).forEach((c) => console.log('  ' + c + ' : ' + s.collections[c].length + ' document(s)'));
  if (s.projet !== compte.project_id) { console.error('Projet différent (' + compte.project_id + ') : rien n\'est fait.'); process.exit(1); }
  if (o.dechiffrer) { fs.writeFileSync(o.dechiffrer, JSON.stringify(s, null, 1)); console.log('Écrit en clair : ' + o.dechiffrer + ' (données personnelles, à effacer après usage).'); }
  if (!o.appliquer) { console.log('Lecture seule. Pour restaurer : --collections <noms> --appliquer'); return; }
  if (!o.collections || !o.collections.length) { console.error('--appliquer exige --collections <noms séparés par des virgules>.'); process.exit(2); }
  const bilan = await restaurer(s, compte, o.collections, fetch);
  Object.keys(bilan).forEach((c) => console.log('Restauré : ' + c + ' (' + bilan[c] + ')'));
}

if (require.main === module) main().catch((e) => { console.error('Restauration impossible :', e.message || e); process.exit(1); });
module.exports = { options, restaurer };
