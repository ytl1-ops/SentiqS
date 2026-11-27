// FICHIER CONSTRUIT — ne pas modifier : node scripts/construire-presentation-web.js
// Sources : le générateur de la Présentation 1 du job (scripts/lib), 5 modules.
(function (racine) {
  'use strict';
  const defs = {}; const faits = {};
  // Le navigateur n'a ni disque ni chemins : le générateur n'y lit que ce
  // qu'on lui donne (images du modèle par utiliserRessources, émetteur et
  // logo dans les données). Une lecture de fichier y est une erreur.
  const fsNav = { readFileSync() { throw new Error('fichier indisponible dans le navigateur'); }, existsSync() { return false; }, writeFileSync() { throw new Error('écriture indisponible dans le navigateur'); }, mkdirSync() {}, readdirSync() { return []; }, statSync() { throw new Error('indisponible'); } };
  const pathNav = { join: (...p) => p.join('/').replace(/\/+/g, '/'), resolve: (...p) => p.join('/').replace(/\/+/g, '/'), dirname: (p) => String(p).replace(/\/[^/]*$/, '') || '/', basename: (p) => String(p).replace(/^.*\//, '') };
  function definir(nom, f) { defs[nom] = f; }
  function exiger(nom) {
    if (nom === 'node:fs' || nom === 'fs') return fsNav;
    if (nom === 'node:path' || nom === 'path') return pathNav;
    const k = './' + nom.replace(/^\.\//, '').replace(/\.js$/, '');
    if (faits[k]) return faits[k].exports;
    if (!defs[k]) throw new Error('module absent : ' + nom);
    const m = faits[k] = { exports: {} };
    defs[k](m, m.exports, exiger, '/lib');
    return m.exports;
  }
  definir("./hors-surete", function (module, exports, require, __dirname) {
// Faits « hors sûreté » écartés du rapport mensuel (Présentation 1).
//
// Pourquoi (relecture du 14/11/2026, demande de YORO : « corrige en retirant
// les faits hors sûreté ») : le rapport de novembre ouvrait la Côte d'Ivoire
// sur « Fête de la Toussaint : ce qu'il faut savoir… », puis « Voici comment
// réagir face à un arrêt cardiaque chez un enfant », « Cuisinière à gaz : ce
// que révèle la couleur de la flamme », un appel d'offres du Trésor, un
// chantier de métro. La classification les avait montés au-dessus du normal
// sur un mot (« morts », « sécurité », « crise ») ; le rapport, lui, est lu
// par un responsable sûreté qui juge l'outil à sa première page.
//
// Le filtre s'applique AU MOMENT DU RAPPORT, sur le cumul du mois, et ne
// touche pas au cumul lui-même : une règle corrigée vaut pour tout le mois,
// rétroactivement, et rien n'est perdu.
//
// Deux parties :
// 1. des THÈMES hors sûreté (conseils pratiques, fêtes, finance de marché,
//    chantiers, agriculture, sport, culture, carrière, revue de presse…) ;
// 2. une GARDE : un titre qui porte un vocabulaire d'atteinte (mort, attaque,
//    enlèvement, incendie, manifestation, grève, arrestation…) reste, même sur
//    un de ces thèmes — un festival attaqué n'est pas un festival. Certaines
//    locutions (« fête des morts », « crise de légitimité ») sont retirées
//    avant la garde : elles ne disent aucune atteinte.
//
// En cas de doute, le fait RESTE : un fait de trop coûte une ligne au
// lecteur, un fait de sûreté retiré peut lui coûter une décision.

function norm(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'").replace(/\s+/g, ' ');
}

// Locutions qui contiennent un mot de la garde sans dire une atteinte.
const LOCUTIONS_NEUTRES = [
  /fete des morts/g, /jour des morts/g, /mort-ne[s]?\b/g,
  /enlevement des (marchandises|ordures|dechets|conteneurs|vehicules)/g,
  /gestion de crise/g, /cellule de crise/g, /exercice (de simulation|de secours)/g,
  /annonce mort/g, /millions? de morts/g, /crise de legitimite/g,
];

// Vocabulaire d'atteinte : sa présence garde le fait, quel que soit le thème.
const GARDE_RE = new RegExp([
  "\\btue[es]?\\b", "\\bmort[s]?\\b", "\\bmorte[s]?\\b", "\\bdeces\\b", "\\bmeurtre", "\\bassassin", "\\bhomicide",
  "\\bblesse", "\\battaque", "\\battentat", "\\bexplosion", "\\bexplosif", "\\bembuscade", "\\bfusillade",
  "\\benlev", "\\bkidnapp", "\\botage", "\\brapt", "\\bincendi", "\\bnoyade", "\\beffondrement", "\\binondation",
  "\\bmanifest", "\\bemeute", "\\bheurt", "\\baffrontement", "\\bviolence", "\\bgreve\\b", "\\bgrevistes?\\b",
  "\\barret(e|ation)", "\\binterpell", "\\bgarde a vue\\b", "\\bpoursuivi", "\\bproces\\b", "\\bcondamn",
  "\\bdjihad", "\\bjihad", "\\bterror", "\\bcoup d'etat\\b", "\\bputsch", "\\bmutin", "\\barme[es]?\\b(?! de)",
  "\\bbandit", "\\bbraquage", "\\bvol a main", "\\bcambriol", "\\bescroquer", "\\bfraude\\b", "\\btrafic",
  "\\bdrogue", "\\bevasion\\b", "\\bepidemie", "\\bcholera\\b", "\\bebola\\b", "\\bmpox\\b", "\\bpenurie",
  "\\bkilled\\b", "\\bdead\\b", "\\battack", "\\bkidnap", "\\babduct", "\\bprotest", "\\bclash", "\\barrest",
  "\\bmilitaire", "\\bsecuritaire", "\\bprocureur", "\\bmeur[st]?\\b", "\\bse noie", "\\bnoye", "\\bperi[st]?\\b",
  "\\bgunmen\\b", "\\bbomb", "\\bfire\\b", "\\bblaze\\b", "\\bstrike\\b", "\\bmorto", "\\bataque",
].join('|'));

// Thèmes hors sûreté. Chaque famille nomme ce qu'elle retire : une famille
// qui en retire trop se corrige seule, sans toucher aux autres.
const THEMES = {
  conseil_pratique: /\b(voici comment|ce qu'il faut savoir|comment (reagir|choisir|eviter|bien|reconnaitre|preparer)|astuces?|recette|bienfaits?|ce que revele|arret cardiaque|cuisiniere|regime alimentaire|beaute)\b/,
  fete_religieuse: /\b(toussaint|noel|paques|tabaski|maouloud|careme|fete de (la|l'|fin)|celebration|pelerinage|messe)\b/,
  finance_marche: /\b(appel d'offres|bons? (et obligations )?du tresor|obligations? du tresor|emprunt obligataire|emission (simultanee|de titres)|brvm|bourse|dividende|introduction en bourse|resultats? financiers?|chiffre d'affaires|taux directeur|levee de fonds|execution (du budget|budgetaire|des reformes)|rapport d'execution|taux d'execution|sursis a execution|retard dans l'execution|marches publics|budgets? sous tension|recettes mobilisees|depenses executees|crise energetique|reserves sous pression)\b/,
  chantier: /\b(travaux (executes|de construction|de rehabilitation|de reprise|du futur)|mise en service|echangeurs?|premiere pierre|inauguration|inaugure|livraison des travaux|lance le chantier|coup d'envoi des travaux|renovation|revetement|parking|electrification)\b/,
  agriculture_dev: /\b(hectares|agroforesterie|cacaoyeres|production de (cacao|cafe|coton|riz|mais|noix de cajou)|production attendue|riz paddy|campagne (agricole|cotonniere|de commercialisation)|semences|clinique[s]? mobile[s]?|sante reproductive|avenir demographique|dividende demographique|renforce(nt)? les capacites|potentiel economique|erosion cotiere|consommer local|siao|navire-hopital|salubrite|par l'assiette)\b/,
  sante_chronique: /\b(diabete|cancer|tuberculose|inactivite physique|prevalence|bilharziose|hypertension|obesite)\b/,
  sport: /\b(can 20\d\d|qualifs?|qualification[s]? (pour|a) la (can|coupe)|eliminatoires|match|matchday|ligue \d|ligue des champions|championnat|champion(ne)?s|coupe (du monde|d'afrique|de la confederation|inter)|selection nationale|selectionneur|buteur|mercato|footballeur|handball|basket(ball)?|athletisme|lutteurs?|lutte (avec frappe|traditionnelle)|combat royal|special combat|beach wrestling|jeux olympiques| vs )\b/,
  culture_people: /\b(festival|concert|album|clip officiel|film|cinema|miss |artiste|chanteu[rs]e?|comedien|celebrite|kardashian|tupac|mariage de|anniversaire de|defile de mode|vernissage|ecrivains?|celebre (\d+|les)|fausse rumeur|recompensee?s?)\b/,
  communication: /\b(tournee (nationale )?d'information|journee portes ouvertes)\b/,
  carriere: /\b(depart a la retraite|admis a la retraite|prise de fonction|passation de (charges|service)|distinction honorifique)\b/,
  presse_opinion: /^(revue de (la )?presse|editorial|edito|chronique|billet|lu pour vous)\b|\brevue de (la )?presse\b/,
  education: /\b(rentree (scolaire|universitaire)|resultats? (du bac|du bepc|du cepe|des examens)|bourses? d'etudes|remise de diplomes|soutenance)\b/,
};

// Un fait qui se passe hors d'Afrique, ou dans un autre pays, sans que le
// titre nomme le pays du rapport ni ses ressortissants : la collecte l'a
// rattaché par erreur (« Congo – Délits fauniques » dans la Côte d'Ivoire,
// « patrouilles à Sydney après l'attaque de Bondi Beach » dans le Ghana).
// Un Ghanéen tué dans le Bronx, lui, concerne le Ghana et reste.
const AILLEURS_RE = /\b(sydney|australie|bondi|barcelone|madrid|espagne|italie|europeen(ne)?s?|etats-unis|bronx|new york|washington|ukraine|liban|israel|gaza|congo|rdc|kinshasa)\b/;
const PEOPLE_ETRANGER_RE = /\b(kardashian|tupac|hollywood|premier league|nba|nfl|beyonce|taylor swift)\b/;
const NATIONAL = {
  CI: /ivoir|abidjan/, BF: /burkin|faso|ouaga/, ML: /\bmali|bamako/, NE: /niger|niamey/, GH: /ghan|accra/,
  TG: /togo|lome/, BJ: /benin|cotonou/, GN: /guine|conakry/, LR: /liberi|monrovia/, SN: /senegal|dakar/,
};


/**
 * Le thème hors sûreté du fait, ou null s'il reste dans le rapport.
 * `f` : un fait du cumul ({ titre, titreFr? }), `cy` : son pays. Seul le titre décide, comme
 * pour la classification (« le titre décide, le corps nuance ») : un chapô
 * qui cite « la sécurité » ne fait pas d'un conseil de cuisine un fait de
 * sûreté, et un chapô anodin ne retire pas une attaque titrée.
 */
function themeHorsSurete(f, cy) {
  const titre = norm(f && (f.titreFr || f.titre));
  if (!titre) return null;
  const nat = NATIONAL[cy];
  if (nat && AILLEURS_RE.test(titre) && !nat.test(titre)) return 'autre_pays';
  let t = titre;
  for (const re of LOCUTIONS_NEUTRES) t = t.replace(re, ' ');
  // Vedettes étrangères et ligues hors d'Afrique : rien ne les rattache à la
  // sûreté du pays, même quand le titre dit « mort » (« L'avocat qui
  // défendait le meurtrier de Tupac Shakur retrouvé mort », rattaché au
  // Sénégal le 13/11/2026).
  if (PEOPLE_ETRANGER_RE.test(titre)) return 'culture_people';
  if (GARDE_RE.test(t)) return null;
  for (const [nom, re] of Object.entries(THEMES)) if (re.test(titre)) return nom;
  return null;
}

function estHorsSurete(f, cy) { return themeHorsSurete(f, cy) !== null; }

module.exports = { themeHorsSurete, estHorsSurete, THEMES, GARDE_RE };

  });
  definir("./faits-p1", function (module, exports, require, __dirname) {
// Matière du rapport mensuel P1 : cumul du mois, nettoyage, regroupement
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
// web/rapports/mensuel/faits-AAAA-MM.json. Le module ne touche ni au réseau ni
// à la page.
const fs = require('node:fs');
const path = require('node:path');
const horsSurete = require('./hors-surete');

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
        // Traductions déjà faites par le job de traduction du cache (a.tr,
        // 19/11/2026) : versées avec le fait, elles rendent lisibles en
        // français les faits des 54 pays sans nouvel appel (25/11/2026).
        titreFr: f.titreFr ? nettoyerTitre(f.titreFr) : null,
        resumeFr: f.resumeFr ? nettoyerTitre(f.resumeFr) : null,
      };
      if (!propre.titreFr) delete propre.titreFr;
      if (!propre.resumeFr) delete propre.resumeFr;
      const k = cleFait(propre);
      if (index.has(k)) {
        const ancien = liste[index.get(k)];
        ancien.niveau = propre.niveau; ancien.cat = propre.cat;
        // Une cotation ne redescend pas : un fait recoupé au passage suivant
        // reste « Confirmé » même si la fusion n'est plus visible ensuite.
        ancien.cotation = meilleureCotation(ancien.cotation, propre.cotation);
        // Un chapô, une ville ou une image arrivés plus tard (aperçu de la
        // source chargé après coup) complètent l'entrée ; jamais ne l'effacent.
        for (const k of ['resume', 'ville', 'img', 'video', 'langue', 'titreFr', 'resumeFr']) if (!ancien[k] && propre[k]) ancien[k] = propre[k];
      } else {
        index.set(k, liste.length);
        liste.push(propre);
      }
    }
  }
  return ecrireCumul(racine, c);
}

// reattribuer(cumul, paysDe) : déplace les faits que la règle courante
// rattache à un autre pays (paysDe(fait, cy) rend le code). Jamais vers
// « INT » : un fait ne sort pas du rapport par cette voie. Rend la liste des
// déplacements, pour le journal du job.
function reattribuer(c, paysDe) {
  const deplaces = [];
  for (const cy of Object.keys(c.pays || {})) {
    const garde = [];
    for (const f of c.pays[cy]) {
      const n = paysDe(f, cy);
      if (n && n !== cy && n !== 'INT' && /^[A-Z]{2}$/.test(n)) {
        const cible = c.pays[n] = c.pays[n] || [];
        if (!cible.some((x) => cleFait(x) === cleFait(f))) cible.push(f);
        deplaces.push({ de: cy, vers: n, titre: f.titre });
      } else garde.push(f);
    }
    c.pays[cy] = garde;
  }
  return deplaces;
}

// retirerDoublonsEntrePays(cumul, prioritaire) : un même article (même adresse,
// ou même titre à l'identique) ne figure qu'une fois dans le cumul du mois.
// Audit du 26/11/2026 : 23 titres identiques dans le cumul, 3 d'un pays à
// l'autre (le même article HCR au Bénin et au Niger). `cumuler` ne
// dédoublonne que DANS un pays. Le fait reste dans le pays prioritaire (la
// Côte d'Ivoire dans le rapport), sinon dans le premier par ordre de code ;
// il garde la meilleure cotation et le meilleur niveau des exemplaires, et
// complète ses champs vides. Rend la liste des retraits pour le journal.
function retirerDoublonsEntrePays(c, prioritaire) {
  const retires = [];
  const codes = Object.keys((c && c.pays) || {}).sort((a, b) => (a === prioritaire ? -1 : b === prioritaire ? 1 : a < b ? -1 : 1));
  const vus = new Map();
  const RANG_NIVEAU = { crit: 0, high: 1, mod: 2 };
  for (const cy of codes) {
    const garde = [];
    for (const f of c.pays[cy]) {
      const cles = [];
      if (f.url) cles.push('u:' + f.url);
      const t = nettoyerTitre(f.titre).toLowerCase();
      if (t.length >= 25) cles.push('t:' + t);
      const ancien = cles.map((k) => vus.get(k)).find(Boolean);
      if (ancien && ancien.cy !== cy) {
        ancien.f.cotation = meilleureCotation(ancien.f.cotation, f.cotation);
        if ((RANG_NIVEAU[f.niveau] ?? 9) < (RANG_NIVEAU[ancien.f.niveau] ?? 9)) ancien.f.niveau = f.niveau;
        for (const k of ['resume', 'ville', 'img', 'video', 'langue', 'titreFr']) if (!ancien.f[k] && f[k]) ancien.f[k] = f[k];
        retires.push({ de: cy, garde: ancien.cy, titre: f.titre });
        continue;
      }
      garde.push(f);
      cles.forEach((k) => { if (!vus.has(k)) vus.set(k, { cy, f }); });
    }
    c.pays[cy] = garde;
  }
  return retires;
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

// Ce qu'un média dit d'un fait : son chapô (flux RSS) et, depuis le
// 25/11/2026, le début de son article quand le job a pu le lire (`texte`,
// texte-article.js), chacun avec sa traduction française quand elle existe.
function extraitDe(f) {
  return { source: f.source || null, resume: f.resumeFr || f.resume || null, url: f.url || null, langue: f.langue || null, fr: !!f.resumeFr,
    long: f.texteFr || f.texte || null, longFr: !!f.texteFr };
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
        // d'un fait marquant (redaction-p1.js).
        if (f.resume || f.texte || f.url) g.fait.extraits.push(extraitDe(f));
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
        extraits: (f.resume || f.texte || f.url) ? [extraitDe(f)] : [],
        liens: f.url ? [{ source: f.source || null, url: f.url }] : [],
      }) });
    }
  }
  return groupes.map((x) => x.fait);
}

/**
 * Les faits du mois pour un pays, prêts pour le rapport. Les faits hors
 * sûreté (hors-surete.js, demande de YORO du 14/11/2026) sont écartés ICI,
 * pas dans le cumul : une règle corrigée vaut pour tout le mois.
 */
function faitsDuMois(cumul, cy, nomPays) {
  const liste = (cumul && cumul.pays && cumul.pays[cy]) || [];
  return regrouper(liste.filter((f) => !horsSurete.estHorsSurete(f, cy)), nomPays)
    .filter(faitEnFrancais);
}

// Une seule langue par document (YORO, 19/11/2026 : « tout type de rapport
// sera soit en FR soit en ENG ») : un fait dont le titre en langue étrangère
// n'a pas encore été traduit par le job n'entre pas dans le rapport, au lieu
// d'y figurer en « (EN) … ». Il y entre au passage qui le traduit.
const LANGUES_ETRANGERES = new Set(['en', 'pt', 'ar']);
function faitEnFrancais(f) {
  return !(f && LANGUES_ETRANGERES.has(f.langue) && !f.titreFr);
}

module.exports = { faitEnFrancais, cheminCumul, cumuler, ecrireCumul, lireCumul, nettoyerTitre, regrouper, faitsDuMois, trier, reattribuer, retirerDoublonsEntrePays };

  });
  definir("./redaction-p1", function (module, exports, require, __dirname) {
// Les « faits marquants » du rapport P1 : un texte rédigé par fait au lieu
// d'un titre (demande de YORO du 23/10/2026 : « je veux un rapport avec des
// textes détaillés pour présenter les actu marquantes avec des photos et pas
// un ensemble de titres »).
//
// CE QUI EST RÉDIGÉ, ET CE QUI NE L'EST PAS. Le module n'invente aucun fait :
// - « Contexte » est fait des données du fait (pays, ville quand le texte la
//   nomme, date, rubrique, nombre de médias) ;
// - « Ce que rapportent les sources » CITE le chapô de chaque média, entre
//   guillemets et attribué ; sans chapô, il le dit et renvoie à l'article ;
// - « Enjeux sûreté » est un repère par famille d'événement (attaque,
//   enlèvement, manifestation…), écrit pour un responsable sûreté
//   d'entreprise. C'est une grille, pas une analyse du fait : la page
//   d'ouverture du rapport le dit, et l'analyste la reprend dans le Word.
//
// Pur : ni réseau ni page. Testé par scripts/test/p1-marquants.test.js.
const { nettoyerTitre } = require('./faits-p1');

// Langues d'origine qu'un rapport en français ne cite jamais telles quelles.
const LANGUES_ETRANGERES = new Set(['en', 'pt', 'ar']);

// Combien de faits rédigés : quatre pour la Côte d'Ivoire (pays du groupe),
// un par pays de la sous-région. Les autres restent en liste, comme le modèle.
const MARQUANTS_CI = 4;
const MARQUANTS_PAYS = 1;
// Les faits rédigés sont les plus graves ; un fait seulement « modéré » ne
// tient une page entière que s'il n'y a rien de plus grave dans le pays.
const RANG = { crit: 0, high: 1, mod: 2 };

/** Partage les faits (déjà triés par gravité puis date) en rédigés / liste. */
function choisirMarquants(faits, n) {
  const liste = (faits || []).slice();
  const marquants = [];
  for (const f of liste) {
    if (marquants.length >= n) break;
    if (marquants.length && (RANG[f.niveau] ?? 3) > 1) break;
    marquants.push(f);
  }
  return { marquants, autres: liste.filter((f) => !marquants.includes(f)) };
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
  'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const RUBRIQUE = { politique: 'politique', humanitaire: 'sociale', securite: 'sécuritaire', economique: 'économique', economie: 'économique' };

// Familles d'événement, repères et « à surveiller » : web/js/reperes-surete.js,
// partagé avec la fiche de synthèse de la page (26/11/2026).
const { sansAccents, enjeuxSurete, SURVEILLER } = require('../../web/js/reperes-surete');

// L'ANALYSE APRÈS CHAQUE ACTU (demande de YORO du 24/11/2026 : « Présentation 1,
// réalise des analyses après chaque actu publiée »). Comme le reste de ce
// module, elle n'invente rien et n'appelle aucun modèle de langue :
// - « Lecture » dit ce que les données du mois établissent sur le fait : son
//   recoupement, et sa place
//   parmi les faits de même nature relevés dans le pays sur la période
//   (premier, ou n-ième, avec la date du précédent) ;
// - « Implications » reprend le repère par famille d'événement (ENJEUX) ;
// - « À surveiller » donne, par famille, les signaux qui feraient évoluer la
//   lecture — ce qu'un analyste chercherait dans les jours suivants.
// Ni gravité, ni niveau d'alerte, ni score : le modèle du rapport n'en a pas.
const FAMILLE_LIB = {
  coup: 'd\'instabilité institutionnelle', enlevement: 'd\'enlèvement', attaque: 'de violence armée',
  manifestation: 'de mobilisation sociale', criminalite: 'de criminalité', homicide: 'de violence criminelle', drame: 'de drame individuel', politique: 'politique',
  justice: 'judiciaire ou réglementaire', accident: 'accidentel', naturel: 'naturel ou sanitaire', frontiere: 'frontalier ou migratoire',
};
function dateBreve(ms) {
  const d = new Date(ms);
  return (d.getUTCDate() === 1 ? '1er' : d.getUTCDate()) + ' ' + MOIS[d.getUTCMonth()];
}

/**
 * L'analyse d'un fait : { lecture, implications, surveiller }. `faitsPays`
 * est la liste de tous les faits du pays sur la période (le fait compris) :
 * c'est elle qui situe le fait parmi ceux de même nature.
 */
const FAMILLES_INCIDENT = new Set(['coup', 'enlevement', 'attaque', 'manifestation', 'criminalite', 'accident', 'homicide', 'naturel', 'frontiere']);
function analyserFait(f, faitsPays) {
  const famille = enjeuxSurete(f);
  const sources = (f.sources && f.sources.length ? f.sources : [f.source]).filter(Boolean);
  const morceaux = [];
  const recoupe = sources.length > 1
    ? 'recoupé par ' + sources.length + ' médias distincts'
    : 'rapporté par une seule source, à confirmer';
  // Pas de mot de gravité : le niveau qu'attribue la veille à un article
  // (« crit » pour « 2 morts par jour sur les routes ») n'est pas une gravité
  // de terrain, et l'écrire ici l'aurait fait passer pour une.
  morceaux.push('Fait ' + recoupe + '.');
  // La récurrence n'est lue que pour les incidents : « fait politique relevé
  // pour le 13e jour » ne dit rien qu'un lecteur ne sache, la politique fait
  // l'actualité tous les jours.
  if (FAMILLES_INCIDENT.has(famille.cle) && Array.isArray(faitsPays) && f.publieMs) {
    // Un même événement est souvent repris par plusieurs médias sous des
    // titres que le regroupement n'a pas réunis (le naufrage du lac Togo du
    // 9 novembre : deux fiches, qui se comptaient l'une l'autre et faisaient
    // une « série »). Les faits de même nature sont donc comptés par JOUR : un
    // jour avec ce type de fait compte une fois, et celui du fait ne compte pas.
    const jour = (ms) => Math.floor(ms / 86400000);
    const jf = jour(f.publieMs);
    const jours = new Map();
    for (const x of faitsPays) {
      if (!x || x === f || !x.publieMs || jour(x.publieMs) === jf || enjeuxSurete(x).cle !== famille.cle) continue;
      const j = jour(x.publieMs);
      if (!jours.has(j) || x.publieMs > jours.get(j)) jours.set(j, x.publieMs);
    }
    const avant = [...jours.entries()].filter(([j]) => j < jf).sort((a, b) => b[0] - a[0]).map(([, ms]) => ms);
    const apres = [...jours.keys()].filter((j) => j > jf).length;
    const lib = FAMILLE_LIB[famille.cle];
    if (!avant.length) {
      morceaux.push('Premier fait ' + lib + ' relevé dans le pays sur la période'
        + (apres ? ' ; d\'autres ont suivi sur ' + apres + ' jour' + (apres > 1 ? 's.' : '.') : '.'));
    } else {
      const n = avant.length + 1;
      // Trois jours en quatorze avec un fait de même nature : c'est une série,
      // pas un fait isolé — le mot qui change la lecture d'un responsable sûreté.
      const serie = n >= 3 && f.publieMs - avant[1] <= 14 * 86400000;
      morceaux.push('Fait ' + lib + ' relevé dans le pays pour le ' + n + 'e jour distinct sur la période (précédent : '
        + dateBreve(avant[0]) + ')' + (serie ? ' ; une série, pas un fait isolé.' : '.'));
    }
  }
  return { cle: famille.cle, lecture: morceaux.join(' '), implications: famille.texte, surveiller: 'À surveiller : ' + SURVEILLER[famille.cle] };
}

function dateRedigee(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  return JOURS[d.getUTCDay()] + ' ' + (d.getUTCDate() === 1 ? '1er' : d.getUTCDate()) + ' ' + MOIS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

// Une phrase de titre, pas des majuscules : « Le Burkina Faso rétablit… ».
// Un titre tout en capitales (« MALI : LE BILAN HUMAIN S'ALOURDIT… », Mali 24)
// crie au milieu de titres en casse de phrase : il y est ramené. Les noms
// propres sont ceux que le chapô écrit avec une capitale (« Guinée », « Kayes ») ;
// un sigle court (FAMa, ONU, AES) garde ses capitales.
function enCapitales(t) {
  const lettres = t.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
  if (lettres.length < 12) return false;
  return lettres.replace(/[^A-ZÀ-ÖØ-Þ]/g, '').length / lettres.length > 0.8;
}
function casseDePhrase(t, f) {
  const propres = new Map();
  const texte = [f.resumeFr, f.resume].concat((f.extraits || []).map((e) => e && e.resume)).filter(Boolean).join(' ');
  for (const m of texte.matchAll(/(?<![.!?»]\s)(?<![A-Za-zÀ-ÿ])([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ-]+)/g)) propres.set(m[1].toLowerCase(), m[1]);
  const sortie = t.replace(/[A-Za-zÀ-ÖØ-öø-ÿ-]+/g, (mot, pos) => {
    const bas = mot.toLowerCase();
    let r;
    if (propres.has(bas) && !MOTS_COURTS.has(bas)) r = propres.get(bas);
    else if (/^[A-ZÀ-ÖØ-Þ]{2,4}$/.test(mot) && !MOTS_COURTS.has(bas)) r = mot;
    else r = bas;
    return pos === 0 ? r.charAt(0).toUpperCase() + r.slice(1) : r;
  });
  // Après « : » le titre reprend souvent une phrase : « Mali : Le bilan… » non,
  // « Mali : le bilan… » oui (usage de la presse française).
  return sortie;
}
const MOTS_COURTS = new Set(['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'au', 'aux', 'par', 'pour', 'sur', 'dans', 'son', 'sa', 'ses', 'est', 'ont', 'qui', 'que', 'plus', 'mort', 'tue', 'tués', 'deux', 'onze', 'neuf', 'huit', 'sept', 'six', 'cinq', 'dix', 'the', 'and', 'of', 'in', 'to', 'for', 'on', 'at', 'by', 'with', 'from', 'two', 'dead', 'kill', 'lui', 'eux', 'nos', 'vos', 'leur', 'avec', 'sans', 'sous', 'vers', 'chez', 'face', 'mais', 'ou', 'où', 'ni', 'car', 'il', 'ils', 'elle', 'elles', 'on', 'se', 'ce', 'ces', 'cet', 'à', 'fin', 'an', 'ans', 'jour', 'mois', 'nord', 'sud', 'est', 'zone', 'camp', 'vie', 'loi', 'chef', 'roi', 'état', 'etat', 'pays', 'ville', 'bus', 'feu', 'armé', 'arme', 'bilan', 'aide', 'fête', 'fete', 'rue', 'port', 'or', 'riz', 'eau', 'pain', 'gaz', 'prix', 'taux', 'dette', 'vote', 'élu', 'elu', 'élus', 'elus', 'peur', 'deuil', 'drame', 'choc', 'raid', 'coup', 'tir', 'tirs', 'cas', 'mine', 'mines', 'crue', 'pont', 'voie', 'axe', 'poste', 'case', 'salon', 'match', 'club']);
function phraseDe(f) {
  let t = nettoyerTitre(f.titreFr || f.titre).replace(/\s*[.!?…]+\s*$/, '');
  if (enCapitales(t)) t = casseDePhrase(t, f);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const EXTRAITS_MAX = 2;
// 420 caractères jusqu'au 25/11/2026. YORO : « donner plus de texte dans
// l'actu ». Le texte cité vient du début de l'article quand le job a pu le
// lire (`long`, texte-article.js), sinon du chapô du flux. Il reste une COURTE
// citation : entre guillemets, attribuée au média, avec le lien vers
// l'article et « © site » sur la photo — jamais l'article entier.
const EXTRAIT_MAX_CAR = 650;
function couper(t, max) {
  const s = nettoyerTitre(t);
  return s.length > max ? s.slice(0, max).replace(/\s+\S*$/, '') + ' …' : s;
}

/**
 * Le texte d'un fait marquant : { titre, contexte, extraits[], sansExtrait,
 * enjeux, sources, liens[], cotation }. `nomPays` sert au contexte.
 */
function rediger(f, nomPays) {
  const sources = (f.sources && f.sources.length ? f.sources : [f.source]).filter(Boolean);
  const quand = dateRedigee(f.publieMs);
  // Pas de « concernant Côte d'Ivoire » : les noms de pays prennent un
  // article variable ; le lieu est donc donné tel quel, après « Lieu : ».
  const lieu = f.ville ? f.ville + ', ' + nomPays : nomPays;
  const rub = RUBRIQUE[f.cat] || 'diverse';
  const contexte = (quand ? 'Fait rapporté le ' + quand + '. ' : '')
    + 'Lieu : ' + lieu + '. Actualité ' + rub + '. '
    + (sources.length > 1
      ? 'Repris par ' + sources.length + ' médias distincts (' + sources.join(', ') + ') : le fait est recoupé.'
      : 'Une seule source à ce stade' + (sources[0] ? ' (' + sources[0] + ')' : '') + ' : à confirmer par un second média.');
  // Un chapô par média, au plus deux, en français quand la traduction existe.
  const vus = new Set();
  const extraits = [];
  const candidats = (f.extraits && f.extraits.length ? f.extraits
    : ((f.resume || f.texte) ? [{ source: f.source, resume: f.resumeFr || f.resume, url: f.url, langue: f.langue || null, fr: !!f.resumeFr,
      long: f.texteFr || f.texte || null, longFr: !!f.texteFr }] : []));
  for (const e of candidats) {
    if (!e || !(e.resume || e.long) || extraits.length >= EXTRAITS_MAX) continue;
    // Une seule langue par document (YORO, 19/11/2026) : un texte en langue
    // étrangère que le job n'a pas pu traduire n'est pas cité.
    const etranger = LANGUES_ETRANGERES.has(e.langue);
    const chapo = e.resume && (!etranger || e.fr) ? e.resume : null;
    const long = e.long && (!etranger || e.longFr) ? e.long : null;
    // Le début de l'article, quand il dit plus que le chapô (25/11/2026).
    const brut = long && long.length > (chapo || '').length + 40 ? long : chapo;
    if (!brut) continue;
    const k = sansAccents(brut).slice(0, 80);
    if (vus.has(k)) continue;
    vus.add(k);
    extraits.push({ source: e.source || 'la source', texte: couper(brut, EXTRAIT_MAX_CAR) });
  }
  const liens = (f.liens && f.liens.length ? f.liens : (f.url ? [{ source: f.source, url: f.url }] : []))
    .filter((l) => l && typeof l.url === 'string' && /^https?:\/\//.test(l.url));
  return {
    titre: phraseDe(f),
    contexte,
    extraits,
    sansExtrait: extraits.length ? null : 'Les médias n\'en publient que le titre dans leur flux : le détail est à lire dans l\'article (lien ci-dessous).',
    enjeux: enjeuxSurete(f).texte,
    sources,
    liens,
    video: typeof f.video === 'string' && /^https:\/\//.test(f.video) ? f.video : null,
  };
}

// Le texte qui suit chaque citation n'est plus annoncé par « Analyse » (YORO,
// 25/11/2026 : « fait l'analyse en dessous de l'actu sans indiquer
// analyse ») ; ce qu'il est, et d'où il vient, reste dit ici une fois.
const NOTE_REDACTION = 'Faits marquants : textes établis à partir des médias cités, dont les extraits sont reproduits entre guillemets, en courte citation, avec le lien vers l\'article. '
  + 'Le paragraphe qui suit chaque citation situe le fait parmi ceux de même nature relevés dans le pays sur la période ; '
  + 'implications et points à surveiller sont des repères par type d\'événement, à valider et compléter par l\'analyste.';

module.exports = { LANGUES_ETRANGERES, phraseDe, choisirMarquants, rediger, enjeuxSurete, analyserFait, SURVEILLER, MARQUANTS_CI, MARQUANTS_PAYS, NOTE_REDACTION, dateRedigee };

  });
  definir("./rapport-p1", function (module, exports, require, __dirname) {
// Rapport mensuel de sûreté (né pour la rencontre mensuelle d'un groupe de
// responsables sûreté ivoiriens, dont il garde la présentation) :
// « Faits marquants en Côte d'Ivoire » puis « Dynamiques régionales », dans la
// présentation du modèle d'octobre 2024 (couverture, table des matières,
// intercalaires, pages thématiques, pays numérotés avec drapeau, MERCI, bandeau
// de pied).
//
// IL NE PORTE PLUS LE NOM NI LE LOGO DU GROUPE. Décision de YORO du 27/10/2026 :
// « supprime la mention P1 mais garde le modèle de présentation ». Le rapport
// porte l'identité d'envoi et le logo choisis (lireEmetteur, plus bas), à
// défaut SentiqS ; la mise en page est inchangée. Les noms de fichiers du code (rapport-p1.js…) sont restés
// pour ne pas casser l'historique : ils ne sont jamais vus par le lecteur.
//
// CE RAPPORT NE PARLE PAS LE LANGAGE DE L'APPLI. Demande du 21/10/2026 : il doit
// respecter la présentation transmise, pas s'adapter à l'outil qui fait ressortir
// des niveaux d'alerte : ni niveau coloré ni score. Depuis le 23/10/2026, à la
// demande de YORO, il porte la cotation de chaque fait et l'indice de confiance
// de chaque pays, et ses faits les plus graves sont RÉDIGÉS avec la photo de la
// source (redaction-p1.js, photos-p1.js) au lieu d'être une liste de titres.
//
// Le module ne touche ni au réseau ni à la page : il reçoit des données et
// renvoie un classeur pptxgenjs, ce qui le rend testable sans navigateur.
const fs = require('node:fs');
const path = require('node:path');
const { nettoyerTitre } = require('./faits-p1');
const redaction = require('./redaction-p1');

const ASSETS = path.join(__dirname, '..', 'assets', 'presentation-1');

// Les mêmes générateurs servent dans le navigateur depuis le 25/11/2026 (une
// Présentation 1 composée à la demande, web/js/presentation-1.js) : là, une
// image ne se lit pas sur le disque. `ressources` reçoit alors, par nom de
// fichier, ses octets ({ nom: Uint8Array }) ; dans le job il reste vide et les
// images sont lues dans scripts/assets/presentation-1.
const ressources = {};
function utiliserRessources(map) { Object.assign(ressources, map || {}); }
// Octets → base64, pour un Buffer (Node) comme pour un Uint8Array (navigateur).
function enBase64(data) {
  if (!data) return '';
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(data)) return data.toString('base64');
  if (typeof data === 'string') return data;
  let t = '';
  const u = data instanceof Uint8Array ? data : new Uint8Array(data);
  for (let i = 0; i < u.length; i += 32768) t += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
  return btoa(t);
}
const TYPE_IMAGE = (nom) => (/\.png$/i.test(nom) ? 'image/png' : 'image/jpeg');
/** Une image du modèle pour pptxgenjs : { path } dans le job, { data } ailleurs. */
function imageModele(nom) {
  return ressources[nom] ? { data: TYPE_IMAGE(nom) + ';base64,' + enBase64(ressources[nom]) } : { path: path.join(ASSETS, nom) };
}
/** Le logo de l'émetteur pour pptxgenjs : { path } ou, composé dans l'appli, { data }. */
function imageLogo(em) {
  return em.logoData ? { data: TYPE_IMAGE(em.logoType === 'png' ? 'x.png' : 'x.jpg') + ';base64,' + enBase64(em.logoData) } : { path: em.logo };
}

// L'émetteur du rapport : identité d'envoi et logo de l'organisation
// (demande de YORO du 27/10/2026, après le retrait du nom du groupe). Le job
// n'a pas accès aux réglages d'un navigateur (Paramètres > Personnalisation de
// marque vit dans le localStorage de l'utilisateur) : l'émetteur est donc un
// fichier du dépôt, scripts/config/rapport-mensuel.json, et son logo un
// fichier à côté. Sans fichier, ou avec un logo illisible, le rapport est
// signé SentiqS sans logo : jamais un rapport bloqué faute de logo.
const CONFIG_EMETTEUR = path.join(__dirname, '..', 'config', 'rapport-mensuel.json');
const EMETTEUR_DEFAUT = { identite: 'SentiqS', signature: 'veille de sûreté sur l\'Afrique', logo: null, logoRatio: null };

// Largeur / hauteur d'un PNG ou d'un JPEG, lue dans l'en-tête : le logo est
// posé sans être déformé, quelle que soit sa forme.
function ratioImage(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return buf.readUInt32BE(16) / buf.readUInt32BE(20);
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return buf.readUInt16BE(i + 7) / buf.readUInt16BE(i + 5);
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

function lireEmetteur(chemin) {
  const fichier = chemin || CONFIG_EMETTEUR;
  let c = {};
  try { c = JSON.parse(fs.readFileSync(fichier, 'utf8')) || {}; } catch (e) { c = {}; }
  const texte = (v, d) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : d);
  const em = {
    identite: texte(c.identite, EMETTEUR_DEFAUT.identite),
    signature: typeof c.signature === 'string' ? c.signature.trim().slice(0, 80) : EMETTEUR_DEFAUT.signature,
    logo: null, logoRatio: null,
  };
  if (typeof c.logo === 'string' && /\.(png|jpe?g)$/i.test(c.logo)) {
    const p = path.resolve(path.dirname(fichier), c.logo);
    try {
      const r = ratioImage(fs.readFileSync(p));
      if (r && r > 0.1 && r < 10) { em.logo = p; em.logoRatio = r; }
    } catch (e) { /* logo absent : rapport sans logo */ }
  }
  return em;
}

// L'identité d'envoi se précise À CHAQUE génération demandée (consigne de
// YORO du 14/11/2026 : « si aucune précision, le rapport sort sous le nom de
// SentiqS par défaut. Toujours demander la précision de l'identité d'envoi »).
// Le lancement manuel du workflow (collecte-planifiee.yml) porte trois champs,
// identite_envoi, signature_envoi, logo_envoi. Ce qu'on y saisit est retenu
// POUR LE MOIS dans web/rapports/mensuel/emetteur-AAAA-MM.json : le rapport du
// mois est réécrit chaque jour par le job, et sans cette trace la réécriture du
// lendemain le ramènerait sous le nom par défaut. Rien de saisi : le fichier de
// configuration, à défaut SentiqS.
const cheminEmetteurMois = (racine, mois) => path.join(racine, 'emetteur-' + mois + '.json');

/** Retient l'émetteur saisi pour un mois ; ne fait rien sans identité. */
function fixerEmetteurMois(racine, mois, saisie) {
  const t = (v) => (typeof v === 'string' ? v.trim().slice(0, 80) : '');
  const identite = t(saisie && saisie.identite);
  if (!identite) return null;
  const e = { identite, signature: t(saisie.signature), logo: t(saisie.logo), saisiLe: new Date().toISOString() };
  fs.mkdirSync(racine, { recursive: true });
  fs.writeFileSync(cheminEmetteurMois(racine, mois), JSON.stringify(e, null, 2) + '\n');
  return e;
}

/**
 * L'émetteur d'un mois : celui saisi pour ce mois s'il existe, sinon le
 * fichier de configuration, sinon SentiqS. `precise` dit si une identité a été
 * donnée pour ce mois (le journal du job le dit, pour qu'aucun rapport ne sorte
 * sous le nom par défaut sans que cela se voie).
 */
function emetteurDuMois(racine, mois, cheminConfig) {
  const base = lireEmetteur(cheminConfig);
  let m = null;
  try { m = JSON.parse(fs.readFileSync(cheminEmetteurMois(racine, mois), 'utf8')); } catch (e) { m = null; }
  if (!m || typeof m.identite !== 'string' || !m.identite.trim()) return Object.assign(base, { precise: false });
  const em = { identite: m.identite.trim().slice(0, 80), signature: typeof m.signature === 'string' ? m.signature.trim().slice(0, 80) : '', logo: null, logoRatio: null, precise: true };
  // Le logo est un fichier posé dans scripts/config (un champ de formulaire ne
  // transporte pas d'image) : on donne son nom, jamais un chemin hors du dossier.
  if (typeof m.logo === 'string' && /^[\w.-]+\.(png|jpe?g)$/i.test(m.logo)) {
    const p = path.join(path.dirname(cheminConfig || CONFIG_EMETTEUR), m.logo);
    try {
      const r = ratioImage(fs.readFileSync(p));
      if (r && r > 0.1 && r < 10) { em.logo = p; em.logoRatio = r; }
    } catch (e) { /* logo introuvable : rapport sans logo */ }
  }
  return em;
}

const piedTexte = (em) => em.identite + (em.signature ? ' — ' + em.signature : '');

// Le logo tient dans une boîte (pouces) sans être déformé.
function cadreLogo(ratio, wMax, hMax) {
  const w = Math.min(wMax, hMax * ratio);
  return { w, h: w / ratio };
}

const TITRE_COUVERTURE = ['RAPPORT MENSUEL', 'DE SÛRETÉ'];
// « Présentation 1 » : nom du modèle de présentation dans l'appli (YORO, 01/11/2026).
const NOM_MODELE = 'Présentation 1';
const TITRE_DOCUMENT = (jour) => NOM_MODELE + ' — Rapport mensuel de sûreté — ' + dateLongue(jour);

// Pays de la section « Dynamiques régionales », dans l'ordre de lecture du
// modèle (voisins du nord d'abord). Le Sénégal clôt, comme en 2024.
const PAYS_REGIONAUX = ['BF', 'ML', 'NE', 'GH', 'TG', 'BJ', 'GN', 'LR', 'SN'];

const VERT = '1F6B5E';       // titres et pastilles de section du modèle
const TEXTE = '1F2937';
const LEGERE = '6B7280';
const POLICE = 'Calibri';
// Le modèle de 2024 écrit ses titres dans une police étroite, soulignés, en
// vert et sans gras ; le corps reste en Calibri.
const POLICE_TITRE = 'Arial Narrow';

// Drapeaux simplifiés (bandes uniquement, sans étoile ni armoiries) pour le
// coin de page, comme le modèle qui affiche le drapeau du pays traité.
// `dir` : 'v' = bandes verticales, 'h' = horizontales ; 'bj' = le Bénin
// (bande verte à gauche, jaune et rouge à droite).
const DRAPEAUX = {
  CI: { dir: 'v', c: ['F77F00', 'FFFFFF', '009E60'] },
  BF: { dir: 'h', c: ['EF2B2D', '009E49'] },
  ML: { dir: 'v', c: ['14B53A', 'FCD116', 'CE1126'] },
  NE: { dir: 'h', c: ['E05206', 'FFFFFF', '0DB02B'] },
  GH: { dir: 'h', c: ['CE1126', 'FCD116', '006B3F'] },
  TG: { dir: 'h', c: ['006A4E', 'FFCE00', '006A4E', 'FFCE00', '006A4E'] },
  BJ: { dir: 'bj', c: ['008751', 'FCD116', 'E8112D'] },
  GN: { dir: 'v', c: ['CE1126', 'FCD116', '009460'] },
  LR: { dir: 'h', c: ['BF0A30', 'FFFFFF', 'BF0A30', 'FFFFFF', 'BF0A30'] },
  SN: { dir: 'v', c: ['00853F', 'FDEF42', 'E31B23'] },
};

// Rectangles (en proportion 0..1) d'un drapeau, partagés par le PowerPoint
// et le Word.
function rectsDrapeau(code) {
  const f = DRAPEAUX[code];
  if (!f) return [];
  if (f.dir === 'bj') return [[0, 0, 0.4, 1, f.c[0]], [0.4, 0, 0.6, 0.5, f.c[1]], [0.4, 0.5, 0.6, 0.5, f.c[2]]];
  const n = f.c.length;
  return f.c.map((c, i) => (f.dir === 'v' ? [i / n, 0, 1 / n, 1, c] : [0, i / n, 1, 1 / n, c]));
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
  'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function dateLongue(jour) {
  const [a, m, j] = String(jour).split('-').map(Number);
  return j + ' ' + MOIS[m - 1] + ' ' + a;
}
// « Période du 1er au 23 octobre 2026 » : l'intervalle couvert, dit sur la
// couverture, parce que le rapport du mois en cours est réécrit chaque jour.
// `debut` (rapport composé dans l'appli sur 7 ou 14 jours, 25/11/2026) : la
// période réelle, jamais « du 1er » quand le rapport ne la couvre pas.
function libellePeriode(fin, debut) {
  const [a, m, j] = String(fin).split('-').map(Number);
  const jj = (x) => (x === 1 ? '1er' : String(x));
  if (debut && debut !== fin.slice(0, 7) + '-01') {
    const [a0, m0, j0] = String(debut).split('-').map(Number);
    const tete = jj(j0) + (m0 !== m || a0 !== a ? ' ' + MOIS[m0 - 1] + (a0 !== a ? ' ' + a0 : '') : '');
    return 'Période du ' + tete + ' au ' + jj(j) + ' ' + MOIS[m - 1] + ' ' + a;
  }
  return 'Période du 1er au ' + jj(j) + ' ' + MOIS[m - 1] + ' ' + a;
}
function dateCourte(jour) {
  const [a, m, j] = String(jour).split('-');
  return j + '/' + m + '/' + a.slice(2);
}

// Rangement des faits dans les rubriques du modèle. Le modèle a Politique,
// Social, Sécurité, Divers ; le flux de SentiqS ne connaît que quatre
// catégories, la rubrique Social n'existe donc pas à part : elle est lue
// dans « humanitaire ».
const RUBRIQUES = [
  { cle: 'politique', num: 'I', titre: 'POLITIQUE', cats: ['politique'] },
  { cle: 'humanitaire', num: 'II', titre: 'SOCIAL', cats: ['humanitaire'] },
  { cle: 'securite', num: 'III', titre: 'SÉCURITÉ', cats: ['securite'] },
  { cle: 'divers', num: 'IV', titre: 'DIVERS', cats: ['economique', 'economie', null] },
];
// Deux fiches d'actu (texte + photo) par page depuis le 14/11/2026 (cinq
// titres auparavant).
const FAITS_PAR_PAGE = 2;
// Un mois de collecte donne des dizaines de faits par rubrique ; le groupe en
// lit dix, les plus graves d'abord (l'ordre vient de faits-p1.js).
const MAX_FAITS_RUBRIQUE = 10;

function rubriqueDe(fait) {
  const cat = fait.cat || null;
  return (RUBRIQUES.find((r) => r.cats.includes(cat)) || RUBRIQUES[3]).cle;
}

function faitsRubrique(ci, rub, max) {
  return (ci.faits || []).filter((f) => rubriqueDe(f) === rub.cle).slice(0, max || MAX_FAITS_RUBRIQUE);
}

function paginer(liste, n) {
  const pages = [];
  for (let i = 0; i < liste.length; i += n) pages.push(liste.slice(i, i + n));
  return pages;
}


function pied(s, ctx, numero) {
  const em = ctx.emetteur;
  if (em.logo) {
    const { w, h } = cadreLogo(em.logoRatio, 1.6, 0.6);
    s.addImage(Object.assign(imageLogo(em), { altText: 'Logo', x: 0.45, y: 6.6 + (0.6 - h) / 2, w, h }));
  }
  s.addText(piedTexte(em), { x: 3.4, y: 6.8, w: 6.0, h: 0.36, fontFace: POLICE, fontSize: 12, fit: 'shrink', color: TEXTE, align: 'center', valign: 'middle', line: { color: VERT, width: 0.75 } });
  s.addText('|  ' + dateCourte(ctx.jour) + '   |   ' + numero, { x: 10.3, y: 6.9, w: 2.7, h: 0.3, fontFace: POLICE, fontSize: 10, color: TEXTE, align: 'right' });
}

function taillePastille(num) {
  const n = String(num).length;
  return n <= 2 ? 24 : n === 3 ? 20 : 16;
}

function titrePage(s, num, titre, pays) {
  const souligne = /^- /.test(titre);
  // « VIII » à 24 pt ne tenait pas dans la pastille et passait sur deux lignes
  // (« VII » puis « I », rapport du 23/10/2026, page Liberia).
  s.addText(num, { x: 0.5, y: 0.3, w: 0.7, h: 0.6, fontFace: POLICE_TITRE, fontSize: taillePastille(num), fit: 'shrink', color: 'FFFFFF', fill: { color: VERT }, align: 'center', valign: 'middle' });
  s.addText(titre, { x: 1.35, y: 0.3, w: 9.8, h: 0.6, fontFace: POLICE_TITRE, fontSize: 28, underline: souligne, color: VERT, valign: 'middle' });
  if (pays && DRAPEAUX[pays]) {
    // Drapeau en coin de page, comme dans le modèle.
    rectsDrapeau(pays).forEach(([x, y, w, h, c]) => s.addShape('rect', { x: 11.9 + x * 0.99, y: 0.3 + y * 0.62, w: w * 0.99, h: h * 0.62, fill: { color: c }, line: { color: c, width: 0 } }));
    s.addShape('rect', { x: 11.9, y: 0.3, w: 0.99, h: 0.62, fill: { type: 'none' }, line: { color: TEXTE, width: 0.5 } });
  }
  s.addShape('line', { x: 0.5, y: 1.05, w: 12.35, h: 0, line: { color: 'A3A3A3', width: 0.5 } });
}


function intercalaire(pptx, ctx, titre, image, note) {
  const s = pptx.addSlide();
  s.background = { color: 'CDCDCD' };
  if (image) s.addImage(Object.assign(imageModele(image), { altText: titre, x: 5.2, y: 0.7, w: 3.2, h: 3.2 }));
  s.addText(titre, { x: 0.5, y: 4.4, w: 12.3, h: 0.9, fontFace: POLICE_TITRE, fontSize: 44, color: '111111', align: 'center', ...(titre.length > 34 ? { fontSize: 32, fit: 'shrink' } : {}) });
  s.addShape('line', { x: 4.6, y: 5.3, w: 4.1, h: 0, line: { color: '000000', width: 4 } });
  if (note) s.addText(note, { x: 1.5, y: 5.55, w: 10.3, h: 0.7, fontFace: POLICE, fontSize: 11, italic: true, color: '333333', align: 'center' });
  pied(s, ctx, ctx.numero());
}

function pageCouverture(pptx, ctx) {
  const s = pptx.addSlide();
  s.addImage(Object.assign(imageModele('couverture-abidjan.jpg'), { altText: 'Abidjan', x: 0.2, y: 0.1, w: 12.9, h: 6.4 }));
  s.addText([
    { text: TITRE_COUVERTURE[0], options: { breakLine: true } }, { text: TITRE_COUVERTURE[1] },
  ], { x: 2.5, y: 0.25, w: 8.3, h: 1.4, fontFace: POLICE_TITRE, fontSize: 44, color: 'FFFFFF', align: 'center', shadow: { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 45, opacity: 0.6 } });
  s.addShape('line', { x: 3.5, y: 1.75, w: 6.3, h: 0, line: { color: '000000', width: 3 } });
  s.addText(ctx.emetteur.identite, { x: 2.5, y: 1.85, w: 8.3, h: 0.55, fontFace: POLICE_TITRE, fontSize: 24, color: 'FFFFFF', align: 'center', shadow: { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 45, opacity: 0.6 } });
  if (ctx.emetteur.logo) {
    // Sur une pastille blanche : un logo foncé reste lisible sur la photo.
    const { w, h } = cadreLogo(ctx.emetteur.logoRatio, 1.8, 1.1);
    s.addShape('rect', { x: 0.45, y: 5.15, w: w + 0.3, h: h + 0.3, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF', width: 0 } });
    s.addImage(Object.assign(imageLogo(ctx.emetteur), { altText: 'Logo', x: 0.6, y: 5.3, w, h }));
  }
  s.addText(dateLongue(ctx.jour).toUpperCase(), { x: 8.3, y: 5.55, w: 4.7, h: 0.4, fontFace: POLICE, fontSize: 20, bold: true, color: 'FFFFFF', align: 'right' });
  s.addText(libellePeriode(ctx.jour, ctx.debut), { x: 6.3, y: 6.0, w: 6.7, h: 0.35, fontFace: POLICE, fontSize: 14, color: 'FFFFFF', align: 'right', shadow: { type: 'outer', color: '000000', blur: 4, offset: 1, angle: 45, opacity: 0.7 } });
  // Rapport composé dans l'appli : son périmètre sous l'émetteur.
  if (ctx.libelle) s.addText(ctx.libelle, { x: 2.0, y: 2.45, w: 9.3, h: 0.5, fontFace: POLICE, fontSize: 18, fit: 'shrink', bold: true, color: 'FFFFFF', align: 'center', shadow: { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 45, opacity: 0.7 } });
  s.addImage(Object.assign(imageModele('afrique.png'), { altText: 'Afrique', x: 10.1, y: 6.75, w: 0.6, h: 0.6 }));
  pied(s, ctx, ctx.numero());
}

// Constantes de gabarit du modèle.
const ROMAIN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const MAX_FAITS_PAYS = 10;

function dateFait(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return d.getUTCDate() + ' ' + MOIS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ', ' + d.getUTCHours() + ' h UTC';
}

function lienSur(f) {
  return typeof f.url === 'string' && /^https?:\/\//.test(f.url) ? f.url : null;
}

// pptxgenjs écrit l'adresse d'un lien telle quelle dans le fichier de
// relations (.rels), sans échapper « & ». Rapport de novembre, 14/11/2026 :
// une seule adresse à paramètres de suivi (« ?utm_source=rss&utm_medium=… »,
// Guinéematin) rendait slide33.xml.rels illisible, et PowerPoint refusait
// d'ouvrir le fichier ou demandait à le réparer. Toute adresse passe donc par
// ici avant d'atteindre un `hyperlink`.
function urlPptx(u) {
  if (typeof u !== 'string' || !/^https?:\/\//i.test(u)) return null;
  return u.replace(/&/g, '&amp;').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, '%22').replace(/'/g, '%27');
}
const lienPptx = (u) => { const x = urlPptx(u); return x ? { url: x } : undefined; };

// « Fin octobre » / « Mi-octobre » / « Début octobre » : le modèle date ses
// pages par période, pas par jour.
function periode(jour) {
  const [, m, j] = String(jour).split('-').map(Number);
  const mois = MOIS[m - 1];
  return (j > 20 ? 'Fin ' : j > 10 ? 'Mi-' : 'Début ') + mois;
}

// Le titre traduit en français quand la source écrit dans une autre langue
// (une seule langue par document) ; à défaut, la langue d'origine est dite.
const LANGUE_ORIGINE = { en: 'EN', pt: 'PT', ar: 'AR' };
function titreDeFait(f) {
  const titre = nettoyerTitre(f.titreFr || f.titre).toUpperCase();
  const marque = !f.titreFr && LANGUE_ORIGINE[f.langue] ? '(' + LANGUE_ORIGINE[f.langue] + ') ' : '';
  return marque + titre;
}

// Ce que le modèle écrit sous chaque titre ❑ : la source et la date. Rien
// d'autre — ni niveau, ni cotation, ni score : ce sont des notions de l'appli.
// Cotation client et indice de confiance : ajoutés au rapport à la demande de
// YORO le 23/10/2026 (« oui, go »), revenant sur le choix du 21/10 de s'en
// tenir au modèle de 2024. Mêmes règles que le bulletin : Confirmé = recoupé
// par une seconde source ; Probable = source unique capable d'alerter ; Non
// confirmé = le reste. La confiance qualifie le niveau du pays, pas un fait.
// L'indice de confiance a été RETIRÉ du rapport le 14/11/2026 (YORO : « les
// conf sont incompréhensibles, à supprimer »). `ligneConfiance` reste exportée
// pour qui voudrait la réafficher ; aucune page ne l'appelle plus.
// Espaces insécables : « Cotation : Non confirmé » ne se coupe jamais en fin
// de ligne (relecture du rapport de novembre, 14/11/2026 : « Cotation : » seul,
// « Probable » à la ligne suivante, sur une page sur trois).
const COTATION = { confirme: 'Confirmé', probable: 'Probable', non_confirme: 'Non\u00a0confirmé' };
const COTATION_LIB = 'Cotation\u00a0:\u00a0';
function ligneConfiance(d) {
  const c = d && d.confiance;
  if (!c || !c.libelle) return null;
  return 'Indice de confiance : ' + c.libelle + (c.motif ? ' (' + c.motif + ')' : '');
}

function faitTexte(f) {
  // Un fait repris par plusieurs médias est un seul fait, recoupé : ses
  // sources sont listées sur la même ligne (faits-p1.js, regrouper).
  const sources = (f.sources && f.sources.length ? f.sources : [f.source]).filter(Boolean);
  const source = sources.length ? sources.join(' · ') : 'Source non précisée';
  const etiquette = sources.length > 1 ? 'Sources : ' : 'Source : ';
  const quand = dateFait(f.publieMs);
  return { titre: titreDeFait(f), source, etiquette, quand, url: lienSur(f), cotation: COTATION[f.cotation] || null };
}

// Chaque actu du rapport est une FICHE : son titre, l'extrait cité de sa
// source, la ligne des sources (lien, date, cotation) et la photo de la source
// quand elle en publie une. Demande de YORO du 14/11/2026 : « toutes les actu
// doivent être présentées avec texte et image si disponible » — la liste de
// titres du modèle de 2024 (❑ titre, ▪ source) ne lui convenait plus. Sans
// photo, le texte prend la largeur : jamais d'image de remplacement. Deux
// fiches par page, pour que le texte reste lisible projeté en réunion.
// L'extrait passe de 360 à 300 caractères le 24/11/2026 pour laisser la place à
// l'analyse qui suit chaque actu (redaction.analyserFait) sans descendre le
// corps sous une taille lisible en projection.
// 650 depuis le 25/11/2026 (YORO : « donner plus de texte dans l'actu ») :
// le début de l'article quand le job l'a lu, sinon le chapô du flux. Une fiche
// trop longue pour une demi-page en prend une entière (paginerFiches).
const FICHE_EXTRAIT_MAX = 650;
// Second média d'un fait recoupé : ce qu'il ajoute, plus court.
const FICHE_EXTRAIT2_MAX = 280;
function ficheTexte(f, faitsPays) {
  const r = redaction.rediger(f, '');
  const t = faitTexte(f);
  const marque = !f.titreFr && LANGUE_ORIGINE[f.langue] ? '(' + LANGUE_ORIGINE[f.langue] + ') ' : '';
  const e = r.extraits[0] || null;
  // Un extrait que le job n'a pas encore pu traduire garde sa langue, et le
  // dit, comme le titre : une seule langue par document, sinon on l'annonce.
  // Depuis le 19/11/2026, rediger() ne cite que des chapôs en français : plus
  // de marque de langue sur l'extrait.
  const marqueExtrait = '';
  const coupe = (t, max) => (t.length > max ? t.slice(0, max).replace(/\s+\S*$/, '') + ' …' : t);
  const extrait = e ? { source: e.source, langue: marqueExtrait, texte: coupe(e.texte, FICHE_EXTRAIT_MAX) } : null;
  const e2 = r.extraits[1] || null;
  return {
    titre: marque + r.titre,
    extrait,
    extrait2: e2 ? { source: e2.source, texte: coupe(e2.texte, FICHE_EXTRAIT2_MAX) } : null,
    sansExtrait: extrait ? null : 'La source n\'en publie que le titre dans son flux : le détail est dans l\'article.',
    liens: r.liens.slice(0, 4),
    sources: r.sources,
    t,
    video: r.video,
    analyse: redaction.analyserFait(f, faitsPays),
  };
}
// L'analyse d'une fiche tient en un paragraphe : la lecture, les implications,
// les points à surveiller.
function texteAnalyse(a) {
  return a.lecture + ' ' + a.implications + ' ' + a.surveiller;
}

// Taille de corps qui fait tenir une fiche dans sa hauteur (pouces).
function tailleFiche(blocs, largeur, hauteur) {
  return [15, 14, 13, 12, 11, 10.5, 10].find((pt) => {
    // 0,55 em par caractère : l'italique et les capitales de la police sont
    // plus larges que la moyenne, et une estimation à 0,5 laissait le lien
    // « Voir la vidéo » chevaucher le pied de page (rapport de novembre, p. 73).
    const parLigne = Math.floor(largeur * 72 / (pt * 0.55));
    const lignes = blocs.reduce((n, b) => n + Math.ceil((b.length || 1) / parLigne), 0);
    return lignes * pt * 1.3 / 72 + 0.2 <= hauteur;
  }) || 9.5;
}

// Ce qu'une fiche écrit, dans l'ordre, et sa largeur de texte : partagé par
// le dessin (ficheSlide) et la mise en page (paginerFiches), pour que la
// taille calculée soit celle qui sera dessinée.
const LARGE_PHOTO_FICHE = 3.85;
function largeurFiche(f) {
  return f.photo && f.photo.data ? 12.15 - LARGE_PHOTO_FICHE - 0.25 : 12.15;
}
function blocsFiche(c) {
  const ligneSources = c.t.etiquette + c.sources.join(' · ') + (c.t.quand ? ' — ' + c.t.quand : '') + (c.t.cotation ? ' · Cotation : ' + c.t.cotation : '');
  const extraitTxt = c.extrait ? c.extrait.source + ' : « ' + c.extrait.texte + ' »' : c.sansExtrait;
  // Le titre est écrit 2 pt plus grand que le corps : compté en conséquence.
  return [c.titre + ' '.repeat(Math.ceil(c.titre.length / 5)), extraitTxt]
    .concat(c.extrait2 ? [c.extrait2.source + ' : « ' + c.extrait2.texte + ' »'] : [])
    .concat([texteAnalyse(c.analyse), ligneSources], c.video ? ['Voir la vidéo de la source'] : []);
}
// Hauteur utile d'une page de fiches (pouces) et écart entre deux fiches.
const FICHES_Y0 = 1.3;
const FICHES_ECART = 0.25;
const hauteurFiche = (n) => (6.5 - FICHES_Y0 - FICHES_ECART * (n - 1)) / n;
// Plus petit corps accepté pour mettre deux fiches sur une page : en dessous,
// une fiche prend la page entière plutôt que d'être illisible projetée.
const CORPS_MIN_DEUX_FICHES = 11;
/**
 * Les fiches d'une rubrique ou d'un pays, rangées par page : deux par page
 * quand chacune tient en demi-page à CORPS_MIN_DEUX_FICHES pt au moins, sinon
 * une. Avant le 25/11/2026 toujours deux (FAITS_PAR_PAGE) : le texte plus long
 * demandé par YORO serait descendu à 9 pt.
 */
function paginerFiches(liste, faitsPays) {
  const tient = (f) => tailleFiche(blocsFiche(ficheTexte(f, faitsPays)), largeurFiche(f), hauteurFiche(FAITS_PAR_PAGE)) >= CORPS_MIN_DEUX_FICHES;
  const pages = [];
  let i = 0;
  while (i < liste.length) {
    if (i + 1 < liste.length && tient(liste[i]) && tient(liste[i + 1])) { pages.push([liste[i], liste[i + 1]]); i += 2; }
    else { pages.push([liste[i]]); i += 1; }
  }
  return pages;
}

// L'analyse suit la citation sans libellé (YORO, 25/11/2026 : « fait l'analyse
// en dessous de l'actu sans indiquer analyse ») : un paragraphe en romain,
// après l'extrait en italique et entre guillemets. La citation et ce qui la
// commente restent distincts à l'œil ; la note de l'intercalaire dit ce
// qu'est ce paragraphe.
function ficheSlide(s, f, x0, y, hauteur, faitsPays) {
  const c = ficheTexte(f, faitsPays);
  const photo = f.photo && f.photo.data ? f.photo : null;
  const LARGE_PHOTO = LARGE_PHOTO_FICHE;
  const largeur = largeurFiche(f);
  const taille = tailleFiche(blocsFiche(c), largeur, hauteur);
  const corps = [{ text: c.titre, options: { bold: true, color: VERT, fontSize: taille + 2, breakLine: true } }];
  if (c.extrait) {
    corps.push({ text: c.extrait.source + ' : ' + c.extrait.langue, options: { bold: true, paraSpaceBefore: 4 } },
      { text: '« ' + c.extrait.texte + ' »', options: { italic: true, breakLine: true } });
  } else corps.push({ text: c.sansExtrait, options: { italic: true, color: LEGERE, breakLine: true, paraSpaceBefore: 4 } });
  if (c.extrait2) {
    corps.push({ text: c.extrait2.source + ' : ', options: { bold: true, paraSpaceBefore: 2 } },
      { text: '« ' + c.extrait2.texte + ' »', options: { italic: true, breakLine: true } });
  }
  corps.push({ text: texteAnalyse(c.analyse), options: { breakLine: true, paraSpaceBefore: 6 } });
  corps.push({ text: c.t.etiquette, options: { bold: true, fontSize: taille - 1, paraSpaceBefore: 4 } });
  if (c.liens.length) {
    c.liens.forEach((l, i) => corps.push({ text: (i ? ' · ' : '') + (l.source || 'article'), options: { color: VERT, fontSize: taille - 1, hyperlink: lienPptx(l.url) } }));
    const restants = c.sources.filter((x) => !c.liens.some((l) => l.source === x));
    if (restants.length) corps.push({ text: ' · ' + restants.join(' · '), options: { fontSize: taille - 1 } });
  } else corps.push({ text: c.t.source, options: { fontSize: taille - 1 } });
  corps.push({ text: (c.t.quand ? ' — ' + c.t.quand : '') + (c.t.cotation ? '   ·   ' + COTATION_LIB + c.t.cotation : ''), options: { fontSize: taille - 1, bold: !!c.t.cotation, breakLine: !!c.video } });
  if (c.video) corps.push({ text: 'Voir la vidéo de la source', options: { color: VERT, fontSize: taille - 1, hyperlink: lienPptx(c.video) } });
  s.addText(corps, { x: x0, y, w: largeur, h: hauteur, fontFace: POLICE, fontSize: taille, color: TEXTE, valign: 'top', paraSpaceAfter: 2, margin: 0 });
  if (photo) {
    const xp = x0 + 12.15 - LARGE_PHOTO;
    const b = boiteImage(photo, xp, y, LARGE_PHOTO, hauteur - 0.3);
    s.addImage({ data: 'image/' + (photo.type === 'png' ? 'png' : 'jpeg') + ';base64,' + enBase64(photo.data), altText: 'Photo : ' + (photo.credit || 'source'), x: b.x, y: b.y, w: b.w, h: b.h, hyperlink: lienPptx(photo.lien) });
    s.addText([{ text: 'Photo : © ' + (photo.credit || 'source'), options: photo.lien ? { hyperlink: lienPptx(photo.lien), color: VERT } : {} }],
      { x: xp, y: b.y + b.h + 0.02, w: LARGE_PHOTO, h: 0.24, fontFace: POLICE, fontSize: 9, color: LEGERE, align: 'right', margin: 0 });
  }
}

function pageFaits(pptx, ctx, titreNum, titre, faits, pays, vide, confiance, faitsPays) {
  const s = pptx.addSlide();
  titrePage(s, titreNum, titre, pays);
  if (confiance) s.addText(confiance, { x: 0.7, y: 1.1, w: 12.0, h: 0.32, fontFace: POLICE, fontSize: 11, italic: true, color: LEGERE });
  const y0 = confiance ? 1.5 : FICHES_Y0;
  if (!faits.length) {
    s.addText(vide || 'Aucun fait marquant relevé sur la période.', { x: 0.7, y: y0, w: 12.0, h: 0.5, fontFace: POLICE, fontSize: 13, italic: true, color: LEGERE });
  } else {
    const ecart = FICHES_ECART;
    // Une fiche seule sur sa page (paginerFiches) en prend toute la hauteur.
    const h = (6.5 - y0 - ecart * (faits.length - 1)) / faits.length;
    faits.forEach((f, i) => {
      const y = y0 + i * (h + ecart);
      if (i) s.addShape('line', { x: 0.7, y: y - ecart / 2, w: 12.15, h: 0, line: { color: 'D1D5DB', width: 0.75 } });
      ficheSlide(s, f, 0.7, y, h, faitsPays);
    });
  }
  pied(s, ctx, ctx.numero());
}

// Un fait marquant rédigé, une page (demande du 23/10/2026) : le titre en
// phrase, puis Contexte, Ce que rapportent les sources (chapôs cités), Enjeux
// sûreté, et la ligne des sources avec la cotation. La photo de la source à
// droite, avec son crédit et le lien vers l'article ; sans photo, le texte
// prend toute la largeur — jamais d'image de remplacement.
function boiteImage(photo, x, y, wMax, hMax) {
  const r = photo.w / photo.h;
  let w = wMax, h = wMax / r;
  if (h > hMax) { h = hMax; w = hMax * r; }
  return { x: x + (wMax - w) / 2, y, w, h };
}

function pageMarquant(pptx, ctx, titreNum, titre, f, pays, nomPays, confiance, faitsPays) {
  const s = pptx.addSlide();
  titrePage(s, titreNum, titre, pays);
  let y = 1.12;
  if (confiance) { s.addText(confiance, { x: 0.7, y, w: 12.0, h: 0.3, fontFace: POLICE, fontSize: 11, italic: true, color: LEGERE }); y += 0.3; }
  const r = redaction.rediger(f, nomPays);
  const a = redaction.analyserFait(f, faitsPays);
  const photo = f.photo && f.photo.data ? f.photo : null;
  const largeurTexte = photo ? 7.45 : 12.0;
  // Un titre de trois lignes chevauchait « Contexte » dans une boîte de 0,75 po
  // (rapport de novembre, Liberia, p. 65) : la boîte suit le nombre de lignes,
  // et le corps descend à 18 pt au-delà de deux lignes.
  const tailleTitre = r.titre.length > 2 * Math.floor(12.0 * 72 / (22 * 0.55)) ? 18 : 22;
  const lignesTitre = Math.ceil(r.titre.length / Math.floor(12.0 * 72 / (tailleTitre * 0.55)));
  const hTitre = lignesTitre * tailleTitre * 1.2 / 72 + 0.1;
  s.addText([{ text: r.titre, options: { bold: true, color: VERT, fontSize: tailleTitre, fontFace: POLICE_TITRE } }],
    { x: 0.7, y, w: 12.0, h: hTitre, valign: 'top', margin: 0 });
  y += hTitre + 0.08;
  const t = faitTexte(f);
  const hauteur = 6.45 - y;
  // Le plus grand corps qui tient dans la page (14 pt, puis 13, 12, 11) :
  // le texte est lu en réunion, projeté, et ne doit jamais déborder sur le pied.
  const blocs = [r.contexte, ...r.extraits.map((e) => e.source + ' : « ' + e.texte + ' »'), r.sansExtrait || '', a.lecture, r.enjeux, a.surveiller, t.etiquette + r.sources.join(' · ') + ' — ' + t.quand + ' · Cotation : ' + (t.cotation || '')].filter(Boolean);
  const taille = [14, 13, 12, 11].find((pt) => {
    const parLigne = Math.floor(largeurTexte * 72 / (pt * 0.5));
    const lignes = blocs.reduce((n, b) => n + Math.ceil(b.length / parLigne), 0) + 3;
    return lignes * pt * 1.25 / 72 + 4 * 0.12 <= hauteur;
  }) || 10.5;
  // Le texte coule sous le titre, sans intertitre (YORO, 25/11/2026 : « fait
  // l'analyse en dessous de l'actu sans indiquer analyse ») : le contexte, les
  // citations des médias en italique et entre guillemets, puis ce qui les
  // commente — la lecture du fait dans son mois, les implications, les points
  // à surveiller — en romain. Jusqu'au 24/11 : « Contexte », « Ce que
  // rapportent les sources », « Analyse sûreté », « Implications : ».
  const corps = [{ text: r.contexte, options: { breakLine: true, color: LEGERE } }];
  if (r.extraits.length) {
    r.extraits.forEach((e) => corps.push(
      { text: e.source + ' : ', options: { bold: true, paraSpaceBefore: 6 } },
      { text: '« ' + e.texte + ' »', options: { italic: true, breakLine: true } }));
  } else corps.push({ text: r.sansExtrait, options: { italic: true, color: LEGERE, breakLine: true, paraSpaceBefore: 6 } });
  corps.push({ text: a.lecture + ' ' + r.enjeux, options: { breakLine: true, paraSpaceBefore: 8 } },
    { text: a.surveiller, options: { breakLine: true, paraSpaceBefore: 4 } });
  corps.push({ text: t.etiquette, options: { bold: true, paraSpaceBefore: 8 } });
  if (r.liens.length) {
    r.liens.slice(0, 4).forEach((l, i) => corps.push({ text: (i ? ' · ' : '') + (l.source || 'article'), options: { color: VERT, hyperlink: lienPptx(l.url) } }));
    const restants = r.sources.filter((x) => !r.liens.slice(0, 4).some((l) => l.source === x));
    if (restants.length) corps.push({ text: ' · ' + restants.join(' · '), options: {} });
  } else corps.push({ text: t.source, options: {} });
  corps.push({ text: (t.quand ? ' — ' + t.quand : '') + (t.cotation ? '   ·   ' + COTATION_LIB + t.cotation : ''), options: { bold: !!t.cotation, breakLine: true } });
  if (r.video) corps.push({ text: 'Voir la vidéo de la source', options: { color: VERT, hyperlink: lienPptx(r.video), breakLine: true } });
  s.addText(corps, { x: 0.7, y, w: largeurTexte, h: hauteur, fontFace: POLICE, fontSize: taille, color: TEXTE, valign: 'top', paraSpaceAfter: 3 });
  if (photo) {
    const b = boiteImage(photo, 8.35, y + 0.05, 4.5, 4.0);
    s.addImage({ data: 'image/' + (photo.type === 'png' ? 'png' : 'jpeg') + ';base64,' + enBase64(photo.data), altText: 'Photo : ' + (photo.credit || 'source'), x: b.x, y: b.y, w: b.w, h: b.h, hyperlink: lienPptx(photo.lien) });
    s.addText([{ text: 'Photo : © ' + (photo.credit || 'source'), options: photo.lien ? { hyperlink: lienPptx(photo.lien), color: VERT } : {} }],
      { x: 8.35, y: b.y + b.h + 0.04, w: 4.5, h: 0.28, fontFace: POLICE, fontSize: 9, color: LEGERE, align: 'right' });
  }
  pied(s, ctx, ctx.numero());
}


const LIGNES_SOMMAIRE = 24;
// Une entrée = une ligne. En capitales et coupées à 84 caractères, elles
// prenaient deux lignes et la colonne de droite débordait du cadre sur le
// pied de page (rapport de novembre, 14/11/2026). Casse de phrase, coupe au
// mot à 72 caractères, et au plus LIGNES_SOMMAIRE lignes par cadre.
function entreeSommaire(f) {
  const marque = !f.titreFr && LANGUE_ORIGINE[f.langue] ? '(' + LANGUE_ORIGINE[f.langue] + ') ' : '';
  const t = marque + redaction.phraseDe(f);
  return t.length > 72 ? t.slice(0, 71).replace(/\s+\S*$/, '') + ' …' : t;
}
/**
 * Les deux cadres de la table des matières, partagés par le PowerPoint et le
 * Word : [{ titre, lignes: [{ t, titre? , puce? }] }]. Le modèle : à gauche
 * les rubriques du pays principal, à droite un fait par pays du groupe. Un
 * rapport filtré sans pays principal répartit ses pays sur les deux cadres ;
 * un rapport sur un seul pays dit son périmètre à droite.
 */
function cadresSommaire(P) {
  const principal = P.principal;
  const lignesPays = (liste) => liste.flatMap((d) => [{ t: d.nom.toUpperCase(), titre: true }]
    .concat((d.faits || []).slice(0, 1).map((f) => ({ t: entreeSommaire(f), puce: true }))));
  const cadres = [];
  if (principal) {
    const d = principal.d;
    const gauche = [];
    const rubriquesPleines = RUBRIQUES.filter((r) => faitsRubrique(d, r, P.max).length).length || 1;
    const parRubrique = Math.max(2, Math.min(6, Math.floor((LIGNES_SOMMAIRE - 1.5 * rubriquesPleines) / rubriquesPleines)));
    for (const r of RUBRIQUES) {
      const faits = faitsRubrique(d, r, P.max);
      if (!faits.length) continue;
      gauche.push({ t: r.titre, titre: true });
      faits.slice(0, parRubrique).forEach((f) => gauche.push({ t: entreeSommaire(f), puce: true }));
    }
    cadres.push({ titre: principal.sommaire, lignes: gauche });
    if (P.groupe && P.groupe.pays.length) cadres.push({ titre: P.groupe.sommaire, lignes: lignesPays(P.groupe.pays) });
    else cadres.push({ titre: 'PÉRIMÈTRE DU RAPPORT', lignes: lignesPerimetre(P) });
  } else {
    const pays = (P.groupe && P.groupe.pays) || [];
    const moitie = Math.ceil(pays.length / 2);
    cadres.push({ titre: P.groupe ? P.groupe.sommaire : 'PAYS', lignes: lignesPays(pays.slice(0, moitie)) });
    cadres.push(pays.length > 1
      ? { titre: (P.groupe ? P.groupe.sommaire : 'PAYS') + ' (SUITE)', lignes: lignesPays(pays.slice(moitie)).concat(P.absents && P.absents.length ? [{ t: 'Sans fait retenu sur la période', titre: true }, { t: P.absents.join(', ') }] : []) }
      : { titre: 'PÉRIMÈTRE DU RAPPORT', lignes: lignesPerimetre(P) });
  }
  cadres.forEach((c) => { if (!c.lignes.length) c.lignes.push({ t: 'Aucun fait marquant relevé sur la période.', vide: true }); });
  return cadres;
}
function lignesPerimetre(P) {
  const l = (P.criteres || []).map((c) => ({ t: c, puce: true }));
  if (P.absents && P.absents.length) l.push({ t: 'Sans fait retenu sur la période', titre: true }, { t: P.absents.join(', ') });
  return l;
}
function pageSommaire(pptx, ctx, P) {
  const s = pptx.addSlide();
  titrePage(s, '0', '- TABLE DES MATIÈRES');
  const bloc = (x, titre, lignes) => {
    s.addShape('rect', { x, y: 1.25, w: 6.05, h: 5.2, fill: { color: 'FFFFFF' }, line: { color: TEXTE, width: 0.75 } });
    s.addText(titre, { x, y: 1.3, w: 6.05, h: 0.4, fontFace: POLICE_TITRE, fontSize: 15, color: VERT, align: 'center' });
    s.addText(lignes, { x: x + 0.2, y: 1.8, w: 5.65, h: 4.55, fontFace: POLICE, fontSize: 10, color: TEXTE, valign: 'top', paraSpaceAfter: 2, fit: 'shrink' });
  };
  const runs = (lignes) => lignes.map((l) => (l.titre ? { text: l.t, options: { bold: true, color: VERT, breakLine: true, paraSpaceBefore: 6 } }
    : l.puce ? { text: l.t, options: { bullet: { code: '2751' }, breakLine: true } }
      : { text: l.t, options: { italic: !!l.vide, breakLine: true } }));
  const [g, d] = cadresSommaire(P);
  bloc(0.5, g.titre, runs(g.lignes));
  bloc(6.8, d.titre, runs(d.lignes));
  pied(s, ctx, ctx.numero());
}

function pageMerci(pptx, ctx) {
  const s = pptx.addSlide();
  s.background = { color: 'CDCDCD' };
  s.addText('MERCI', { x: 0.5, y: 2.6, w: 12.3, h: 1.2, fontFace: POLICE_TITRE, fontSize: 60, color: '111111', align: 'center' });
  pied(s, ctx, ctx.numero());
}

// Numéros romains des pays : le modèle s'arrête à X, un rapport filtré sur
// une région d'Afrique en compte plus (Afrique de l'Ouest : seize pays).
function romain(n) {
  if (n <= 10) return ROMAIN[n];
  const t = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let r = '';
  for (const [v, l] of t) while (n >= v) { r += l; n -= v; }
  return r;
}

/**
 * Le PÉRIMÈTRE d'un rapport (25/11/2026, YORO : « Revise Présentation 1 avec
 * des filtres pays, régional d'un pays, région ouest ou est Afrique… pour
 * avoir des options de contenus selon les besoins »). Le modèle de 2024 en est
 * un cas : la Côte d'Ivoire en pays principal (rubriques, faits rédigés), puis
 * les neuf pays de la sous-région. Un rapport composé dans l'appli
 * (presentation-perimetre.js) passe le sien ; le job, jamais.
 *  { libelle, criteres[], principal: { d, titre, sommaire, image } | null,
 *    groupe: { titre, sommaire, image, pays[] } | null, absents[], max }
 */
function perimetreModele(ci, regionaux) {
  return {
    libelle: null, criteres: [], absents: [], max: null,
    principal: ci ? { d: ci, titre: 'FAITS MARQUANTS EN CÔTE D\'IVOIRE', sommaire: 'FAITS MARQUANTS EN CÔTE D\'IVOIRE', image: 'carte-ci.jpg' } : null,
    groupe: { titre: 'DYNAMIQUES RÉGIONALES', sommaire: 'DYNAMIQUES SOUS-RÉGIONALES', image: 'afrique.png', pays: regionaux || [] },
  };
}
function perimetreDe(donnees) {
  return donnees.perimetre || perimetreModele(donnees.ci, donnees.regionaux);
}

// Construit le classeur. `ci` et chaque élément de `regionaux` ont la forme
// de `donneesBulletinPays` ; seuls leurs faits (titre, source, date, lien) sont
// lus. Le niveau d'alerte, la confiance, le score et la cotation de l'appli
// n'apparaissent PAS : le modèle du groupe n'en a pas, et le rapport doit
// respecter sa présentation (demande du 21/10/2026).
function construire(PptxGenJS, donnees) {
  const { jour, emetteur } = donnees;
  const P = perimetreDe(donnees);
  const em = emetteur || lireEmetteur();
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = TITRE_DOCUMENT(jour) + (P.libelle ? ' — ' + P.libelle : '');
  pptx.author = em.identite;
  let n = 0;
  const ctx = { jour, emetteur: em, numero: () => ++n, libelle: P.libelle, debut: P.debut || null };

  pageCouverture(pptx, ctx);
  pageSommaire(pptx, ctx, P);
  const plan = planPerimetre(P);
  let note = redaction.NOTE_REDACTION;
  if (P.principal) {
    const d = P.principal.d;
    intercalaire(pptx, ctx, P.principal.titre, P.principal.image, note);
    note = null;
    for (const { rub, marquants, liste } of plan.principal) {
      marquants.forEach((f) => pageMarquant(pptx, ctx, rub.num, '- ' + rub.titre, f, d.cy, d.nom || 'Côte d\'Ivoire', null, d.faits));
      paginerFiches(liste, d.faits).forEach((p) => pageFaits(pptx, ctx, rub.num, '- ' + rub.titre, p, d.cy, null, null, d.faits));
    }
  }
  // Le modèle garde toujours son intercalaire régional ; un rapport composé
  // sur un seul pays n'en a pas.
  if (P.groupe && (P.groupe.pays.length || !P.principal || !P.libelle)) {
    const absents = P.absents && P.absents.length ? 'Sans fait retenu sur la période : ' + P.absents.join(', ') + '.' : null;
    intercalaire(pptx, ctx, P.groupe.titre, P.groupe.image, [note, absents].filter(Boolean).join('\n') || null);
    plan.groupe.forEach(({ d, marquants, liste }, i) => {
      const titre0 = i === 0 ? d.nom + ' : situation ' + periode(jour) : d.nom;
      let k = 0;
      marquants.forEach((f) => { pageMarquant(pptx, ctx, romain(i + 1), k ? d.nom : titre0, f, d.cy, d.nom, null, d.faits); k++; });
      const pages = paginerFiches(liste, d.faits);
      if (!pages.length && !k) pages.push([]);
      pages.forEach((p) => { pageFaits(pptx, ctx, romain(i + 1), k ? d.nom : titre0, p, d.cy, null, null, d.faits); k++; });
    });
  }
  pageMerci(pptx, ctx);
  return pptx;
}

// Ce que le rapport montre, partagé par le PowerPoint et le Word : pour le
// pays principal (la Côte d'Ivoire dans le modèle), les MARQUANTS_CI faits les
// plus graves sont rédigés (chacun dans sa rubrique), le reste de chaque
// rubrique en fiches ; pour chaque pays du groupe, MARQUANTS_PAYS fait rédigé
// puis les fiches. Un fait n'est jamais à la fois rédigé et en fiche.
function planPerimetre(P) {
  const max = P.max || null;
  let planP = [];
  if (P.principal) {
    const d = P.principal.d;
    const choix = redaction.choisirMarquants(d.faits || [], redaction.MARQUANTS_CI).marquants;
    planP = RUBRIQUES.map((rub) => {
      const faits = faitsRubrique(d, rub, max);
      const tous = (d.faits || []).filter((f) => rubriqueDe(f) === rub.cle);
      const marquants = tous.filter((f) => choix.includes(f));
      return { rub, marquants, liste: faits.filter((f) => !marquants.includes(f)) };
    }).filter((x) => x.marquants.length || x.liste.length);
  }
  const planG = ((P.groupe && P.groupe.pays) || []).map((d) => {
    const faits = (d.faits || []).slice(0, max || MAX_FAITS_PAYS);
    const { marquants, autres } = redaction.choisirMarquants(faits, redaction.MARQUANTS_PAYS);
    return { d, marquants, liste: autres };
  });
  return { principal: planP, groupe: planG };
}
function planRapport(ci, regionaux) {
  const p = planPerimetre(perimetreModele(ci, regionaux));
  return { ci: p.principal, regionaux: p.groupe };
}
/** Tous les faits rédigés du rapport. */
function faitsMarquants(ci, regionaux) {
  const p = planRapport(ci, regionaux);
  return p.ci.flatMap((x) => x.marquants).concat(p.regionaux.flatMap((x) => x.marquants));
}
/**
 * Tous les faits que le rapport montre, ceux que le job illustre et dont il
 * traduit l'extrait : les rédigés d'abord (ils comptent le plus quand le
 * budget du passage s'épuise), puis les fiches, dans l'ordre des pages.
 */
function faitsIllustres(ci, regionaux) {
  const p = planRapport(ci, regionaux);
  return faitsMarquants(ci, regionaux)
    .concat(p.ci.flatMap((x) => x.liste), p.regionaux.flatMap((x) => x.liste));
}

function cheminRapport(racine, jour) {
  return path.join(racine, jour.slice(0, 7) + '.pptx');
}

// Le rapport du mois est TOUJOURS disponible et à jour sur sa période
// (demande de YORO du 23/10/2026 : « P1 doit toujours être disponible
// selon l'intervalle de la période désignée »). Jusque-là un seul rapport
// par mois, écrit au premier passage à partir du 24, puis figé : celui
// d'octobre 2026, forcé le 21, serait resté le rapport officiel.
//
// Désormais :
// - période = du 1er du mois au jour du rapport (`fin`) ;
// - le rapport du mois en cours est réécrit au premier passage de chaque
//   jour, sur le cumul du mois (faits-p1.js) ;
// - le mois écoulé est réécrit une dernière fois le lendemain de sa fin,
//   période complète (1er → dernier jour), puis ne bouge plus.
// `jour` écrit dans l'index est la fin de la période couverte.
function dernierJourMois(mois) {
  const [a, m] = String(mois).split('-').map(Number);
  return mois + '-' + String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0');
}
function moisPrecedent(jour) {
  const [a, m] = String(jour).split('-').map(Number);
  return m === 1 ? (a - 1) + '-12' : a + '-' + String(m - 1).padStart(2, '0');
}
function entreeIndex(racine, mois) {
  try {
    return (JSON.parse(fs.readFileSync(path.join(racine, 'index.json'), 'utf8')).rapports || []).find((r) => r.mois === mois) || null;
  } catch (e) { return null; }
}
/** Les rapports à (ré)écrire aujourd'hui : [{ mois, fin }]. */
function rapportsAActualiser(racine, aujourdhui) {
  const out = [];
  const prec = moisPrecedent(aujourdhui);
  const finPrec = dernierJourMois(prec);
  const ep = entreeIndex(racine, prec);
  const genereP = ep && ep.genere ? String(ep.genere).slice(0, 10) : null;
  // Le mois écoulé : une dernière fois, s'il n'a pas encore été écrit après sa fin.
  if (ep && !(ep.jour === finPrec && genereP && genereP > finPrec)) out.push({ mois: prec, fin: finPrec });
  const mois = String(aujourdhui).slice(0, 7);
  const e = entreeIndex(racine, mois);
  // Le fichier du mois en cours n'est plus dans le dépôt depuis le 22/11/2026
  // (servi par une release, voir publier-rapport-release.js) : une entrée qui
  // porte `base` est publiée, elle ne se réécrit pas une seconde fois le même jour.
  const publie = fs.existsSync(cheminRapport(racine, aujourdhui)) || !!(e && e.base);
  if (!e || e.jour !== aujourdhui || !publie) out.push({ mois, fin: aujourdhui });
  return out;
}

async function ecrire(racine, PptxGenJS, donnees) {
  const pptx = construire(PptxGenJS, donnees);
  fs.mkdirSync(racine, { recursive: true });
  const chemin = cheminRapport(racine, donnees.jour);
  await pptx.writeFile({ fileName: chemin });
  majIndex(racine, chemin, donnees.jour);
  return chemin;
}

/**
 * Reconstruit index.json à partir des fichiers présents (AAAA-MM.pptx / .docx /
 * .pdf) : Pages ne liste pas un dossier, et sans index le rapport existait mais
 * personne ne pouvait le retrouver (signalement du 21/10/2026). Partir des
 * fichiers plutôt que d'un état ajouté au fil de l'eau : le PDF est produit
 * par une étape ultérieure du workflow, et l'index doit le voir sans que le
 * job de collecte ne le sache. La date de génération déjà écrite est conservée.
 */
function reconstruireIndex(racine, maintenant) {
  const fIndex = path.join(racine, 'index.json');
  let avant = [];
  try { avant = JSON.parse(fs.readFileSync(fIndex, 'utf8')).rapports || []; } catch (e) { /* premier rapport */ }
  const parMois = {};
  for (const f of fs.readdirSync(racine)) {
    const m = /^(\d{4}-\d{2})\.(pptx|docx|pdf)$/.exec(f);
    if (m) (parMois[m[1]] = parMois[m[1]] || []).push(m[2]);
  }
  const ordre = ['pptx', 'docx', 'pdf'];
  // Un mois servi par une release (champ `base`) n'a plus ses fichiers dans
  // le dépôt : son entrée est gardée telle quelle. Un mois dont les fichiers
  // sont là (version finale commitée, ou release en échec) est servi par Pages.
  const publies = avant.filter((r) => r && r.base && !parMois[r.mois] && baseValide(r.base));
  const rapports = publies.concat(Object.keys(parMois).map((mois) => {
    const ancien = avant.find((r) => r.mois === mois) || {};
    const st = fs.statSync(path.join(racine, mois + '.' + parMois[mois][0]));
    return {
      mois,
      formats: parMois[mois].sort((a, b) => ordre.indexOf(a) - ordre.indexOf(b)),
      jour: ancien.jour || null,
      genere: ancien.genere || (maintenant || st.mtime).toISOString(),
    };
  })).sort((a, b) => (a.mois < b.mois ? 1 : a.mois > b.mois ? -1 : 0));
  fs.writeFileSync(fIndex, JSON.stringify({ rapports }, null, 1) + '\n');
  return rapports;
}

/**
 * Versions quotidiennes servies par une release GitHub — choix de YORO du
 * 22/11/2026 (« version finale seule dans Git »). Le rapport du mois en cours
 * (~24 Mo) était recommité chaque jour et chaque version restait dans
 * l'historique : ~700 Mo par mois, la première limite que le dépôt aurait
 * atteinte. Désormais seule la version finale d'un mois clos est commitée ;
 * le mois en cours est déposé (et remplacé chaque jour) dans la release
 * `rapport-AAAA-MM`. Les assets d'une release ne pèsent pas sur le dépôt et
 * n'ont pas d'historique.
 */
const PREFIXE_TAG = 'rapport-';
function tagRelease(mois) { return PREFIXE_TAG + mois; }
function nomAsset(mois, ext) { return 'Presentation-1-' + mois + '.' + ext; }
function baseRelease(depot, mois) {
  return 'https://github.com/' + depot + '/releases/download/' + tagRelease(mois) + '/';
}
// Seule une adresse de release GitHub est acceptée : l'index est servi au
// navigateur, qui en fait des liens de téléchargement.
function baseValide(b) {
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/releases\/download\/rapport-\d{4}-\d{2}\/$/.test(String(b || ''));
}
/** Pose `base` sur l'entrée du mois (après dépôt réussi dans la release). */
function marquerRelease(racine, mois, base, formats) {
  if (!baseValide(base)) throw new Error('adresse de release invalide : ' + base);
  const fIndex = path.join(racine, 'index.json');
  const d = JSON.parse(fs.readFileSync(fIndex, 'utf8'));
  const r = (d.rapports || []).find((x) => x.mois === mois);
  if (!r) throw new Error('mois absent de l\'index : ' + mois);
  r.base = base;
  if (formats && formats.length) r.formats = formats.slice();
  fs.writeFileSync(fIndex, JSON.stringify(d, null, 1) + '\n');
  return r;
}

/**
 * Index, appelé après l'écriture du fichier du mois. Plus de copie « dernier.* »
 * depuis le 20/11/2026 (choix de YORO) : réécrites chaque jour, elles doublaient
 * le poids du rapport dans le dépôt (~26 Mo par jour), et l'appli lit l'index.
 */
function majIndex(racine, chemin, jour, maintenant) {
  const rapports = reconstruireIndex(racine, maintenant);
  const r = rapports.find((x) => x.mois === String(jour).slice(0, 7));
  if (r) {
    r.jour = jour;
    r.genere = (maintenant || new Date()).toISOString();
    fs.writeFileSync(path.join(racine, 'index.json'), JSON.stringify({ rapports }, null, 1) + '\n');
  }
}

module.exports = {
  urlPptx,
  tagRelease, nomAsset, baseRelease, baseValide, marquerRelease,
  PAYS_REGIONAUX, construire, planRapport, planPerimetre, perimetreModele, perimetreDe, cadresSommaire, paginerFiches, romain, utiliserRessources, ressources, enBase64, imageModele, faitsMarquants, faitsIllustres, ficheTexte, texteAnalyse, rapportsAActualiser, dernierJourMois, moisPrecedent, libellePeriode, ecrire, majIndex, reconstruireIndex, cheminRapport, rubriqueDe, RUBRIQUES,
  // partagés avec la version Word (rapport-p1-word.js)
  ASSETS, NOM_MODELE, EMETTEUR_DEFAUT, CONFIG_EMETTEUR, lireEmetteur, fixerEmetteurMois, emetteurDuMois, cheminEmetteurMois, piedTexte, cadreLogo, ratioImage, TITRE_COUVERTURE, TITRE_DOCUMENT, VERT, TEXTE, LEGERE, POLICE, POLICE_TITRE, DRAPEAUX, rectsDrapeau,
  dateLongue, dateCourte, paginer, faitTexte, ligneConfiance, COTATION, LANGUE_ORIGINE, faitsRubrique, MAX_FAITS_RUBRIQUE, FAITS_PAR_PAGE, ROMAIN, MAX_FAITS_PAYS, periode, titreDeFait, taillePastille,
};

  });
  definir("./rapport-p1-word", function (module, exports, require, __dirname) {
// Rapport mensuel de sûreté en Word (.docx) : mêmes pages, mêmes couleurs, même
// ordre que la version PowerPoint (voir rapport-p1.js), mais en VRAIS
// textes, tableaux et images que l'on peut modifier — jamais une page aplatie
// en image. Une page Word = une diapositive (page 16:9 en paysage).
//
// La bibliothèque `docx` est injectée comme pptxgenjs l'est : le module se
// teste sans elle, avec un faux qui enregistre ce qu'on lui demande.
const fs = require('node:fs');
const path = require('node:path');
const g = require('./rapport-p1.js');
const redaction = require('./redaction-p1');

// Comme le PowerPoint, il respecte la présentation du modèle du groupe : pas de
// niveau d'alerte, de confiance, de score ni de cotation (notions de l'appli).
// L'indice de confiance, ajouté le 23/10/2026, a été retiré le 14/11/2026 à la
// demande de YORO (« incompréhensible ») ; la cotation reste.
//
// Page 16:9 du modèle (954 × 540 pt), en vingtièmes de point.
const LARGEUR = 19080;
const HAUTEUR = 10800;
const MARGE = 700;
const UTILE = LARGEUR - 2 * MARGE;

function construireWord(D, donnees) {
  const { jour, emetteur } = donnees;
  const P = g.perimetreDe(donnees);
  const em = emetteur || g.lireEmetteur();
  const {
    Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType,
    BorderStyle, ImageRun, Footer, PageNumber, PageOrientation, HeightRule, VerticalAlign,
    HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType, ExternalHyperlink,
  } = D;
  // Composé dans l'appli (25/11/2026) : les images du modèle et le logo
  // arrivent en octets (g.ressources, em.logoData) au lieu du disque.
  const img = (f) => g.ressources[f] || fs.readFileSync(path.join(g.ASSETS, f));
  const logo = () => em.logoData || fs.readFileSync(em.logo);
  const AUCUNE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const SANS_BORDURE = { top: AUCUNE, bottom: AUCUNE, left: AUCUNE, right: AUCUNE };
  const FILET = (c) => ({ style: BorderStyle.SINGLE, size: 6, color: c || g.TEXTE });
  const CADRE = { top: FILET(), bottom: FILET(), left: FILET(), right: FILET() };

  const run = (t, o) => new TextRun(Object.assign({ text: t, font: g.POLICE, size: 24, color: g.TEXTE }, o || {}));
  const par = (enfants, o) => new Paragraph(Object.assign({ children: Array.isArray(enfants) ? enfants : [enfants] }, o || {}));
  let premiere = true;
  // Chaque « diapositive » commence sur une nouvelle page, sauf la première.
  const debutPage = () => { const r = !premiere; premiere = false; return r; };

  // Drapeau : un petit tableau de bandes, modifiable comme le reste.
  function drapeau(code) {
    const f = g.DRAPEAUX[code];
    if (!f) return par(run(''));
    const cel = (c, o) => new TableCell(Object.assign({ shading: { type: ShadingType.CLEAR, fill: c, color: 'auto' }, borders: CADRE, children: [par(run('', { size: 2 }))] }, o || {}));
    let lignes;
    if (f.dir === 'bj') {
      lignes = [new TableRow({ height: { value: 300, rule: HeightRule.EXACT }, children: [cel(f.c[0], { rowSpan: 2, width: { size: 480, type: WidthType.DXA } }), cel(f.c[1], { width: { size: 720, type: WidthType.DXA } })] }),
        new TableRow({ height: { value: 300, rule: HeightRule.EXACT }, children: [cel(f.c[2], { width: { size: 720, type: WidthType.DXA } })] })];
    } else if (f.dir === 'v') {
      const w = Math.round(1200 / f.c.length);
      lignes = [new TableRow({ height: { value: 600, rule: HeightRule.EXACT }, children: f.c.map((c) => cel(c, { width: { size: w, type: WidthType.DXA } })) })];
    } else {
      lignes = f.c.map((c) => new TableRow({ height: { value: Math.round(600 / f.c.length), rule: HeightRule.EXACT }, children: [cel(c, { width: { size: 1200, type: WidthType.DXA } })] }));
    }
    return new Table({ width: { size: 1200, type: WidthType.DXA }, columnWidths: f.dir === 'v' ? f.c.map(() => Math.round(1200 / f.c.length)) : f.dir === 'bj' ? [480, 720] : [1200], rows: lignes });
  }

  // En-tête de page : pastille verte numérotée, titre souligné, drapeau.
  function entete(num, titre, pays) {
    const cell = (enfants, w, o) => new TableCell(Object.assign({ borders: SANS_BORDURE, width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: enfants }, o || {}));
    const tableau = new Table({
      width: { size: UTILE, type: WidthType.DXA }, columnWidths: [1000, UTILE - 1000 - 1500, 1500],
      rows: [new TableRow({ children: [
        cell([par(run(num, { font: g.POLICE_TITRE, size: g.taillePastille(num) * 2 - 4, color: 'FFFFFF' }), { alignment: AlignmentType.CENTER })], 1000, { shading: { type: ShadingType.CLEAR, fill: g.VERT, color: 'auto' } }),
        cell([par(run(titre, Object.assign({ font: g.POLICE_TITRE, size: 56, color: g.VERT }, /^- /.test(titre) ? { underline: {} } : {})), { indent: { left: 200 } })], UTILE - 1000 - 1500),
        cell([drapeau(pays)], 1500),
      ] })],
    });
    return [new Paragraph({ children: [], pageBreakBefore: debutPage(), spacing: { after: 0, before: 0 }, run: { size: 2 } }), tableau, par(run('', { size: 12 }), { border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'A3A3A3', space: 1 } } })];
  }

  // Une fiche par actu (demande de YORO du 14/11/2026), même contenu que le
  // PowerPoint (g.ficheTexte) : titre, extrait cité, sources, photo de la
  // source à droite avec son crédit ; sans photo, le texte prend la largeur.
  function ficheWord(f, derniere, faitsPays) {
    const c = g.ficheTexte(f, faitsPays);
    const texte = [par(run(c.titre, { bold: true, color: g.VERT, size: 32 }), { spacing: { before: 120, after: 60 } })];
    texte.push(c.extrait
      ? par([run(c.extrait.source + ' : ' + c.extrait.langue, { bold: true, size: 27 }), run('« ' + c.extrait.texte + ' »', { italics: true, size: 27 })], { spacing: { after: 60 } })
      : par(run(c.sansExtrait, { italics: true, color: g.LEGERE, size: 27 }), { spacing: { after: 60 } }));
    if (c.extrait2) texte.push(par([run(c.extrait2.source + ' : ', { bold: true, size: 25 }), run('« ' + c.extrait2.texte + ' »', { italics: true, size: 25 })], { spacing: { after: 60 } }));
    // L'analyse après chaque actu (24/11/2026), même texte que le PowerPoint,
    // sans libellé depuis le 25/11/2026 (YORO : « sans indiquer analyse »).
    texte.push(par(run(g.texteAnalyse(c.analyse), { size: 25 }), { spacing: { before: 80, after: 60 } }));
    const restants = c.sources.filter((x) => !c.liens.some((l) => l.source === x));
    texte.push(par([
      run(c.t.etiquette, { bold: true, size: 24 }),
      ...c.liens.flatMap((l, i) => [run(i ? ' · ' : '', { size: 24 }), new ExternalHyperlink({ link: l.url, children: [run(l.source || 'article', { color: g.VERT, size: 24, underline: {} })] })]),
      ...(c.liens.length ? [] : [run(c.t.source, { size: 24 })]),
      run((restants.length && c.liens.length ? ' · ' + restants.join(' · ') : '') + (c.t.quand ? ' \u2014 ' + c.t.quand : ''), { size: 24 }),
      ...(c.t.cotation ? [run('   \u00B7   Cotation\u00A0:\u00A0' + c.t.cotation, { size: 24, bold: true })] : []),
    ]));
    if (c.video) texte.push(par(new ExternalHyperlink({ link: c.video, children: [run('Voir la vidéo de la source', { color: g.VERT, size: 24, underline: {} })] })));
    const photo = f.photo && f.photo.data ? f.photo : null;
    const bas = derniere ? AUCUNE : { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' };
    const bordures = { top: AUCUNE, left: AUCUNE, right: AUCUNE, bottom: bas };
    const LARGE_PHOTO = 5200;
    const cellules = [new TableCell({ borders: bordures, width: { size: photo ? UTILE - LARGE_PHOTO : UTILE, type: WidthType.DXA }, margins: { right: 200, bottom: 120 }, children: texte })];
    if (photo) {
      // Pixels à 96 ppp : 330 px de large au plus, 190 de haut.
      let w = 330, h = Math.round(330 * photo.h / photo.w);
      if (h > 190) { h = 190; w = Math.round(190 * photo.w / photo.h); }
      const credit = photo.lien
        ? new ExternalHyperlink({ link: photo.lien, children: [run('Photo : \u00A9 ' + (photo.credit || 'source'), { size: 16, color: g.VERT, underline: {} })] })
        : run('Photo : \u00A9 ' + (photo.credit || 'source'), { size: 16, color: g.LEGERE });
      cellules.push(new TableCell({ borders: bordures, width: { size: LARGE_PHOTO, type: WidthType.DXA }, margins: { bottom: 120 }, children: [
        par(new ImageRun({ data: photo.data, transformation: { width: w, height: h } }), { alignment: AlignmentType.CENTER, spacing: { before: 120 } }),
        par(credit, { alignment: AlignmentType.RIGHT }),
      ] }));
    }
    return new Table({ width: { size: UTILE, type: WidthType.DXA }, columnWidths: photo ? [UTILE - LARGE_PHOTO, LARGE_PHOTO] : [UTILE], rows: [new TableRow({ cantSplit: true, children: cellules })] });
  }
  function lignesFaits(faits, faitsPays) {
    return faits.map((f, i) => ficheWord(f, i === faits.length - 1, faitsPays));
  }

  // Un fait marquant rédigé (demande du 23/10/2026) : même texte que la page
  // PowerPoint (redaction-p1.js), photo de la source à droite avec son
  // crédit et le lien ; sans photo, le texte prend toute la largeur.
  function faitMarquant(f, nomPays, faitsPays) {
    const r = redaction.rediger(f, nomPays);
    const a = redaction.analyserFait(f, faitsPays);
    const t = g.faitTexte(f);
    // Le texte coule sous le titre, sans intertitre (25/11/2026), comme le
    // PowerPoint : contexte, citations, puis ce qui les commente.
    const texte = [
      par(run(r.titre, { bold: true, color: g.VERT, size: 40, font: g.POLICE_TITRE }), { spacing: { before: 120, after: 60 } }),
      par(run(r.contexte, { size: 26, color: g.LEGERE }), { spacing: { after: 80 } }),
      ...(r.extraits.length
        ? r.extraits.map((e) => par([run(e.source + ' : ', { bold: true, size: 26 }), run('« ' + e.texte + ' »', { italics: true, size: 26 })], { spacing: { after: 60 } }))
        : [par(run(r.sansExtrait, { italics: true, color: g.LEGERE, size: 26 }))]),
      par(run(a.lecture + ' ' + r.enjeux, { size: 26 }), { spacing: { before: 120, after: 60 } }),
      par(run(a.surveiller, { size: 26 })),
    ];
    const liens = r.liens.slice(0, 4);
    const restants = r.sources.filter((x) => !liens.some((l) => l.source === x));
    texte.push(par([
      run(t.etiquette, { bold: true, size: 26 }),
      ...liens.flatMap((l, i) => [run(i ? ' · ' : '', { size: 26 }), new ExternalHyperlink({ link: l.url, children: [run(l.source || 'article', { color: g.VERT, size: 26, underline: {} })] })]),
      ...(liens.length ? [] : [run(t.source, { size: 26 })]),
      run((restants.length && liens.length ? ' · ' + restants.join(' · ') : '') + (t.quand ? ' \u2014 ' + t.quand : ''), { size: 26 }),
      ...(t.cotation ? [run('   \u00B7   Cotation\u00A0:\u00A0' + t.cotation, { size: 26, bold: true })] : []),
    ], { spacing: { before: 120 } }));
    if (r.video) texte.push(par(new ExternalHyperlink({ link: r.video, children: [run('Voir la vidéo de la source', { color: g.VERT, size: 26, underline: {} })] })));
    const photo = f.photo && f.photo.data ? f.photo : null;
    if (!photo) return texte;
    // Pixels à 96 ppp : 400 px de large au plus, 300 de haut.
    let w = 400, h = Math.round(400 * photo.h / photo.w);
    if (h > 300) { h = 300; w = Math.round(300 * photo.w / photo.h); }
    const credit = photo.lien
      ? new ExternalHyperlink({ link: photo.lien, children: [run('Photo : \u00A9 ' + (photo.credit || 'source'), { size: 16, color: g.VERT, underline: {} })] })
      : run('Photo : \u00A9 ' + (photo.credit || 'source'), { size: 16, color: g.LEGERE });
    const LARGE_PHOTO = 6400;
    return [new Table({
      width: { size: UTILE, type: WidthType.DXA }, columnWidths: [UTILE - LARGE_PHOTO, LARGE_PHOTO],
      rows: [new TableRow({ children: [
        new TableCell({ borders: SANS_BORDURE, width: { size: UTILE - LARGE_PHOTO, type: WidthType.DXA }, margins: { right: 200 }, children: texte }),
        new TableCell({ borders: SANS_BORDURE, width: { size: LARGE_PHOTO, type: WidthType.DXA }, children: [
          par(new ImageRun({ data: photo.data, transformation: { width: w, height: h } }), { alignment: AlignmentType.CENTER, spacing: { before: 200 } }),
          par(credit, { alignment: AlignmentType.RIGHT }),
        ] }),
      ] })],
    })];
  }

  const corps = [];

  // — Couverture : photo en fond de page, titre en blanc par-dessus.
  corps.push(new Paragraph({
    pageBreakBefore: debutPage(),
    children: [new ImageRun({
      data: img('couverture-abidjan.jpg'), transformation: { width: 1272, height: 640 },
      floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 }, behindDocument: true, wrap: { type: TextWrappingType.NONE } },
    })],
  }));
  corps.push(par(run(g.TITRE_COUVERTURE[0], { font: g.POLICE_TITRE, size: 96, color: 'FFFFFF' }), { alignment: AlignmentType.CENTER, spacing: { before: 200 } }));
  corps.push(par(run(g.TITRE_COUVERTURE[1], { font: g.POLICE_TITRE, size: 96, color: 'FFFFFF' }), { alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: '000000', space: 6 } } }));
  corps.push(par(run(em.identite, { font: g.POLICE_TITRE, size: 48, color: 'FFFFFF' }), { alignment: AlignmentType.CENTER, spacing: { before: 120 } }));
  // Logo de l'émetteur sur une pastille blanche, comme le PowerPoint : un logo
  // foncé reste lisible sur la photo.
  const logoPx = (wMax, hMax) => { const w = Math.round(Math.min(wMax, hMax * em.logoRatio)); return { width: w, height: Math.round(w / em.logoRatio) }; };
  if (em.logo) {
    const t = logoPx(170, 100);
    for (let i = 0; i < 6; i++) corps.push(par(run('', { size: 40 })));
    corps.push(new Table({
      width: { size: t.width * 15 + 300, type: WidthType.DXA }, columnWidths: [t.width * 15 + 300],
      rows: [new TableRow({ children: [new TableCell({ borders: SANS_BORDURE, width: { size: t.width * 15 + 300, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: 'FFFFFF', color: 'auto' }, margins: { top: 100, bottom: 100, left: 150, right: 150 },
        children: [par(new ImageRun({ data: logo(), transformation: t }))] })] })],
    }));
    for (let i = 0; i < 1; i++) corps.push(par(run('', { size: 40 })));
  } else {
    for (let i = 0; i < 10; i++) corps.push(par(run('', { size: 40 })));
  }
  corps.push(par(run(g.dateLongue(jour).toUpperCase(), { bold: true, size: 40, color: 'FFFFFF' }), { alignment: AlignmentType.RIGHT }));
  corps.push(par(run(g.libellePeriode(jour, P.debut), { size: 28, color: 'FFFFFF' }), { alignment: AlignmentType.RIGHT }));
  // Rapport composé dans l'appli : son périmètre, sur la couverture aussi.
  if (P.libelle) corps.push(par(run(P.libelle, { bold: true, size: 30, color: 'FFFFFF' }), { alignment: AlignmentType.RIGHT, spacing: { before: 80 } }));

  // — Table des matières : deux cadres, comme le modèle.
  corps.push(...entete('0', '- TABLE DES MATIÈRES'));
  {
    // Mêmes cadres que le sommaire du PowerPoint (g.cadresSommaire).
    const lignes = (l) => l.map((x) => (x.titre ? par(run(x.t, { bold: true, color: g.VERT, size: 20 }), { spacing: { before: 100 } })
      : x.puce ? par([run('\u2751  ', { size: 18 }), run(x.t, { size: 18 })], { indent: { left: 240 } })
        : par(run(x.t, { italics: !!x.vide, size: 18 }))));
    const [cg, cd] = g.cadresSommaire(P);
    const bloc = (titre, enfants) => new TableCell({
      borders: CADRE, width: { size: Math.floor(UTILE / 2) - 100, type: WidthType.DXA }, margins: { top: 100, left: 150, right: 150 },
      children: [par(run(titre, { font: g.POLICE_TITRE, color: g.VERT, size: 30 }), { alignment: AlignmentType.CENTER }), ...enfants],
    });
    corps.push(par(run('', { size: 12 })));
    corps.push(new Table({
      width: { size: UTILE, type: WidthType.DXA }, columnWidths: [Math.floor(UTILE / 2), UTILE - Math.floor(UTILE / 2)],
      rows: [new TableRow({ children: [bloc(cg.titre, lignes(cg.lignes)), bloc(cd.titre, lignes(cd.lignes))] })],
    }));
  }

  // — Intercalaire : bloc gris, carte au centre, titre en police étroite.
  const intercalaire = (titre, image, note) => {
    corps.push(new Paragraph({ children: [], pageBreakBefore: debutPage(), spacing: { after: 0 }, run: { size: 2 } }));
    corps.push(new Table({
      width: { size: UTILE, type: WidthType.DXA }, columnWidths: [UTILE],
      rows: [new TableRow({ height: { value: 8200, rule: HeightRule.EXACT }, children: [new TableCell({
        borders: SANS_BORDURE, width: { size: UTILE, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: 'CDCDCD', color: 'auto' },
        children: [
          par(new ImageRun({ data: img(image), transformation: { width: 300, height: 300 } }), { alignment: AlignmentType.CENTER }),
          par(run(titre, { font: g.POLICE_TITRE, size: titre.length > 34 ? 64 : 88, color: '111111' }), { alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: '000000', space: 8 } } }),
          ...(note ? note.split('\n').map((x, i) => par(run(x, { italics: true, size: 22, color: '333333' }), { alignment: AlignmentType.CENTER, spacing: { before: i ? 120 : 240 } })) : []),
        ],
      })] })],
    }));
  };
  const plan = g.planPerimetre(P);
  let note = redaction.NOTE_REDACTION;
  // — Pays principal (la Côte d'Ivoire dans le modèle) : rubriques, faits
  // rédigés d'abord, puis les fiches.
  if (P.principal) {
    const d = P.principal.d;
    intercalaire(P.principal.titre, P.principal.image, note);
    note = null;
    for (const { rub, marquants, liste } of plan.principal) {
      marquants.forEach((f) => {
        corps.push(...entete(rub.num, '- ' + rub.titre, d.cy));
        corps.push(...faitMarquant(f, d.nom || 'Côte d\'Ivoire', d.faits));
      });
      g.paginerFiches(liste, d.faits).forEach((p) => {
        corps.push(...entete(rub.num, '- ' + rub.titre, d.cy));
        corps.push(...lignesFaits(p, d.faits));
      });
    }
  }

  // — Groupe de pays (dynamiques régionales du modèle) : une rubrique
  // numérotée par pays, avec son drapeau.
  // Le modèle garde toujours son intercalaire régional ; un rapport composé
  // sur un seul pays n'en a pas.
  if (P.groupe && (P.groupe.pays.length || !P.principal || !P.libelle)) {
    const absents = P.absents && P.absents.length ? 'Sans fait retenu sur la période : ' + P.absents.join(', ') + '.' : null;
    intercalaire(P.groupe.titre, P.groupe.image, [note, absents].filter(Boolean).join('\n') || null);
    plan.groupe.forEach(({ d, marquants, liste }, i) => {
      const titre0 = i === 0 ? d.nom + ' : situation ' + g.periode(jour) : d.nom;
      let k = 0;
      marquants.forEach((f) => {
        corps.push(...entete(g.romain(i + 1), k ? d.nom : titre0, d.cy));
        k++;
        corps.push(...faitMarquant(f, d.nom, d.faits));
      });
      const pages = g.paginerFiches(liste, d.faits);
      if (!pages.length && !k) pages.push([]);
      pages.forEach((p) => {
        corps.push(...entete(g.romain(i + 1), k ? d.nom : titre0, d.cy));
        k++;
        if (p.length) corps.push(...lignesFaits(p, d.faits));
        else corps.push(par(run('Aucun fait marquant relevé sur la période.', { italics: true, color: g.LEGERE }), { spacing: { before: 160 } }));
      });
    });
  }

  // — Dernière page, comme le modèle.
  corps.push(new Paragraph({ children: [], pageBreakBefore: debutPage(), spacing: { after: 0 }, run: { size: 2 } }));
  corps.push(new Table({
    width: { size: UTILE, type: WidthType.DXA }, columnWidths: [UTILE],
    rows: [new TableRow({ height: { value: 8200, rule: HeightRule.EXACT }, children: [new TableCell({
      borders: SANS_BORDURE, width: { size: UTILE, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: 'CDCDCD', color: 'auto' },
      children: [par(run('MERCI', { font: g.POLICE_TITRE, size: 120, color: '111111' }), { alignment: AlignmentType.CENTER })],
    })] })],
  }));

  // Pied de page : logo et identité de l'émetteur encadrée, date et numéro —
  // comme le modèle, sans le nom ni le logo du groupe (27/10/2026).
  const pied = new Footer({ children: [new Table({
    width: { size: UTILE, type: WidthType.DXA }, columnWidths: [1500, UTILE - 1500 - 3000, 3000],
    rows: [new TableRow({ children: [
      new TableCell({ borders: SANS_BORDURE, width: { size: 1500, type: WidthType.DXA }, children: [par(em.logo ? new ImageRun({ data: logo(), transformation: logoPx(90, 40) }) : run(''))] }),
      new TableCell({ borders: CADRE, verticalAlign: VerticalAlign.CENTER, width: { size: UTILE - 4500, type: WidthType.DXA }, children: [par(run(g.piedTexte(em), { size: 22 }), { alignment: AlignmentType.CENTER })] }),
      new TableCell({ borders: SANS_BORDURE, verticalAlign: VerticalAlign.CENTER, width: { size: 3000, type: WidthType.DXA }, children: [par([run('|  ' + g.dateCourte(jour) + '   |   ', { size: 20 }), new TextRun({ children: [PageNumber.CURRENT], font: g.POLICE, size: 20, color: g.TEXTE })], { alignment: AlignmentType.RIGHT })] }),
    ] })],
  })] });

  return new Document({
    creator: em.identite,
    title: g.TITRE_DOCUMENT(jour) + (P.libelle ? ' — ' + P.libelle : ''),
    sections: [{
      properties: { page: { size: { width: HAUTEUR, height: LARGEUR, orientation: PageOrientation.LANDSCAPE }, margin: { top: 500, bottom: 700, left: MARGE, right: MARGE, header: 300, footer: 250 } } },
      footers: { default: pied },
      children: corps,
    }],
  });
}

function cheminWord(racine, jour) {
  return path.join(racine, String(jour).slice(0, 7) + '.docx');
}

async function ecrireWord(racine, D, donnees) {
  const doc = construireWord(D, donnees);
  fs.mkdirSync(racine, { recursive: true });
  const chemin = cheminWord(racine, donnees.jour);
  fs.writeFileSync(chemin, await D.Packer.toBuffer(doc));
  g.reconstruireIndex(racine);
  return chemin;
}

module.exports = { construireWord, ecrireWord, cheminWord };

  });
  racine.SentiqPresentation1 = { faits: exiger('./faits-p1'), redaction: exiger('./redaction-p1'), rapport: exiger('./rapport-p1'), word: exiger('./rapport-p1-word') };
}(typeof self !== 'undefined' ? self : this));
