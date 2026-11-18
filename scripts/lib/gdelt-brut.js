'use strict';
// GDELT par ses fichiers bruts — signal secondaire (accord de YORO, 18/11/2026).
//
// L'API DOC 2.0 répond 429 à presque toutes les requêtes venues des runners
// GitHub (voir CLAUDE.md, « GDELT : mesuré, non branché ») : leurs adresses
// sont partagées et le quota d'une requête toutes les cinq secondes est déjà
// consommé par d'autres. Les fichiers d'export, eux, sont de simples fichiers
// statiques publiés toutes les quinze minutes sur data.gdeltproject.org, sans
// quota ni clé.
//
// Ce qu'ils donnent : des ÉVÉNEMENTS codés (CAMEO) et géolocalisés par une
// machine, avec l'adresse d'un article source. Ce qu'ils ne donnent pas : un
// titre, un texte, une vérification. Un événement GDELT n'est donc jamais une
// actu ni une alerte ici : il ne peut que dire « la presse mondiale parle de
// violences dans ce pays » quand nos propres sources se taisent. Il ne fait
// jamais monter un niveau, et un test l'exige.
//
// Deux faiblesses connues de GDELT, à garder en tête avant toute conclusion :
// le géocodage confond les homonymes (Niger State et le Niger, comme pour nos
// propres lexiques), et un même fait repris par cent articles fait cent
// lignes. D'où le compte des ADRESSES distinctes, pas des lignes.

const zlib = require('zlib');

const BASE = 'http://data.gdeltproject.org/gdeltv2/';
const PAS_MS = 15 * 60 * 1000;

// GDELT géolocalise en codes FIPS 10-4, pas en ISO : le Niger y est « NG »,
// le Nigeria « NI ». Une table recopiée de mémoire se trompe sur ces paires ;
// un test vérifie qu'elle couvre les 54 pays, une seule fois chacun.
const FIPS_VERS_ISO = {
  AG: 'DZ', AO: 'AO', BN: 'BJ', BC: 'BW', UV: 'BF', BY: 'BI', CV: 'CV', CM: 'CM',
  CT: 'CF', CD: 'TD', CN: 'KM', CF: 'CG', CG: 'CD', IV: 'CI', DJ: 'DJ', EG: 'EG',
  EK: 'GQ', ER: 'ER', WZ: 'SZ', ET: 'ET', GB: 'GA', GA: 'GM', GH: 'GH', GV: 'GN',
  PU: 'GW', KE: 'KE', LT: 'LS', LI: 'LR', LY: 'LY', MA: 'MG', MI: 'MW', ML: 'ML',
  MR: 'MR', MP: 'MU', MO: 'MA', MZ: 'MZ', WA: 'NA', NG: 'NE', NI: 'NG', RW: 'RW',
  TP: 'ST', SG: 'SN', SE: 'SC', SL: 'SL', SO: 'SO', SF: 'ZA', OD: 'SS', SU: 'SD',
  TZ: 'TZ', TO: 'TG', TS: 'TN', UG: 'UG', ZA: 'ZM', ZI: 'ZW',
};

// Familles CAMEO retenues (code racine) : la configuration du projet est
// sécurité, politique, humanitaire. 14 manifestations, 17 coercition
// (arrestations, répression), 18 agressions, 19 combats, 20 violence de masse.
// Les familles coopératives (01 à 13) ne disent rien de la sûreté.
const FAMILLES = {
  '14': 'manifestation',
  '17': 'coercition',
  '18': 'agression',
  '19': 'combat',
  '20': 'violence_masse',
};

// Colonnes du fichier d'export GDELT 2.0 (61 colonnes, séparées par des
// tabulations). Un fichier d'un autre format fait échouer la lecture
// bruyamment plutôt que de compter de travers.
const COL = { id: 0, jour: 1, racine: 28, nbSources: 32, nbArticles: 33, lieu: 52, pays: 53, ajout: 59, url: 60 };
const NB_COLONNES = 61;

