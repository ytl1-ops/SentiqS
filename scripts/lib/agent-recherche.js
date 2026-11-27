'use strict';
// Agent de recherche d'actus — la partie du job qui ne dépend d'aucun
// navigateur (22/11/2026). Voir web/js/agent-recherche.js pour le pourquoi,
// scripts/agent-recherche.js pour l'enchaînement.
//
// Tout ce qui est ici est pur ou prend ses dépendances en argument : les
// tests le rejouent avec de faux moteurs (scripts/test/agent-recherche.test.js).
//
// Règles tenues ici, chacune avec sa raison :
//   · liste blanche = les médias du registre SRCS de l'appli, jamais un
//     domaine découvert au passage : un média inconnu n'est pas une source,
//     c'est une piste (comptée pour la découverte de sources, jamais affichée
//     comme un fait) ;
//   · on ne télécharge que les points d'accès des moteurs, jamais la page de
//     l'article : rien de ce que publie un site ne s'exécute ni ne se lit
//     au-delà du titre et de l'extrait que le moteur en donne ;
//   · « Confirmé » = deux médias distincts du registre (domaines racines
//     différents) sur le même fait — deux résultats du même média ne
//     recoupent rien ;
//   · un fait seulement probable ou non confirmé n'entre jamais seul dans la
//     base : il attend l'analyste.

const crypto = require('crypto');
const noyau = require('../../web/js/noyau.js');
const A = require('../../web/js/agent-recherche.js');

// Domaines qui hébergent n'importe qui, ou qui ne sont que des relais : ils
// figurent au registre comme adresse technique d'une source, jamais comme
// garantie de l'éditeur.
const HOTES_RELAIS = new Set([
  'google.com', 'bing.com', 'rsshub.app', 't.me', 'twitter.com', 'x.com', 'facebook.com', 'youtube.com',
  'instagram.com', 'tiktok.com', 'linkedin.com', 'feedburner.com', 'blogspot.com', 'wordpress.com',
  'medium.com', 'substack.com', 'nitter.net', 'telegram.org', 'whatsapp.com', 'feedly.com',
]);

// listeBlanche(srcs) : domaine racine → source du registre (la mieux notée
// quand plusieurs entrées partagent un domaine).
function listeBlanche(srcs) {
  const m = new Map();
  const poser = (hote, s) => {
    const d = A.domaineRacine(hote);
    if (!d || HOTES_RELAIS.has(d)) return;
    const deja = m.get(d);
    if (!deja || (Number(s.score) || 0) > (Number(deja.score) || 0)) m.set(d, s);
  };
  (srcs || []).forEach((s) => {
    if (!s || !s.id) return;
    [s.url, s.rss].forEach((u) => {
      if (typeof u !== 'string') return;
      try {
        const x = new URL(u);
        poser(x.hostname, s);
        // Requête Google News « site:domaine » : le média visé est le domaine.
        const q = x.searchParams.get('q') || '';
        const site = /site:([a-z0-9.-]+)/i.exec(q);
        if (site) poser(site[1], s);
      } catch (_) { /* adresse illisible : ignorée */ }
    });
  });
  return m;
}

// ── Moteurs ─────────────────────────────────────────────────────────────────
function urlBing(q, marche) {
  // Tri par date : la sonde du 22/11/2026 a montré que l'ordre par défaut
  // (pertinence) renvoyait surtout des articles de plus d'un mois — 36 sur 85
  // écartés « hors période » pour l'agenda ivoirien.
  return 'https://www.bing.com/news/search?q=' + encodeURIComponent(q) + '&format=rss&mkt=' + encodeURIComponent(marche || 'fr-FR')
    + '&qft=' + encodeURIComponent('sortbydate="1"');
}
function urlReliefweb(q) {
  const p = ['appname=sentiqs-veille', 'query[value]=' + encodeURIComponent(q), 'sort[]=date:desc', 'limit=15',
    'fields[include][]=title', 'fields[include][]=url_alias', 'fields[include][]=date.original', 'fields[include][]=body',
    'fields[include][]=source.shortname'];
  return 'https://api.reliefweb.int/v2/reports?' + p.join('&');
}

