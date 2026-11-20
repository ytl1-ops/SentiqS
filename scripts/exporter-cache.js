#!/usr/bin/env node
// Exporte le cache partagé (Firestore) dans un fichier, pour rejouer
// classify() dessus avec scripts/banc-tri.js. Lit avec le compte de service,
// comme le job qui publie (audit du 20/11/2026 : le bac à sable n'atteint pas
// Firestore, et une modification de lexique se mesure sur le cache réel).
//   FIREBASE_SERVICE_ACCOUNT=… node scripts/exporter-cache.js cache.json
const fs = require('node:fs');
const cache = require('./lib/cache-firestore-ecriture');
(async () => {
  const compte = cache.lireCompte(process.env.FIREBASE_SERVICE_ACCOUNT || '');
  if (!compte) { console.error('✗ FIREBASE_SERVICE_ACCOUNT absent ou illisible.'); process.exit(1); }
  const lu = await cache.lireCache(compte, fetch);
  if (!lu) { console.error('✗ Cache introuvable.'); process.exit(1); }
  fs.writeFileSync(process.argv[2] || 'cache.json', JSON.stringify({ articles: lu.articles }));
  console.log(`✓ ${lu.articles.length} articles exportés (cache du ${lu.updated_at}).`);
})().catch((e) => { console.error('✗ ' + (e && e.message || e)); process.exit(1); });