// Un fichier .zip à une seule entrée, lu par le répertoire central (les
// tailles du bloc local valent zéro quand l'archive porte un descripteur de
// données). Pas de dépendance : zlib suffit pour la méthode 8 (deflate).
function lireZip(buf) {
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error('zip illisible : fin du répertoire central introuvable');
  const central = buf.readUInt32LE(fin + 16);
  if (buf.readUInt32LE(central) !== 0x02014b50) throw new Error('zip illisible : répertoire central');
  const methode = buf.readUInt16LE(central + 10);
  const taille = buf.readUInt32LE(central + 20);
  const local = buf.readUInt32LE(central + 42);
  if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('zip illisible : entrée locale');
  const debut = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  const donnees = buf.subarray(debut, debut + taille);
  if (methode === 0) return donnees.toString('utf8');
  if (methode === 8) return zlib.inflateRawSync(donnees).toString('utf8');
  throw new Error('zip illisible : méthode de compression ' + methode);
}

// Garde les événements africains des familles retenues.
function analyserExport(texte) {
  const evenements = [];
  const lignes = texte.split('\n');
  for (const ligne of lignes) {
    if (!ligne) continue;
    const c = ligne.split('\t');
    if (c.length !== NB_COLONNES) throw new Error('export GDELT : ' + c.length + ' colonnes au lieu de ' + NB_COLONNES);
    const cy = FIPS_VERS_ISO[c[COL.pays]];
    const famille = FAMILLES[c[COL.racine]];
    if (!cy || !famille) continue;
    evenements.push({
      id: c[COL.id], cy, famille, lieu: c[COL.lieu], url: c[COL.url],
      nbSources: Number(c[COL.nbSources]) || 0, ajout: c[COL.ajout],
    });
  }
  return evenements;
}

// Par pays : adresses distinctes par famille, et la part reprise par au
// moins deux sources (NumSources de GDELT : sources distinctes ayant
// mentionné l'événement dans le quart d'heure). C'est un comptage, jamais
// une note : il ne compare aucun pays à un seuil.
function agreger(evenements) {
  const pays = {};
  for (const e of evenements) {
    const p = pays[e.cy] || (pays[e.cy] = { urls: new Set(), parFamille: {}, multiSources: new Set(), lieux: {} });
    p.urls.add(e.url);
    (p.parFamille[e.famille] || (p.parFamille[e.famille] = new Set())).add(e.url);
    if (e.nbSources >= 2) p.multiSources.add(e.url);
    if (e.lieu) p.lieux[e.lieu] = (p.lieux[e.lieu] || 0) + 1;
  }
  const sortie = {};
  Object.keys(pays).sort().forEach((cy) => {
    const p = pays[cy];
    const familles = {};
    Object.keys(p.parFamille).sort().forEach((f) => { familles[f] = p.parFamille[f].size; });
    sortie[cy] = {
      articles: p.urls.size,
      familles,
      reprisParPlusieursSources: p.multiSources.size,
      lieux: Object.entries(p.lieux).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l),
      exemples: Array.from(p.urls).slice(0, 3),
    };
  });
  return sortie;
}

// « 20261118214500 » → Date (UTC).
function dateGdelt(s) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(s);
  if (!m) throw new Error('horodatage GDELT illisible : ' + s);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}
function horodatage(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds());
}

// Dernier export annoncé par lastupdate.txt (trois lignes : export, mentions,
// gkg ; chacune « taille empreinte adresse »).
function dernierExport(lastupdate) {
  const l = lastupdate.split('\n').find((x) => /\.export\.CSV\.zip\s*$/.test(x));
  if (!l) throw new Error('lastupdate.txt : aucun export annoncé');
  const url = l.trim().split(/\s+/).pop();
  const m = /(\d{14})\.export\.CSV\.zip$/.exec(url);
  if (!m) throw new Error('lastupdate.txt : adresse inattendue ' + url);
  return m[1];
}

// Les n exports qui précèdent (et comprennent) le dernier, du plus récent au
// plus ancien.
function adressesExports(dernier, n) {
  const t = dateGdelt(dernier).getTime();
  const out = [];
  for (let i = 0; i < n; i++) out.push(BASE + horodatage(new Date(t - i * PAS_MS)) + '.export.CSV.zip');
  return out;
}

module.exports = {
  BASE, PAS_MS, FIPS_VERS_ISO, FAMILLES, COL, NB_COLONNES,
  lireZip, analyserExport, agreger, dateGdelt, horodatage, dernierExport, adressesExports,
};
