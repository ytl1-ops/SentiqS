// ============================================================
// SentiqS — bulletin quotidien d'un pays pilote.
//
// POURQUOI CE FICHIER EXISTE
//
// Décision du 20/10/2026 : le profil pilote est le responsable sûreté
// d'entreprise, la Côte d'Ivoire est le pays pilote n° 1, et la diffusion
// attendue est un bulletin par jour en début de matinée (7 h GMT), plus un
// flash dès qu'un pays franchit un seuil (voir alerte-sortante.js). Jusqu'ici
// le produit montrait un écran : rien ne partait vers quelqu'un qui ne
// l'ouvre pas.
//
// TROIS CHOIX QUI EXPLIQUENT LA FORME DU CODE
//
// 1. Les données viennent de la page (donneesBulletinPays, dans
//    SentiqS_Web.html), interrogée par le job APRÈS sa collecte. Rien n'est
//    recalculé ici : le niveau, la confiance, la cotation et les angles morts
//    sont ceux que voit l'utilisateur à l'écran au même instant.
//
// 2. Le bulletin est une page HTML statique écrite sous web/bulletins/, donc
//    servie par Pages comme l'archive des niveaux : une adresse stable par
//    jour, imprimable en PDF depuis n'importe quel navigateur, lisible sans
//    compte ni Supabase. Le PDF généré côté serveur viendra après, s'il le faut.
//
// 3. Un bulletin par jour, écrit par le premier passage du job à partir de
//    HEURE_BULLETIN_UTC. La collecte planifiée tourne en réalité toutes les
//    3 h 24 à 5 h 51 (voir CLAUDE.md) : le bulletin part donc entre 6 h et
//    midi GMT selon le passage, pas à 7 h pile. C'est dit dans la page.
//    Comme pour l'archive, le refus d'écraser EST le mécanisme « un par jour ».
//
// Ton : coller au réel, sans alarmisme (consigne de l'éditeur). Aucune phrase
// n'est écrite qui ne soit pas portée par une donnée de la page ; un fait non
// recoupé est dit tel, et ce que l'outil ignore a son propre bloc.
// ============================================================

const fs = require('fs');
const path = require('path');
const { tendanceNiveaux } = require('../../web/js/noyau.js');

const URL_SITE = 'https://ytl1-ops.github.io/SentiqS/';
const HEURE_BULLETIN_UTC = 6;

