'use strict';
// Avis aux voyageurs du FCDO britannique, lus par l'API de contenu de gov.uk
// (audit du 15/11/2026). Second témoin de la confiance d'un niveau quand la
// collecte se tait : voir lectureAvisOfficiel dans web/js/noyau.js, qui seul
// décide de ce qu'un avis change à l'écran (la confiance, jamais le niveau).
//
// Ici : lire une réponse de l'API, garder l'ancien avis d'un pays qui ne
// répond pas (un silence ne doit pas effacer un témoin), et lister les pays
// où l'avis récent diverge du niveau affiché — la liste de relecture du socle.
const noyau = require('../../web/js/noyau.js');

const API = 'https://www.gov.uk/api/content/foreign-travel-advice/';

function slugFcdo(urlPublique) {
  const m = /foreign-travel-advice\/([a-z0-9-]+)/.exec(String(urlPublique || ''));
  return m ? m[1] : null;
}

// Une réponse de l'API → { statuts, revu, maj, url } ; null si illisible.
// `alert_status` vide veut dire « aucune restriction » : c'est un avis, pas
// une absence d'avis. Sans date lisible, l'avis ne peut rien attester.
function lireReponse(json, slug) {
  if (!json || typeof json !== 'object' || !json.details) return null;
  const statuts = Array.isArray(json.details.alert_status) ? json.details.alert_status.map(String) : [];
  const revu = json.details.reviewed_at || json.public_updated_at || null;
  const maj = json.public_updated_at || null;
  if (!revu || !isFinite(Date.parse(revu))) return null;
  return { statuts, revu, maj, url: 'https://www.gov.uk/foreign-travel-advice/' + slug };
}

// ── Témoins supplémentaires (18/11/2026) ────────────────────────────────────
//
// Affaires mondiales Canada publie ses 230 avis en un seul fichier de données
// ouvertes (Licence du gouvernement ouvert — Canada), indexé par code ISO :
// un appel pour les 54 pays. Le Département d'État publie un flux RSS de ses
// avis (domaine public). Chacun est ramené aux degrés du noyau
// (AVIS_COMPATIBLE) ; le noyau seul décide de ce qu'ils changent.
const API_CANADA = 'https://data.international.gc.ca/travel-voyage/index-updated.json';
const RSS_USA = 'https://travel.state.gov/_res/rss/TAsTWs.xml';

// advisory-state : 0 précautions normales, 1 grande prudence, 2 éviter les
// voyages non essentiels, 3 éviter tout voyage ; has-regional-advisory dit
// qu'une partie du pays est plus restreinte que le reste.
function degreAvisCanada(etat, regional) {
  const e = Number(etat);
  if (e === 3) return 'aat_total';
  if (e === 2) return 'aabe_total';
  if (e === 1) return regional ? 'prudence_partie' : 'prudence';
  if (e === 0) return regional ? 'aat_partie' : 'aucun';
  return null;
}

// Niveau 1 précautions normales, 2 prudence accrue (souvent avec des zones
// « Do Not Travel »), 3 reconsidérer le voyage, 4 ne pas voyager.
function degreAvisUsa(niveau) {
  return ({ 1: 'aucun', 2: 'prudence_partie', 3: 'aabe_total', 4: 'aat_total' })[Number(niveau)] || null;
}

function dateCanada(dp) {
  if (!dp) return null;
  const ts = Number(dp.timestamp);
  if (isFinite(ts) && ts > 0) return new Date(ts * 1000).toISOString();
  const ms = Date.parse(String(dp.date || '').replace(' ', 'T') + (/Z|[+-]\d\d:?\d\d$/.test(String(dp.date || '')) ? '' : 'Z'));
  return isFinite(ms) ? new Date(ms).toISOString() : null;
}

// Le fichier canadien → { cy: témoin } pour les codes demandés.
function lireCanada(json, codes) {
  const data = json && typeof json === 'object' ? (json.data || json) : null;
  const out = {};
  if (!data) return out;
  (codes || []).forEach((cy) => {
    const d = data[cy];
    if (!d) return;
    const degre = degreAvisCanada(d['advisory-state'], Number(d['has-regional-advisory']) === 1);
    const revu = dateCanada(d['date-published']);
    if (!degre || !revu) return;
    const slug = d.eng && d.eng['url-slug'];
    out[cy] = { source: 'Canada', degre, revu,
      url: 'https://travel.gc.ca/destinations/' + (slug || String(cy).toLowerCase()) };
  });
  return out;
}

