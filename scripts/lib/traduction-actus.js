'use strict';
// Traduction des actus du cache partagé en français ET en anglais, faite par
// le job de collecte (Node, réseau direct) — 19/11/2026.
//
// Demande de YORO : « des traductions automatiques générales selon les
// langues choisies (FR / ENG). Masquer les actus non traduites. » Jusque-là,
// chaque navigateur traduisait lui-même, titre par titre, par des services
// gratuits appelés au travers de relais publics saturés : en anglais, la
// plupart des titres français restaient « Traduction en cours… » ou
// « traduction indisponible ». Ce module traduit une fois pour tous les
// visiteurs, et range le résultat DANS l'article :
//
//   a.tr = { en: { t: 'titre anglais', s: 'chapô anglais' }, fr: { t, s } }
//
// La page sème ces traductions dans son cache (semerTraductionsArticles) :
// L() les rend sans attendre aucun service. Une langue n'est rangée que si
// elle diffère de la langue du texte d'origine.
//
// Mêmes services gratuits que traduction-job.js (Google « gtx », MyMemory en
// repli), sans clé. Les titres d'une même langue partent par paquets, une
// ligne par titre : quelques dizaines de requêtes par passage au lieu de
// plusieurs centaines. Un paquet dont le nombre de lignes revient faux est
// rejoué titre par titre — jamais une traduction collée au mauvais titre.
//
// Mémoire : une traduction déjà rangée dans le cache précédent est reprise
// telle quelle (clé = langue cible + texte d'origine). Seuls les nouveaux
// textes coûtent une requête ; le budget de temps épuisé, le reste attend le
// passage suivant.

const { traduire: traduireUn } = require('./traduction-job');

const CIBLES = ['fr', 'en'];
const PAQUET_MAX_CARACTERES = 1400; // texte brut ; ~4 000 une fois encodé dans l'adresse
const PAQUET_MAX_LIGNES = 25;
// Traducteur hors ligne : un lot de 40 lignes (titres ou chapôs) tient en une
// dizaine de secondes sur un runner à 4 cœurs, sous le délai du pont Node.
const PAQUET_LOCAL_LIGNES = 40;
const PAQUET_LOCAL_CARACTERES = 12000;
const DELAI_REQUETE_MS = 12000;
const PAUSE_ENTRE_REQUETES_MS = 250;
const GOOGLE_ECHECS_MAX = 3;

const cleMemoire = (cible, texte) => cible + '\u0001' + texte;

// Mémoire des traductions déjà faites, lue dans les articles du cache
// précédent (et dans ceux du passage, qui ont pu en hériter).
function memoire(articles) {
  const m = new Map();
  (articles || []).forEach((a) => {
    if (!a || !a.tr || typeof a.tr !== 'object') return;
    CIBLES.forEach((c) => {
      const t = a.tr[c];
      if (!t) return;
      if (a.title && typeof t.t === 'string' && t.t) m.set(cleMemoire(c, a.title), t.t);
      if (a.analysis && typeof t.s === 'string' && t.s) m.set(cleMemoire(c, a.analysis), t.s);
    });
  });
  return m;
}

// Une ligne de paquet ne doit pas contenir de saut de ligne : on les aplatit.
const uneLigne = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function bornerTexte(texte, max) {
  const t = uneLigne(texte);
  if (!max || t.length <= max) return t;
  const coupe = t.slice(0, max);
  const fin = coupe.lastIndexOf(' ');
  return (fin > max * 0.6 ? coupe.slice(0, fin) : coupe) + '…';
}

const decoder = (s) => s.replace(/&#39;|&#039;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function lireJson(fetchFn, url, delaiMs) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const minuteur = ctl ? setTimeout(() => ctl.abort(), delaiMs) : null;
  try {
    const r = await fetchFn(url, { signal: ctl ? ctl.signal : undefined, headers: { 'User-Agent': 'Mozilla/5.0 SentiqS-traduction' } });
    if (!r || !r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
}

// Un paquet de lignes, une requête Google. Rend un tableau de même longueur,
// ou null (réponse illisible, ou nombre de lignes différent).
async function traduirePaquetGoogle(lignes, source, cible, fetchFn, delaiMs) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&tl=' + cible
    + '&sl=' + encodeURIComponent(source || 'auto') + '&q=' + encodeURIComponent(lignes.join('\n'));
  const j = await lireJson(fetchFn, url, delaiMs);
  if (!Array.isArray(j) || !Array.isArray(j[0])) return null;
  const sortie = j[0].map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : '')).join('');
  const morceaux = sortie.split('\n').map((x) => decoder(x).trim());
  if (morceaux.length !== lignes.length || morceaux.some((x) => !x)) return null;
  return morceaux;
}