// Conseils officiels aux voyageurs, pour les 54 pays. Des liens, jamais un
// résumé : le contenu de ces avis change sans prévenir et le recopier ici
// figerait une consigne périmée sous l'en-tête du jour.
//
// 13/11/2026 : demande de YORO, « que chaque pays autre que la Côte d'Ivoire
// ait des rapports également ». Le bulletin couvrait le seul pays pilote ; il
// couvre désormais les 54 pays suivis. Chaque ligne : [nom affiché, adresse
// FCDO, adresse Département d'État, adresse France Diplomatie] — les trois
// administrations n'écrivent pas le même nom de la même façon (« congo » au
// FCDO, « republic-of-the-congo » au Département d'État ; « cape-verde » et
// « cabo-verde »). Ces adresses ont été écrites sans réseau :
// scripts/verifier-conseils-voyageurs.js les interroge depuis GitHub.
const CONSEILS = {
  AO: ['Angola', 'angola', 'angola', 'angola'],
  BF: ['Burkina Faso', 'burkina-faso', 'burkina-faso', 'burkina-faso'],
  BI: ['Burundi', 'burundi', 'burundi', 'burundi'],
  BJ: ['Bénin', 'benin', 'benin', 'benin'],
  BW: ['Botswana', 'botswana', 'botswana', 'botswana'],
  CD: ['RD Congo', 'democratic-republic-of-the-congo', 'democratic-republic-of-the-congo', 'republique-democratique-du-congo'],
  CF: ['Centrafrique', 'central-african-republic', 'central-african-republic', 'republique-centrafricaine'],
  CG: ['Congo-Brazzaville', 'congo', 'republic-of-the-congo', 'congo'],
  // France Diplomatie : l'ancienne adresse de la Côte d'Ivoire répond 404
  // depuis GitHub (vérifié le 13/11/2026) ; le site a déplacé ce pays sous
  // /information-par-pays/. Une adresse complète remplace alors le nom.
  CI: ['Côte d\'Ivoire', 'cote-d-ivoire', 'cote-d-ivoire', 'https://www.diplomatie.gouv.fr/fr/information-par-pays/cote-d-ivoire/conseils-aux-voyageurs-securite'],
  CM: ['Cameroun', 'cameroon', 'cameroon', 'cameroun'],
  CV: ['Cap-Vert', 'cape-verde', 'cabo-verde', 'cap-vert'],
  DJ: ['Djibouti', 'djibouti', 'djibouti', 'djibouti'],
  DZ: ['Algérie', 'algeria', 'algeria', 'algerie'],
  EG: ['Égypte', 'egypt', 'egypt', 'egypte'],
  ER: ['Érythrée', 'eritrea', 'eritrea', 'erythree'],
  ET: ['Éthiopie', 'ethiopia', 'ethiopia', 'ethiopie'],
  GA: ['Gabon', 'gabon', 'gabon', 'gabon'],
  GH: ['Ghana', 'ghana', 'ghana', 'ghana'],
  GM: ['Gambie', 'the-gambia', 'the-gambia', 'gambie'],
  GN: ['Guinée', 'guinea', 'guinea', 'guinee'],
  GQ: ['Guinée équatoriale', 'equatorial-guinea', 'equatorial-guinea', 'guinee-equatoriale'],
  GW: ['Guinée-Bissau', 'guinea-bissau', 'guinea-bissau', 'guinee-bissao'], // « Bissao » chez France Diplomatie
  KE: ['Kenya', 'kenya', 'kenya', 'kenya'],
  KM: ['Comores', 'comoros', 'comoros', 'comores'],
  LR: ['Liberia', 'liberia', 'liberia', 'liberia'],
  LS: ['Lesotho', 'lesotho', 'lesotho', 'lesotho'],
  LY: ['Libye', 'libya', 'libya', 'libye'],
  MA: ['Maroc', 'morocco', 'morocco', 'maroc'],
  MG: ['Madagascar', 'madagascar', 'madagascar', 'madagascar'],
  ML: ['Mali', 'mali', 'mali', 'mali'],
  MR: ['Mauritanie', 'mauritania', 'mauritania', 'mauritanie'],
  MU: ['Maurice', 'mauritius', 'mauritius', 'maurice'],
  MW: ['Malawi', 'malawi', 'malawi', 'malawi'],
  MZ: ['Mozambique', 'mozambique', 'mozambique', 'mozambique'],
  NA: ['Namibie', 'namibia', 'namibia', 'namibie'],
  NE: ['Niger', 'niger', 'niger', 'niger'],
  NG: ['Nigeria', 'nigeria', 'nigeria', 'nigeria'],
  RW: ['Rwanda', 'rwanda', 'rwanda', 'rwanda'],
  SC: ['Seychelles', 'seychelles', 'seychelles', 'seychelles'],
  SD: ['Soudan', 'sudan', 'sudan', 'soudan'],
  SL: ['Sierra Leone', 'sierra-leone', 'sierra-leone', 'sierra-leone'],
  SN: ['Sénégal', 'senegal', 'senegal', 'senegal'],
  SO: ['Somalie', 'somalia', 'somalia', 'somalie'],
  SS: ['Soudan du Sud', 'south-sudan', 'south-sudan', 'soudan-du-sud'],
  ST: ['Sao Tomé-et-Principe', 'sao-tome-and-principe', 'sao-tome-and-principe', 'sao-tome-et-principe'],
  SZ: ['Eswatini', 'eswatini', 'eswatini', 'eswatini'],
  TD: ['Tchad', 'chad', 'chad', 'tchad'],
  TG: ['Togo', 'togo', 'togo', 'togo'],
  TN: ['Tunisie', 'tunisia', 'tunisia', 'tunisie'],
  TZ: ['Tanzanie', 'tanzania', 'tanzania', 'tanzanie'],
  UG: ['Ouganda', 'uganda', 'uganda', 'ouganda'],
  ZA: ['Afrique du Sud', 'south-africa', 'south-africa', 'afrique-du-sud'],
  ZM: ['Zambie', 'zambia', 'zambia', 'zambie'],
  ZW: ['Zimbabwe', 'zimbabwe', 'zimbabwe', 'zimbabwe'],
};

