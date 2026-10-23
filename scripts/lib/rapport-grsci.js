// Rapport mensuel du GRSCI (Groupe des Responsables Sûreté de Côte d'Ivoire) :
// « Faits marquants en Côte d'Ivoire » puis « Dynamiques régionales », dans la
// présentation du modèle d'octobre 2024 (couverture, table des matières,
// intercalaires, pages thématiques, pays numérotés avec drapeau, MERCI, bandeau
// de pied avec le logo).
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

const ASSETS = path.join(__dirname, '..', 'assets', 'grsci');

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
function libellePeriode(fin) {
  const [a, m, j] = String(fin).split('-').map(Number);
  return 'Période du 1er au ' + (j === 1 ? '1er' : j) + ' ' + MOIS[m - 1] + ' ' + a;
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
const FAITS_PAR_PAGE = 5;
// Un mois de collecte donne des dizaines de faits par rubrique ; le groupe en
// lit dix, les plus graves d'abord (l'ordre vient de faits-grsci.js).
const MAX_FAITS_RUBRIQUE = 10;

function rubriqueDe(fait) {
  const cat = fait.cat || null;
  return (RUBRIQUES.find((r) => r.cats.includes(cat)) || RUBRIQUES[3]).cle;
}

function faitsRubrique(ci, rub) {
  return ci.faits.filter((f) => rubriqueDe(f) === rub.cle).slice(0, MAX_FAITS_RUBRIQUE);
}

function paginer(liste, n) {
  const pages = [];
  for (let i = 0; i < liste.length; i += n) pages.push(liste.slice(i, i + n));
  return pages;
}


function pied(s, ctx, numero) {
  s.addImage({ path: path.join(ASSETS, 'logo-grsci.png'), x: 0.45, y: 6.55, w: 0.6, h: 0.69 });
  s.addText([
    { text: 'G', options: { bold: true } }, { text: 'roupe des ' },
    { text: 'R', options: { bold: true } }, { text: 'esponsables ' },
    { text: 'S', options: { bold: true } }, { text: 'ûreté de ' },
    { text: 'C', options: { bold: true } }, { text: 'ôte d\'' },
    { text: 'I', options: { bold: true } }, { text: 'voire' },
  ], { x: 3.4, y: 6.8, w: 4.6, h: 0.36, fontFace: POLICE, fontSize: 12, color: TEXTE, align: 'center', valign: 'middle', line: { color: VERT, width: 0.75 } });
  s.addText('|  ' + dateCourte(ctx.jour) + '   |   ' + numero, { x: 10.3, y: 6.9, w: 2.7, h: 0.3, fontFace: POLICE, fontSize: 10, color: TEXTE, align: 'right' });
}

function titrePage(s, num, titre, pays) {
  const souligne = /^- /.test(titre);
  // « VIII » ne tient pas à 24 pt dans la pastille : il passait sur deux
  // lignes (« VII / I », page Liberia du rapport d'octobre 2026).
  s.addText(num, { x: 0.5, y: 0.3, w: 0.7, h: 0.6, fontFace: POLICE_TITRE, fontSize: num.length > 2 ? 17 : 24, color: 'FFFFFF', fill: { color: VERT }, align: 'center', valign: 'middle' });
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
  if (image) s.addImage({ path: path.join(ASSETS, image), x: 5.2, y: 0.7, w: 3.2, h: 3.2 });
  s.addText(titre, { x: 0.5, y: 4.4, w: 12.3, h: 0.9, fontFace: POLICE_TITRE, fontSize: 44, color: '111111', align: 'center' });
  s.addShape('line', { x: 4.6, y: 5.3, w: 4.1, h: 0, line: { color: '000000', width: 4 } });
  if (note) s.addText(note, { x: 1.5, y: 5.55, w: 10.3, h: 0.7, fontFace: POLICE, fontSize: 11, italic: true, color: '333333', align: 'center' });
  pied(s, ctx, ctx.numero());
}

function pageCouverture(pptx, ctx) {
  const s = pptx.addSlide();
  s.addImage({ path: path.join(ASSETS, 'couverture-abidjan.jpg'), x: 0.2, y: 0.1, w: 12.9, h: 6.4 });
  s.addText([
    { text: 'RENCONTRE MENSUELLE', options: { breakLine: true } }, { text: 'G.R.S.CI' },
  ], { x: 2.5, y: 0.25, w: 8.3, h: 1.4, fontFace: POLICE_TITRE, fontSize: 44, color: 'FFFFFF', align: 'center', shadow: { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 45, opacity: 0.6 } });
  s.addShape('line', { x: 3.5, y: 1.75, w: 6.3, h: 0, line: { color: '000000', width: 3 } });
  s.addText(dateLongue(ctx.jour).toUpperCase(), { x: 8.3, y: 5.55, w: 4.7, h: 0.4, fontFace: POLICE, fontSize: 20, bold: true, color: 'FFFFFF', align: 'right' });
  s.addText(libellePeriode(ctx.jour), { x: 6.3, y: 6.0, w: 6.7, h: 0.35, fontFace: POLICE, fontSize: 14, color: 'FFFFFF', align: 'right', shadow: { type: 'outer', color: '000000', blur: 4, offset: 1, angle: 45, opacity: 0.7 } });
  s.addImage({ path: path.join(ASSETS, 'afrique.png'), x: 10.1, y: 6.75, w: 0.6, h: 0.6 });
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
const COTATION = { confirme: 'Confirmé', probable: 'Probable', non_confirme: 'Non confirmé' };
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

function corpsFaits(faits) {
  const corps = [];
  faits.forEach((f) => {
    const t = faitTexte(f);
    corps.push({ text: t.titre, options: { bold: true, underline: true, color: VERT, fontSize: 14, bullet: { code: '2751' }, breakLine: true, paraSpaceBefore: 8 } });
    const src = t.url ? { text: t.source, options: { hyperlink: { url: t.url }, color: VERT } } : { text: t.source, options: {} };
    corps.push({ text: t.etiquette, options: { bullet: { code: '25AA' }, indentLevel: 1, fontSize: 13 } });
    corps.push(Object.assign({}, src, { options: Object.assign({ fontSize: 13 }, src.options) }));
    corps.push({ text: (t.quand ? ' — ' + t.quand : '') + (t.cotation ? '   ·   ' : ''), options: { fontSize: 13, breakLine: !t.cotation } });
    if (t.cotation) corps.push({ text: 'Cotation : ' + t.cotation, options: { fontSize: 13, bold: true, color: TEXTE, breakLine: true } });
  });
  return corps;
}

function pageFaits(pptx, ctx, titreNum, titre, faits, pays, vide, confiance) {
  const s = pptx.addSlide();
  titrePage(s, titreNum, titre, pays);
  if (confiance) s.addText(confiance, { x: 0.7, y: 1.1, w: 12.0, h: 0.32, fontFace: POLICE, fontSize: 11, italic: true, color: LEGERE });
  const corps = faits.length ? corpsFaits(faits)
    : [{ text: vide || 'Aucun fait marquant relevé sur la période.', options: { color: LEGERE, italic: true } }];
  s.addText(corps, { x: 0.7, y: confiance ? 1.45 : 1.3, w: 12.0, h: confiance ? 4.95 : 5.1, fontFace: POLICE, fontSize: 13, color: TEXTE, valign: 'top', paraSpaceAfter: 2 });
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

function pageMarquant(pptx, ctx, titreNum, titre, f, pays, nomPays, confiance) {
  const s = pptx.addSlide();
  titrePage(s, titreNum, titre, pays);
  let y = 1.12;
  if (confiance) { s.addText(confiance, { x: 0.7, y, w: 12.0, h: 0.3, fontFace: POLICE, fontSize: 11, italic: true, color: LEGERE }); y += 0.3; }
  const r = redaction.rediger(f, nomPays);
  const photo = f.photo && f.photo.data ? f.photo : null;
  const largeurTexte = photo ? 7.45 : 12.0;
  s.addText([{ text: r.titre, options: { bold: true, color: VERT, fontSize: 22, fontFace: POLICE_TITRE } }],
    { x: 0.7, y, w: 12.0, h: 0.75, valign: 'top' });
  y += 0.8;
  const t = faitTexte(f);
  const hauteur = 6.45 - y;
  // Le plus grand corps qui tient dans la page (14 pt, puis 13, 12, 11) :
  // le texte est lu en réunion, projeté, et ne doit jamais déborder sur le pied.
  const blocs = [r.contexte, ...r.extraits.map((e) => e.source + ' : « ' + e.texte + ' »'), r.sansExtrait || '', r.enjeux, t.etiquette + r.sources.join(' · ') + ' — ' + t.quand + ' · Cotation : ' + (t.cotation || '')].filter(Boolean);
  const taille = [14, 13, 12, 11].find((pt) => {
    const parLigne = Math.floor(largeurTexte * 72 / (pt * 0.5));
    const lignes = blocs.reduce((n, b) => n + Math.ceil(b.length / parLigne), 0) + 3;
    return lignes * pt * 1.25 / 72 + 3 * 0.12 <= hauteur;
  }) || 10.5;
  const intertitre = (x) => ({ text: x, options: { bold: true, color: VERT, fontSize: taille + 1, breakLine: true, paraSpaceBefore: 8 } });
  const corps = [intertitre('Contexte'), { text: r.contexte, options: { breakLine: true } }];
  corps.push(intertitre('Ce que rapportent les sources'));
  if (r.extraits.length) {
    r.extraits.forEach((e) => corps.push(
      { text: e.source + ' : ', options: { bold: true } },
      { text: '« ' + e.texte + ' »', options: { italic: true, breakLine: true } }));
  } else corps.push({ text: r.sansExtrait, options: { italic: true, color: LEGERE, breakLine: true } });
  corps.push(intertitre('Enjeux sûreté'), { text: r.enjeux, options: { breakLine: true } });
  corps.push({ text: t.etiquette, options: { bold: true, paraSpaceBefore: 8 } });
  if (r.liens.length) {
    r.liens.slice(0, 4).forEach((l, i) => corps.push({ text: (i ? ' · ' : '') + (l.source || 'article'), options: { color: VERT, hyperlink: { url: l.url } } }));
    const restants = r.sources.filter((x) => !r.liens.slice(0, 4).some((l) => l.source === x));
    if (restants.length) corps.push({ text: ' · ' + restants.join(' · '), options: {} });
  } else corps.push({ text: t.source, options: {} });
  corps.push({ text: (t.quand ? ' — ' + t.quand : '') + (t.cotation ? '   ·   Cotation : ' + t.cotation : ''), options: { bold: !!t.cotation, breakLine: true } });
  if (r.video) corps.push({ text: 'Voir la vidéo de la source', options: { color: VERT, hyperlink: { url: r.video }, breakLine: true } });
  s.addText(corps, { x: 0.7, y, w: largeurTexte, h: hauteur, fontFace: POLICE, fontSize: taille, color: TEXTE, valign: 'top', paraSpaceAfter: 3 });
  if (photo) {
    const b = boiteImage(photo, 8.35, y + 0.05, 4.5, 4.0);
    s.addImage({ data: 'image/' + (photo.type === 'png' ? 'png' : 'jpeg') + ';base64,' + photo.data.toString('base64'), x: b.x, y: b.y, w: b.w, h: b.h, hyperlink: photo.lien ? { url: photo.lien } : undefined });
    s.addText([{ text: 'Photo : © ' + (photo.credit || 'source'), options: photo.lien ? { hyperlink: { url: photo.lien }, color: VERT } : {} }],
      { x: 8.35, y: b.y + b.h + 0.04, w: 4.5, h: 0.28, fontFace: POLICE, fontSize: 9, color: LEGERE, align: 'right' });
  }
  pied(s, ctx, ctx.numero());
}


function pageSommaire(pptx, ctx, ci, regionaux) {
  const s = pptx.addSlide();
  titrePage(s, '0', '- TABLE DES MATIÈRES');
  const bloc = (x, titre, lignes) => {
    s.addShape('rect', { x, y: 1.25, w: 6.05, h: 5.2, fill: { color: 'FFFFFF' }, line: { color: TEXTE, width: 0.75 } });
    s.addText(titre, { x, y: 1.3, w: 6.05, h: 0.4, fontFace: POLICE_TITRE, fontSize: 15, color: VERT, align: 'center' });
    s.addText(lignes, { x: x + 0.2, y: 1.8, w: 5.65, h: 4.6, fontFace: POLICE, fontSize: 9, color: TEXTE, valign: 'top', paraSpaceAfter: 2 });
  };
  const court = (t) => (t.length > 84 ? t.slice(0, 81) + '…' : t);
  const gauche = [];
  for (const r of RUBRIQUES) {
    const faits = faitsRubrique(ci, r);
    if (!faits.length) continue;
    gauche.push({ text: r.titre, options: { bold: true, color: VERT, breakLine: true, paraSpaceBefore: 6 } });
    faits.slice(0, 6).forEach((f) => gauche.push({ text: court(titreDeFait(f)), options: { bullet: { code: '2751' }, breakLine: true } }));
  }
  if (!gauche.length) gauche.push({ text: 'Aucun fait marquant relevé sur la période.', options: { italic: true } });
  const droite = [];
  regionaux.forEach((d) => {
    droite.push({ text: d.nom.toUpperCase(), options: { bold: true, color: VERT, breakLine: true, paraSpaceBefore: 6 } });
    (d.faits || []).slice(0, 1).forEach((f) => droite.push({ text: court(titreDeFait(f)), options: { bullet: { code: '2751' }, breakLine: true } }));
  });
  bloc(0.5, 'FAITS MARQUANTS EN CÔTE D\'IVOIRE', gauche);
  bloc(6.8, 'DYNAMIQUES SOUS-RÉGIONALES', droite);
  pied(s, ctx, ctx.numero());
}

function pageMerci(pptx, ctx) {
  const s = pptx.addSlide();
  s.background = { color: 'CDCDCD' };
  s.addText('MERCI', { x: 0.5, y: 2.6, w: 12.3, h: 1.2, fontFace: POLICE_TITRE, fontSize: 60, color: '111111', align: 'center' });
  pied(s, ctx, ctx.numero());
}

// Construit le classeur. `ci` et chaque élément de `regionaux` ont la forme
// de `donneesBulletinPays` ; seuls leurs faits (titre, source, date, lien) sont
// lus. Le niveau d'alerte, la confiance, le score et la cotation de l'appli
// n'apparaissent PAS : le modèle du groupe n'en a pas, et le rapport doit
// respecter sa présentation (demande du 21/10/2026).
function construire(PptxGenJS, { jour, ci, regionaux }) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = 'Rencontre mensuelle G.R.S.CI — ' + dateLongue(jour);
  pptx.author = 'SentiqS';
  let n = 0;
  const ctx = { jour, numero: () => ++n };

  pageCouverture(pptx, ctx);
  pageSommaire(pptx, ctx, ci, regionaux);
  intercalaire(pptx, ctx, 'FAITS MARQUANTS EN CÔTE D\'IVOIRE', 'carte-ci.jpg', redaction.NOTE_REDACTION);
  const plan = planRapport(ci, regionaux);
  for (const { rub, marquants, liste } of plan.ci) {
    let premiere = true;
    const conf = () => { const c = premiere ? ligneConfiance(ci) : null; premiere = false; return c; };
    marquants.forEach((f) => pageMarquant(pptx, ctx, rub.num, '- ' + rub.titre, f, 'CI', ci.nom || 'Côte d\'Ivoire', conf()));
    paginer(liste, FAITS_PAR_PAGE).forEach((p) => pageFaits(pptx, ctx, rub.num, '- ' + rub.titre, p, 'CI', null, conf()));
  }
  intercalaire(pptx, ctx, 'DYNAMIQUES RÉGIONALES', 'afrique.png');
  plan.regionaux.forEach(({ d, marquants, liste }, i) => {
    const titre0 = i === 0 ? d.nom + ' : situation ' + periode(jour) : d.nom;
    let k = 0;
    marquants.forEach((f) => { pageMarquant(pptx, ctx, ROMAIN[i + 1], k ? d.nom : titre0, f, d.cy, d.nom, k ? null : ligneConfiance(d)); k++; });
    const pages = paginer(liste, FAITS_PAR_PAGE);
    if (!pages.length && !k) pages.push([]);
    pages.forEach((p) => { pageFaits(pptx, ctx, ROMAIN[i + 1], k ? d.nom : titre0, p, d.cy, null, k ? null : ligneConfiance(d)); k++; });
  });
  pageMerci(pptx, ctx);
  return pptx;
}

// Ce que le rapport montre, partagé par le PowerPoint et le Word : pour la
// Côte d'Ivoire, les MARQUANTS_CI faits les plus graves sont rédigés (chacun
// dans sa rubrique), le reste de chaque rubrique en liste ; pour chaque pays
// de la sous-région, MARQUANTS_PAYS fait rédigé puis la liste. Un fait n'est
// jamais à la fois rédigé et listé.
function planRapport(ci, regionaux) {
  const choixCi = redaction.choisirMarquants(ci.faits || [], redaction.MARQUANTS_CI).marquants;
  const planCi = RUBRIQUES.map((rub) => {
    const faits = faitsRubrique(ci, rub);
    const tous = (ci.faits || []).filter((f) => rubriqueDe(f) === rub.cle);
    const marquants = tous.filter((f) => choixCi.includes(f));
    return { rub, marquants, liste: faits.filter((f) => !marquants.includes(f)) };
  }).filter((x) => x.marquants.length || x.liste.length);
  const planReg = (regionaux || []).map((d) => {
    const faits = (d.faits || []).slice(0, MAX_FAITS_PAYS);
    const { marquants, autres } = redaction.choisirMarquants(faits, redaction.MARQUANTS_PAYS);
    return { d, marquants, liste: autres };
  });
  return { ci: planCi, regionaux: planReg };
}
/** Tous les faits rédigés du rapport : ceux que le job illustre. */
function faitsMarquants(ci, regionaux) {
  const p = planRapport(ci, regionaux);
  return p.ci.flatMap((x) => x.marquants).concat(p.regionaux.flatMap((x) => x.marquants));
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
  if (!e || e.jour !== aujourdhui || !fs.existsSync(cheminRapport(racine, aujourdhui))) out.push({ mois, fin: aujourdhui });
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
  const rapports = Object.keys(parMois).sort().reverse().map((mois) => {
    const ancien = avant.find((r) => r.mois === mois) || {};
    const st = fs.statSync(path.join(racine, mois + '.' + parMois[mois][0]));
    return {
      mois,
      formats: parMois[mois].sort((a, b) => ordre.indexOf(a) - ordre.indexOf(b)),
      jour: ancien.jour || null,
      genere: ancien.genere || (maintenant || st.mtime).toISOString(),
    };
  });
  fs.writeFileSync(fIndex, JSON.stringify({ rapports }, null, 1) + '\n');
  return rapports;
}

/** Lien stable « dernier » + index, appelé après l'écriture du fichier du mois. */
function majIndex(racine, chemin, jour, maintenant) {
  fs.copyFileSync(chemin, path.join(racine, 'dernier.pptx'));
  const rapports = reconstruireIndex(racine, maintenant);
  const r = rapports.find((x) => x.mois === String(jour).slice(0, 7));
  if (r) {
    r.jour = jour;
    r.genere = (maintenant || new Date()).toISOString();
    fs.writeFileSync(path.join(racine, 'index.json'), JSON.stringify({ rapports }, null, 1) + '\n');
  }
}

module.exports = {
  PAYS_REGIONAUX, construire, planRapport, faitsMarquants, rapportsAActualiser, dernierJourMois, moisPrecedent, libellePeriode, ecrire, majIndex, reconstruireIndex, cheminRapport, rubriqueDe, RUBRIQUES,
  // partagés avec la version Word (rapport-grsci-word.js)
  ASSETS, VERT, TEXTE, LEGERE, POLICE, POLICE_TITRE, DRAPEAUX, rectsDrapeau,
  dateLongue, dateCourte, paginer, faitTexte, ligneConfiance, COTATION, faitsRubrique, MAX_FAITS_RUBRIQUE, FAITS_PAR_PAGE, ROMAIN, MAX_FAITS_PAYS, periode, titreDeFait,
};