// requetes(demande, noms) : les appels d'une demande, au plus cinq. `noms` :
// cy → { fr, en } (lus dans la page). Le nom du pays est ajouté s'il manque
// à la question ; la variante anglaise remplace le nom français par l'anglais.
function requetes(d, noms) {
  const q = A.nettoyerRequete(d.q);
  if (!q) return [];
  const sansAccent = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pays = (d.pays || []).filter((c) => noms && noms[c]).slice(0, 2);
  const variantes = pays.length ? pays.map((cy) => {
    const n = noms[cy];
    const contient = sansAccent(q).includes(sansAccent(n.fr)) || (n.en && sansAccent(q).includes(sansAccent(n.en)));
    const fr = contient ? q : n.fr + ' ' + q;
    let en = fr;
    if (n.en && n.en !== n.fr) en = fr.replace(new RegExp(n.fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), n.en);
    return { fr, en };
  }) : [{ fr: q, en: q }];
  const out = [];
  variantes.forEach((v) => {
    out.push({ moteur: 'bing', url: urlBing(v.fr, 'fr-FR') });
    if (v.en !== v.fr || !pays.length) out.push({ moteur: 'bing', url: urlBing(v.en, 'en-GB') });
  });
  out.push({ moteur: 'reliefweb', url: urlReliefweb(variantes[0].fr) });
  return out.slice(0, 5);
}

// ── Lecture des réponses de moteurs ─────────────────────────────────────────
// Expressions régulières, sans analyseur XML ni DOM : rien de ce qu'envoie un
// moteur n'est interprété au-delà du texte de quelques balises.
const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decoder(t) {
  return String(t || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, h) => { const n = parseInt(h, 16); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' '; })
    .replace(/&#(\d{1,7});/g, (_, d) => { const n = Number(d); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' '; })
    .replace(/&([a-z]+);/gi, (m, e) => (ENTITES[e.toLowerCase()] !== undefined ? ENTITES[e.toLowerCase()] : m));
}
function balise(bloc, nom) {
  const m = new RegExp('<' + nom + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + nom + '>', 'i').exec(bloc);
  return m ? decoder(m[1]) : '';
}
// Bing enveloppe l'adresse de l'article : …/news/apiclick.aspx?…&url=<adresse>.
function urlReelle(lien) {
  try {
    const x = new URL(lien);
    if (/(^|\.)bing\.com$/i.test(x.hostname)) {
      const u = x.searchParams.get('url');
      return u ? A.urlSure(u) : null;
    }
    return A.urlSure(lien);
  } catch (_) { return null; }
}
function parserRss(xml, moteur) {
  const items = String(xml || '').match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  return items.slice(0, 40).map((it) => {
    const url = urlReelle(balise(it, 'link').trim());
    const pub = Date.parse(balise(it, 'pubDate').trim());
    return {
      titre: A.nettoyerTexte(balise(it, 'title'), A.TITRE_MAX),
      extrait: A.nettoyerTexte(decoder(balise(it, 'description')), A.EXTRAIT_MAX),
      url, publieMs: pub > 0 ? pub : null,
      nomSource: A.nettoyerTexte(balise(it, 'News:Source') || balise(it, 'source'), 80),
      moteur,
    };
  }).filter((c) => c.url && c.titre.length >= 8);
}
function parserReliefweb(texte) {
  let j;
  try { j = JSON.parse(texte); } catch (_) { return []; }
  return ((j && j.data) || []).slice(0, 30).map((e) => {
    const f = (e && e.fields) || {};
    const pub = Date.parse((f.date && f.date.original) || '');
    return {
      titre: A.nettoyerTexte(f.title, A.TITRE_MAX),
      extrait: A.nettoyerTexte(f.body, A.EXTRAIT_MAX),
      url: A.urlSure(f.url_alias), publieMs: pub > 0 ? pub : null,
      nomSource: A.nettoyerTexte(((f.source || [])[0] || {}).shortname, 80),
      moteur: 'reliefweb',
    };
  }).filter((c) => c.url && c.titre.length >= 8);
}

