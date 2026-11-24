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
//      Google News (donc muette par construction), et pour chaque agence
//      nationale de presse des 54 pays dans le même cas : existe-t-il un flux
//      natif, vu depuis GitHub ;
//   C. les agences nationales absentes du registre (question de YORO du
//      18/11/2026 : « les actus des agences nationales sont-elles
//      collectées ? ») : leur site expose-t-il un flux.
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

// Agences nationales de presse, reconnues au nom (le registre n'a pas de champ
// « type »). Togo-Presse et La Presse de Tunisie sont des journaux : exclus.
const AGENCE_RE = /\bagen[cç]|ag[êe]ncia|press service|news agency|press agency|\b(APS|ANP|AIP|MAP|ENA|AIB|AMAP|ABP|ATOP|AGP|AMI|KNA|TAP|SUNA|SNA|ANGOP|AIM|NAN|GNA|MENA|LANA|BOPA|ACI|ACP|ANG|NAMPA|LENA|SLENA|SSNA|LINA|Inforpress|STP-?Press|ADI|ATPE)\b/i;
const estAgence = (s) => AGENCE_RE.test(s.n || '') && !/allafrica|_gn_|presse de tunisie|togo-presse/i.test(s.id + ' ' + s.n);

// Agences absentes du registre, à sonder par leur page d'accueil.
const CANDIDATS = [
  // Pays encore à source unique ou muets au 24/11/2026 (AO ER GQ GW KM SC).
  // Titres nommés, sondés par auto-découverte (méthode du 07/09/2026 :
  // tester nominativement les grands titres de chaque pays). Lusophones et
  // hispanophones inclus : le lexique les lit depuis le 20/11/2026 (complété
  // le 24/11/2026), ce qui les avait fait écarter le 19/11/2026.
  { cy: 'AO', nom: 'Novo Jornal', url: 'https://www.novojornal.co.ao/' },
  { cy: 'AO', nom: 'Jornal de Angola', url: 'https://www.jornaldeangola.ao/' },
  { cy: 'AO', nom: 'O País (Angola)', url: 'https://opais.co.ao/' },
  { cy: 'AO', nom: 'Angola24Horas', url: 'https://www.angola24horas.com/' },
  { cy: 'AO', nom: 'Club-K', url: 'https://club-k.net/' },
  { cy: 'AO', nom: 'Maka Angola', url: 'https://www.makaangola.org/' },
  { cy: 'AO', nom: 'Angonotícias', url: 'https://www.angonoticias.com/' },
  { cy: 'AO', nom: 'Portal de Angola', url: 'https://www.portaldeangola.com/' },
  { cy: 'AO', nom: 'RNA — Rádio Nacional de Angola', url: 'https://rna.ao/' },
  { cy: 'AO', nom: 'TPA — Televisão Pública de Angola', url: 'https://tpa.ao/' },
  { cy: 'GW', nom: 'Rádio Sol Mansi', url: 'https://www.radiosolmansi.net/' },
  { cy: 'GW', nom: 'e-Global (Guiné-Bissau)', url: 'https://www.e-global.pt/' },
  { cy: 'GW', nom: 'Gbissau.com', url: 'https://www.gbissau.com/' },
  { cy: 'GW', nom: 'Conosaba do Porto', url: 'https://conosaba.blogspot.com/' },
  { cy: 'GW', nom: 'Bissau Digital', url: 'https://bissaudigital.com/' },
  { cy: 'GQ', nom: 'Real Equatorial Guinea', url: 'https://www.realequatorialguinea.com/' },
  { cy: 'GQ', nom: 'ASODEGUE', url: 'https://www.asodegue.org/' },
  { cy: 'GQ', nom: 'Radio Macuto', url: 'https://www.radiomacuto.net/' },
  { cy: 'GQ', nom: 'RTVGE (flux natif)', url: 'https://rtvge.online/' },
  { cy: 'KM', nom: 'Al-Watwan (flux natif)', url: 'https://alwatwan.net/' },
  { cy: 'KM', nom: 'ORTC (flux natif)', url: 'https://ortc.km/' },
  { cy: 'KM', nom: 'HabariZaComores', url: 'https://www.habarizacomores.com/' },
  { cy: 'KM', nom: 'Al-Fajr', url: 'https://www.alfajr-quotidien.com/' },
  { cy: 'KM', nom: 'Masiwa', url: 'https://masiwa-comores.com/' },
  { cy: 'SC', nom: 'SNA (flux natif)', url: 'https://www.seychellesnewsagency.com/' },
  { cy: 'SC', nom: 'Today in Seychelles', url: 'https://www.todayinseychelles.com/' },
  { cy: 'SC', nom: 'Seychelles Weekly', url: 'https://www.seychellesweekly.com/' },
  { cy: 'ER', nom: 'TesfaNews', url: 'https://www.tesfanews.net/' },
  { cy: 'ER', nom: 'Eritrea Hub', url: 'https://eritreahub.org/' },
  { cy: 'ER', nom: 'Madote', url: 'https://www.madote.com/' },
  { cy: 'ER', nom: 'Erena', url: 'https://erena.org/' },
  { cy: 'SO', nom: 'SONNA — Somali National News Agency', url: 'https://sonna.so/' },
  { cy: 'ZA', nom: 'SAnews — South African Government News Agency', url: 'https://www.sanews.gov.za/' },
  { cy: 'MW', nom: 'MANA — Malawi News Agency', url: 'https://www.manaonline.gov.mw/' },
  { cy: 'MU', nom: 'GIS — Government Information Service (Maurice)', url: 'https://gis.govmu.org/' },
  { cy: 'UG', nom: 'Uganda Media Centre', url: 'https://www.mediacentre.go.ug/' },
  { cy: 'UG', nom: 'UBC — Uganda Broadcasting Corporation', url: 'https://ubc.go.ug/' },
  { cy: 'TZ', nom: 'Daily News (TSN, Tanzanie)', url: 'https://dailynews.co.tz/' },
  { cy: 'ZM', nom: 'ZANIS / Zambia Daily Mail', url: 'https://www.daily-mail.co.zm/' },
  { cy: 'ZM', nom: 'ZNBC', url: 'https://www.znbc.co.zm/' },
  { cy: 'MG', nom: 'ANTA — Agence nationale d information Taratra', url: 'https://www.anta.mg/' },
  { cy: 'CF', nom: 'ACAP — Agence centrafricaine de presse', url: 'https://www.acap.cf/' },
  { cy: 'CF', nom: 'Radio Ndeke Luka', url: 'https://www.radiondekeluka.org/' },
  { cy: 'SZ', nom: 'Eswatini Government', url: 'https://www.gov.sz/' },
  { cy: 'GM', nom: 'GRTS', url: 'https://grts.gm/' },
  { cy: 'ER', nom: 'Shabait (ministère de l Information)', url: 'https://shabait.com/' },
  { cy: 'GQ', nom: 'Guinea Ecuatorial Press', url: 'https://www.guineaecuatorialpress.com/' },
  { cy: 'TD', nom: 'ATPE — Agence tchadienne de presse', url: 'https://www.atpe-tchad.info/' },
  { cy: 'LY', nom: 'Libya Observer (édition anglaise)', url: 'https://libyaobserver.ly/' },
  { cy: 'LY', nom: 'Libya Herald', url: 'https://libyaherald.com/' },
  { cy: 'SD', nom: 'Dabanga (anglais)', url: 'https://www.dabangasudan.org/en' },
  { cy: 'KM', nom: 'La Gazette des Comores', url: 'https://lagazettedescomores.com/' },
  { cy: 'SC', nom: 'Seychelles Nation', url: 'https://www.nation.sc/' },
];

