// Rapport mensuel de sûreté (né pour la rencontre mensuelle d'un groupe de
// responsables sûreté ivoiriens, dont il garde la présentation) :
// « Faits marquants en Côte d'Ivoire » puis « Dynamiques régionales », dans la
// présentation du modèle d'octobre 2024 (couverture, table des matières,
// intercalaires, pages thématiques, pays numérotés avec drapeau, MERCI, bandeau
// de pied).
//
// IL NE PORTE PLUS LE NOM NI LE LOGO DU GROUPE. Décision de YORO du 27/10/2026 :
// « supprime la mention GRSCI mais garde le modèle de présentation ». Le rapport
// porte l'identité d'envoi et le logo choisis (lireEmetteur, plus bas), à
// défaut SentiqS ; la mise en page est inchangée. Les noms de fichiers du code (rapport-grsci.js…) sont restés
// pour ne pas casser l'historique : ils ne sont jamais vus par le lecteur.
//
// CE RAPPORT NE PARLE PAS LE LANGAGE DE L'APPLI. Demande du 21/10/2026 : il doit
// respecter la présentation transmise, pas s'adapter à l'outil qui fait ressortir
// des niveaux d'alerte : ni niveau coloré ni score. Depuis le 23/10/2026, à la
// demande de YORO, il porte la cotation de chaque fait et l'indice de confiance
// de chaque pays, et ses faits les plus graves sont RÉDIGÉS avec la photo de la
// source (redaction-grsci.js, photos-grsci.js) au lieu d'être une liste de titres.
//
// Le module ne touche ni au réseau ni à la page : il reçoit des données et
// renvoie un classeur pptxgenjs, ce qui le rend testable sans navigateur.
const fs = require('node:fs');
const path = require('node:path');
const { nettoyerTitre } = require('./faits-grsci');
const redaction = require('./redaction-grsci');

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
  if (debut && debut === fin) return 'Journée du ' + jj(j) + ' ' + MOIS[m - 1] + ' ' + a;
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
  { cle: 'divers', num: 'IV', titre: 'DIVERS', cats: ['economique', 'economie', 'divers', null] },
];
// Deux fiches d'actu (texte + photo) par page depuis le 14/11/2026 (cinq
// titres auparavant).
const FAITS_PAR_PAGE = 2;
// Un mois de collecte donne des dizaines de faits par rubrique ; le groupe en
// lit dix, les plus graves d'abord (l'ordre vient de faits-grsci.js).
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
  // sources sont listées sur la même ligne (faits-grsci.js, regrouper).
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
// (demande de YORO du 23/10/2026 : « GRSCI doit toujours être disponible
// selon l'intervalle de la période désignée »). Jusque-là un seul rapport
// par mois, écrit au premier passage à partir du 24, puis figé : celui
// d'octobre 2026, forcé le 21, serait resté le rapport officiel.
//
// Désormais :
// - période = du 1er du mois au jour du rapport (`fin`) ;
// - le rapport du mois en cours est réécrit au premier passage de chaque
//   jour, sur le cumul du mois (faits-grsci.js) ;
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
  // partagés avec la version Word (rapport-grsci-word.js)
  ASSETS, NOM_MODELE, EMETTEUR_DEFAUT, CONFIG_EMETTEUR, lireEmetteur, fixerEmetteurMois, emetteurDuMois, cheminEmetteurMois, piedTexte, cadreLogo, ratioImage, TITRE_COUVERTURE, TITRE_DOCUMENT, VERT, TEXTE, LEGERE, POLICE, POLICE_TITRE, DRAPEAUX, rectsDrapeau,
  dateLongue, dateCourte, paginer, faitTexte, ligneConfiance, COTATION, LANGUE_ORIGINE, faitsRubrique, MAX_FAITS_RUBRIQUE, FAITS_PAR_PAGE, ROMAIN, MAX_FAITS_PAYS, periode, titreDeFait, taillePastille,
};