// Le pays pilote garde son annonce individuelle sur le canal ; les 53 autres
// sont annoncés en UNE ligne par jour qui renvoie à l'index. Cinquante-quatre
// messages chaque matin feraient le canal que plus personne ne lit (règle de
// la sortie d'alerte, CLAUDE.md).
const PAYS_PILOTES = ['CI'];

const PAYS_BULLETIN = {};
Object.keys(CONSEILS).forEach((cy) => {
  const [nom, fcdo, etat, fr] = CONSEILS[cy];
  PAYS_BULLETIN[cy] = {
    nom,
    pilote: PAYS_PILOTES.includes(cy),
    conseils: [
      { nom: 'Royaume-Uni — FCDO', url: 'https://www.gov.uk/foreign-travel-advice/' + fcdo },
      { nom: 'États-Unis — Département d\'État', url: 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/' + etat + '-travel-advisory.html' },
      { nom: 'France — Conseils aux voyageurs', url: /^https:\/\//.test(fr) ? fr : 'https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/conseils-par-pays-destination/' + fr + '/' },
    ],
  };
});

/** Ordre d'écriture : le pays pilote d'abord, puis l'alphabet des codes. */
function paysAEcrire() {
  return PAYS_PILOTES.concat(Object.keys(PAYS_BULLETIN).filter((cy) => !PAYS_PILOTES.includes(cy)).sort());
}

const NIVEAU_ARTICLE = { crit: 'critique', high: 'élevé', mod: 'modéré' };
// Les couleurs de NIV (SentiqS_Web.html). Le jaune porte un texte foncé :
// le blanc sur #CA8A04 tombe à 2,9:1.
const COULEUR_NIVEAU = { vert: '#0F4F2A', jaune: '#CA8A04', orange: '#7C4A00', marron: '#78350F', rouge: '#8B1A1A' };
const TEXTE_SUR_NIVEAU = { jaune: '#1F2937' };
const SENS_TENDANCE = (c) => (c > 0 ? 'en hausse de ' + c + ' cran' + (c > 1 ? 's' : '')
  : c < 0 ? 'en baisse de ' + (-c) + ' cran' + (c < -1 ? 's' : '') : 'stable');

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function cheminBulletin(racine, cy, jour) {
  return path.join(racine, cy, jour + '.html');
}

/** Faut-il écrire le bulletin de ce jour ? Heure atteinte et pas déjà écrit. */
function doitEcrire(racine, cy, jour, maintenantMs) {
  if (!PAYS_BULLETIN[cy]) return false;
  if (new Date(maintenantMs).getUTCHours() < HEURE_BULLETIN_UTC) return false;
  return !fs.existsSync(cheminBulletin(racine, cy, jour));
}

// La tendance compare le niveau AFFICHÉ dans ce bulletin au début de la
// fenêtre archivée. L'instantané du jour peut avoir été écrit par un passage
// antérieur, avec un autre niveau : le prendre tel quel ferait annoncer une
// baisse vers un niveau qui n'est pas celui imprimé juste à côté.
function tendanceDuJour(serie, d, jour) {
  const points = ((serie && serie.pays && serie.pays[d.cy]) || []).filter((p) => p[0] !== jour);
  return tendanceNiveaux(points.concat([[jour, d.niveau]]), 30);
}

function dateFr(jour) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour || '');
  return m ? m[3] + '/' + m[2] + '/' + m[1] : String(jour || '');
}

function heureUTC(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0')
    + ' ' + String(d.getUTCHours()).padStart(2, '0') + 'h' + String(d.getUTCMinutes()).padStart(2, '0');
}

