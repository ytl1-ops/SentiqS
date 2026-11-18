#!/usr/bin/env node
// Avis aux voyageurs du FCDO pour les 54 pays (audit du 15/11/2026).
//
// Écrit web/historique/avis-officiels.json, que la page lit pour la confiance
// des niveaux (voir lectureAvisOfficiel dans le noyau). Tourne dans GitHub
// Actions (avis-officiels.yml) : le bac à sable n'atteint pas gov.uk. Une
// source gratuite, publique, sans clé ; les conditions de réutilisation de
// gov.uk (Open Government Licence) autorisent cette lecture.
//
// Un pays qui ne répond pas garde son avis précédent. Le journal liste les
// pays où l'avis récent diverge du dernier niveau archivé : c'est la liste
// de relecture du socle, à lire par l'analyste — le script ne change rien.
'use strict';
const fs = require('fs');
const path = require('path');
const { PAYS_BULLETIN } = require('./lib/bulletin');
const avis = require('./lib/avis-officiels');
const noyau = require('../web/js/noyau.js');

const RACINE = path.join(__dirname, '..', 'web', 'historique');
const SORTIE = path.join(RACINE, 'avis-officiels.json');
const DELAI_MS = 20000;

async function lireJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), DELAI_MS);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'SentiqS-avis/1.0', Accept: 'application/json' } });
    if (!r.ok) return { code: r.status, json: null };
    return { code: r.status, json: await r.json() };
  } catch (e) {
    return { code: 0, json: null };
  } finally { clearTimeout(t); }
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

function dernierInstantane() {
  const f = fs.readdirSync(RACINE).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().pop();
  return f ? JSON.parse(fs.readFileSync(path.join(RACINE, f), 'utf8')) : null;
}

