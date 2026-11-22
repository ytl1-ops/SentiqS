#!/usr/bin/env node
// Imprime le tableau de capacité (voir scripts/lib/capacite.js). Aucun réseau.
const { calculer, QUOTAS } = require('./lib/capacite.js');
for (const [titre, o] of [['État au 22/11/2026', {}], ['Avec le contenu partagé servi en fichiers statiques', { contenuStatique: true }]]) {
  const m = calculer(Object.assign({ utilisateurs: 50000 }, o));
  console.log('\n' + titre + ' — ' + m.actifsJour + ' actifs/jour, ' + m.lectures_par_ouverture + ' lectures par ouverture');
  for (const [k, v] of Object.entries(m.lignes)) console.log('  ' + k.padEnd(26) + String(v.besoin).padStart(10) + ' / ' + String(v.quota).padEnd(8) + (v.besoin > v.quota ? 'DÉPASSE ×' + (v.besoin / v.quota).toFixed(1) : 'ok'));
}
