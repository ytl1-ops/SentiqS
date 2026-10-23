// Matière du rapport mensuel GRSCI : cumul du mois, nettoyage, regroupement
// d'un même fait rapporté par plusieurs médias, tri.
//
// Pourquoi ce module existe (relecture du 23/10/2026, rapport d'octobre) :
// - le rapport lisait `donneesBulletinPays`, donc la fenêtre d'actualité de
//   36 h. Un rapport « mensuel » y trouvait DEUX faits pour la Côte d'Ivoire,
//   aucun pour le Bénin ni le Liberia ;
// - la réintroduction de la peine de mort au Burkina Faso y occupait six
//   puces, une par média ; le massacre de Ménaka trois ;
// - des titres portaient un espace de largeur nulle (« ​GRÈVE ») qui coupait
//   le mot en deux dans le PDF.
//
// Le job appelle `cumuler` à chaque passage, pas seulement le jour du
// rapport : le mois se construit passage après passage, dans
// web/rapports/GRSCI/faits-AAAA-MM.json. Le module ne touche ni au réseau ni
// à la page.
const fs = require('node:fs');
const path = require('node:path');

const RANG = { crit: 0, high: 1, mod: 2 };

function cheminCumul(racine, mois) {
  return path.join(racine, 'faits-' + mois + '.json');
}

