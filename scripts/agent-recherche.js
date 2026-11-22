#!/usr/bin/env node
'use strict';
// Agent de recherche d'actus — le passage GitHub (22/11/2026).
// Pourquoi et comment : web/js/agent-recherche.js ; logique pure :
// scripts/lib/agent-recherche.js ; lancé par .github/workflows/agent-recherche.yml.
//
// Un passage, dans l'ordre :
//   1. sert les demandes des utilisateurs (dix au plus, trois par compte) ;
//   2. applique les décisions de l'analyste sur la quarantaine ;
//   3. une fois par jour : veille proactive des pays muets ou hors alerte
//      (objectif 1), recoupement des critiques à source unique (objectif 2),
//      contrôle qualité de la base (objectif 5), signaux faibles (objectif 3),
//      et le relevé des médias inconnus vus passer (objectif 6) ;
//   4. purge ce qui a vieilli.
//
//   node scripts/agent-recherche.js --compter   écrit travail=1|0 dans GITHUB_OUTPUT
//   AGENT_SONDE=1 node scripts/agent-recherche.js   une recherche d'essai, RIEN n'est écrit
//
// Jamais rouge pour un moteur muet : le journal dit lequel, et pourquoi.

const http = require('http');
const fs = require('fs');
const path = require('path');
const cacheFirestore = require('./lib/cache-firestore-ecriture');
const FR = require('./lib/firestore-rest');
const { fetchRespectueux } = require('./lib/fetch-respectueux');
const L = require('./lib/agent-recherche');
const A = require('../web/js/agent-recherche.js');

const RACINE = path.join(__dirname, '..', 'web');
const BUDGET_MS = Number(process.env.AGENT_BUDGET_MS || 9 * 60 * 1000);
const DEMANDES_PAR_PASSAGE = 10;
const DEMANDES_PAR_COMPTE = 3;
const VEILLE_PAYS_PAR_JOUR = 6;
const RECOUPEMENTS_PAR_JOUR = 6;
// Agenda des 54 pays (YORO, 22/11/2026) : à chaque passage horaire, deux
// pays — la Côte d'Ivoire toutes les quatre heures (pays pilote n° 1), puis
// le pays cherché il y a le plus longtemps, le moins couvert à égalité. Douze
// requêtes Bing par pays, trois secondes entre deux : ~40 s par pays, et les
// 54 pays reviennent en un jour et quart environ.
const AGENDA_PAYS_PAR_PASSAGE = 2;
const AGENDA_TOURNEE_MIN = 55;
const C = A.COLLECTIONS;

function jourIso(ms) { return new Date(ms).toISOString().slice(0, 10); }

