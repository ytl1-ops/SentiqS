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
//     officiels, pour les pays qu'elle couvre ;
//   - TheSportsDB (clé publique de démonstration « 123 », documentée par le
//     service) : prochains matchs des compétitions africaines et des
//     championnats nationaux qu'elle référence.
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
const SPORTSDB = 'https://www.thesportsdb.com/api/v1/json/123/';

// Nom anglais du pays tel que TheSportsDB l'écrit (champ strCountry).
const PAYS_SPORTSDB = {
  DZ: 'Algeria', AO: 'Angola', BJ: 'Benin', BW: 'Botswana', BF: 'Burkina Faso', BI: 'Burundi',
  CV: 'Cape Verde', CM: 'Cameroon', CF: 'Central African Republic', TD: 'Chad', KM: 'Comoros',
  CG: 'Congo', CD: 'DR Congo', CI: 'Ivory Coast', DJ: 'Djibouti', EG: 'Egypt', GQ: 'Equatorial Guinea',
  ER: 'Eritrea', SZ: 'Eswatini', ET: 'Ethiopia', GA: 'Gabon', GM: 'Gambia', GH: 'Ghana', GN: 'Guinea',
  GW: 'Guinea-Bissau', KE: 'Kenya', LS: 'Lesotho', LR: 'Liberia', LY: 'Libya', MG: 'Madagascar',
  MW: 'Malawi', ML: 'Mali', MR: 'Mauritania', MU: 'Mauritius', MA: 'Morocco', MZ: 'Mozambique',
  NA: 'Namibia', NE: 'Niger', NG: 'Nigeria', RW: 'Rwanda', ST: 'Sao Tome and Principe', SN: 'Senegal',
  SC: 'Seychelles', SL: 'Sierra Leone', SO: 'Somalia', ZA: 'South Africa', SS: 'South Sudan',
  SD: 'Sudan', TZ: 'Tanzania', TG: 'Togo', TN: 'Tunisia', UG: 'Uganda', ZM: 'Zambia', ZW: 'Zimbabwe',
};
// Compétitions continentales : leurs matchs se jouent dans un pays donné,
// lu dans le lieu (strCountry de l'événement ou de la ville).
const COMPETITIONS_CONTINENTALES = [
  'African Cup of Nations', 'CAF Champions League', 'CAF Confederation Cup',
  'African Nations Championship', 'World Cup Qualifying CAF',
];

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

function cyDuPays(nom) {
  if (!nom) return null;
  const n = String(nom).toLowerCase();
  const e = Object.entries(PAYS_SPORTSDB).find(([, v]) => v.toLowerCase() === n);
  return e ? e[0] : null;
}

function matchVersEvenement(m, cyLigue, ligue) {
  if (!m || !m.dateEvent || !m.strEvent) return null;
  const cy = cyDuPays(m.strCountry) || cyLigue;
  if (!cy) return null; // match continental sans pays du lieu : on ne devine pas
  const lieu = [m.strVenue, m.strCity].filter(Boolean).join(', ');
  return {
    id: 'match-' + m.idEvent, date: m.dateEvent, heure: m.strTime ? String(m.strTime).slice(0, 5) : null, cy,
    titre: m.strEvent + ' — ' + ligue, titreEn: m.strEvent + ' — ' + ligue, lieu: lieu || null,
    type: 'sportif', nature: 'match',
    src: 'TheSportsDB', surl: 'https://www.thesportsdb.com/event/' + m.idEvent,
  };
}