// Découpe en paquets de même langue source, bornés en caractères et en lignes.
function paquets(items, bornes) {
  const maxLignes = (bornes && bornes.lignes) || PAQUET_MAX_LIGNES;
  const maxCar = (bornes && bornes.caracteres) || PAQUET_MAX_CARACTERES;
  const parSource = new Map();
  items.forEach((it) => {
    const k = it.source + '>' + it.cible;
    if (!parSource.has(k)) parSource.set(k, []);
    parSource.get(k).push(it);
  });
  const out = [];
  parSource.forEach((liste) => {
    let cour = [];
    let taille = 0;
    liste.forEach((it) => {
      if (cour.length && (taille + it.envoye.length + 1 > maxCar || cour.length >= maxLignes)) {
        out.push(cour); cour = []; taille = 0;
      }
      cour.push(it); taille += it.envoye.length + 1;
    });
    if (cour.length) out.push(cour);
  });
  return out;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Range dans chaque article `a.tr` les traductions FR et EN de son titre et
 * de son chapô.
 *
 * @param articles   articles à publier (modifiés sur place)
 * @param opts.existants  articles du cache précédent (mémoire)
 * @param opts.langues    Map texte → langue ('fr','en','pt','ar','other' ou null)
 *                        telle que la page la détecte (langueSure / detectLangue)
 * @param opts.resumeMax  longueur maximale d'un chapô envoyé (celle de la page)
 * @param opts.echeance   instant (ms) au-delà duquel on n'envoie plus rien
 * @param opts.fetchFn, opts.pauseMs, opts.delaiMs
 * @param opts.traducteurLocal (lignes, source, cible) → Promise<tableau|null>,
 *                        repli hors ligne (scripts/lib/traducteur-local.js)
 * @returns statistiques { repris, traduits, echecs, reportes, requetes }
 */
async function traduireActus(articles, opts) {
  const o = opts || {};
  const fetchFn = o.fetchFn || (typeof fetch === 'function' ? fetch : null);
  const langues = o.langues instanceof Map ? o.langues : new Map(Object.entries(o.langues || {}));
  const mem = memoire([].concat(o.existants || [], articles || []));
  const echeance = o.echeance || (Date.now() + 3 * 60 * 1000);
  const pauseMs = o.pauseMs === undefined ? PAUSE_ENTRE_REQUETES_MS : o.pauseMs;
  const delaiMs = o.delaiMs || DELAI_REQUETE_MS;
  const stats = { repris: 0, traduits: 0, echecs: 0, reportes: 0, requetes: 0 };

  // 1. Ce qu'il faut traduire, et ce que la mémoire fournit déjà.
  const items = [];
  const poser = (a, cible, champ, valeur) => {
    if (!a.tr || typeof a.tr !== 'object') a.tr = {};
    if (!a.tr[cible]) a.tr[cible] = {};
    a.tr[cible][champ] = valeur;
  };
  const NIV = { crit: 0, high: 1, mod: 2 };
  (articles || []).forEach((a) => {
    if (!a) return;
    [['t', a.title, 0], ['s', a.analysis, o.resumeMax || 0]].forEach(([champ, texte, max]) => {
      if (!texte || typeof texte !== 'string') return;
      const source = langues.get(texte);
      // Langue inconnue ou texte trop court (noms, sigles) : la page l'affiche
      // tel quel ; « other » (langue locale longue) part en détection
      // automatique, et seulement pour les titres.
      if (!source || (source === 'other' && champ !== 't')) return;
      CIBLES.forEach((cible) => {
        if (cible === source) return;
        const connu = mem.get(cleMemoire(cible, texte));
        if (connu) { poser(a, cible, champ, connu); stats.repris++; return; }
        items.push({ a, champ, cible, texte, source: source === 'other' ? 'auto' : source,
          envoye: bornerTexte(texte, max), rang: (champ === 't' ? 0 : 10) + (NIV[a.level] !== undefined ? NIV[a.level] : 3) });
      });
    });
  });
  // Titres avant chapôs, critiques d'abord : quand le budget s'épuise, ce
  // sont les chapôs des faits les moins graves qui attendent.
  items.sort((x, y) => x.rang - y.rang);

  // Doublons de texte (le même titre repris par deux articles) : une requête.
  const parCle = new Map();
  items.forEach((it) => {
    const k = cleMemoire(it.cible, it.texte);
    if (!parCle.has(k)) parCle.set(k, { ...it, cibles: [] });
    parCle.get(k).cibles.push(it);
  });
  const uniques = [...parCle.values()];
  if (!fetchFn) { stats.reportes = uniques.length; return stats; }

  // 2. Traduction par paquets ; un paquet refusé est rejoué ligne par ligne.
  const ranger = (u, trad) => {
    const propre = trad && trad.trim() && trad.trim() !== u.envoye ? trad.trim() : null;
    if (!propre) { stats.echecs++; return; }
    mem.set(cleMemoire(u.cible, u.texte), propre);
    u.cibles.forEach((it) => poser(it.a, it.cible, it.champ, propre));
    stats.traduits++;
  };
  // Traducteur hors ligne (scripts/lib/traducteur-local.js) EN PREMIER pour
  // les langues qu'il connaît, depuis le 25/11/2026. Avant, Google passait
  // d'abord : depuis les runners il ne répond plus (0 traduction sur 766
  // requêtes le 22/11/2026), et chaque passage perdait trois délais de 12 s
  // avant de basculer. Les services en ligne restent le repli, et la seule
  // route pour une langue sans modèle local (« auto »). Les lots du local sont
  // plus gros (PAQUET_LOCAL_*) : aucune adresse à borner, et le modèle va
  // d'autant plus vite qu'il reçoit de phrases à la fois.
  const local = typeof o.traducteurLocal === 'function' ? o.traducteurLocal : null;
  const lots = local
    ? paquets(uniques, { lignes: PAQUET_LOCAL_LIGNES, caracteres: PAQUET_LOCAL_CARACTERES }).sort((p, q) => p[0].rang - q[0].rang)
    : paquets(uniques).sort((p, q) => p[0].rang - q[0].rang);
  // Après GOOGLE_ECHECS_MAX paquets refusés d'affilée, Google n'est plus
  // appelé pour ce passage (même idée que creerDisjoncteur dans le noyau).
  let googleEchecs = 0;
  const parLocal = async (lot) => {
    const lignes = lot.map((u) => u.envoye);
    let res = null;
    try { res = await local(lignes, lot[0].source, lot[0].cible); } catch (e) { res = null; }
    // Réponse partielle acceptée : une ligne null reste non traduite.
    if (!Array.isArray(res) || res.length !== lignes.length || !res.some((x) => typeof x === 'string' && x)) return null;
    stats.locaux = (stats.locaux || 0) + res.filter((x) => typeof x === 'string' && x).length;
    return res;
  };
  const enLigne = async (lot) => {
    // Repli en ligne : on redécoupe aux bornes de l'adresse Google.
    for (const sous of paquets(lot)) {
      if (Date.now() >= echeance) { stats.reportes += sous.length; continue; }
      let res = null;
      if (googleEchecs < GOOGLE_ECHECS_MAX) {
        stats.requetes++;
        res = await traduirePaquetGoogle(sous.map((u) => u.envoye), sous[0].source, sous[0].cible, fetchFn, delaiMs);
        googleEchecs = res ? 0 : googleEchecs + 1;
      }
      if (res) {
        sous.forEach((u, i) => ranger(u, res[i]));
      } else if (googleEchecs >= GOOGLE_ECHECS_MAX) {
        // Services en ligne tombés : inutile de les rejouer ligne par ligne,
        // le passage suivant réessaiera. Une langue sans modèle local
        // (« auto ») est comptée à part : ce n'est pas un échec du modèle.
        sous.forEach((u) => { if (u.source === 'auto') stats.sansModele = (stats.sansModele || 0) + 1; else stats.echecs++; });
      } else {
        for (const u of sous) {
          if (Date.now() >= echeance) { stats.reportes++; continue; }
          stats.requetes++;
          let t = null;
          try { t = await traduireUn(u.envoye, u.source, { fetchFn, delaiMs, cible: u.cible }); } catch (e) { t = null; }
          ranger(u, t);
          if (pauseMs) await attendre(pauseMs);
        }
      }
      if (pauseMs) await attendre(pauseMs);
    }
  };
  for (const lot of lots) {
    if (Date.now() >= echeance) { stats.reportes += lot.length; continue; }
    const res = local && lot[0].source !== 'auto' ? await parLocal(lot) : null;
    if (res) {
      // Une ligne que le local a laissée vide part en ligne, avec les autres
      // lignes vides du même lot.
      const restes = [];
      lot.forEach((u, i) => { if (typeof res[i] === 'string' && res[i].trim()) ranger(u, res[i]); else restes.push(u); });
      if (restes.length) await enLigne(restes);
    } else {
      await enLigne(lot);
    }
  }
  return stats;
}

module.exports = { traduireActus, memoire, cleMemoire, paquets, traduirePaquetGoogle, bornerTexte, CIBLES, PAQUET_LOCAL_LIGNES };