// Espaces de largeur nulle, marques de sens, BOM : invisibles à l'écran,
// mais LibreOffice les rend comme un saut de ligne au milieu d'un mot.
function nettoyerTitre(t) {
  return String(t || '').replace(/[\u200B-\u200F\u2028\u2029\u2060\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}

function cleFait(f) {
  return f.url || ('t:' + nettoyerTitre(f.titre).toLowerCase());
}

const RANG_COTATION = { confirme: 0, probable: 1, non_confirme: 2 };
function meilleureCotation(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return RANG_COTATION[b] < RANG_COTATION[a] ? b : a;
}

function lireCumul(racine, mois) {
  try { return JSON.parse(fs.readFileSync(cheminCumul(racine, mois), 'utf8')); } catch (e) { return { mois, pays: {} }; }
}

/**
 * Ajoute au cumul du mois les faits relevés par ce passage. `parPays` :
 * { CI: [fait, ...], BF: [...] }. Un fait déjà connu garde sa première
 * entrée (son titre traduit compris) ; seuls le niveau et la catégorie sont
 * rafraîchis, parce qu'un correctif de classement doit pouvoir s'appliquer.
 */
function cumuler(racine, mois, parPays) {
  const c = lireCumul(racine, mois);
  c.mois = mois;
  c.pays = c.pays || {};
  for (const [cy, faits] of Object.entries(parPays || {})) {
    const liste = c.pays[cy] = c.pays[cy] || [];
    const index = new Map(liste.map((f, i) => [cleFait(f), i]));
    for (const f of faits || []) {
      if (!f || !f.titre || !f.publieMs) continue;
      if (String(new Date(f.publieMs).toISOString()).slice(0, 7) !== mois) continue;
      const propre = {
        titre: nettoyerTitre(f.titre), url: f.url || null, source: f.source || null,
        niveau: f.niveau || null, cat: f.cat || null, publieMs: f.publieMs, langue: f.langue || null,
        cotation: f.cotation || null,
        resume: f.resume ? nettoyerTitre(f.resume) : null, ville: f.ville || null,
        img: f.img || null, video: f.video || null,
      };
      const k = cleFait(propre);
      if (index.has(k)) {
        const ancien = liste[index.get(k)];
        ancien.niveau = propre.niveau; ancien.cat = propre.cat;
        // Une cotation ne redescend pas : un fait recoupé au passage suivant
        // reste « Confirmé » même si la fusion n'est plus visible ensuite.
        ancien.cotation = meilleureCotation(ancien.cotation, propre.cotation);
        // Un chapô, une ville ou une image arrivés plus tard (aperçu de la
        // source chargé après coup) complètent l'entrée ; jamais ne l'effacent.
        for (const k of ['resume', 'ville', 'img', 'video']) if (!ancien[k] && propre[k]) ancien[k] = propre[k];
      } else {
        index.set(k, liste.length);
        liste.push(propre);
      }
    }
  }
  return ecrireCumul(racine, c);
}

function ecrireCumul(racine, c) {
  fs.mkdirSync(racine, { recursive: true });
  fs.writeFileSync(cheminCumul(racine, c.mois), JSON.stringify(c) + '\n');
  return c;
}

// Mots qui ne disent rien du fait : outils, et le nom du pays lui-même (il
// figure dans presque tous les titres d'une page consacrée à ce pays).
const VIDES = new Set(('le la les un une des de du d l au aux et ou en dans sur pour par avec sans sous '
  + 'a à est sont ont qui que quoi ce cette ces son sa ses leur leurs plus apres après selon contre entre '
  + 'the of in on at to for and or with by from as is are was were has have after over its their an '
  + 'o os as do da dos das em no na nos nas um uma com para por').split(' '));

function sansAccents(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function racines(titre, motsPays) {
  const mots = sansAccents(nettoyerTitre(titre).toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean);
  const out = new Set();
  for (const m of mots) {
    if (m.length < 3 || VIDES.has(m) || motsPays.has(m) || /^\d+$/.test(m)) continue;
    out.add(m.slice(0, 5));
  }
  return out;
}

// Deux titres décrivent le même fait s'ils partagent au moins trois racines
// de mots significatifs couvrant 60 % du plus court (ou quatre couvrant la
// moitié), ET s'ils sont publiés à moins de quatre jours d'écart. Mesuré sur
// le rapport d'octobre : les six titres de la peine de mort au Burkina Faso se
// replient en un, le massacre de Ménaka en anglais (traduit) et en français
// aussi ; la rizerie de Bagré et la récolte de maïs à Bagré restent séparées.
// L'écart de dates est la garde : deux attaques distinctes dans la même
// région, à deux semaines d'intervalle, ont des titres voisins et ne doivent
// jamais se replier en une — un fait effacé coûte plus qu'un doublon.
const ECART_MAX_MS = 4 * 86400000;
function memeFait(a, b) {
  if (a.t && b.t && Math.abs(a.t - b.t) > ECART_MAX_MS) return false;
  let commun = 0;
  for (const r of a.r) if (b.r.has(r)) commun++;
  const part = commun / Math.min(a.r.size, b.r.size);
  return (commun >= 3 && part >= 0.6) || (commun >= 4 && part >= 0.5);
}

function trier(faits) {
  return faits.slice().sort((x, y) => ((RANG[x.niveau] ?? 3) - (RANG[y.niveau] ?? 3)) || ((y.publieMs || 0) - (x.publieMs || 0)));
}

/**
 * Regroupe les faits d'un même pays qui décrivent le même événement. Le
 * premier (le plus grave, puis le plus récent) porte le titre et le lien ;
 * les autres médias sont listés dans `sources` : un fait rapporté par
 * plusieurs titres est un fait recoupé, pas six faits.
 */
function regrouper(faits, nomPays) {
  const motsPays = new Set(sansAccents(String(nomPays || '').toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean));
  const groupes = [];
  for (const f of trier(faits)) {
    const r = { r: racines(f.titreFr || f.titre, motsPays), t: f.publieMs || 0 };
    // Comparé à chaque titre déjà rangé dans le groupe, pas à l'union de
    // leurs mots : une union grossirait à chaque ajout et finirait par
    // avaler des faits voisins mais distincts.
    const g = groupes.find((x) => x.membres.some((m) => memeFait(m, r)));
    if (g) {
      if (f.source && !g.fait.sources.includes(f.source)) {
        g.fait.sources.push(f.source);
        // Ce que chaque autre média en dit : la matière du texte rédigé
        // d'un fait marquant (redaction-grsci.js).
        if (f.resume) g.fait.extraits.push({ source: f.source, resume: f.resumeFr || f.resume, url: f.url || null });
        if (f.url) g.fait.liens.push({ source: f.source, url: f.url });
      }
      for (const k of ['ville', 'img', 'video']) if (!g.fait[k] && f[k]) g.fait[k] = f[k];
      g.fait.cotation = meilleureCotation(g.fait.cotation, f.cotation);
      // Deux médias distincts sur le même fait : c'est la définition du
      // recoupement, donc « Confirmé » (même règle que cotationArticle).
      if (g.fait.sources.length > 1) g.fait.cotation = 'confirme';
      g.membres.push(r);
    } else {
      groupes.push({ membres: [r], fait: Object.assign({}, f, {
        titre: nettoyerTitre(f.titre), sources: f.source ? [f.source] : [],
        extraits: f.resume ? [{ source: f.source || null, resume: f.resumeFr || f.resume, url: f.url || null }] : [],
        liens: f.url ? [{ source: f.source || null, url: f.url }] : [],
      }) });
    }
  }
  return groupes.map((x) => x.fait);
}

/** Les faits du mois pour un pays, prêts pour le rapport. */
function faitsDuMois(cumul, cy, nomPays) {
  return regrouper((cumul && cumul.pays && cumul.pays[cy]) || [], nomPays);
}

module.exports = { cheminCumul, cumuler, ecrireCumul, lireCumul, nettoyerTitre, regrouper, faitsDuMois, trier };