// ── Recoupement et cotation ─────────────────────────────────────────────────
function memeFait(a, b) {
  if (a.url === b.url) return true;
  if (a.cy && b.cy && a.cy !== b.cy) return false;
  return noyau.articlesSontDoublons({ title: a.titre }, { title: b.titre });
}
// grouper(liste) : union des candidats qui décrivent le même fait.
function grouper(liste) {
  const groupes = [];
  liste.forEach((c) => {
    const g = groupes.find((x) => x.some((y) => memeFait(c, y)));
    if (g) g.push(c); else groupes.push([c]);
  });
  return groupes;
}
// coter(groupe, seuil) : deux domaines racines distincts → confirmé ; un seul
// média noté au seuil d'alerte → probable ; sinon non confirmé. La note seule
// compte : peutAlerter écarte aussi les requêtes Google News pour leur date
// non fiable, mais ici la date vient du moteur, avec l'article lui-même.
function coter(groupe, seuil) {
  const domaines = new Set(groupe.map((c) => c.domaine));
  if (domaines.size >= 2) return 'confirme';
  return groupe.some((c) => noyau.peutAlerter({ score: c.source.score }, seuil === undefined ? 70 : seuil)) ? 'probable' : 'non_confirme';
}
// ── Pertinence sûreté d'un fait trouvé sur le web (22/11/2026) ──────────────
// Premier passage réel : « LEC regularizes 304 volunteers » (compagnie
// d'électricité du Liberia) est parti en quarantaine, à côté de « Gambia Navy
// intercepts boat carrying 150 migrants ». La vraie classify() met les DEUX
// au niveau normal : le niveau seul ne sépare pas l'utile du hors-thème.
// Règle : un fait au-dessus du normal est pertinent ; au niveau normal, il
// l'est seulement si son TITRE (le titre décide, comme dans classify) porte
// un mot du domaine sûreté. Un fait non pertinent reste dans la réponse à la
// question posée (statut « hors_theme »), mais n'est jamais proposé à la base.
const PERTINENCE_SURETE_RE = new RegExp('\\b(' + [
  // forces et ordre public
  'armee', 'armees', 'army', 'military', 'militaires?', 'soldats?', 'soldiers?', 'troops?', 'navy', 'marine', 'gendarmes?', 'gendarmerie', 'police', 'policiers?', 'douane', 'customs', 'forca', 'forcas', 'policia', 'fuerzas', 'fama', 'fardc',
  // violence et menaces
  'attaques?', 'attaquent', 'attaque', 'attack(s|ed)?', 'ataques?', 'jihadistes?', 'djihadistes?', 'jihadists?', 'terroris\\w*', 'insurg\\w*', 'rebelles?', 'rebels?', 'bandits?', 'banditry', 'gunmen', 'hommes armes', 'armed', 'tue(s|e|es)?', 'killed', 'kills?', 'morts?', 'dead', 'mortos', 'muertos', 'enlev\\w*', 'kidnap\\w*', 'sequestr\\w*', 'otages?', 'hostages?', 'explosion', 'explosifs?', 'bomb\\w*', 'ied', 'coup', 'putsch', 'mutinerie', 'mutiny', 'violences?', 'violent', 'clash(es)?', 'affrontements?', 'combats?', 'fighting',
  // mouvements de population et ordre public
  'migrants?', 'migration', 'refugies?', 'refugees?', 'deplaces?', 'displaced', 'frontieres?', 'borders?', 'manifestations?', 'manifestants?', 'protests?', 'protesters?', 'greve', 'strikes?', 'emeutes?', 'riots?', 'couvre-feu', 'curfew', 'arrest\\w*', 'arrete(s|e|es)?', 'interpell\\w*', 'intercept\\w*',
  // criminalité, sinistres, santé publique
  'trafi(c|quants?|cking|ckers?)', 'drogue', 'drugs?', 'cocaine', 'piraterie', 'piracy', 'pirates?', 'braquages?', 'robbery', 'crimes?', 'criminal\\w*', 'incendies?', 'fires?', 'inondations?', 'floods?', 'naufrage', 'shipwreck', 'epidemie', 'outbreak', 'cholera', 'ebola', 'mpox',
  // sûreté au sens propre
  'securite', 'security', 'seguranca', 'seguridad', 'surete', 'evacuat\\w*', 'alerte', 'alert',
].join('|') + ')\\b');
function pertinentSurete(titre, niveau) {
  if (niveau && niveau !== 'normal' && niveau !== 'ok') return true;
  const t = String(titre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, ' ')
    // Locutions figurées : « coup d'envoi », « coup de pouce », « coup de cœur » ne sont pas un putsch.
    .replace(/\bcoups? d(e|u|es)? ?(envoi|pouce|coeur|projecteur|maitre|theatre|gueule|main)\b/g, ' ');
  return PERTINENCE_SURETE_RE.test(t);
}

function cleFait(cy, titre) {
  return crypto.createHash('sha256').update(String(cy) + '\n' + noyau.titreNormalise(titre)).digest('hex').slice(0, 40);
}
function estDejaDansBase(c, existants) {
  return (existants || []).some((e) => e && (e.url === c.url
    || ((!c.cy || !e.cy || e.cy === c.cy) && noyau.articlesSontDoublons({ title: c.titre }, { title: e.title }))));
}

// ── Une demande, de bout en bout ────────────────────────────────────────────
/**
 * @param d     demande (agent_demandes), déjà relue
 * @param ctx.chercher(url) → { ok, texte, bloque, status, raison }  (fetchRespectueux)
 * @param ctx.blanche      listeBlanche(SRCS)
 * @param ctx.noms         cy → { fr, en }
 * @param ctx.analyser(candidats) → Promise<[{ cy, level, cat, article }|null]>  (la vraie page)
 * @param ctx.existants    articles déjà dans la base ({ title, cy, url })
 * @param ctx.maintenant
 * @returns { resultat, insertions, quarantaines, decouvertes }
 */
