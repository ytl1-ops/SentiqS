#!/usr/bin/env node
// Interroge les 162 liens de conseils aux voyageurs des bulletins pays
// (scripts/lib/bulletin.js : FCDO, Département d'État, France Diplomatie,
// pour les 54 pays). Ils ont été écrits sans réseau le 13/11/2026 : un lien
// mort sous l'en-tête « Conseils officiels » d'un bulletin client vaut moins
// que pas de lien. Ce script le dit, depuis GitHub (le bac à sable n'a pas
// de réseau).
//
// Trois issues par lien : OK (2xx, après redirections), MORT (404/410), et
// NON CONCLUANT (403, 429, délai, erreur réseau : un site qui refuse les
// robots ne dit rien de l'existence de la page). Code de sortie 1 seulement
// s'il y a au moins un MORT et que --strict est passé.
const { PAYS_BULLETIN } = require('./lib/bulletin');

const DELAI_MS = 20000;

async function sonder(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), DELAI_MS);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (verification de liens)', Accept: 'text/html' } });
    return { code: r.status, finale: r.url };
  } catch (e) {
    return { code: 0, erreur: (e && e.name === 'AbortError') ? 'délai' : String((e && e.message) || e) };
  } finally { clearTimeout(t); }
}

(async () => {
  const liens = [];
  Object.keys(PAYS_BULLETIN).sort().forEach((cy) => PAYS_BULLETIN[cy].conseils.forEach((c) => liens.push({ cy, nom: c.nom, url: c.url })));
  const res = [];
  // Quatre à la fois : on ne martèle pas les sites de trois administrations.
  for (let i = 0; i < liens.length; i += 4) {
    const lot = liens.slice(i, i + 4);
    const r = await Promise.all(lot.map((l) => sonder(l.url)));
    lot.forEach((l, j) => res.push(Object.assign({}, l, r[j])));
  }
  const etat = (r) => (r.code >= 200 && r.code < 300 ? 'OK' : (r.code === 404 || r.code === 410) ? 'MORT' : 'NON CONCLUANT');
  const compte = { OK: 0, MORT: 0, 'NON CONCLUANT': 0 };
  res.forEach((r) => { compte[etat(r)]++; });
  res.filter((r) => etat(r) !== 'OK').forEach((r) => console.log(etat(r).padEnd(14) + r.cy + '  ' + (r.code || r.erreur) + '  ' + r.url));
  console.log('\nLiens : ' + res.length + ' — OK ' + compte.OK + ', morts ' + compte.MORT + ', non concluants ' + compte['NON CONCLUANT']);
  if (process.argv.includes('--strict') && compte.MORT) process.exit(1);
})();
