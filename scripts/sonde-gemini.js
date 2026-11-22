'use strict';
// Sonde de Gemini depuis un runner (le bac à sable de développement
// n'atteint pas generativelanguage.googleapis.com) — 20/11/2026. Traduit trois titres types,
// dans les deux sens, et dit ce qui a répondu. Informative : n'échoue jamais,
// et n'imprime jamais la clé.
const modeles = require('./lib/gemini');

const ESSAIS = [
  ['fr', 'en', ['Attaque armée contre un convoi de l\'armée près de Djibo', 'Grève générale des transporteurs à Abidjan']],
  ['en', 'fr', ['Gunmen kill three soldiers in northern Nigeria']],
  ['pt', 'fr', ['Ataque armado mata doze pessoas em Cabo Delgado']],
];

(async () => {
  modeles.reinitialiser({ maxRequetes: ESSAIS.length });
  if (!modeles.disponible()) {
    console.log('Secret GEMINI_API_KEY absent : rien à sonder. ' + modeles.bilan() + '.');
    return;
  }
  for (const [src, cible, lignes] of ESSAIS) {
    const t0 = Date.now();
    const out = await modeles.traduireLignes(lignes, src, cible);
    console.log(src + ' → ' + cible + ' (' + (Date.now() - t0) + ' ms) : ' + (out ? JSON.stringify(out) : 'aucune traduction'));
  }
  console.log(modeles.bilan() + '.');
})().catch((e) => { console.log('Sonde interrompue : ' + ((e && e.message) || e)); });
