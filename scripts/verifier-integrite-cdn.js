#!/usr/bin/env node
// Vérification RÉSEAU des empreintes SRI (audit du 15/11/2026).
//
// Le test hors ligne (scripts/test/integrite-cdn.test.js) exige une version
// exacte et une empreinte sur chaque script tiers. Il ne peut pas dire si
// l'empreinte est la BONNE : une empreinte fausse ne laisse pas passer un
// fichier modifié, elle bloque le vrai — la connexion Firebase cesserait de
// se charger pour tout le monde. Ce contrôle télécharge chaque fichier depuis
// le CDN, recalcule son sha384 et vérifie l'en-tête CORS sans lequel le
// navigateur refuse un script portant crossorigin. Lancé en CI, qui a le
// réseau ; en cas d'écart, il imprime l'empreinte réelle.
'use strict';
const crypto = require('node:crypto');
const { inventaire } = require('./lib/scripts-cdn.js');

(async () => {
  const vus = new Map();
  for (const x of inventaire()) if (!vus.has(x.url)) vus.set(x.url, x);
  let echecs = 0;
  for (const x of vus.values()) {
    try {
      const r = await fetch(x.url, { headers: { Origin: 'https://sentiqs-235ce.web.app' } });
      if (!r.ok) { console.log('✗ HTTP ' + r.status + ' ' + x.url); echecs++; continue; }
      const corps = Buffer.from(await r.arrayBuffer());
      const reel = 'sha384-' + crypto.createHash('sha384').update(corps).digest('base64');
      const acao = r.headers.get('access-control-allow-origin');
      const okHash = reel === x.integrity;
      const okCors = acao === '*' || acao === 'https://sentiqs-235ce.web.app';
      console.log((okHash && okCors ? '✓ ' : '✗ ') + x.url
        + (okHash ? '' : '\n    attendu ' + x.integrity + '\n    servi   ' + reel)
        + (okCors ? '' : '\n    en-tête CORS absent ou restreint : ' + acao));
      if (!okHash || !okCors) echecs++;
    } catch (e) {
      console.log('✗ injoignable ' + x.url + ' (' + (e.message || e) + ')'); echecs++;
    }
  }
  if (echecs) {
    console.log('\n' + echecs + ' script(s) dont l\'empreinte ou l\'en-tête CORS ne correspond pas : la page refuserait de les exécuter.');
    process.exit(1);
  }
  console.log('\n✓ ' + vus.size + ' scripts tiers : empreinte SRI et CORS conformes au fichier servi.');
})();