async function matchs(maintenant) {
  const ev = [];
  const ligues = [];
  const journal = {};
  const aSuivre = [];
  for (const cy of Object.keys(PAYS_SPORTSDB)) {
    const r = await lireJson(SPORTSDB + 'search_all_leagues.php?c=' + encodeURIComponent(PAYS_SPORTSDB[cy]) + '&s=Soccer');
    journal['ligues-' + cy] = r.code || r.erreur;
    const l = (r.json && (r.json.countries || r.json.countrys || r.json.leagues)) || [];
    // Le premier championnat masculin de chaque pays : le plus suivi.
    const premier = l.find((x) => x && !/women|femin|u\d\d|youth|cup|coupe/i.test(x.strLeague || ''));
    if (premier) aSuivre.push({ id: premier.idLeague, nom: premier.strLeague, cy });
    await pause(400);
  }
  for (const nom of COMPETITIONS_CONTINENTALES) {
    const r = await lireJson(SPORTSDB + 'search_all_leagues.php?s=Soccer&c=Africa');
    const l = (r.json && (r.json.countries || r.json.countrys || r.json.leagues)) || [];
    const t = l.find((x) => x && String(x.strLeague || '').toLowerCase() === nom.toLowerCase());
    if (t) aSuivre.push({ id: t.idLeague, nom: t.strLeague, cy: null });
    journal['continental-' + nom] = t ? t.idLeague : 'absent';
    await pause(400);
  }
  for (const lg of aSuivre) {
    const r = await lireJson(SPORTSDB + 'eventsnextleague.php?id=' + lg.id);
    const l = (r.json && r.json.events) || [];
    journal['matchs-' + lg.id] = (r.code || r.erreur) + ':' + l.length;
    let n = 0;
    l.forEach((m) => {
      if (!dansHorizon(m.dateEvent, maintenant)) return;
      const e = matchVersEvenement(m, lg.cy, lg.nom);
      if (e) { ev.push(e); n++; }
    });
    ligues.push({ id: lg.id, nom: lg.nom, cy: lg.cy, matchs: n });
    await pause(400);
  }
  return { ev, ligues, journal };
}

function lireExistant() {
  try { return JSON.parse(fs.readFileSync(SORTIE, 'utf8')); } catch (_) { return null; }
}

async function principal() {
  const maintenant = Date.now();
  const existant = lireExistant();
  const ancien = (existant && Array.isArray(existant.evenements)) ? existant.evenements : [];
  const f = await joursFeries(maintenant);
  const s = await matchs(maintenant);
  // Une source muette ce coup-ci garde ses entrées à venir de la fois d'avant.
  const garder = (nature, nouveau) => (nouveau.length ? nouveau
    : ancien.filter((e) => e.nature === nature && dansHorizon(e.date, maintenant)));
  const evenements = [].concat(garder('ferie', f.ev), garder('match', s.ev))
    .sort((a, b) => a.date.localeCompare(b.date) || a.cy.localeCompare(b.cy));
  const sortie = {
    genere: new Date(maintenant).toISOString(),
    horizonJours: HORIZON_J,
    sources: {
      feries: { nom: 'Nager.Date', url: 'https://date.nager.at', licence: 'MIT', pays: f.couverts, evenements: f.ev.length },
      matchs: { nom: 'TheSportsDB', url: 'https://www.thesportsdb.com', ligues: s.ligues, evenements: s.ev.length },
    },
    evenements,
  };
  fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
  fs.writeFileSync(SORTIE, JSON.stringify(sortie, null, 1) + '\n');
  console.log('Jours fériés : ' + f.ev.length + ' événement(s), ' + f.couverts.length + ' pays couverts : ' + f.couverts.join(' '));
  console.log('Matchs : ' + s.ev.length + ' événement(s) sur ' + s.ligues.length + ' compétition(s)');
  s.ligues.forEach((l) => console.log('  ' + (l.cy || 'CAF') + ' ' + l.nom + ' : ' + l.matchs));
  console.log('Journal : ' + JSON.stringify(Object.assign({}, f.journal, s.journal)));
  console.log('Total écrit : ' + evenements.length + ' → ' + path.relative(process.cwd(), SORTIE));
}

if (require.main === module) principal().catch((e) => { console.error(e); process.exit(1); });
module.exports = { matchVersEvenement, dansHorizon, cyDuPays, PAYS_SPORTSDB };