/** La phrase d'ouverture : uniquement ce que les données portent. */
function phraseEnBref(d, t) {
  const confirmes = d.faits.filter((f) => f.cotation && f.cotation.cle === 'confirme').length;
  const parts = [];
  parts.push('Niveau ' + d.libelle + ' (' + d.sous.toLowerCase() + ')'
    + (t ? ', ' + SENS_TENDANCE(t.crans) + ' depuis le ' + dateFr(t.depuis) : '') + '.');
  if (!d.faitsNotables) {
    parts.push('Aucun fait notable publié sur les ' + d.fenetreH + ' dernières heures'
      + (d.articlesDuJour ? ' (' + d.articlesDuJour + ' article' + (d.articlesDuJour > 1 ? 's' : '') + ' sans incidence sur la sûreté)' : '')
      + ' : cela ne veut pas dire qu\'il ne s\'est rien passé, voir « Ce que nous ne savons pas ».');
  } else {
    parts.push(d.faitsNotables + ' fait' + (d.faitsNotables > 1 ? 's' : '') + ' notable' + (d.faitsNotables > 1 ? 's' : '')
      + ' sur les ' + d.fenetreH + ' dernières heures, dont ' + confirmes + ' recoupé' + (confirmes > 1 ? 's' : '')
      + ' par une seconde source.');
  }
  if (t && t.crans) parts.push('Cette évolution est celle du niveau affiché : elle peut tenir à une revue du socle autant qu\'à la situation.');
  if (d.confiance) parts.push('Confiance dans ce niveau : ' + d.confiance.libelle + '.');
  return parts.join(' ');
}

function lignesAngleMort(am, d) {
  const l = [];
  if (am.muet) l.push('Aucune actualité publiée sur ce pays dans la fenêtre : le silence n\'est pas le calme.');
  else if (am.horsAlerte) l.push('Du flux existe, mais aucune source capable d\'alerter n\'a publié : le niveau ne peut pas monter sur la collecte du jour.');
  if (am.sourceUnique) l.push('Une seule source capable d\'alerter (' + am.sourcesAlerte + ') : si elle se tait, le pays devient aveugle.');
  else l.push(am.sourcesAlerte + ' sources capables d\'alerter suivent ce pays.');
  if (am.socleAncien) {
    const age = d.confiance && d.confiance.ageSocleJ;
    l.push('Le dernier incident vérifié du socle date de ' + (age == null ? 'une date inconnue' : age + ' jours')
      + ' : le niveau repose en partie sur un contexte qui n\'a pas été revu récemment.');
  }
  return l;
}

/**
 * Le bulletin, en HTML autonome (aucune ressource externe, imprimable).
 * `d` : donneesBulletinPays(cy) ; `serie` : web/historique/serie.json.
 */