async function servirDemande(d, ctx) {
  const maintenant = ctx.maintenant === undefined ? Date.now() : ctx.maintenant;
  const ecartes = { hors_liste: 0, sans_date: 0, hors_periode: 0, autre_pays: 0, hors_surete: 0, doublon: 0 };
  const etats = new Map();
  const bruts = [];
  const decouvertes = new Map(); // domaine hors registre → occurrences (découverte de sources)
  for (const r of requetes(d, ctx.noms)) {
    const nom = (A.MOTEURS.find((m) => m.id === r.moteur) || {}).nom || r.moteur;
    const e = etats.get(nom) || { nom, etat: 'ok', n: 0 };
    let rep;
    try { rep = await ctx.chercher(r.url); } catch (err) { rep = { ok: false, raison: String(err && err.message) }; }
    if (!rep || !rep.ok) {
      if (e.n === 0) e.etat = rep && rep.bloque ? 'robots' : (rep && rep.status === 429 ? 'quota' : 'erreur');
    } else {
      e.etat = 'ok';
      const items = r.moteur === 'reliefweb' ? parserReliefweb(rep.texte) : parserRss(rep.texte, r.moteur);
      e.n += items.length;
      bruts.push(...items);
    }
    etats.set(nom, e);
  }
  // Une même adresse ne compte qu'une fois, quel que soit le moteur.
  const vus = new Set();
  const candidats = [];
  bruts.forEach((c) => {
    if (vus.has(c.url)) return;
    vus.add(c.url);
    const domaine = A.domaineRacine(new URL(c.url).hostname);
    const source = ctx.blanche.get(domaine);
    if (!source) {
      ecartes.hors_liste++;
      if (domaine && !HOTES_RELAIS.has(domaine)) decouvertes.set(domaine, (decouvertes.get(domaine) || 0) + 1);
      return;
    }
    if (!c.publieMs) { ecartes.sans_date++; return; }
    if (c.publieMs > maintenant + 3600000 || c.publieMs < maintenant - (Number(d.jours) || A.JOURS_DEFAUT) * 86400000) { ecartes.hors_periode++; return; }
    candidats.push(Object.assign({}, c, { domaine, source }));
  });

  // La vraie page décide du pays, du niveau et de la catégorie : rien n'est
  // réimplémenté à côté (même règle que la collecte).
  const analyses = candidats.length ? await ctx.analyser(candidats) : [];
  const retenus = [];
  candidats.forEach((c, i) => {
    const an = analyses[i];
    if (!an || !an.article) { ecartes.hors_surete++; return; }
    if (an.cat === 'sport' || an.cat === 'culture') { ecartes.hors_surete++; return; }
    const voulus = (d.pays || []);
    if (voulus.length ? voulus.indexOf(an.cy) === -1 : (!an.cy || an.cy === 'INT')) { ecartes.autre_pays++; return; }
    retenus.push(Object.assign(c, { cy: an.cy, niveau: an.level, cat: an.cat, article: an.article }));
  });

  const RANG = { crit: 0, high: 1, mod: 2, normal: 3 };
  const faits = [];
  const insertions = [];
  const quarantaines = [];
  grouper(retenus).forEach((g) => {
    g.sort((a, b) => (Number(b.source.score) || 0) - (Number(a.source.score) || 0));
    const tete = g[0];
    const cotation = coter(g);
    const deja = g.some((c) => estDejaDansBase(c, ctx.existants));
    const pertinent = pertinentSurete(tete.titre, tete.niveau);
    const statut = deja ? 'deja' : (!pertinent ? 'hors_theme' : (cotation === 'confirme' ? 'insere' : 'quarantaine'));
    const liens = g.slice(0, 6).map((c) => ({ url: c.url, source: c.source.n, moteur: c.moteur }));
    faits.push({ titre: tete.titre, extrait: tete.extrait, liens, publieMs: Math.max(...g.map((c) => c.publieMs)),
      cy: tete.cy, niveau: tete.niveau, cotation, statut });
    if (deja || !pertinent) return;
    const srcs = [...new Set(g.map((c) => c.source.id))];
    const article = Object.assign({}, tete.article, {
      srcs, primary: tete.source.id, crosses: [...new Set(g.map((c) => c.source.n))],
      verified: srcs.length >= 2,
      origine: 'agent', _agentCotation: cotation, _agentLiens: liens,
      _agentTrouveLe: new Date(maintenant).toISOString(), _agentDemande: d.id || null,
    });
    (statut === 'insere' ? insertions : quarantaines).push({ cle: cleFait(tete.cy, tete.titre), cy: tete.cy, cotation, article });
  });
  faits.sort((a, b) => (RANG[a.niveau] - RANG[b.niveau]) || (b.publieMs - a.publieMs));
  return {
    resultat: { q: A.nettoyerRequete(d.q), faits: faits.slice(0, 25), moteurs: [...etats.values()].concat(
      A.MOTEURS.filter((m) => m.etat === 'refuse').map((m) => ({ nom: m.nom, etat: 'robots', n: 0 }))),
    ecartes, le: new Date(maintenant).toISOString() },
    insertions, quarantaines, decouvertes,
  };
}