// Journaux officiels (demande de YORO du 18/11/2026 : « regarde journaux
// officiels »). Ils publient décrets, états d'urgence, couvre-feux,
// réquisitions : un signal de sûreté réel, mais daté de la signature, pas de
// l'événement. Sondés pour savoir s'ils exposent un flux ; aucun ne sera lu
// sans flux (pas de lecture de page à l'aveugle, voir decouverte-source.js).
const JOURNAUX_OFFICIELS = [
  { cy: 'CI', nom: 'Journal officiel (SGG Côte d Ivoire)', url: 'https://www.sgg.gouv.ci/' },
  { cy: 'SN', nom: 'Journal officiel du Sénégal', url: 'https://www.jo.gouv.sn/' },
  { cy: 'BJ', nom: 'Journal officiel (SGG Bénin)', url: 'https://sgg.gouv.bj/' },
  { cy: 'TG', nom: 'Journal officiel du Togo', url: 'https://jo.gouv.tg/' },
  { cy: 'BF', nom: 'LegiBurkina', url: 'https://www.legiburkina.bf/' },
  { cy: 'ML', nom: 'SGG Mali', url: 'https://sgg-mali.ml/' },
  { cy: 'NE', nom: 'SGG Niger', url: 'https://www.sgg.gouv.ne/' },
  { cy: 'CM', nom: 'Services du Premier ministre (Cameroun)', url: 'https://www.spm.gov.cm/' },
  { cy: 'MA', nom: 'SGG Maroc (Bulletin officiel)', url: 'https://www.sgg.gov.ma/' },
  { cy: 'TN', nom: 'IORT — Journal officiel tunisien', url: 'https://www.iort.gov.tn/' },
  { cy: 'DZ', nom: 'JORADP — Journal officiel algérien', url: 'https://www.joradp.dz/' },
  { cy: 'KE', nom: 'Kenya Gazette (Kenya Law)', url: 'https://new.kenyalaw.org/gazettes/' },
  { cy: 'ZA', nom: 'Government Gazette (GPW)', url: 'https://www.gpwonline.co.za/' },
  { cy: 'NG', nom: 'Federal Government Gazette (Nigeria)', url: 'https://gazettes.africa/gazettes/ng' },
  { cy: 'INT', nom: 'Gazettes.Africa (Laws.Africa, plusieurs pays)', url: 'https://gazettes.africa/' },
  { cy: 'INT', nom: 'Laws.Africa', url: 'https://laws.africa/' },
];

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