function rendre(d, { jour, genereMs, serie } = {}) {
  const cfg = PAYS_BULLETIN[d.cy] || { conseils: [] };
  const t = tendanceDuJour(serie, d, jour);
  const col = COULEUR_NIVEAU[d.niveau] || '#1F2937';
  const am = d.angleMort || {};

  const faits = d.faits.length
    ? '<ol class="faits">' + d.faits.map((f) => '<li><span class="cot cot-' + esc(f.cotation.cle) + '">' + esc(f.cotation.libelle) + '</span> '
      + (f.url ? '<a href="' + esc(f.url) + '" rel="noopener">' + esc(f.titre) + '</a>' : esc(f.titre))
      + '<div class="meta">' + esc(f.source) + ' · ' + esc(heureUTC(f.publieMs)) + ' GMT · gravité estimée ' + esc(NIVEAU_ARTICLE[f.niveau] || f.niveau) + '</div></li>').join('') + '</ol>'
      + (d.faitsNotables > d.faits.length ? '<p class="meta">' + (d.faitsNotables - d.faits.length) + ' autre(s) fait(s) notable(s) dans l\'application.</p>' : '')
    : '<p>Aucun fait notable publié sur la fenêtre.</p>';

  const socle = d.socle.slice(0, 5).map((e) => '<li>' + esc(e.titre) + '<div class="meta">' + esc(e.date)
    + (e.ageJ != null ? ' (il y a ' + e.ageJ + ' j)' : '') + (e.src ? ' · ' + esc(e.src) : '') + '</div></li>').join('');
  const facteurs = d.facteurs.map((f) => '<li>' + esc(f.label) + '<div class="meta">'
    + (f.revu ? 'revu ' + esc(f.revu) : 'non daté') + '</div></li>').join('');

  return '<!doctype html>\n<html lang="fr"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">'
    + '<title>Bulletin sûreté — ' + esc(d.nom) + ' — ' + esc(dateFr(jour)) + '</title><style>'
    + ':root{color-scheme:light}body{margin:0;background:#F7F5F2;color:#1F2937;font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}'
    + 'main{max-width:760px;margin:0 auto;padding:24px 16px 40px;background:#fff}'
    + 'h1{font:700 26px/1.2 Georgia,"Source Serif 4",serif;margin:4px 0 6px}h2{font:700 18px/1.3 Georgia,serif;margin:28px 0 8px;padding-top:12px;border-top:1px solid #E5E0D8}'
    + '.tag{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#4B5563}.meta{font-size:13px;color:#4B5563}'
    + '.niv{display:inline-block;padding:3px 10px;border-radius:4px;color:' + (TEXTE_SUR_NIVEAU[d.niveau] || '#fff') + ';font-weight:700;background:' + col + '}'
    + '.bref{font-size:16px;border-left:4px solid ' + col + ';padding:8px 12px;background:#FAF8F5}'
    + 'ol,ul{padding-left:20px}li{margin:0 0 10px}a{color:#7A4A12}a:focus-visible{outline:2px solid #7A4A12;outline-offset:2px}'
    + '.cot{display:inline-block;font-size:12px;font-weight:700;padding:1px 7px;border-radius:3px;border:1px solid}'
    + '.cot-confirme{color:#065F46;border-color:#065F46}.cot-probable{color:#854D0E;border-color:#854D0E}.cot-non_confirme{color:#4B5563;border-color:#4B5563}'
    + '@media print{body{background:#fff}main{padding:0}a{color:#1F2937}}'
    + '</style></head><body><main>'
    + '<div class="tag">SentiqS · Bulletin quotidien · Responsable sûreté</div>'
    + '<h1>' + esc(d.nom) + ' — ' + esc(dateFr(jour)) + '</h1>'
    + '<p class="meta">Établi le ' + esc(heureUTC(genereMs)) + ' GMT à partir de la collecte la plus récente. '
    + 'Diffusion visée : 7 h GMT ; le passage réel de la collecte peut la décaler jusqu\'à la mi-journée.</p>'
    + '<h2>1. En bref</h2><p><span class="niv">' + esc(d.libelle) + '</span> '
    + (d.confiance ? '<span class="meta">Confiance : ' + esc(d.confiance.libelle) + ' — ' + esc(d.confiance.motif) + '</span>' : '') + '</p>'
    + '<p class="bref">' + esc(phraseEnBref(d, t)) + '</p>'
    + (d.motifPlafond ? '<p class="meta">' + esc(d.motifPlafond) + '.</p>' : '')
    + '<h2>2. Faits des ' + esc(d.fenetreH) + ' dernières heures</h2>' + faits
    + '<p class="meta">Cotation : <strong>Confirmé</strong> = recoupé par une seconde source distincte (pas une confirmation officielle) ; '
    + '<strong>Probable</strong> = une seule source jugée fiable ; <strong>Non confirmé</strong> = une seule source, sous le seuil de fiabilité. '
    + 'La gravité est estimée automatiquement sur le titre.</p>'
    + '<h2>3. Ce qui porte le niveau</h2>'
    + (socle ? '<p>Incidents vérifiés les plus récents :</p><ul>' + socle + '</ul>' : '<p>Aucun incident vérifié au socle.</p>')
    + (facteurs ? '<p>Facteurs structurels :</p><ul>' + facteurs + '</ul>' : '')
    + '<h2>4. Ce que nous ne savons pas</h2><ul>' + lignesAngleMort(am, d).map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul>'
    + '<h2>5. Conseils officiels aux voyageurs</h2>'
    + (cfg.conseils.length ? '<ul>' + cfg.conseils.map((c) => '<li><a href="' + esc(c.url) + '" rel="noopener">' + esc(c.nom) + '</a></li>').join('') + '</ul>'
      + '<p class="meta">Liens vers les avis en vigueur, à consulter à la source : ils ne sont pas résumés ici pour ne jamais en reproduire une version périmée.</p>' : '')
    + '<p class="meta"><a href="' + URL_SITE + 'SentiqS_Web.html">Ouvrir SentiqS</a> · <a href="../index.html">Bulletins des 54 pays</a> · Outil d\'aide à la décision : '
    + 'il ne remplace pas l\'appréciation de situation du responsable sûreté.</p>'
    + '</main></body></html>\n';
}