// La vraie page, servie en local, sans réseau : elle donne le registre, les
// noms de pays, et décide du pays, du niveau et de la catégorie de chaque
// candidat avec parseRSS — la fonction même de la collecte.
async function ouvrirPage() {
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
  const page = await nav.newPage();
  await page.route('**', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  await page.goto(base + '/SentiqS_Web.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof parseRSS === 'function' && typeof SRCS !== 'undefined', null, { timeout: 30000 });
  const reg = await page.evaluate(() => ({
    srcs: SRCS.map((s) => ({ id: s.id, n: s.n, cy: s.cy, score: s.score, url: s.url, rss: s.rss })),
    noms: Object.fromEntries(Object.keys(PAYS_INFO).filter((cy) => cy !== 'INT')
      .map((cy) => [cy, { fr: PAYS_INFO[cy].name, en: (typeof PAYS_EN !== 'undefined' && PAYS_EN[cy]) || PAYS_INFO[cy].name }])),
  }));
  async function analyser(cands) {
    return page.evaluate((liste) => {
      const x = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return liste.map((c) => {
        const src = SRCS.find((s) => s.id === c.sourceId);
        if (!src) return null;
        const xml = '<rss><channel><item><title>' + x(c.titre) + '</title><link>' + x(c.url) + '</link><description>'
          + x(c.extrait) + '</description><pubDate>' + new Date(c.publieMs).toUTCString() + '</pubDate></item></channel></rss>';
        const a = (parseRSS(xml, src) || [])[0];
        return a ? { cy: a.cy, level: a.level, cat: a.cat, agendaType: a._agendaType || null, article: JSON.parse(JSON.stringify(a)) } : null;
      });
    }, cands.map((c) => ({ titre: c.titre, extrait: c.extrait, url: c.url, publieMs: c.publieMs, sourceId: c.source.id })));
  }
  async function angleMort(articles) {
    return page.evaluate((arts) => {
      ALL = arts; // eslint-disable-line no-undef
      try { rehydrateArticles(ALL); } catch (_) {}
      const am = angleMortPerimetre(Object.keys(PAYS_INFO).filter((cy) => cy !== 'INT'));
      return { muets: am.muets.map((p) => p.cy), horsAlerte: am.horsAlerte.map((p) => p.cy) };
    }, articles);
  }
  return { reg, analyser, angleMort, fermer: async () => { await nav.close(); serveur.close(); } };
}

// Firestore REST avec le compte de service (hors des règles, comme les autres jobs).
async function ouvrirBase(compte) {
  const jeton = await cacheFirestore.jetonAcces(compte, fetch);
  const db = FR.client(compte.project_id, jeton, fetch);
  const racine = FR.base(compte.project_id);
  const entetes = { Authorization: 'Bearer ' + jeton, 'content-type': 'application/json' };
  return Object.assign(db, {
    // Création seule : un document déjà là n'est jamais réécrit (409).
    async creer(collection, id, objet) {
      const r = await fetch(racine + '/' + collection + '?documentId=' + encodeURIComponent(id), {
        method: 'POST', headers: entetes, body: JSON.stringify({ fields: FR.versFirestore(objet).mapValue.fields }) });
      if (r.status === 409) return false;
      if (!r.ok) throw new Error('création de ' + collection + '/' + id + ' refusée (HTTP ' + r.status + ')');
      return true;
    },
    async effacer(collection, id) {
      await fetch(racine + '/' + collection + '/' + encodeURIComponent(id), { method: 'DELETE', headers: entetes }).catch(() => null);
    },
  });
}

async function chercher(url) {
  const r = await fetchRespectueux(url);
  return r.ok ? r : { ok: false, bloque: !!r.bloque, status: /HTTP (\d+)/.test(r.raison || '') ? Number(RegExp.$1) : 0, raison: r.raison };
}

function relireDemande(id, d) {
  // La demande vient d'un navigateur : on la relit comme une donnée.
  const pays = Array.isArray(d.pays) ? d.pays.filter((c) => /^[A-Z]{2}$/.test(c)).slice(0, A.PAYS_MAX) : [];
  const q = A.nettoyerRequete(d.q);
  if (!q || typeof d.uid !== 'string' || !id.startsWith(d.uid + '_')) return null;
  return { id, uid: d.uid, q, pays, jours: Math.max(1, Math.min(A.JOURS_MAX, Number(d.jours) || A.JOURS_DEFAUT)), lang: d.lang === 'en' ? 'en' : 'fr' };
}

function existantsDe(cache, actus, quarantaine) {
  const ex = (cache || []).map((a) => ({ title: a.title, cy: a.cy, url: a.url }));
  [...(actus || []), ...(quarantaine || [])].forEach((d) => {
    try { const a = JSON.parse(d.data.article || '{}'); ex.push({ title: a.title, cy: a.cy, url: a.url }); } catch (_) {}
  });
  return ex;
}

async function principal() {
  const compte = cacheFirestore.lireCompte(process.env.FIREBASE_SERVICE_ACCOUNT || '');
  const sonde = process.env.AGENT_SONDE === '1';
  if (!compte && !sonde) { console.log('FIREBASE_SERVICE_ACCOUNT absent ou illisible : rien à faire.'); return; }
  const debut = Date.now();
  const echeance = debut + BUDGET_MS;
  const db = compte ? await ouvrirBase(compte) : null;

  if (process.argv.includes('--compter')) {
    const dem = db ? await db.lister(C.demandes, 300) : [];
    const rep = new Set(db ? (await db.lister(C.reponses, 2000)).map((x) => x.id) : []);
    const q = db ? await db.lister(C.quarantaine, 500) : [];
    const rapport = db ? await db.lire(C.rapport + '/quotidien').catch(() => null) : null;
    const quotidien = !rapport || rapport.jour !== jourIso(Date.now());
    const tour = db ? await db.lire(C.rapport + '/agenda_tournee').catch(() => null) : null;
    const agendaDu = !tour || !(Date.now() - Date.parse(tour.le || 0) < AGENDA_TOURNEE_MIN * 60000);
    const enAttente = dem.filter((x) => !rep.has(x.id)).length;
    const decisions = q.filter((x) => x.data.decision).length;
    const travail = enAttente + decisions > 0 || !!process.env.AGENT_VALIDER_PAYS || quotidien || agendaDu || dem.some((x) => x.data.jour < A.jourDe(Date.now()) - 2);
    console.log('Demandes en attente : ' + enAttente + ', décisions de l’analyste : ' + decisions + ', passage quotidien dû : ' + (quotidien ? 'oui' : 'non') + ', tournée d’agenda due : ' + (agendaDu ? 'oui' : 'non') + '.');
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'travail=' + (travail ? 1 : 0) + '\n');
    return;
  }

  const page = await ouvrirPage();
  try {
    const blanche = L.listeBlanche(page.reg.srcs);
    console.log('Liste blanche : ' + blanche.size + ' domaines de médias du registre (' + page.reg.srcs.length + ' sources).');
    let cache = [];
    if (compte) { try { const lu = await cacheFirestore.lireCache(compte, fetch); cache = (lu && lu.articles) || []; } catch (_) {} }
    const actus = db ? await db.lister(C.actus, 3000) : [];
    const quarantaine = db ? await db.lister(C.quarantaine, 1000) : [];
    const existants = existantsDe(cache, actus, quarantaine);
    const decouvertes = new Map();
    const ctx = { chercher, blanche, noms: page.reg.noms, analyser: page.analyser, existants };

    async function traiter(d, ecrire) {
      const r = await L.servirDemande(d, ctx);
      r.decouvertes.forEach((n, dom) => {
        const e = decouvertes.get(dom) || { n: 0, pays: new Set() };
        e.n += n; d.pays.forEach((c) => e.pays.add(c)); decouvertes.set(dom, e);
      });
      const res = r.resultat;
      console.log('« ' + res.q + ' » : ' + res.faits.length + ' fait(s) — moteurs : '
        + res.moteurs.map((m) => m.nom + ' ' + m.etat + (m.n ? ' (' + m.n + ')' : '')).join(', ')
        + ' — écartés : ' + Object.entries(res.ecartes).filter((e) => e[1]).map((e) => e[0] + ' ' + e[1]).join(', '));
      res.faits.slice(0, 6).forEach((f) => console.log('   [' + f.cotation + ' · ' + f.statut + '] ' + f.cy + ' ' + f.titre.slice(0, 100) + ' — ' + f.liens.map((l) => l.source).join(', ')));
      if (!ecrire) return r;
      for (const ins of r.insertions) {
        if (await db.creer(C.actus, ins.cle, { article: JSON.stringify(ins.article), cy: ins.cy, cotation: ins.cotation, origine: 'agent', trouveLe: new Date().toISOString(), demande: d.id || 'agent' })) {
          existants.push({ title: ins.article.title, cy: ins.cy, url: ins.article.url });
        }
      }
      for (const qu of r.quarantaines) {
        if (await db.creer(C.quarantaine, qu.cle, { article: JSON.stringify(qu.article), cy: qu.cy, cotation: qu.cotation, origine: 'agent', trouveLe: new Date().toISOString(), demande: d.id || 'agent' })) {
          existants.push({ title: qu.article.title, cy: qu.cy, url: qu.article.url });
        }
      }
      return r;
    }

    // ── 0. Sonde : une recherche d'essai, rien n'est écrit ──────────────────
    if (sonde) {
      for (const q of ["Côte d'Ivoire sécurité", 'Mali attaque', 'Nigeria kidnapping']) {
        const cy = q.startsWith('Côte') ? 'CI' : (q.startsWith('Mali') ? 'ML' : 'NG');
        await traiter({ id: null, q, pays: [cy], jours: 7, lang: 'fr' }, false);
      }
      // ReliefWeb a répondu « erreur » à la première sonde : la raison exacte
      // dit si c'est l'appname (à faire approuver, gratuit) ou autre chose.
      const rw = await chercher(L.urlReliefweb('Mali'));
      console.log('ReliefWeb (sonde) : ' + (rw.ok ? 'ok' : 'échec — HTTP ' + (rw.status || '?') + ' ' + String(rw.raison || '').slice(0, 200)));
      // Un pays francophone, un anglophone, un lusophone (cherché en anglais).
      for (const cy of ['CI', 'KE', 'AO']) {
        const ag = await L.collecterAgenda(cy, ctx);
        console.log('Agenda ' + cy + ' (sonde) : ' + ag.evenements.length + ' événement(s) daté(s) — écartés : ' + JSON.stringify(ag.ecartes));
        ag.evenements.slice(0, 8).forEach((e) => console.log('   ' + new Date(e.debutMs).toISOString().slice(0, 10) + ' [' + e.type + ' · ' + e.cotation + '] ' + e.titre.slice(0, 100) + ' — ' + e.liens.map((l) => l.source).join(', ')));
      }
      console.log('Sonde terminée : rien n’a été écrit.');
      return;
    }

    // ── 1. Demandes des utilisateurs ─────────────────────────────────────────
    const dem = await db.lister(C.demandes, 300);
    const repondues = new Set((await db.lister(C.reponses, 2000)).map((x) => x.id));
    const parCompte = new Map();
    let servies = 0;
    for (const x of dem.sort((a, b) => String(a.data.at).localeCompare(String(b.data.at)))) {
      if (repondues.has(x.id) || servies >= DEMANDES_PAR_PASSAGE || Date.now() > echeance) continue;
      const d = relireDemande(x.id, x.data);
      if (!d) { await db.ecrire(C.reponses + '/' + x.id, { uid: String(x.data.uid || ''), at: new Date().toISOString(), resultat: JSON.stringify({ q: '', faits: [], moteurs: [], ecartes: {}, le: new Date().toISOString() }) }); continue; }
      const n = parCompte.get(d.uid) || 0;
      if (n >= DEMANDES_PAR_COMPTE) continue;
      parCompte.set(d.uid, n + 1);
      let r;
      try { r = await traiter(d, true); } catch (e) { console.warn('::warning::Demande ' + x.id + ' non servie : ' + e.message); continue; }
      await db.ecrire(C.reponses + '/' + x.id, { uid: d.uid, at: new Date().toISOString(), resultat: JSON.stringify(r.resultat) });
      servies++;
    }
    console.log('Demandes servies : ' + servies + '.');

    // ── 2. Décisions de l'analyste sur la quarantaine ────────────────────────
    // Lancement manuel (workflow_dispatch) : l'administrateur peut valider en
    // un passage les faits d'un pays dont le titre contient un mot donné. Le
    // choix vient de lui (il lance le workflow), le journal le dit.
    const vPays = String(process.env.AGENT_VALIDER_PAYS || '').trim().toUpperCase();
    const vMot = String(process.env.AGENT_VALIDER_TITRE || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    // Un fait en attente que la règle de pertinence juge hors sûreté est
    // écarté sans attendre l'analyste (faits entrés avant la règle).
    for (const q of quarantaine) {
      if (q.data.decision || q.data.genre === 'agenda') continue;
      let a; try { a = JSON.parse(q.data.article); } catch (_) { a = null; }
      if (!a) continue;
      const titreNorm = String(a.title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (vPays && vMot && vMot.length >= 4 && q.data.cy === vPays && titreNorm.includes(vMot)) {
        q.data.decision = 'valide'; q.data.decidePar = 'administrateur (lancement manuel)'; q.data.decideLe = new Date().toISOString();
      } else if (!L.pertinentSurete(a.title, a.level)) {
        q.data.decision = 'rejete'; q.data.decidePar = 'agent (hors sûreté)'; q.data.decideLe = new Date().toISOString();
      }
    }
    const journal = [];
    for (const q of quarantaine) {
      if (q.data.decision === 'valide' && q.data.genre === 'agenda') {
        let e; try { e = JSON.parse(q.data.evenement); } catch (_) { e = null; }
        if (e) await db.creer(C.agenda, q.id, { evenement: JSON.stringify(Object.assign(e, { validePar: 'analyste' })), cy: q.data.cy, cotation: q.data.cotation, trouveLe: q.data.trouveLe || null, debut: e.debutMs ? new Date(e.debutMs).toISOString() : null });
        await db.effacer(C.quarantaine, q.id);
        journal.push({ cle: q.id, genre: 'agenda', decision: 'valide', par: q.data.decidePar || null, le: q.data.decideLe || null });
      } else if (q.data.decision === 'valide') {
        let a; try { a = JSON.parse(q.data.article); } catch (_) { a = null; }
        if (a) {
          a._agentValidePar = 'analyste';
          await db.creer(C.actus, q.id, { article: JSON.stringify(a), cy: q.data.cy, cotation: q.data.cotation, origine: 'agent', trouveLe: q.data.trouveLe || null, validePar: q.data.decidePar || 'analyste', valideLe: q.data.decideLe || new Date().toISOString() });
        }
        await db.effacer(C.quarantaine, q.id);
        journal.push({ cle: q.id, decision: 'valide', par: q.data.decidePar || null, le: q.data.decideLe || null });
      } else if (q.data.decision === 'rejete') {
        await db.effacer(C.quarantaine, q.id);
        journal.push({ cle: q.id, decision: 'rejete', par: q.data.decidePar || null, le: q.data.decideLe || null });
      }
    }
    if (journal.length) {
      const ancien = (await db.lire(C.rapport + '/journal').catch(() => null)) || {};
      await db.ecrire(C.rapport + '/journal', { entrees: journal.concat(ancien.entrees || []).slice(0, 300) });
      console.log('Décisions de l’analyste appliquées : ' + journal.length + '.');
    }

    // ── 3. Le passage quotidien ──────────────────────────────────────────────
    const aujourdhui = jourIso(Date.now());
    const rapportPrec = (await db.lire(C.rapport + '/quotidien').catch(() => null)) || {};
    if (rapportPrec.jour !== aujourdhui && Date.now() < echeance) {
      const rapport = { jour: aujourdhui, le: new Date().toISOString() };
      // Couverture des 54 pays, puis objectif 1 — veille proactive des pays
      // les moins couverts (muets, hors alerte, pauvres en actus ou en agenda).
      try {
        const am = await page.angleMort(cache);
        const codes = Object.keys(page.reg.noms);
        const agendaBase = (await db.lister(C.agenda, 3000)).map((x) => ({ cy: x.data.cy, debutMs: Date.parse(x.data.debut) }));
        const couv = L.couverturePays(codes, { cache, agenda: agendaBase, sources: page.reg.srcs, muets: am.muets, horsAlerte: am.horsAlerte });
        rapport.couverture = couv;
        const pauvres = codes.filter((cy) => couv[cy].etat === 'pauvre');
        console.log('Couverture : ' + pauvres.length + ' pays pauvres, '
          + codes.filter((cy) => couv[cy].etat === 'moyenne').length + ' moyens, ' + codes.filter((cy) => couv[cy].etat === 'bonne').length + ' bien couverts.'
          + (pauvres.length ? ' Pauvres : ' + pauvres.join(' ') + '.' : ''));
        const choisis = L.paysPauvres(couv, VEILLE_PAYS_PAR_JOUR, Math.floor(Date.now() / 86400000) * VEILLE_PAYS_PAR_JOUR);
        rapport.veille = [];
        for (const cy of choisis) {
          if (Date.now() > echeance) break;
          const n = page.reg.noms[cy] || {};
          const fr = L.PAYS_FRANCOPHONES.has(cy);
          const r = await traiter({ id: 'veille_' + aujourdhui + '_' + cy, q: fr ? (n.fr || cy) + ' sécurité' : (n.en || n.fr || cy) + ' security', pays: [cy], jours: 3, lang: fr ? 'fr' : 'en' }, true);
          rapport.veille.push({ cy, couverture: couv[cy].score, muet: couv[cy].muet, faits: r.resultat.faits.length, inseres: r.insertions.length, quarantaine: r.quarantaines.length });
        }
      } catch (e) { console.warn('::warning::Couverture ou veille non faite : ' + e.message); }
      // Objectif 2 — recoupement proposé des critiques et élevés à source unique.
      rapport.recoupements = [];
      for (const a of L.aRecouper(cache, RECOUPEMENTS_PAR_JOUR)) {
        if (Date.now() > echeance) break;
        const r = await L.servirDemande({ q: a.title.slice(0, A.Q_MAX), pays: a.cy && a.cy !== 'INT' ? [a.cy] : [], jours: 3 },
          Object.assign({}, ctx, { existants: [] }));
        const domA = (() => { try { return A.domaineRacine(new URL(a.url).hostname); } catch (_) { return ''; } })();
        const autres = r.resultat.faits.filter((f) => L.memeFait({ titre: a.title, url: a.url, cy: a.cy }, { titre: f.titre, url: f.liens[0].url, cy: f.cy }))
          .flatMap((f) => f.liens).filter((l) => A.domaineRacine(new URL(l.url).hostname) !== domA);
        rapport.recoupements.push({ id: a.id, cy: a.cy, titre: a.title, niveau: a.level, url: a.url,
          proposition: autres.length ? 'confirme' : 'inchange', liens: autres.slice(0, 4) });
      }
      // Objectif 5 — contrôle qualité et cohérence de la base.
      rapport.qualite = L.qualiteBase(cache);
      // Objectif 3 — signaux faibles, sur le cumul mensuel publié + le cache.
      try {
        const faits = [];
        const mois = [new Date(), new Date(Date.now() - 20 * 86400000)].map((d) => d.toISOString().slice(0, 7));
        [...new Set(mois)].forEach((m) => {
          const f = path.join(RACINE, 'rapports', 'mensuel', 'faits-' + m + '.json');
          if (!fs.existsSync(f)) return;
          const c = JSON.parse(fs.readFileSync(f, 'utf8'));
          Object.keys(c.pays || {}).forEach((cy) => (c.pays[cy] || []).forEach((x) => faits.push({ titre: x.titreFr || x.titre, cy, publieMs: x.publieMs })));
        });
        cache.forEach((a) => faits.push({ titre: a.title, cy: a.cy, publieMs: a.pubDate }));
        rapport.signaux = L.signauxFaibles(faits);
      } catch (e) { rapport.signaux = []; console.warn('::warning::Signaux faibles non calculés : ' + e.message); }
      // Objectif 6 — médias inconnus vus passer (cumul du jour).
      rapport.decouvertes = [...decouvertes.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 40)
        .map(([dom, e]) => ({ domaine: dom, n: e.n, pays: [...e.pays] }));
      await db.ecrire(C.rapport + '/quotidien', { jour: aujourdhui, le: rapport.le, rapport: JSON.stringify(rapport) });
      console.log('Passage quotidien : veille ' + (rapport.veille || []).length + ' pays, ' + rapport.recoupements.length + ' recoupement(s) cherché(s), '
        + rapport.qualite.doublons.length + ' doublon(s) non fusionné(s), ' + rapport.qualite.horsSurete.length + ' critique(s)/élevé(s) hors sûreté, '
        + rapport.signaux.length + ' signal(aux) faible(s), ' + rapport.decouvertes.length + ' média(s) inconnu(s).');
    }

    // ── 3 bis. Tournée d'agenda des 54 pays ─────────────────────────────────
    const tourPrec = (await db.lire(C.rapport + '/agenda_tournee').catch(() => null)) || {};
    if (!(Date.now() - Date.parse(tourPrec.le || 0) < AGENDA_TOURNEE_MIN * 60000) && Date.now() < echeance) {
      let fait = {};
      try { fait = JSON.parse(tourPrec.fait || '{}'); } catch (_) {}
      let couv = {};
      try { couv = JSON.parse(((await db.lire(C.rapport + '/quotidien').catch(() => null)) || {}).rapport || '{}').couverture || {}; } catch (_) {}
      const paysAgenda = L.tourneeAgenda(Object.keys(page.reg.noms), fait, couv, { n: AGENDA_PAYS_PAR_PASSAGE });
      const bilan = [];
      for (const cy of paysAgenda) {
        if (Date.now() > echeance) break;
        try {
          const ag = await L.collecterAgenda(cy, ctx);
          let inseres = 0, attente = 0;
          for (const e of ag.evenements) {
            const champs = { evenement: JSON.stringify(e), cy, cotation: e.cotation, trouveLe: new Date().toISOString(), debut: new Date(e.debutMs).toISOString() };
            // Un événement n'alerte pas : un seul média du registre noté au
            // seuil suffit à l'inscrire (« probable ») ; en dessous, l'analyste.
            if (e.cotation === 'non_confirme') { if (await db.creer(C.quarantaine, e.cle, Object.assign({ genre: 'agenda', origine: 'agent' }, champs))) attente++; }
            else if (await db.creer(C.agenda, e.cle, champs)) inseres++;
          }
          fait[cy] = Date.now();
          bilan.push({ cy, trouves: ag.evenements.length, inseres, quarantaine: attente, ecartes: ag.ecartes });
          console.log('Agenda ' + cy + ' : ' + ag.evenements.length + ' événement(s) daté(s), ' + inseres + ' inscrit(s), ' + attente + ' en attente — écartés : '
            + Object.entries(ag.ecartes).filter((x) => x[1]).map((x) => x[0] + ' ' + x[1]).join(', '));
          ag.evenements.slice(0, 5).forEach((e) => console.log('   ' + new Date(e.debutMs).toISOString().slice(0, 10) + ' [' + e.type + ' · ' + e.cotation + '] ' + e.titre.slice(0, 100)));
        } catch (e) { console.warn('::warning::Agenda ' + cy + ' non collecté : ' + e.message); }
      }
      let hist = [];
      try { hist = JSON.parse(tourPrec.bilans || '[]'); } catch (_) {}
      await db.ecrire(C.rapport + '/agenda_tournee', { le: new Date().toISOString(), fait: JSON.stringify(fait),
        bilans: JSON.stringify(bilan.concat(hist).slice(0, 120)) });
    }

    // ── 4. Purge ─────────────────────────────────────────────────────────────
    const jour = A.jourDe(Date.now());
    for (const x of dem) if (Number(x.data.jour) < jour - 2) await db.effacer(C.demandes, x.id);
    for (const x of await db.lister(C.reponses, 2000)) if (Date.parse(x.data.at) < Date.now() - 14 * 86400000) await db.effacer(C.reponses, x.id);
    for (const x of actus) if (Date.parse(x.data.trouveLe) < Date.now() - 60 * 86400000) await db.effacer(C.actus, x.id);
    for (const x of await db.lister(C.agenda, 3000)) if (x.data.debut && Date.parse(x.data.debut) < Date.now() - 7 * 86400000) await db.effacer(C.agenda, x.id);
    for (const x of quarantaine) if (!x.data.decision && Date.parse(x.data.trouveLe) < Date.now() - 30 * 86400000) await db.effacer(C.quarantaine, x.id);
  } finally {
    await page.fermer();
  }
  console.log('Passage terminé en ' + Math.round((Date.now() - debut) / 1000) + ' s.');
}

if (require.main === module) {
  principal().catch((e) => { console.warn('::warning::Passage de l’agent non terminé : ' + ((e && e.message) || e)); });
}

module.exports = { relireDemande, existantsDe };
