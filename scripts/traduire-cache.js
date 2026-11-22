#!/usr/bin/env node
'use strict';
// Passage de traduction seul, entre deux collectes — 19/11/2026.
//
// Demande de YORO : « Boost le skill de traduction via GitHub. » La collecte
// planifiée traduit les actus (scripts/lib/traduction-actus.js), mais avec un
// budget de 3 min par passage, et GitHub n'en lance qu'un toutes les 3 h 24 à
// 5 h 51 : l'arriéré d'un cache de 2 000 articles prend une journée. Ce
// script, lancé toutes les heures par .github/workflows/traduction-actus.yml,
// ne fait QUE traduire, avec un budget de 8 min :
//
//   1. lit le cache partagé (Firestore) ;
//   2. détecte la langue de chaque titre et chapô avec la VRAIE page, servie
//      en local dans Chromium (rien n'est réimplémenté à côté) ;
//   3. traduit ce qui manque, FR et EN (mêmes services gratuits, sans clé) ;
//   4. relit l'annonce juste avant d'écrire : si une collecte a publié entre
//      deux, les traductions sont reportées sur SON cache, jamais l'inverse ;
//   5. réécrit le cache en gardant sa date de publication (updated_at) : un
//      cache traduit n'est pas un cache plus frais, et le faire croire
//      masquerait une collecte arrêtée (COLLECTE_PARTAGEE_LECTURE_MAX_MS).
//
// Rien n'est écrit quand rien n'a été traduit.
//
//   6. sert les demandes de traduction déposées par les navigateurs
//      (scripts/lib/traductions-partagees-job.js, 20/11/2026) : ce que les
//      visiteurs ont ouvert sans le trouver traduit est traduit ici, une fois,
//      et rangé pour tous. Les navigateurs n'écrivent jamais de traduction
//      partagée.

const http = require('http');
const fs = require('fs');
const path = require('path');
const cacheFirestore = require('./lib/cache-firestore-ecriture');
const { traduireActus, memoire, cleMemoire, CIBLES } = require('./lib/traduction-actus');
const { servirDemandes } = require('./lib/traductions-partagees-job');

const BUDGET_MS = Number(process.env.TRAD_BUDGET_MS || 8 * 60 * 1000);
const RACINE = path.join(__dirname, '..', 'web');

// Reporte sur `articles` les traductions de la mémoire (clé = langue + texte).
// Rend le nombre de champs posés. Pur : testé par traduire-cache.test.js.
function reporterTraductions(articles, mem) {
  let n = 0;
  (articles || []).forEach((a) => {
    if (!a) return;
    CIBLES.forEach((c) => {
      [['t', a.title], ['s', a.analysis]].forEach(([champ, texte]) => {
        if (!texte) return;
        const v = mem.get(cleMemoire(c, texte));
        if (!v || (a.tr && a.tr[c] && a.tr[c][champ] === v)) return;
        if (!a.tr || typeof a.tr !== 'object') a.tr = {};
        if (!a.tr[c]) a.tr[c] = {};
        a.tr[c][champ] = v;
        n++;
      });
    });
  });
  return n;
}

