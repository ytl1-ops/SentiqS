'use strict';
// Sonde de GitHub Models depuis un runner (le bac à sable de développement
// n'atteint pas models.github.ai) — 20/11/2026. Traduit trois titres types,
// dans les deux sens, et dit ce qui a répondu. Informative : n'échoue jamais.
const modeles = require('./lib/github-models');

const ESSAIS = [
  ['fr', 'en', ['Attaque armée contre un convoi de l\'armée près de Djibo', 'Grève générale des transporteurs à Abidjan']],
  ['en', 'fr', ['Gunmen kill three soldiers in northern Nigeria']],
  ['pt', 'fr', ['Ataque armado mata doze pessoas em Cabo Delgado']],
];

(async () => {
  modeles.reinitialiser({ maxRequetes: ESSAIS.length });
  for (const [src, cible, lignes] of ESSAIS) {
    const t0 = Date.now();
    const out = await modeles.traduireLignes(lignes, src, cible);
    console.log(src + ' → ' + cible + ' (' + (Date.now() - t0) + ' ms) : ' + (out ? JSON.stringify(out) : 'aucune traduction'));
  }
  console.log(modeles.bilan());
})().catch((e) => { console.log('Sonde interrompue : ' + ((e && e.message) || e)); });

// Diagnostic brut (20/11/2026) : le premier lancement a reçu « OK » au lieu
// d'une réponse JSON. On montre code, type et début du corps de trois points
// d'accès, sans jamais imprimer le jeton.
(async () => {
  await new Promise((r) => setTimeout(r, 1500));
  const jeton = String(process.env.GITHUB_TOKEN || '');
  const corps = JSON.stringify({ model: 'openai/gpt-4o-mini', messages: [{ role: 'user', content: 'Say hi' }] });
  const essais = [
    ['GET catalogue', 'https://models.github.ai/catalog/models', { method: 'GET' }],
    ['POST inference', 'https://models.github.ai/inference/chat/completions', { method: 'POST', body: corps }],
    ['POST ancien point (Azure)', 'https://models.inference.ai.azure.com/chat/completions', { method: 'POST', body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Say hi' }] }) }],
  ];
  for (const [nom, url, init] of essais) {
    try {
      const r = await fetch(url, { ...init, redirect: 'manual', headers: { Authorization: 'Bearer ' + jeton, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' } });
      const t = (await r.text()).replace(/\s+/g, ' ').slice(0, 200);
      console.log('[diag] ' + nom + ' : HTTP ' + r.status + ' ' + (r.headers.get('content-type') || '?') + ' ' + (r.headers.get('location') || '') + ' | ' + t);
    } catch (e) { console.log('[diag] ' + nom + ' : ' + ((e && e.message) || e)); }
  }
})();