(async () => {
  const maintenant = Date.now();
  let ancien = null;
  try { ancien = JSON.parse(fs.readFileSync(SORTIE, 'utf8')); } catch (_) { /* premier passage */ }
  const nouveaux = {};
  let lus = 0;
  const echecs = [];
  for (const cy of Object.keys(PAYS_BULLETIN)) {
    const fcdo = PAYS_BULLETIN[cy].conseils.find((c) => /gov\.uk/.test(c.url));
    const slug = fcdo && avis.slugFcdo(fcdo.url);
    if (!slug) { echecs.push(cy + ' (adresse)'); continue; }
    const { code, json } = await lireJson(avis.API + slug);
    const lu = avis.lireReponse(json, slug);
    if (lu) { nouveaux[cy] = lu; lus++; } else echecs.push(cy + ' (' + code + ')');
    await pause(250);
  }
  const pays = avis.fusionner(ancien, nouveaux);
  // Témoins supplémentaires (18/11/2026) : Canada (un fichier pour tous les
  // pays) et États-Unis (un flux RSS). Une source qui ne répond pas garde ses
  // témoins précédents ; elle ne fait jamais échouer le passage.
  const codes = Object.keys(PAYS_BULLETIN);
  const ca = await lireJson(avis.API_CANADA);
  const temCanada = avis.lireCanada(ca.json, codes);
  let temUsa = {};
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), DELAI_MS);
    const r = await fetch(avis.RSS_USA, { signal: ctl.signal, headers: { 'User-Agent': 'SentiqS-avis/1.0' } });
    clearTimeout(t);
    const slugs = {};
    codes.forEach((cy) => {
      const u = (PAYS_BULLETIN[cy].conseils.find((c) => /travel\.state\.gov/.test(c.url)) || {}).url || '';
      const m = /traveladvisories\/([a-z0-9-]+)-travel-advisory\.html/.exec(u);
      if (m) slugs[cy] = m[1];
    });
    const xml = r.ok ? await r.text() : '';
    temUsa = avis.lireUsa(xml, slugs);
    if (r.ok && !Object.keys(temUsa).length) {
      // Format inattendu : montrer le premier article pour corriger la lecture.
      console.log('États-Unis : aucun avis reconnu ; premier article du flux :\n' + ((/<item[\s>][\s\S]*?<\/item>/i.exec(xml) || [xml.slice(0, 800)])[0]).slice(0, 1200));
    }
    console.log('États-Unis : HTTP ' + r.status + ', ' + Object.keys(temUsa).length + '/54 avis');
  } catch (e) { console.log('États-Unis : sans réponse (' + e.message + ')'); }
  console.log('Canada : HTTP ' + ca.code + ', ' + Object.keys(temCanada).length + '/54 avis');
  avis.attacherTemoins(pays, ancien && ancien.pays, { Canada: temCanada, 'États-Unis': temUsa });
  const instantane = dernierInstantane();
  const div = avis.divergences(pays, instantane, maintenant);
  const sortie = { source: 'FCDO — gov.uk Content API (Open Government Licence v3.0) ; Affaires mondiales Canada — données ouvertes (Licence du gouvernement ouvert — Canada) ; Département d\'État des États-Unis — flux RSS (domaine public)', lu: new Date(maintenant).toISOString(), pays, divergences: div };
  fs.writeFileSync(SORTIE, JSON.stringify(sortie, null, 1) + '\n');
  console.log('Avis lus : ' + lus + '/54' + (echecs.length ? ' ; sans réponse : ' + echecs.join(', ') : ''));
  console.log('Avis divergents du dernier niveau archivé (' + (instantane && instantane.jour) + ') : ' + div.length);
  div.forEach((d) => console.log('  ' + d.code + ' affiché ' + d.niveau + ' ; ' + d.source + ' : ' + d.libelle + ' (revu il y a ' + d.revuIlYaJ + ' j)'));
  // Effet attendu sur la confiance : un pays « faible » remonte à « moyenne »
  // quand son avis est récent et compatible (règle du noyau, rien d'autre).
  const faibles = ((instantane && instantane.pays) || []).filter((p) => p.confiance === 'faible');
  const corrobores = faibles.filter((p) => {
    const t = noyau.lectureTemoinsOfficiels(pays[p.code], p.niveau, maintenant);
    return t.filter((x) => x.compatible).length > t.filter((x) => !x.compatible).length;
  });
  // Le passage peut aussi faire REDESCENDRE un pays « moyenne » qu'un nouveau
  // témoin contredit : le compter, pour ne pas lire seulement les gains.
  const moyennes = ((instantane && instantane.pays) || []).filter((p) => p.confiance === 'moyenne');
  const contredits = moyennes.filter((p) => {
    const t = noyau.lectureTemoinsOfficiels(pays[p.code], p.niveau, maintenant);
    const fcdo = noyau.lectureAvisOfficiel(pays[p.code], p.niveau, maintenant);
    return fcdo && fcdo.compatible && t.filter((x) => x.compatible).length <= t.filter((x) => !x.compatible).length;
  });
  if (contredits.length) console.log('Corroborés hier par le FCDO seul, contredits aujourd\'hui par un autre témoin : ' + contredits.map((p) => p.code).join(' '));
  const restants = faibles.filter((p) => !corrobores.includes(p)).map((p) => {
    const t = noyau.lectureTemoinsOfficiels(pays[p.code], p.niveau, maintenant);
    return p.code + ' ' + p.niveau + ' [' + (t.length ? t.map((x) => x.source + (x.compatible ? '+' : '−') + x.ageJ + 'j').join(', ') : 'aucun avis récent') + ']';
  });
  if (restants.length) console.log('Restent faibles : ' + restants.join(' ; '));
  console.log('Confiance faible : ' + faibles.length + ' → ' + (faibles.length - corrobores.length) + ' (' + corrobores.map((p) => p.code).join(' ') + ' corroborés)');
  if (lus === 0 && !ancien) process.exitCode = 1;
})();