// ── Contrôle qualité de la base (objectif 5, 22/11/2026) ────────────────────
// Ce que l'agent relève dans le cache publié, sans rien y toucher : la liste
// va à l'analyste. Trois familles :
//   · doublons non fusionnés : même pays, même fait (articlesSontDoublons),
//     deux identifiants — le dédoublonnage les a manqués ;
//   · dates suspectes : publication absente ou dans le futur ;
//   · critiques ou élevés « hors sûreté » selon la règle du rapport mensuel
//     (scripts/lib/hors-surete.js) — candidats faux positifs (« crise »,
//     « frappe » au figuré…), jamais déclassés d'office.
function qualiteBase(articles, maintenant) {
  const t = maintenant === undefined ? Date.now() : maintenant;
  const { themeHorsSurete } = require('./hors-surete');
  const arts = (articles || []).filter((a) => a && a.title);
  const doublons = [];
  const parPays = new Map();
  arts.forEach((a) => { const l = parPays.get(a.cy) || []; l.push(a); parPays.set(a.cy, l); });
  parPays.forEach((l) => {
    for (let i = 0; i < l.length && doublons.length < 40; i++) {
      for (let j = i + 1; j < l.length; j++) {
        if (l[i].id !== l[j].id && noyau.articlesSontDoublons(l[i], l[j])) {
          doublons.push({ cy: l[i].cy, a: l[i].title, b: l[j].title, ida: l[i].id, idb: l[j].id });
          break;
        }
      }
    }
  });
  const dates = arts.filter((a) => !a.pubDate || a.pubDate > t + 3600000)
    .slice(0, 30).map((a) => ({ cy: a.cy, titre: a.title, motif: a.pubDate ? 'future' : 'absente' }));
  const horsSurete = arts.filter((a) => (a.level === 'crit' || a.level === 'high'))
    .map((a) => ({ a, theme: themeHorsSurete({ titre: a.title }, a.cy) }))
    .filter((x) => x.theme && x.theme !== 'autre_pays')
    .slice(0, 30).map((x) => ({ cy: x.a.cy, titre: x.a.title, niveau: x.a.level, theme: x.theme }));
  return { le: new Date(t).toISOString(), articles: arts.length, doublons, dates, horsSurete, contradictions: contradictions(arts) };
}

// ── Faits à recouper (objectif 2) ───────────────────────────────────────────
// Les critiques et élevés à source unique du cache : ceux dont la cotation
// gagnerait le plus à un second média. L'agent en cherche le recoupement et
// PROPOSE une cotation ; il ne change jamais celle du cache.
function aRecouper(articles, max) {
  const RANG = { crit: 0, high: 1 };
  return (articles || []).filter((a) => a && a.title && (a.level in RANG)
      && new Set(Array.isArray(a.srcs) && a.srcs.length ? a.srcs : [a.primary]).size < 2)
    .sort((x, y) => (RANG[x.level] - RANG[y.level]) || ((y.pubDate || 0) - (x.pubDate || 0)))
    .slice(0, max || 5);
}

// ── Signaux faibles (objectif 3) ────────────────────────────────────────────
// Une famille d'événement (attaque, enlèvement, manifestation, inondation…,
// FAMILLES_EVENEMENT du noyau) qui revient dans au moins `seuil` faits
// distincts d'un pays sur les `recentJ` derniers jours, alors qu'elle n'y
// figurait au plus qu'une fois sur les `baseJ` jours d'avant. On compare un
// pays à lui-même : seulement là où le cumul mensuel donne une base (pays du
// rapport mensuel). Sans base, aucun signal n'est affirmé.
const NOMS_FAMILLES = ['morts', 'blessés', 'autocar', 'accident', 'attaque', 'enlèvement', 'coup d’État',
  'inondation', 'explosion', 'incendie', 'naufrage', 'manifestation'];
