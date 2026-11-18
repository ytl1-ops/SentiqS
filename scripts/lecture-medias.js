#!/usr/bin/env node
'use strict';
// Lecture éditoriale des médias qui pourraient sortir un pays de la source
// unique (demande de YORO du 18/11/2026 : « brise les limites »).
//
// 21 pays n'ont qu'une source capable d'alerter, et c'est toujours la même :
// AllAfrica, qui publie une fois par jour au mieux. Le registre a pourtant,
// pour presque tous, des médias locaux à flux natif notés 68 — sous le seuil
// de 70 parce que leur note de 72 avait été posée en bloc sans lecture (voir
// CLAUDE.md, « Les quatre arbitrages du 07/09/2026 », point 3). Le chemin de
// retour écrit là-bas est une lecture, média par média. Ce script la prépare :
//
//   A. pour chaque média natif noté sous 70 d'un pays à source unique : le
//      flux répond-il depuis GitHub, à quel rythme publie-t-il, et que fait
//      la vraie classify() de ses titres (le mot qui fait monter chaque
//      titre au-dessus du normal, pour juger le faux positif) ;
//   B. pour chaque source de ces pays qui ne passe que par une requête
//      Google News (donc muette par construction) : existe-t-il un flux
//      natif, vu depuis GitHub.
//
// Informatif : n'écrit rien dans le registre, ne note personne. Le bac à
// sable n'atteint pas ces sites ; à lancer depuis GitHub
// (.github/workflows/lecture-medias.yml).
//
//   node scripts/lecture-medias.js [sortie.json]

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { peutAlerter, estRequeteGoogleNews } = require('./lib/capacite-alerte');
const { decouvrirMeilleurFlux } = require('./lib/decouverte-source');
const { bac, exposer } = require('./test/_bac.js');

const SORTIE = process.argv[2] || '';
const HTML = fs.readFileSync(path.join(__dirname, '..', 'web', 'SentiqS_Web.html'), 'utf8');
const SEUIL = Number(/\(a\.score \|\| 0\) >= (\d+)/.exec(HTML)[1]);

function tranche(debut, fin) {
  const i = HTML.indexOf(debut); const j = HTML.indexOf(fin, i);
  if (i === -1 || j === -1) throw new Error('marqueur introuvable : ' + debut);
  return HTML.slice(i, j);
}
const ctx = exposer(bac(tranche('const CK_CRIT', '//  FIABILITÉ & ANTI-HALLUCINATION')),
  'classify', 'CK_CRIT', 'CK_HIGH', 'matchMot', 'normaliserAccents', 'neutraliserExpressions');

const i = HTML.indexOf('const SRCS=['); const j = HTML.indexOf('\n];', i);
const reg = {}; vm.createContext(reg);
vm.runInContext(HTML.slice(i, j) + '\n];\nthis.SRCS = SRCS;', reg);
const SRCS = reg.SRCS.filter((s) => s && s.cy && s.cy !== 'INT');

const parPays = {};
for (const s of SRCS) (parPays[s.cy] = parPays[s.cy] || []).push(s);
const uniques = Object.keys(parPays).filter((cy) => parPays[cy].filter((s) => peutAlerter(s, SEUIL)).length === 1).sort();

const UA = 'Mozilla/5.0 (compatible; SentiqS-veille/1.0; lecture editoriale)';
async function lire(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(25000), redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return (await r.text()).replace(/^[\s﻿]+/, '');
}