/** Écrit le bulletin daté et sa copie « dernier.html ». Retourne le chemin daté. */
function ecrire(racine, d, opts) {
  const html = rendre(d, opts);
  fs.mkdirSync(path.join(racine, d.cy), { recursive: true });
  const cible = cheminBulletin(racine, d.cy, opts.jour);
  fs.writeFileSync(cible, html);
  fs.writeFileSync(path.join(racine, d.cy, 'dernier.html'), html);
  return cible;
}

function urlPublique(cy, jour) {
  return URL_SITE + 'bulletins/' + cy + '/' + jour + '.html';
}

/** Le message court qui annonce le bulletin sur le canal (un par jour). */
function messageAnnonce(d, jour) {
  return { text: 'SentiqS — Bulletin ' + d.nom + ' du ' + dateFr(jour) + ' : niveau ' + d.libelle
    + (d.confiance ? ', confiance ' + d.confiance.libelle : '') + ', '
    + d.faitsNotables + ' fait(s) notable(s).\n' + urlPublique(d.cy, jour) };
}

// ── INDEX DES 54 BULLETINS ────────────────────────────────────────
// Pages ne liste pas un dossier : sans index, un bulletin de Mauritanie
// n'existerait que pour qui connaît son adresse. L'index est reconstruit à
// chaque écriture à partir d'index.json, qui garde le résumé du DERNIER
// bulletin de chaque pays (un pays non réécrit ce jour-là garde sa ligne et
// sa date : on voit qu'elle est ancienne au lieu de la perdre).

const RANG_NIVEAU = { rouge: 0, marron: 1, orange: 2, jaune: 3, vert: 4 };

function lireIndex(racine) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(racine, 'index.json'), 'utf8'));
    if (j && j.pays && typeof j.pays === 'object') return j;
  } catch (e) { /* absent ou illisible : on repart d'un index vide */ }
  return { pays: {} };
}

/** Résumé d'un bulletin pour l'index : ce que la page imprime, rien de plus. */
function resumeBulletin(d, jour, genereMs) {
  return {
    nom: d.nom, niveau: d.niveau, libelle: d.libelle, sous: d.sous,
    confiance: d.confiance ? d.confiance.libelle : null,
    faitsNotables: d.faitsNotables || 0,
    confirmes: (d.faits || []).filter((f) => f.cotation && f.cotation.cle === 'confirme').length,
    muet: !!(d.angleMort && d.angleMort.muet),
    jour, genere: genereMs ? new Date(genereMs).toISOString() : null,
  };
}

