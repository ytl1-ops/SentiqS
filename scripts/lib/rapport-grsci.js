// Rapport mensuel du GRSCI (Groupe des Responsables Sûreté de Côte d'Ivoire) :
// « Faits marquants en Côte d'Ivoire » puis « Dynamiques régionales », dans la
// présentation du modèle d'octobre 2024 (couverture, table des matières,
// intercalaires, pages thématiques, pays numérotés avec drapeau, MERCI, bandeau
// de pied avec le logo).
//
// CE RAPPORT NE PARLE PAS LE LANGAGE DE L'APPLI. Demande du 21/10/2026 : il doit
// respecter la présentation transmise, pas s'adapter à l'outil qui fait ressortir
// des niveaux d'alerte. Le modèle n'a ni niveau coloré, ni indice de confiance,
// ni score, ni cotation : le générateur n'en écrit aucun. Il ne lit des
// données de `donneesBulletinPays` que les faits (titre, source, date, lien).
// Le « Décryptage » d'analyste du modèle n'est pas inventé : il reste à écrire.
//
// Le module ne touche ni au réseau ni à la page : il reçoit des données et
// renvoie un classeur pptxgenjs, ce qui le rend testable sans navigateur.
const fs = require('node:fs');
const path = require('node:path');

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

function rubriqueDe(fait) {
  const cat = fait.cat || null;
  return (RUBRIQUES.find((r) => r.cats.includes(cat)) || RUBRIQUES[3]).cle;
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

function tailleNumero(num) {
  const n = String(num).length;
  return n <= 2 ? 24 : n === 3 ? 17 : 13;
}

function titrePage(s, num, titre, pays) {
  const souligne = /^- /.test(titre);
  // « VIII » ne tient pas dans le carré de « I » à 24 pt : il passait sur deux
  // lignes (page du Liberia, 21/10/2026). On réduit le corps selon la longueur.
  s.addText(num, { x: 0.5, y: 0.3, w: 0.7, h: 0.6, fontFace: POLICE_TITRE, fontSize: tailleNumero(num), color: 'FFFFFF', fill: { color: VERT }, align: 'center', valign: 'middle' });
  s.addText(titre, { x: 1.35, y: 0.3, w: 9.8, h: 0.6, fontFace: POLICE_TITRE, fontSize: 28, underline: souligne, color: VERT, valign: 'middle' });
  if (pays && DRAPEAUX[pays]) {
    // Drapeau en coin de page, comme dans le modèle.
    rectsDrapeau(pays).forEach(([x, y, w, h, c]) => s.addShape('rect', { x: 11.9 + x * 0.99, y: 0.3 + y * 0.62, w: w * 0.99, h: h * 0.62, fill: { color: c }, line: { color: c, width: 0 } }));
    s.addShape('rect', { x: 11.9, y: 0.3, w: 0.99, h: 0.62, fill: { type: 'none' }, line: { color: TEXTE, width: 0.5 } });
  }
  s.addShape('line', { x: 0.5, y: 1.05, w: 12.35, h: 0, line: { color: 'A3A3A3', width: 0.5 } });
}


function intercalaire(pptx, ctx, titre, image) {
  const s = pptx.addSlide();
  s.background = { color: 'CDCDCD' };
  if (image) s.addImage({ path: path.join(ASSETS, image), x: 5.2, y: 0.7, w: 3.2, h: 3.2 });
  s.addText(titre, { x: 0.5, y: 4.4, w: 12.3, h: 0.9, fontFace: POLICE_TITRE, fontSize: 44, color: '111111', align: 'center' });
  s.addShape('line', { x: 4.6, y: 5.3, w: 4.1, h: 0, line: { color: '000000', width: 4 } });
  pied(s, ctx, ctx.numero());
}

function pageCouverture(pptx, ctx) {
  const s = pptx.addSlide();
  s.addImage({ path: path.join(ASSETS, 'couverture-abidjan.jpg'), x: 0.2, y: 0.1, w: 12.9, h: 6.4 });
  s.addText([
    { text: 'RENCONTRE MENSUELLE', options: { breakLine: true } }, { text: 'G.R.S.CI' },
  ], { x: 2.5, y: 0.25, w: 8.3, h: 1.4, fontFace: POLICE_TITRE, fontSize: 44, color: 'FFFFFF', align: 'center', shadow: { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 45, opacity: 0.6 } });
  s.addShape('line', { x: 3.5, y: 1.75, w: 6.3, h: 0, line: { color: '000000', width: 3 } });
  s.addText(dateLongue(ctx.jour).toUpperCase(), { x: 8.3, y: 6.0, w: 4.7, h: 0.4, fontFace: POLICE, fontSize: 20, bold: true, color: 'FFFFFF', align: 'right' });
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

function titreDeFait(f) {
  return String(f.titre || '').toUpperCase();
}

// Ce que le modèle écrit sous chaque titre ❑ : la source et la date. Rien
// d'autre — ni niveau, ni cotation, ni score : ce sont des notions de l'appli.
function faitTexte(f) {
  const source = f.source || 'Source non précisée';
  const quand = dateFait(f.publieMs);
  return { titre: titreDeFait(f), source, quand, url: lienSur(f) };
}

function corpsFaits(faits) {
  const corps = [];
  faits.forEach((f) => {
    const t = faitTexte(f);
    corps.push({ text: t.titre, options: { bold: true, underline: true, color: VERT, fontSize: 14, bullet: { code: '2751' }, breakLine: true, paraSpaceBefore: 8 } });
    const src = t.url ? { text: t.source, options: { hyperlink: { url: t.url }, color: VERT } } : { text: t.source, options: {} };
    corps.push({ text: 'Source : ', options: { bullet: { code: '25AA' }, indentLevel: 1, fontSize: 13 } });
    corps.push(Object.assign({}, src, { options: Object.assign({ fontSize: 13 }, src.options) }));
    corps.push({ text: t.quand ? ' — ' + t.quand : '', options: { fontSize: 13, breakLine: true } });
  });
  return corps;
}

function pageFaits(pptx, ctx, titreNum, titre, faits, pays, vide) {
  const s = pptx.addSlide();
  titrePage(s, titreNum, titre, pays);
  const corps = faits.length ? corpsFaits(faits)
    : [{ text: vide || 'Aucun fait marquant relevé sur la période.', options: { color: LEGERE, italic: true } }];
  s.addText(corps, { x: 0.7, y: 1.3, w: 12.0, h: 5.1, fontFace: POLICE, fontSize: 13, color: TEXTE, valign: 'top', paraSpaceAfter: 2 });
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
  const court = (t) => (t.length > 110 ? t.slice(0, 107) + '…' : t);
  const gauche = [];
  for (const r of RUBRIQUES) {
    const faits = ci.faits.filter((f) => rubriqueDe(f) === r.cle);
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
  intercalaire(pptx, ctx, 'FAITS MARQUANTS EN CÔTE D\'IVOIRE', 'carte-ci.jpg');
  for (const rub of RUBRIQUES) {
    const faits = ci.faits.filter((f) => rubriqueDe(f) === rub.cle);
    if (!faits.length) continue;
    paginer(faits, FAITS_PAR_PAGE).forEach((p) => pageFaits(pptx, ctx, rub.num, '- ' + rub.titre, p, 'CI'));
  }
  intercalaire(pptx, ctx, 'DYNAMIQUES RÉGIONALES', 'afrique.png');
  regionaux.forEach((d, i) => {
    const faits = (d.faits || []).slice(0, MAX_FAITS_PAYS);
    const pages = paginer(faits, FAITS_PAR_PAGE);
    if (!pages.length) pages.push([]);
    pages.forEach((p, k) => {
      const titre = k > 0 ? d.nom : (i === 0 ? d.nom + ' : situation ' + periode(jour) : d.nom);
      pageFaits(pptx, ctx, ROMAIN[i + 1], titre, p, d.cy);
    });
  });
  pageMerci(pptx, ctx);
  return pptx;
}

function cheminRapport(racine, jour) {
  return path.join(racine, jour.slice(0, 7) + '.pptx');
}

// Un rapport par mois : le premier passage à partir du jour demandé fait foi,
// même mécanique que les bulletins et l'archive (le refus d'écraser).
function doitEcrire(racine, jour, jourMin) {
  const j = Number(String(jour).slice(8, 10));
  if (j < (jourMin || 1)) return false;
  return !fs.existsSync(cheminRapport(racine, jour));
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
  PAYS_REGIONAUX, construire, doitEcrire, ecrire, majIndex, reconstruireIndex, cheminRapport, rubriqueDe, RUBRIQUES,
  // partagés avec la version Word (rapport-grsci-word.js)
  ASSETS, VERT, TEXTE, LEGERE, POLICE, POLICE_TITRE, DRAPEAUX, rectsDrapeau,
  dateLongue, dateCourte, tailleNumero, paginer, faitTexte, FAITS_PAR_PAGE, ROMAIN, MAX_FAITS_PAYS, periode, titreDeFait,
};