function signauxFaibles(faits, maintenant, o) {
  const opt = Object.assign({ recentJ: 3, baseJ: 14, seuil: 3 }, o || {});
  const t = maintenant === undefined ? Date.now() : maintenant;
  const debutRecent = t - opt.recentJ * 86400000;
  const debutBase = debutRecent - opt.baseJ * 86400000;
  const comptes = new Map(); // cy|famille → { recent: [titres], base: n }
  const vus = new Set();
  const avecBase = new Set();
  (faits || []).forEach((f) => {
    if (!f || !f.titre || !f.cy || !(f.publieMs > debutBase) || f.publieMs > t + 3600000) return;
    if (f.publieMs <= debutRecent) avecBase.add(f.cy);
    const k0 = f.cy + '|' + noyau.titreNormalise(f.titre);
    if (vus.has(k0)) return;
    vus.add(k0);
    noyau.famillesEvenement(f.titre).forEach((i) => {
      if (i <= 1) return; // « morts », « blessés » : un bilan, pas un type d'événement
      const k = f.cy + '|' + i;
      const c = comptes.get(k) || { recent: [], base: 0 };
      if (f.publieMs > debutRecent) {
        if (!c.recent.some((x) => noyau.articlesSontDoublons({ title: x }, { title: f.titre }))) c.recent.push(f.titre);
      } else c.base++;
      comptes.set(k, c);
    });
  });
  const out = [];
  comptes.forEach((c, k) => {
    const [cy, i] = k.split('|');
    if (avecBase.has(cy) && c.recent.length >= opt.seuil && c.base <= 1) {
      out.push({ cy, famille: NOMS_FAMILLES[Number(i)], recents: c.recent.length, avant: c.base, exemples: c.recent.slice(0, 3) });
    }
  });
  return out.sort((a, b) => b.recents - a.recents);
}

// ── Agenda de la vie de chaque pays (22/11/2026) ────────────────────────────
// YORO : « faire de l'agenda un point de référence de collecte sur la vie de
// chaque pays : colloque, concert, séminaire, foire, ouverture de session de
// l'Assemblée nationale, fermeture de voie, inauguration, mise en service de
// routes ou d'échangeurs… ». Ces événements déplacent du monde ou ferment un
// axe : c'est leur lien avec la sûreté (circulation, foules), pas un niveau
// d'alerte — ils n'en font jamais monter un.
//
// Requêtes par pays, la Côte d'Ivoire d'abord (pays pilote n° 1). Un
// événement n'entre que s'il porte une DATE ÉCRITE dans son titre ou son
// extrait (« du 25 au 27 novembre », « le 3 décembre ») : sans date annoncée,
// rien n'est deviné.
const REQUETES_AGENDA = [
  'colloque', 'séminaire', 'concert', 'foire', 'salon', 'festival',
  'ouverture de la session Assemblée nationale', 'fermeture de voie', 'circulation perturbée travaux',
  'inauguration', 'mise en service échangeur', 'mise en service route',
];
// Les 54 pays, pas seulement la Côte d'Ivoire (YORO, 22/11/2026). La presse
// d'un pays non francophone se cherche en anglais : Bing en-GB couvre bien
// l'Angola, le Mozambique ou la Libye en anglais, et la page (parseRSS) ne
// reconnaît les types d'événement qu'en français et en anglais — une requête
// portugaise ou arabe ramènerait des titres qu'elle ne sait pas classer.
const REQUETES_AGENDA_EN = [
  'conference', 'seminar', 'concert', 'trade fair', 'exhibition', 'festival',
  'parliament session opening', 'road closure', 'traffic diversion roadworks',
  'inauguration', 'interchange commissioned', 'road commissioned',
];
const PAYS_FRANCOPHONES = new Set(['BJ', 'BF', 'BI', 'CM', 'CF', 'KM', 'CG', 'CD', 'CI', 'DJ', 'GA', 'GN', 'MG', 'ML',
  'MR', 'MA', 'NE', 'RW', 'SN', 'SC', 'TD', 'TG', 'TN', 'DZ', 'MU']);
// dateAnnoncee(texte, publieMs) : { debutMs, finMs } d'un événement écrit en
// toutes lettres, ou null. Partagée avec la page depuis le 27/11/2026
// (web/js/calendrier-foules.js) : l'agenda détecté dans le Flux et celui de
// l'agent lisent une date de la même façon.
const { dateAnnoncee } = require('../../web/js/calendrier-foules.js');
function requetesAgenda(cy, noms) {
  const n = noms && noms[cy];
  if (!n) return [];
  if (PAYS_FRANCOPHONES.has(cy)) return REQUETES_AGENDA.map((q) => ({ moteur: 'bing', url: urlBing(n.fr + ' ' + q, 'fr-FR'), q }));
  return REQUETES_AGENDA_EN.map((q) => ({ moteur: 'bing', url: urlBing((n.en || n.fr) + ' ' + q, 'en-GB'), q }));
}