function rendreIndex(index) {
  const lignes = Object.keys(index.pays).map((cy) => Object.assign({ cy }, index.pays[cy]))
    .sort((a, b) => ((PAYS_PILOTES.includes(b.cy) ? 1 : 0) - (PAYS_PILOTES.includes(a.cy) ? 1 : 0))
      || ((RANG_NIVEAU[a.niveau] ?? 9) - (RANG_NIVEAU[b.niveau] ?? 9))
      || String(a.nom).localeCompare(String(b.nom), 'fr'));
  const recent = lignes.reduce((m, l) => (l.jour > m ? l.jour : m), '');
  const corps = lignes.map((l) => {
    const col = COULEUR_NIVEAU[l.niveau] || '#1F2937';
    return '<tr><td><a href="' + esc(l.cy) + '/dernier.html">' + esc(l.nom) + '</a>'
      + (PAYS_PILOTES.includes(l.cy) ? ' <span class="meta">(pays pilote)</span>' : '') + '</td>'
      + '<td><span class="niv" style="background:' + col + ';color:' + (TEXTE_SUR_NIVEAU[l.niveau] || '#fff') + '">' + esc(l.libelle) + '</span></td>'
      + '<td><span class="lbl">Confiance </span>' + esc(l.confiance || '—') + '</td>'
      + '<td><span class="lbl">Faits notables : </span>' + (l.muet ? '<span class="meta">aucune actualité</span>' : esc(l.faitsNotables) + (l.confirmes ? ' <span class="meta">(' + esc(l.confirmes) + ' recoupé' + (l.confirmes > 1 ? 's' : '') + ')</span>' : '')) + '</td>'
      + '<td' + (l.jour !== recent ? ' class="ancien"' : '') + '><span class="lbl">du </span>' + esc(dateFr(l.jour)) + '</td></tr>';
  }).join('');
  return '<!doctype html>\n<html lang="fr"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">'
    + '<title>Bulletins sûreté — 54 pays</title><style>'
    + ':root{color-scheme:light}body{margin:0;background:#F7F5F2;color:#1F2937;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}'
    + 'main{max-width:900px;margin:0 auto;padding:24px 16px 40px;background:#fff}'
    + 'h1{font:700 26px/1.2 Georgia,"Source Serif 4",serif;margin:4px 0 6px}.tag{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#4B5563}'
    + '.meta{font-size:13px;color:#4B5563}table{width:100%;border-collapse:collapse;margin-top:16px}'
    + 'th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #E5E0D8;vertical-align:top}th{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#4B5563}'
    + '.niv{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:700;font-size:13px}.ancien{color:#9A3412}.lbl{display:none}'
    + 'a{color:#7A4A12}a:focus-visible{outline:2px solid #7A4A12;outline-offset:2px}'
    + '@media (max-width:560px){thead{display:none}tr{display:block;padding:8px 0;border-bottom:1px solid #E5E0D8}td{display:inline-block;border:0;padding:2px 8px 2px 0}td:first-child{display:block;font-weight:700}.lbl{display:inline;color:#4B5563}}'
    + '@media print{body{background:#fff}main{padding:0}a{color:#1F2937}}'
    + '</style></head><body><main>'
    + '<div class="tag">SentiqS · Bulletins quotidiens · 54 pays</div>'
    + '<h1>Bulletins sûreté du ' + esc(dateFr(recent)) + '</h1>'
    + '<p class="meta">Un bulletin par pays et par jour, établi à partir de la collecte la plus récente. '
    + 'Le pays pilote d\'abord, puis du niveau le plus grave au plus calme. Une date en couleur signale un bulletin qui n\'a pas été réécrit ce jour-là.</p>'
    + '<p class="meta">« Aucune actualité » ne veut pas dire « calme » : c\'est un pays sur lequel l\'outil ne voit rien dans la fenêtre. Chaque bulletin le précise dans « Ce que nous ne savons pas ».</p>'
    + '<table><thead><tr><th>Pays</th><th>Niveau</th><th>Confiance</th><th>Faits notables</th><th>Bulletin du</th></tr></thead><tbody>'
    + corps + '</tbody></table>'
    + '<p class="meta"><a href="' + URL_SITE + 'SentiqS_Web.html">Ouvrir SentiqS</a> · Outil d\'aide à la décision : '
    + 'il ne remplace pas l\'appréciation de situation du responsable sûreté.</p>'
    + '</main></body></html>\n';
}

/** Ajoute le bulletin du jour à l'index et réécrit index.json + index.html. */
function mettreAJourIndex(racine, d, jour, genereMs) {
  const index = lireIndex(racine);
  index.pays[d.cy] = resumeBulletin(d, jour, genereMs);
  index.genere = genereMs ? new Date(genereMs).toISOString() : null;
  fs.mkdirSync(racine, { recursive: true });
  fs.writeFileSync(path.join(racine, 'index.json'), JSON.stringify(index, null, 1) + '\n');
  fs.writeFileSync(path.join(racine, 'index.html'), rendreIndex(index));
  return index;
}

/** Une seule ligne par jour pour les pays hors pilote, avec les plus graves nommés. */
function messageResume(resumes, jour) {
  if (!resumes.length) return null;
  const graves = resumes.filter((r) => r.niveau === 'rouge' || r.niveau === 'marron')
    .map((r) => r.nom + ' (' + r.libelle + ')');
  return { text: 'SentiqS — ' + resumes.length + ' bulletin' + (resumes.length > 1 ? 's' : '') + ' pays du ' + dateFr(jour)
    + (graves.length ? ' ; marron ou rouge : ' + graves.join(', ') : '') + '.\n' + URL_SITE + 'bulletins/index.html' };
}

module.exports = {
  URL_SITE, HEURE_BULLETIN_UTC, PAYS_BULLETIN, PAYS_PILOTES, paysAEcrire,
  cheminBulletin, doitEcrire, tendanceDuJour, rendre, ecrire, urlPublique, messageAnnonce, phraseEnBref,
  lireIndex, resumeBulletin, rendreIndex, mettreAJourIndex, messageResume,
};