const decoder = (s) => (s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();
const balise = (bloc, noms) => { for (const n of noms) { const m = new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>', 'i').exec(bloc); if (m) return decoder(m[1]); } return ''; };

function analyser(xml) {
  const blocs = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocs.map((b) => {
    const date = Date.parse(balise(b, ['pubDate', 'published', 'updated', 'dc:date']));
    return { titre: balise(b, ['title']), resume: balise(b, ['description', 'summary', 'content:encoded', 'content']).slice(0, 600), date: Number.isFinite(date) ? date : null };
  }).filter((a) => a.titre);
}

function motDeclencheur(titre, texte) {
  const t = ctx.neutraliserExpressions(ctx.normaliserAccents(texte.toLowerCase()));
  const tt = ctx.neutraliserExpressions(ctx.normaliserAccents(titre.toLowerCase()));
  const listes = [].concat(ctx.CK_CRIT || [], ctx.CK_HIGH || []);
  const dansTitre = listes.find((k) => ctx.matchMot(tt, k));
  return dansTitre ? dansTitre + ' (titre)' : (listes.find((k) => ctx.matchMot(t, k)) || '?') + ' (corps)';
}

(async () => {
  const maintenant = Date.now();
  const rapport = { seuil: SEUIL, uniques, medias: [], agences: [] };
  console.log('Seuil ' + SEUIL + ' ; pays à source unique : ' + uniques.length + ' (' + uniques.join(' ') + ')\n');

  for (const cy of uniques) {
    for (const s of parPays[cy]) {
      if (peutAlerter(s, SEUIL)) continue;
      if (estRequeteGoogleNews(s)) {
        if ((s.score || 0) < 60 || /_gn_/.test(s.id)) continue;
        let r;
        try { r = await decouvrirMeilleurFlux(s.url); } catch (e) { r = { trouve: false, essais: [e.message] }; }
        let n = 0; let frais = null;
        if (r.trouve) {
          try { const arts = analyser(await lire(r.url)); n = arts.length; const d = arts.map((a) => a.date).filter(Boolean); frais = d.length ? Math.round((maintenant - Math.max(...d)) / 3600000) : null; } catch (e) { r.erreurLecture = e.message; }
        }
        rapport.agences.push({ cy, id: s.id, score: s.score, url: s.url, flux: r.trouve ? r.url : null, articles: n, plusFraisH: frais, essais: r.essais || null });
        console.log('[agence] ' + cy + ' ' + s.id + ' (' + s.score + ') → ' + (r.trouve ? r.url + ' : ' + n + ' articles, le plus frais à ' + frais + ' h' + (r.erreurLecture ? ' (lecture : ' + r.erreurLecture + ')' : '') : 'aucun flux (' + (r.essais || []).join(' ; ') + ')'));
        continue;
      }
      if (s.cat === 'economique') continue;
      const m = { cy, id: s.id, nom: s.n, score: s.score, rss: s.rss, note: s.note || null };
      try {
        const arts = analyser(await lire(s.rss));
        const dates = arts.map((a) => a.date).filter(Boolean).sort((a, b) => b - a);
        m.articles = arts.length;
        m.plusFraisH = dates.length ? Math.round((maintenant - dates[0]) / 3600000) : null;
        m.sur36h = dates.filter((d) => maintenant - d <= 36 * 3600000).length;
        m.ecartMedianH = dates.length > 2 ? Math.round(dates.slice(0, -1).map((d, k) => (d - dates[k + 1]) / 3600000).sort((a, b) => a - b)[Math.floor((dates.length - 1) / 2)] * 10) / 10 : null;
        m.niveaux = { crit: 0, high: 0, mod: 0, ok: 0 };
        m.audessus = [];
        m.echantillon = arts.slice(0, 8).map((a) => a.titre);
        for (const a of arts) {
          const texte = a.titre + ' ' + a.resume;
          const r = ctx.classify(texte, { cy, cat: s.cat }, a.titre);
          m.niveaux[r.lvl] = (m.niveaux[r.lvl] || 0) + 1;
          if (r.lvl === 'crit' || r.lvl === 'high') m.audessus.push({ niveau: r.lvl, titre: a.titre, mot: motDeclencheur(a.titre, texte) });
        }
      } catch (e) { m.erreur = e.message; }
      rapport.medias.push(m);
      console.log('[média] ' + cy + ' ' + s.id + ' (' + s.score + ') ' + (m.erreur ? 'ÉCHEC ' + m.erreur
        : m.articles + ' articles, plus frais ' + m.plusFraisH + ' h, ' + m.sur36h + ' sur 36 h, écart médian ' + m.ecartMedianH + ' h, ' + JSON.stringify(m.niveaux)));
      if (!m.erreur) {
        m.echantillon.forEach((t) => console.log('      · ' + t.slice(0, 110)));
        m.audessus.forEach((a) => console.log('      ! ' + a.niveau + ' [' + a.mot + '] ' + a.titre.slice(0, 110)));
      }
    }
  }
  if (SORTIE) fs.writeFileSync(SORTIE, JSON.stringify(rapport, null, 2));
})().catch((e) => { console.error('Lecture des médias : ' + e.message); process.exitCode = 0; });
