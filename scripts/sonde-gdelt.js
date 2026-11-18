#!/usr/bin/env node
// Sonde GDELT (18/11/2026) : mesure, depuis GitHub (le bac à sable n'a pas
// de réseau), ce que rapporte chaque requête du registre — avec et sans le
// filtre de thèmes — et à quoi ressemble un article du flux RSS que la page
// lira. Informative : elle ne change rien et n'échoue jamais une PR.
'use strict';
const g = require('./lib/gdelt');

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const sansAccent = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function lire(url, texte) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'SentiqS-sonde/1.0' }, signal: AbortSignal.timeout(30000) });
    const corps = await r.text();
    return { code: r.status, corps };
  } catch (e) { return { code: 0, corps: String(e.message || e) }; }
}

(async () => {
  const lignes = ['## Sonde GDELT', '', '| Requête | Thèmes | HTTP | Articles | Pays nommés | Plus récent | Plus ancien |', '|---|---|---:|---:|---:|---:|---:|'];
  const exemples = [];
  for (const r of g.REQUETES) {
    for (const themes of [true, false]) {
      const { code, corps } = await lire(g.urlGdelt(r, { format: 'json', themes, max: 250 }));
      let arts = [];
      try { arts = (JSON.parse(corps).articles) || []; } catch (_) { if (code === 200) console.log(r.id, 'réponse non JSON :', corps.slice(0, 200)); }
      const nommes = new Set();
      arts.forEach((a) => r.pays.forEach((p) => { if (sansAccent(a.title).includes(sansAccent(p))) nommes.add(p); }));
      const dates = arts.map((a) => Date.parse(String(a.seendate || '').replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/, '$1-$2-$3T$4:$5:$6Z'))).filter(isFinite);
      const age = (ms) => (ms ? Math.round((Date.now() - ms) / 3600000) + ' h' : '—');
      lignes.push('| ' + r.id + ' | ' + (themes ? 'oui' : 'non') + ' | ' + code + ' | ' + arts.length + ' | ' + nommes.size + '/' + r.pays.length
        + ' | ' + age(dates.length ? Math.max(...dates) : 0) + ' | ' + age(dates.length ? Math.min(...dates) : 0) + ' |');
      console.log(r.id, themes ? 'thèmes' : 'tout', 'HTTP', code, arts.length, 'articles', [...nommes].join(', ') || '(aucun pays dans les titres)');
      if (themes) arts.slice(0, 4).forEach((a) => exemples.push('- ' + r.id + ' : ' + a.title + ' (' + a.domain + ', ' + a.language + ')'));
      if (code !== 200) console.log('  corps :', corps.slice(0, 200));
      await pause(g.DELAI_MIN_MS);
    }
  }
  // Forme exacte du RSS que la page lira (parseRSS).
  const rss = await lire(g.urlGdelt(g.REQUETES[0]));
  const item = (/<item>[\s\S]*?<\/item>/.exec(rss.corps) || [''])[0];
  console.log('RSS HTTP', rss.code, '— premier article :\n' + item.slice(0, 1200));
  const robots = await lire('https://api.gdeltproject.org/robots.txt');
  console.log('robots.txt HTTP', robots.code, ':', robots.corps.slice(0, 300));
  lignes.push('', '### Exemples (filtre de thèmes)', '', ...exemples, '', '### Premier article du flux RSS', '', '```xml', item.slice(0, 1200), '```');
  if (process.env.GITHUB_STEP_SUMMARY) require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, lignes.join('\n') + '\n');
  console.log(lignes.join('\n'));
})();