// Le flux RSS américain → { cy: témoin }. Chaque <item> porte « <Pays> -
// Level N: … » et un lien « …/<slug>-travel-advisory.html » ; on reconnaît
// le pays par ce slug, celui de la table CONSEILS du bulletin.
function lireUsa(xml, slugs) {
  const out = {};
  const parSlug = {};
  Object.keys(slugs || {}).forEach((cy) => { parSlug[slugs[cy]] = cy; });
  String(xml || '').split(/<item[\s>]/i).slice(1).forEach((it) => {
    const brut = (b) => { const m = new RegExp('<' + b + '[^>]*>([\\s\\S]*?)</' + b + '>', 'i').exec(it); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : ''; };
    const lien = brut('link') || brut('guid');
    const m = /traveladvisories\/([a-z0-9-]+)-travel-advisory\.html/i.exec(lien);
    // Repli sur le titre : « Cote d'Ivoire - Level 2: … » ramené au slug
    // (« cote-d-ivoire »). Le premier passage depuis GitHub a lu 0 avis sur
    // 54 par le seul lien : le flux ne le porte pas sous cette forme.
    const prefixe = brut('title').replace(/&#0*39;|&apos;|&rsquo;|&#8217;/g, "'").replace(/&amp;/g, '&').split(/\s+-\s+Level/i)[0];
    const slugTitre = prefixe.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const cy = (m && parSlug[m[1].toLowerCase()]) || parSlug[slugTitre] || parSlug['the-' + slugTitre];
    if (!cy) return;
    const n = /Level\s*([1-4])/i.exec(brut('title'));
    const degre = n && degreAvisUsa(n[1]);
    const ms = Date.parse(brut('pubDate'));
    if (!degre || !isFinite(ms)) return;
    out[cy] = { source: 'États-Unis', degre, revu: new Date(ms).toISOString(), url: lien };
  });
  return out;
}

// Rattache les témoins à chaque pays. Une source muette ce jour-là garde le
// témoin du passage précédent (même règle que le FCDO).
function attacherTemoins(pays, ancienPays, parSource) {
  Object.keys(pays).forEach((cy) => {
    const avant = (ancienPays && ancienPays[cy] && Array.isArray(ancienPays[cy].temoins)) ? ancienPays[cy].temoins : [];
    const temoins = [];
    Object.keys(parSource).forEach((src) => {
      const lu = parSource[src] && parSource[src][cy];
      const garde = avant.find((t) => t && t.source === src);
      if (lu) temoins.push(lu); else if (garde) temoins.push(garde);
    });
    if (temoins.length) pays[cy] = Object.assign({}, pays[cy], { temoins });
  });
  return pays;
}

function fusionner(ancien, nouveaux) {
  const pays = Object.assign({}, (ancien && ancien.pays) || {});
  Object.keys(nouveaux || {}).forEach((cy) => { if (nouveaux[cy]) pays[cy] = nouveaux[cy]; });
  return pays;
}

// Pays dont l'avis RÉCENT ne colle pas au niveau archivé. Un avis trop ancien
// ne témoigne de rien et n'y figure pas.
function divergences(pays, instantane, maintenant) {
  const out = [];
  ((instantane && instantane.pays) || []).forEach((p) => {
    // Tous les témoins récents : un pays où l'un d'eux diverge est listé,
    // avec chaque avis divergent (source, degré, âge).
    noyau.lectureTemoinsOfficiels(pays[p.code], p.niveau, maintenant).filter((t) => !t.compatible).forEach((lu) => {
      out.push({ code: p.code, niveau: p.niveau, source: lu.source, avis: lu.degre, libelle: noyau.AVIS_LIBELLES[lu.degre], revuIlYaJ: lu.ageJ });
    });
  });
  return out;
}

module.exports = { API, API_CANADA, RSS_USA, slugFcdo, lireReponse, fusionner, divergences,
  degreAvisCanada, degreAvisUsa, lireCanada, lireUsa, attacherTemoins };