// ── Couverture des 54 pays ──────────────────────────────────────────────────
// couverturePays(codes, o) : pour chaque pays, ce que la base sait de lui.
// o = { cache, agenda: [{cy, debutMs}], sources: [{cy, score}], muets, horsAlerte,
// seuil, maintenant }. Rend { cy: { actus36h, actus7j, agenda, sources, muet,
// horsAlerte, score, etat } }. Le score (0 à 100) ne note pas le danger d'un
// pays : il dit combien l'outil le voit, pour que la veille aille d'abord là où
// il ne sait rien.
function couverturePays(codes, o) {
  const m = o.maintenant === undefined ? Date.now() : o.maintenant;
  const seuil = o.seuil || 70;
  const out = {};
  (codes || []).forEach((cy) => { out[cy] = { actus36h: 0, actus7j: 0, agenda: 0, sources: 0, muet: false, horsAlerte: false }; });
  (o.cache || []).forEach((a) => {
    const c = out[a && a.cy];
    if (!c) return;
    const age = m - (Number(a.pubDate) || 0);
    if (age >= 0 && age < 36 * 3600000) c.actus36h++;
    if (age >= 0 && age < 7 * 86400000) c.actus7j++;
  });
  (o.agenda || []).forEach((e) => {
    const c = out[e && e.cy];
    if (c && Number(e.debutMs) >= m - 86400000) c.agenda++;
  });
  (o.sources || []).forEach((s) => {
    const c = out[s && s.cy];
    if (c && noyau.peutAlerter({ score: s.score, url: s.url, rss: s.rss }, seuil)) c.sources++;
  });
  (o.muets || []).forEach((cy) => { if (out[cy]) out[cy].muet = true; });
  (o.horsAlerte || []).forEach((cy) => { if (out[cy]) out[cy].horsAlerte = true; });
  Object.values(out).forEach((c) => {
    const p = Math.min(40, c.actus36h * 8) + Math.min(20, c.actus7j * 2) + Math.min(20, c.agenda * 5) + Math.min(20, c.sources * 7);
    c.score = c.muet ? Math.min(p, 20) : c.horsAlerte ? Math.min(p, 40) : p;
    c.etat = c.score < 35 ? 'pauvre' : c.score < 70 ? 'moyenne' : 'bonne';
  });
  return out;
}

// tourneeAgenda(codes, fait, couv, o) : les pays à chercher à ce passage.
// fait = { cy: ms du dernier passage }. La Côte d'Ivoire revient toutes les
// `o.prioriteH` heures ; les autres, jamais faits d'abord, puis le plus ancien,
// à égalité le moins couvert. Au plus `o.n` pays, CI comprise.
function tourneeAgenda(codes, fait, couv, o) {
  const opt = Object.assign({ n: 2, prioritaires: ['CI'], prioriteH: 4, maintenant: Date.now() }, o || {});
  const f = fait || {};
  const choix = opt.prioritaires.filter((cy) => codes.includes(cy) && !(opt.maintenant - (f[cy] || 0) < opt.prioriteH * 3600000));
  const reste = codes.filter((cy) => !opt.prioritaires.includes(cy)).sort((a, b) =>
    ((f[a] || 0) - (f[b] || 0)) || (((couv || {})[a] || {}).score || 0) - (((couv || {})[b] || {}).score || 0) || a.localeCompare(b));
  return choix.concat(reste).slice(0, opt.n);
}

// paysPauvres(couv, n, decalage) : les pays les moins couverts, à tour de rôle
// parmi le tiers le plus pauvre (un seul pays muet ne monopolise pas la veille).
function paysPauvres(couv, n, decalage) {
  const tries = Object.keys(couv || {}).sort((a, b) => couv[a].score - couv[b].score || a.localeCompare(b));
  const vivier = tries.slice(0, Math.max(n, Math.ceil(tries.length / 3)));
  const d = (Number(decalage) || 0) % Math.max(1, vivier.length);
  return vivier.slice(d).concat(vivier.slice(0, d)).slice(0, n);
}
/**
 * collecterAgenda(cy, ctx) : événements datés et sourcés d'un pays.
 * ctx comme servirDemande ; ctx.analyser doit rendre aussi agendaType.
 * Rend { evenements: [{ cle, cy, type, titre, extrait, liens, debutMs, finMs, cotation }], ecartes }.
 */
