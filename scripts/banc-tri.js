#!/usr/bin/env node
// Banc de mesure du tri : rejoue classify() — la vraie, extraite du fichier
// de production — sur les articles d'un cache reel, et montre ce qui depasse
// le niveau normal, avec le mot qui l'a fait monter.
//
// POURQUOI : toute modification d'un lexique ou d'une regle de classify()
// doit etre mesuree sur des articles reels AVANT d'etre proposee (voir
// CLAUDE.md). Ce banc rend la mesure reproductible : meme entree, meme
// sortie, comparables d'un commit a l'autre.
//
// Usage :
//   node scripts/banc-tri.js [cache.json]     (par defaut : lit Supabase)
//   node scripts/banc-tri.js --diff avant.json  compare a une sortie precedente
//
// Le cache est la ligne « global » de collecte_partagee : { articles: [...] }
// ou directement un tableau d'articles.
const fs = require('node:fs');
const path = require('node:path');
const { bac, exposer } = require('./test/_bac.js');

// SENTINEL_HTML_PATH permet de rejouer une AUTRE version de la page (par
// exemple celle de main, extraite par git show) pour produire la reference
// « avant » d'une comparaison.
const CHEMIN_HTML = process.env.SENTINEL_HTML_PATH || path.join(__dirname, '..', 'web', 'SentiqS_Web.html');
const HTML = fs.readFileSync(CHEMIN_HTML, 'utf8');
function trancheDe(debut, fin) {
  const i = HTML.indexOf(debut); const j = HTML.indexOf(fin, i);
  if (i === -1 || j === -1) throw new Error('marqueur introuvable : ' + debut);
  return HTML.slice(i, j);
}
const ctx = exposer(bac(trancheDe('const CK_CRIT', '//  FIABILITÉ & ANTI-HALLUCINATION')),
  'classify', 'CK_CRIT', 'CK_HIGH', 'matchMot', 'normaliserAccents', 'neutraliserExpressions');

function chargerArticles(arg) {
  const brut = JSON.parse(fs.readFileSync(arg, 'utf8'));
  if (Array.isArray(brut) && brut[0] && Array.isArray(brut[0].articles)) return brut[0].articles;
  if (brut && Array.isArray(brut.articles)) return brut.articles;
  if (Array.isArray(brut)) return brut;
  throw new Error('format de cache inconnu');
}

async function lireSupabase() {
  const url = (HTML.match(/SENTINEL_SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1];
  const key = (HTML.match(/SENTINEL_SUPABASE_ANON_KEY\s*=\s*'([^']+)'/) || [])[1];
  const r = await fetch(url + '/rest/v1/collecte_partagee?select=articles&id=eq.global',
    { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  if (!r.ok) throw new Error('Supabase HTTP ' + r.status);
  return (await r.json())[0].articles;
}

function texteDe(a) {
  const corps = (a.analysis && !/^(Resume non disponible|voir sur )/i.test(a.analysis)) ? a.analysis : '';
  return a.title + ' ' + corps;
}

function rejouer(arts) {
  const lignes = [];
  const compte = { crit: 0, high: 0, mod: 0, ok: 0 };
  for (const a of arts) {
    const r = ctx.classify(texteDe(a), { cy: a.cy, cat: a.cat }, a.title);
    compte[r.lvl] = (compte[r.lvl] || 0) + 1;
    if (r.lvl === 'ok') continue;
    const tTitre = ctx.neutraliserExpressions(ctx.normaliserAccents((a.title || '').toLowerCase()));
    const tTout = ctx.neutraliserExpressions(ctx.normaliserAccents(texteDe(a).toLowerCase()));
    const dansTitre = [...ctx.CK_CRIT, ...ctx.CK_HIGH].filter((w) => ctx.matchMot(tTitre, w));
    const dansCorps = [...ctx.CK_CRIT, ...ctx.CK_HIGH].filter((w) => ctx.matchMot(tTout, w) && !dansTitre.includes(w));
    lignes.push({ lvl: r.lvl, cy: a.cy, title: a.title, titre: dansTitre, corps: dansCorps, avant: a.level });
  }
  const ordre = { crit: 0, high: 1, mod: 2 };
  lignes.sort((x, y) => ordre[x.lvl] - ordre[y.lvl] || x.cy.localeCompare(y.cy));
  return { compte, lignes };
}

(async () => {
  const args = process.argv.slice(2);
  const iDiff = args.indexOf('--diff');
  const refPath = iDiff !== -1 ? args[iDiff + 1] : null;
  const fichier = args.find((a, i) => !a.startsWith('--') && (iDiff === -1 || i !== iDiff + 1));
  const arts = fichier ? chargerArticles(fichier) : await lireSupabase();
  const { compte, lignes } = rejouer(arts);

  console.log('Articles : ' + arts.length + '  —  crit ' + compte.crit + ' · high ' + compte.high + ' · mod ' + compte.mod + ' · ok ' + compte.ok);
  const changes = lignes.filter((l) => l.avant && l.avant !== l.lvl).length
    + arts.filter((a) => a.level && a.level !== 'ok' && !lignes.some((l) => l.title === a.title && l.cy === a.cy)).length;
  console.log('Niveaux differents de ceux stockes dans le cache : ' + changes);
  console.log();
  for (const l of lignes) {
    const cause = l.titre.length ? 'titre: ' + l.titre.join(',') : (l.corps.length ? 'corps: ' + l.corps.join(',') : 'pays a risque + lien securite dans le titre');
    console.log('  ' + l.lvl.padEnd(4) + ' ' + l.cy.padEnd(3) + ' ' + l.title.slice(0, 66).padEnd(66) + '  <- ' + cause + (l.avant && l.avant !== l.lvl ? '   (cache: ' + l.avant + ')' : ''));
  }
  const sortie = { compte, lignes: lignes.map((l) => ({ lvl: l.lvl, cy: l.cy, title: l.title })) };
  if (refPath) {
    const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));
    const cle = (l) => l.cy + '|' + l.title;
    const avant = new Map(ref.lignes.map((l) => [cle(l), l.lvl]));
    const apres = new Map(sortie.lignes.map((l) => [cle(l), l.lvl]));
    console.log('\nPar rapport a ' + refPath + ' :');
    for (const [k, v] of avant) if (!apres.has(k)) console.log('  descend au normal : ' + k.slice(0, 80) + '  (etait ' + v + ')');
    for (const [k, v] of apres) if (!avant.has(k)) console.log('  monte au-dessus du normal : ' + k.slice(0, 80) + '  (' + v + ')');
    for (const [k, v] of apres) if (avant.has(k) && avant.get(k) !== v) console.log('  change : ' + k.slice(0, 80) + '  ' + avant.get(k) + ' -> ' + v);
  }
  const out = path.join(process.cwd(), 'banc-tri.json');
  fs.writeFileSync(out, JSON.stringify(sortie, null, 1));
  console.log('\nEcrit dans ' + out);
})().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