async function detecterLangues(textes) {
  const { chromium } = require('playwright');
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css' };
  const serveur = http.createServer((req, res) => {
    const f = path.join(RACINE, decodeURIComponent(String(req.url).split('?')[0].split('#')[0]));
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => serveur.listen(0, r));
  const base = 'http://localhost:' + serveur.address().port;
  const nav = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await nav.newPage();
    // La page n'a besoin d'aucun réseau pour détecter une langue.
    await page.route('**', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
    await page.goto(base + '/SentiqS_Web.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => typeof langueSure === 'function', null, { timeout: 30000 });
    return await page.evaluate((liste) => {
      const aff = (t) => (typeof _trTexteAffichable === 'function' ? _trTexteAffichable(t) : t);
      return {
        langues: liste.map((t) => langueSure(aff(t)) || (detectLangue(aff(t)) === 'other' ? 'other' : null)),
        resumeMax: typeof EXTRAIT_MAX_CARACTERES === 'number' ? EXTRAIT_MAX_CARACTERES + 40 : 320,
      };
    }, textes);
  } finally {
    await nav.close();
    serveur.close();
  }
}

async function principal() {
  const compte = cacheFirestore.lireCompte(process.env.FIREBASE_SERVICE_ACCOUNT || '');
  if (!compte) { console.log('FIREBASE_SERVICE_ACCOUNT absent ou illisible : rien à traduire.'); return; }
  const debut = Date.now();
  try {
    await passageCache(compte, debut);
  } catch (e) {
    console.warn('::warning::Traduction du cache non terminée : ' + ((e && e.message) || e));
  }
  // Les demandes des navigateurs passent après le cache, dans le même budget
  // (deux minutes de plus au plus : le cache est ce que tout le monde lit).
  try {
    const d = await servirDemandes(compte, fetch, { echeance: debut + BUDGET_MS + 2 * 60 * 1000 });
    console.log('Demandes de traduction des navigateurs : ' + d.lues + ' lue(s), ' + d.traduites + ' traduite(s) et rangée(s) pour tous, '
      + d.dejaRangees + ' déjà rangée(s), ' + d.echecs + ' échec(s) (gardées), ' + d.perimees + ' périmée(s), ' + d.invalides + ' invalide(s), '
      + d.reportees + ' reportée(s).');
  } catch (e) {
    console.warn('::warning::Demandes de traduction non servies : ' + ((e && e.message) || e));
  }
}

async function passageCache(compte, debut) {
  const lu = await cacheFirestore.lireCache(compte, fetch);
  if (!lu || !lu.articles.length) { console.log('Cache partagé vide ou illisible : rien à traduire.'); return; }
  const articles = lu.articles;
  const textes = [...new Set(articles.flatMap((a) => [a && a.title, a && a.analysis]).filter((t) => typeof t === 'string' && t))];
  const det = await detecterLangues(textes);
  const langues = new Map(textes.map((t, i) => [t, det.langues[i]]));
  const st = await traduireActus(articles, { existants: articles, langues, resumeMax: det.resumeMax, echeance: debut + BUDGET_MS });
  console.log('Traduction des actus (FR/EN, passage seul) : ' + st.repris + ' reprise(s), ' + st.traduits + ' nouvelle(s), '
    + st.echecs + ' échec(s), ' + st.reportes + ' reportée(s), ' + st.requetes + ' requête(s), en ' + Math.round((Date.now() - debut) / 1000) + ' s.');
  console.log(require('./lib/gemini').bilan() + '.');
  if (!st.traduits) { console.log('Aucune traduction nouvelle : le cache n\'est pas réécrit.'); return; }

  // Une collecte a pu publier pendant ce passage : on relit, et on reporte.
  let cible = articles;
  let date = lu.updated_at;
  const frais = await cacheFirestore.lireCache(compte, fetch);
  if (frais && frais.updated_at !== lu.updated_at) {
    cible = frais.articles;
    date = frais.updated_at;
    const n = reporterTraductions(cible, memoire(articles));
    console.log('Une collecte a publié pendant ce passage : ' + n + ' traduction(s) reportée(s) sur son cache.');
  }
  const pub = await cacheFirestore.ecrireCache(compte, cible, fetch, { maintenant: date });
  console.log('Cache réécrit avec ses traductions : ' + pub.nbArticles + ' articles, date de publication gardée (' + date + ').');
}

if (require.main === module) {
  principal().catch((e) => {
    // Jamais rouge pour une traduction : le cache d'avant reste en place.
    console.warn('::warning::Passage de traduction non terminé : ' + ((e && e.message) || e));
  });
}

module.exports = { reporterTraductions };