const maintenant = Date.now();
const rapport = { seuil: SEUIL, uniques, medias: [], agences: [] };
async function sonderAgence(cy, id, score, url, etiquette) {
  let r;
  try { r = await decouvrirMeilleurFlux(url); } catch (e) { r = { trouve: false, essais: [e.message] }; }
  let n = 0; let frais = null; let echantillon = []; let lecture = null;
  if (r.trouve) {
    try {
      const arts = analyser(await lire(r.url)); n = arts.length; echantillon = arts.slice(0, 8).map((a) => a.titre);
      const d = arts.map((a) => a.date).filter(Boolean); frais = d.length ? Math.round((maintenant - Math.max(...d)) / 3600000) : null;
      // Ce que la vraie classify() ferait de ce flux : la lecture éditoriale
      // juge le faux positif sur pièce, pas sur le nom du média.
      lecture = { sur36h: d.filter((x) => maintenant - x <= 36 * 3600000).length, niveaux: { crit: 0, high: 0, mod: 0, ok: 0 }, audessus: [] };
      for (const a of arts) {
        const texte = a.titre + ' ' + a.resume;
        const c = ctx.classify(texte, { cy, cat: 'securite' }, a.titre);
        lecture.niveaux[c.lvl] = (lecture.niveaux[c.lvl] || 0) + 1;
        if (c.lvl === 'crit' || c.lvl === 'high') lecture.audessus.push({ niveau: c.lvl, titre: a.titre, mot: motDeclencheur(a.titre, texte) });
      }
    } catch (e) { r.erreurLecture = e.message; }
  }
  rapport.agences.push({ cy, id, score, url, flux: r.trouve ? r.url : null, articles: n, plusFraisH: frais, echantillon, lecture, essais: r.essais || null, erreur: r.erreurLecture || null });
  console.log(etiquette + ' ' + cy + ' ' + id + (score != null ? ' (' + score + ')' : '') + ' → ' + (r.trouve ? r.url + ' : ' + n + ' articles, le plus frais à ' + frais + ' h' + (r.erreurLecture ? ' (lecture : ' + r.erreurLecture + ')' : '') : 'aucun flux (' + (r.essais || []).join(' ; ') + ')'));
  if (lecture) console.log('      ' + lecture.sur36h + ' sur 36 h, ' + JSON.stringify(lecture.niveaux));
  echantillon.forEach((t) => console.log('      · ' + t.slice(0, 110)));
  if (lecture) lecture.audessus.forEach((a) => console.log('      ! ' + a.niveau + ' [' + a.mot + '] ' + a.titre.slice(0, 110)));
}

(async () => {
  console.log('Seuil ' + SEUIL + ' ; pays à source unique : ' + uniques.length + ' (' + uniques.join(' ') + ')\n');

  for (const cy of (process.env.SEULEMENT_CANDIDATS ? [] : uniques)) {
    for (const s of parPays[cy]) {
      if (peutAlerter(s, SEUIL)) continue;
      if (estRequeteGoogleNews(s)) {
        if ((s.score || 0) < 60 || /_gn_/.test(s.id) || estAgence(s)) continue;
        await sonderAgence(s.cy, s.id, s.score, s.url, '[agence]');
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
  console.log('\n--- Agences nationales de presse au registre');
  for (const s of SRCS.filter((x) => estAgence(x) && !process.env.SEULEMENT_CANDIDATS).sort((a, b) => a.cy.localeCompare(b.cy))) {
    if (!estRequeteGoogleNews(s)) { console.log('[agence native] ' + s.cy + ' ' + s.id + ' (' + s.score + (peutAlerter(s, SEUIL) ? ', alerte' : ', sous le seuil') + ') ' + s.rss); continue; }
    await sonderAgence(s.cy, s.id, s.score, s.url, '[agence GN]');
  }
  console.log('\n--- Agences absentes du registre');
  for (const c of CANDIDATS) await sonderAgence(c.cy, c.nom, null, c.url, '[candidat]');
  console.log('\n--- Journaux officiels');
  for (const c of JOURNAUX_OFFICIELS) await sonderAgence(c.cy, c.nom, null, c.url, '[journal officiel]');
  if (SORTIE) fs.writeFileSync(SORTIE, JSON.stringify(rapport, null, 2));
})().catch((e) => { console.error('Lecture des médias : ' + e.message); process.exitCode = 0; });
