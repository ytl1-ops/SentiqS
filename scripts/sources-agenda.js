#!/usr/bin/env node
// Sources d'événements pour l'Agenda (14/11/2026).
//
// Demande de YORO : un agenda « très pauvre » en rassemblements, alors que ce
// qui draine du monde — fêtes nationales, matchs, grandes célébrations —
// pèse sur les mouvements de foule et donc sur la sûreté d'un pays. Les
// articles n'en parlent souvent que le jour même ; il faut des sources qui
// les annoncent À L'AVANCE. Deux sources gratuites, sans clé à nous :
//
//   - Nager.Date (date.nager.at, licence MIT, sans clé) : jours fériés
//     officiels. Mesuré le 14/11/2026 depuis GitHub : 53 pays sur 54
//     couverts, 190 jours fériés sur 120 jours.
//
// Écartée après mesure le même jour : TheSportsDB (clé publique « 123 ») ne
// rend aucun match à venir pour les 7 championnats africains qu'elle
// référence — une source vide occuperait la place d'une garantie. Les matchs
// restent ceux que la presse annonce, détectés dans le Flux (typeEvenementDetecte).
//
// Le calendrier religieux (Tabaski, Magal, Timkat…) n'a pas besoin de
// réseau : il est calculé dans la page (web/js/calendrier-foules.js).
//
// Le bac à sable n'a pas de réseau : ce script tourne dans GitHub Actions
// (.github/workflows/sources-agenda.yml) et écrit web/agenda/externe.json,
// que la page lit. Il ne garde QUE des événements à venir et n'écrit jamais
// un incident : ces sources ne publient que des calendriers. Une source qui
// ne répond pas laisse ses anciennes entrées en place plutôt que de vider
// l'agenda (le silence ressemblerait au calme).
'use strict';
const fs = require('fs');
const path = require('path');
const { PAYS_BULLETIN } = require('./lib/bulletin');

const SORTIE = path.join(__dirname, '..', 'web', 'agenda', 'externe.json');
const HORIZON_J = 120;
const DELAI_MS = 20000;

async function lireJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), DELAI_MS);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'SentiqS-agenda/1.0', Accept: 'application/json' } });
    if (r.status === 204 || r.status === 404) return { code: r.status, json: null };
    if (!r.ok) return { code: r.status, json: null };
    const txt = await r.text();
    return { code: r.status, json: txt ? JSON.parse(txt) : null };
  } catch (e) {
    return { code: 0, json: null, erreur: (e && e.name === 'AbortError') ? 'délai' : String((e && e.message) || e) };
  } finally { clearTimeout(t); }
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

function dansHorizon(dateIso, maintenant) {
  const ms = Date.parse(dateIso + 'T12:00:00Z');
  return Number.isFinite(ms) && ms >= maintenant - 86400000 && ms <= maintenant + HORIZON_J * 86400000;
}

// Jours fériés officiels. Un jour férié est un fait administratif publié par
// l'État, pas une estimation : c'est la source la plus sûre de l'agenda.
async function joursFeries(maintenant) {
  const annee = new Date(maintenant).getUTCFullYear();
  const ev = [];
  const couverts = [];
  const journal = {};
  const pays = Object.keys(PAYS_BULLETIN).sort();
  for (const cy of pays) {
    let vu = false;
    for (const a of [annee, annee + 1]) {
      const r = await lireJson('https://date.nager.at/api/v3/PublicHolidays/' + a + '/' + cy);
      journal[cy + a] = r.code || r.erreur;
      if (!Array.isArray(r.json)) continue;
      vu = true;
      r.json.forEach((h) => {
        if (!h || !h.date || !dansHorizon(h.date, maintenant)) return;
        if (h.global === false) return; // férié régional seulement : pas un fait national
        ev.push({
          id: 'ferie-' + cy + '-' + h.date, date: h.date, cy,
          titre: h.localName && h.localName !== h.name ? h.localName + ' (' + h.name + ')' : h.name,
          titreEn: h.name, type: 'ceremonie', nature: 'ferie',
          src: 'Nager.Date — jours fériés officiels', surl: 'https://date.nager.at/PublicHoliday/' + cy + '/' + h.date.slice(0, 4),
        });
      });
      await pause(150);
    }
    if (vu) couverts.push(cy);
  }
  return { ev, couverts, journal };
}

function lireExistant() {
  try { return JSON.parse(fs.readFileSync(SORTIE, 'utf8')); } catch (_) { return null; }
}

async function principal() {
  const maintenant = Date.now();
  const existant = lireExistant();
  const ancien = (existant && Array.isArray(existant.evenements)) ? existant.evenements : [];
  const f = await joursFeries(maintenant);
  // Une source muette ce coup-ci garde ses entrées à venir de la fois d'avant.
  const garder = (nature, nouveau) => (nouveau.length ? nouveau
    : ancien.filter((e) => e.nature === nature && dansHorizon(e.date, maintenant)));
  const evenements = garder('ferie', f.ev)
    .sort((a, b) => a.date.localeCompare(b.date) || a.cy.localeCompare(b.cy));
  const sortie = {
    genere: new Date(maintenant).toISOString(),
    horizonJours: HORIZON_J,
    sources: {
      feries: { nom: 'Nager.Date', url: 'https://date.nager.at', licence: 'MIT', pays: f.couverts, evenements: f.ev.length },
    },
    evenements,
  };
  fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
  fs.writeFileSync(SORTIE, JSON.stringify(sortie, null, 1) + '\n');
  console.log('Jours fériés : ' + f.ev.length + ' événement(s), ' + f.couverts.length + ' pays couverts : ' + f.couverts.join(' '));
  console.log('Journal : ' + JSON.stringify(f.journal));
  console.log('Total écrit : ' + evenements.length + ' → ' + path.relative(process.cwd(), SORTIE));
}

if (require.main === module) principal().catch((e) => { console.error(e); process.exit(1); });
module.exports = { dansHorizon };