async function collecterAgenda(cy, ctx) {
  const maintenant = ctx.maintenant === undefined ? Date.now() : ctx.maintenant;
  const ecartes = { hors_liste: 0, sans_date: 0, hors_periode: 0, autre_pays: 0, pas_un_evenement: 0 };
  const vus = new Set();
  const candidats = [];
  for (const r of requetesAgenda(cy, ctx.noms)) {
    let rep;
    try { rep = await ctx.chercher(r.url); } catch (_) { rep = null; }
    if (!rep || !rep.ok) continue;
    parserRss(rep.texte, 'bing').forEach((c) => {
      if (vus.has(c.url)) return;
      vus.add(c.url);
      const domaine = A.domaineRacine(new URL(c.url).hostname);
      const source = ctx.blanche.get(domaine);
      if (!source) { ecartes.hors_liste++; return; }
      if (!c.publieMs || c.publieMs < maintenant - 30 * 86400000) { ecartes.hors_periode++; return; }
      const date = dateAnnoncee(c.titre + ' ' + c.extrait, c.publieMs);
      if (!date) { ecartes.sans_date++; return; }
      if (date.finMs < maintenant - 86400000 || date.debutMs > maintenant + 120 * 86400000) { ecartes.hors_periode++; return; }
      candidats.push(Object.assign({}, c, { domaine, source }, date));
    });
  }
  const analyses = candidats.length ? await ctx.analyser(candidats) : [];
  const retenus = [];
  candidats.forEach((c, i) => {
    const an = analyses[i];
    if (!an || an.cy !== cy) { ecartes.autre_pays++; return; }
    if (!an.agendaType) { ecartes.pas_un_evenement++; return; }
    retenus.push(Object.assign(c, { cy, type: an.agendaType }));
  });
  const evenements = grouper(retenus).map((g) => {
    g.sort((a, b) => (Number(b.source.score) || 0) - (Number(a.source.score) || 0));
    const t = g[0];
    return { cle: cleFait(cy, 'agenda ' + t.titre), cy, type: t.type, titre: t.titre, extrait: t.extrait,
      liens: g.slice(0, 4).map((c) => ({ url: c.url, source: c.source.n })), sourceId: t.source.id,
      debutMs: t.debutMs, finMs: t.finMs, cotation: coter(g) };
  });
  return { evenements, ecartes };
}

// ── Cohérence : contradictions entre sources ────────────────────────────────
// Deux médias rapportent le même fait (même pays, articlesSontDoublons) avec
// des bilans différents (« 5 morts » / « 12 morts »), ou le même fait est
// rangé dans deux pays. L'agent le signale ; il ne tranche pas.
function contradictions(articles) {
  const out = [];
  const arts = (articles || []).filter((a) => a && a.title).map((a) => ({ a,
    f: noyau.famillesEvenement(a.title), n: noyau.nombresDuTitre(a.title), m: new Set(noyau.motsSignificatifs(a.title)) }))
    .filter((x) => x.f.size);
  for (let i = 0; i < arts.length && out.length < 30; i++) {
    for (let j = i + 1; j < arts.length; j++) {
      const x = arts[i], y = arts[j];
      if (x.a.id === y.a.id || ![...x.f].some((f) => y.f.has(f))) continue;
      let communs = 0;
      x.m.forEach((m) => { if (y.m.has(m)) communs++; });
      if (communs < 3) continue;
      if (x.a.cy && y.a.cy && x.a.cy !== y.a.cy && x.a.cy !== 'INT' && y.a.cy !== 'INT') {
        out.push({ motif: 'pays', a: x.a.title, b: y.a.title, cyA: x.a.cy, cyB: y.a.cy });
        break;
      }
      if (x.a.cy === y.a.cy && x.n.size && y.n.size && ![...x.n].some((n) => y.n.has(n))) {
        out.push({ motif: 'bilan', cy: x.a.cy, a: x.a.title, b: y.a.title });
        break;
      }
    }
  }
  return out;
}

module.exports = { pertinentSurete, REQUETES_AGENDA, REQUETES_AGENDA_EN, PAYS_FRANCOPHONES, couverturePays, tourneeAgenda, paysPauvres, dateAnnoncee, requetesAgenda, collecterAgenda, contradictions, HOTES_RELAIS, listeBlanche, urlBing, urlReliefweb, requetes, decoder, parserRss, parserReliefweb,
  urlReelle, memeFait, grouper, coter, cleFait, estDejaDansBase, servirDemande, qualiteBase, aRecouper, signauxFaibles, NOMS_FAMILLES };
