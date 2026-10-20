// Rapport mensuel du GRSCI (Groupe des Responsables Sûreté de Côte d'Ivoire) :
// « Faits marquants en Côte d'Ivoire » puis « Dynamiques régionales », dans la
// forme du modèle d'octobre 2024 (couverture, table des matières, intercalaires,
// pages thématiques, encadrés « Décryptage », bandeau de pied avec le logo).
//
// POURQUOI UN GÉNÉRATEUR ET PAS UN MODÈLE REMPLI À LA MAIN : le modèle de
// 2024 est un travail d'analyste de trente pages, refait chaque mois. Ce
// qui s'automatise, c'est la matière : les faits de la fenêtre, leur cotation
// (Confirmé / Probable / Non confirmé), le niveau et la confiance de chaque
// pays, ce que l'outil ne voit pas. Les données viennent de
// `donneesBulletinPays` DANS la page — rien n'est recalculé ici.
//
// CE QUE LE GÉNÉRATEUR N'INVENTE PAS : le « Décryptage » du modèle est un
// jugement d'analyste. Ici il est construit uniquement à partir des mesures
// (niveau, tendance, âge du socle, signaux du jour) et porte la mention
// « Lecture automatique — à valider ». Un faux décryptage présenté comme une
// analyse serait pire qu'une page sans encadré.
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
const ROUGE = '8B1A1A';      // texte des encadrés « Décryptage »
const GRIS = 'E5E7EB';       // fond des encadrés
const TEXTE = '1F2937';
const LEGERE = '6B7280';
const COULEUR_NIVEAU = {
  vert: '16A34A', jaune: 'CA8A04', orange: 'EA580C', marron: '7C2D12', rouge: 'B91C1C',
};
const POLICE = 'Calibri';

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
  { cle: 'humanitaire', num: 'II', titre: 'SOCIAL ET HUMANITAIRE', cats: ['humanitaire'] },
  { cle: 'securite', num: 'III', titre: 'SÉCURITÉ', cats: ['securite'] },
  { cle: 'divers', num: 'IV', titre: 'DIVERS', cats: ['economique', 'economie', null] },
];
const FAITS_PAR_PAGE = 5;
const NIVEAU_LIBELLE = { crit: 'critique', high: 'élevé', mod: 'modéré' };

function rubriqueDe(fait) {
  const cat = fait.cat || null;
  return (RUBRIQUES.find((r) => r.cats.includes(cat)) || RUBRIQUES[3]).cle;
}

function paginer(liste, n) {
  const pages = [];
  for (let i = 0; i < liste.length; i += n) pages.push(liste.slice(i, i + n));
  return pages;
}

function heure(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  return p(d.getUTCDate()) + '/' + p(d.getUTCMonth() + 1) + ' ' + p(d.getUTCHours()) + 'h UTC';
}

// `tendance` arrive brute de tendanceNiveaux : { crans, depuis } ou null.
function lireTendance(t) {
  if (!t || !Number.isFinite(t.crans)) return { phrase: null, court: '—' };
  if (t.crans === 0) return { phrase: 'Niveau stable depuis le ' + t.depuis + '.', court: '=' };
  const n = Math.abs(t.crans);
  const sens = t.crans > 0 ? 'en hausse' : 'en baisse';
  return { phrase: 'Niveau ' + sens + ' de ' + n + ' cran' + (n > 1 ? 's' : '') + ' depuis le ' + t.depuis + '.', court: t.crans > 0 ? '↑' : '↓' };
}

// Décryptage : seulement des constats chiffrés issus des données.
function decryptage(d) {
  const lignes = [];
  const niveau = (d.sous || d.libelle || '').toString().toLowerCase();
  lignes.push('Niveau ' + (d.libelle || '').toLowerCase() + ' (' + niveau + ', ' + d.total100 + '/100), confiance '
    + (d.confiance && d.confiance.libelle ? d.confiance.libelle : 'non évaluée') + '.');
  if (d.confiance && d.confiance.motif) lignes.push('Fondement : ' + d.confiance.motif + '.');
  if (d.motifPlafond) lignes.push('Niveau plafonné : ' + d.motifPlafond);
  const t = lireTendance(d.tendance);
  if (t.phrase) lignes.push(t.phrase);
  if (d.faitsNotables === 0) {
    lignes.push('Aucun fait au-dessus du niveau normal dans la fenêtre : cela ne veut pas dire qu\'il ne s\'est rien passé.');
  } else {
    lignes.push(d.faitsNotables + ' fait(s) au-dessus du normal dans les ' + (d.fenetreH || 36) + ' dernières heures.');
  }
  const am = d.angleMort || {};
  if (am.muet) lignes.push('Aucune actualité récente : l\'outil ne voit rien sur ce pays, ce n\'est pas un signe de calme.');
  else if (am.sourceUnique) lignes.push('Une seule source capable d\'alerter : lecture à recouper.');
  return lignes;
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

function titrePage(s, num, titre, couleurDroite) {
  s.addText(num, { x: 0.5, y: 0.3, w: 0.7, h: 0.6, fontFace: POLICE, fontSize: 22, bold: true, color: 'FFFFFF', fill: { color: VERT }, align: 'center', valign: 'middle' });
  s.addText(titre, { x: 1.35, y: 0.3, w: 9.8, h: 0.6, fontFace: POLICE, fontSize: 28, bold: true, color: VERT, valign: 'middle' });
  if (couleurDroite) {
    // Drapeau en coin de page, comme dans le modèle : orange, blanc, vert.
    ['F77F00', 'FFFFFF', '009E60'].forEach((c, i) => s.addShape('rect', { x: 11.9 + i * 0.33, y: 0.3, w: 0.33, h: 0.62, fill: { color: c }, line: { color: TEXTE, width: 0.5 } }));
  }
  s.addShape('line', { x: 0.5, y: 1.05, w: 12.35, h: 0, line: { color: 'A3A3A3', width: 0.5 } });
}

function encadreDecryptage(s, lignes, y, h) {
  s.addShape('rect', { x: 0.5, y, w: 12.35, h, fill: { color: GRIS }, line: { color: TEXTE, width: 0.75 } });
  s.addText('DÉCRYPTAGE — lecture automatique, à valider par l\'analyste', {
    x: 0.6, y: y + 0.05, w: 12.15, h: 0.32, fontFace: POLICE, fontSize: 12, bold: true, underline: true, color: ROUGE, align: 'center',
  });
  s.addText(lignes.map((t) => ({ text: t, options: { bullet: { code: '25AA' }, breakLine: true } })), {
    x: 0.7, y: y + 0.4, w: 11.95, h: h - 0.45, fontFace: POLICE, fontSize: 12, color: ROUGE, valign: 'top', paraSpaceAfter: 3,
  });
}

function ligneFait(f) {
  const niv = NIVEAU_LIBELLE[f.niveau] || '';
  const meta = [f.source, heure(f.publieMs), niv && ('niveau ' + niv), f.cotation && f.cotation.libelle].filter(Boolean).join(' · ');
  return [
    { text: f.titre, options: { bold: true, color: TEXTE, breakLine: true, bullet: { code: '2713' } } },
    { text: meta, options: { italic: true, color: LEGERE, fontSize: 11, breakLine: true, indentLevel: 1 } },
  ];
}

function pageFaits(pptx, ctx, d, rub, faits, i, n, couleurDroite) {
  const s = pptx.addSlide();
  titrePage(s, rub.num, rub.titre + (n > 1 ? ' (' + (i + 1) + '/' + n + ')' : ''), couleurDroite);
  s.addText(d.nom.toUpperCase() + ' — ' + faits.length + ' FAIT(S) DE LA FENÊTRE', {
    x: 0.5, y: 1.15, w: 12.3, h: 0.4, fontFace: POLICE, fontSize: 14, bold: true, color: VERT, underline: true,
  });
  const corps = [];
  faits.forEach((f) => corps.push(...ligneFait(f)));
  s.addText(corps, { x: 0.7, y: 1.65, w: 12.0, h: 4.7, fontFace: POLICE, fontSize: 14, valign: 'top', paraSpaceAfter: 4 });
  pied(s, ctx, ctx.numero());
}

function pageNiveau(pptx, ctx, d, couleurDroite) {
  const s = pptx.addSlide();
  titrePage(s, '0', 'EN BREF — ' + d.nom.toUpperCase(), couleurDroite);
  const col = COULEUR_NIVEAU[d.niveau] || '6B7280';
  s.addText(String(d.libelle || '').toUpperCase(), {
    x: 0.7, y: 1.35, w: 2.8, h: 0.9, fontFace: POLICE, fontSize: 28, bold: true,
    color: d.niveau === 'jaune' ? TEXTE : 'FFFFFF', fill: { color: col }, align: 'center', valign: 'middle',
  });
  s.addText([
    { text: 'Niveau ' + String(d.sous || '').toLowerCase() + ' · score ' + d.total100 + '/100', options: { bold: true, breakLine: true, fontSize: 16 } },
    { text: 'Confiance ' + (d.confiance ? d.confiance.libelle : 'non évaluée') + (d.confiance && d.confiance.motif ? ' — ' + d.confiance.motif : ''), options: { breakLine: true, fontSize: 13, color: LEGERE } },
    { text: lireTendance(d.tendance).phrase || 'Tendance : moins de deux relevés, aucune trajectoire annoncée.', options: { fontSize: 13, color: LEGERE } },
  ], { x: 3.7, y: 1.3, w: 9.1, h: 1.0, fontFace: POLICE, color: TEXTE, valign: 'middle' });

  const socle = (d.socle || []).slice(0, 4).map((x) => ({
    text: x.titre + ' — ' + x.date + ' (' + x.ageJ + ' j)', options: { bullet: { code: '25AA' }, breakLine: true },
  }));
  const facteurs = (d.facteurs || []).slice(0, 3).map((x) => ({
    text: x.label + (x.revu ? ' — revu ' + x.revu : ' — non daté'), options: { bullet: { code: '25AA' }, breakLine: true },
  }));
  s.addText('CE QUI PORTE LE NIVEAU', { x: 0.7, y: 2.5, w: 12, h: 0.35, fontFace: POLICE, fontSize: 14, bold: true, underline: true, color: VERT });
  s.addText(socle.concat(facteurs).length ? socle.concat(facteurs) : [{ text: 'Aucun incident vérifié ni facteur structurel : le niveau est celui du signal du jour.', options: {} }], {
    x: 0.9, y: 2.9, w: 11.8, h: 1.7, fontFace: POLICE, fontSize: 12, color: TEXTE, valign: 'top', paraSpaceAfter: 2,
  });
  encadreDecryptage(s, decryptage(d), 4.7, 1.75);
  pied(s, ctx, ctx.numero());
}

function intercalaire(pptx, ctx, titre, image) {
  const s = pptx.addSlide();
  s.background = { color: 'CCCCCC' };
  if (image) s.addImage({ path: path.join(ASSETS, image), x: 5.2, y: 0.7, w: 3.2, h: 3.2 });
  s.addText(titre, { x: 0.5, y: 4.4, w: 12.3, h: 0.9, fontFace: POLICE, fontSize: 40, bold: true, color: '111111', align: 'center' });
  s.addShape('line', { x: 4.6, y: 5.3, w: 4.1, h: 0, line: { color: '000000', width: 4 } });
  pied(s, ctx, ctx.numero());
}

function pageCouverture(pptx, ctx) {
  const s = pptx.addSlide();
  s.addImage({ path: path.join(ASSETS, 'couverture-abidjan.jpg'), x: 0.2, y: 0.1, w: 12.9, h: 6.4 });
  s.addText([
    { text: 'RENCONTRE MENSUELLE', options: { breakLine: true } }, { text: 'G.R.S.CI' },
  ], { x: 2.5, y: 0.25, w: 8.3, h: 1.4, fontFace: POLICE, fontSize: 40, bold: true, color: 'FFFFFF', align: 'center', shadow: { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 45, opacity: 0.6 } });
  s.addShape('line', { x: 3.5, y: 1.75, w: 6.3, h: 0, line: { color: '000000', width: 3 } });
  s.addText(dateLongue(ctx.jour).toUpperCase(), { x: 8.3, y: 6.0, w: 4.7, h: 0.4, fontFace: POLICE, fontSize: 20, bold: true, color: 'FFFFFF', align: 'right' });
  s.addImage({ path: path.join(ASSETS, 'afrique.png'), x: 10.1, y: 6.75, w: 0.6, h: 0.6 });
  pied(s, ctx, ctx.numero());
}

function pageSommaire(pptx, ctx, ci, regionaux) {
  const s = pptx.addSlide();
  titrePage(s, '0', 'TABLE DES MATIÈRES');
  const bloc = (x, titre, lignes) => {
    s.addShape('rect', { x, y: 1.25, w: 6.05, h: 5.2, fill: { color: GRIS }, line: { color: TEXTE, width: 0.75 } });
    s.addText(titre, { x, y: 1.3, w: 6.05, h: 0.4, fontFace: POLICE, fontSize: 14, bold: true, underline: true, color: VERT, align: 'center' });
    s.addText(lignes, { x: x + 0.2, y: 1.8, w: 5.65, h: 4.6, fontFace: POLICE, fontSize: 11, color: TEXTE, valign: 'top', paraSpaceAfter: 3 });
  };
  const gauche = [];
  for (const r of RUBRIQUES) {
    const faits = ci.faits.filter((f) => rubriqueDe(f) === r.cle);
    if (!faits.length) continue;
    gauche.push({ text: r.titre, options: { bold: true, underline: true, color: VERT, breakLine: true } });
    faits.slice(0, 5).forEach((f) => gauche.push({ text: f.titre.length > 70 ? f.titre.slice(0, 67) + '…' : f.titre, options: { bullet: { code: '2751' }, breakLine: true } }));
  }
  if (!gauche.length) gauche.push({ text: 'Aucun fait au-dessus du normal dans la fenêtre.', options: {} });
  const droite = regionaux.map((d) => [
    { text: d.nom.toUpperCase(), options: { bold: true, underline: true, color: VERT, breakLine: true } },
    { text: String(d.libelle || '') + ' · confiance ' + (d.confiance ? d.confiance.libelle : '—') + ' · ' + d.faitsNotables + ' fait(s)', options: { bullet: { code: '2751' }, breakLine: true } },
  ]).flat();
  bloc(0.5, 'FAITS MARQUANTS EN CÔTE D\'IVOIRE', gauche);
  bloc(6.8, 'DYNAMIQUES SOUS-RÉGIONALES', droite);
  pied(s, ctx, ctx.numero());
}

function pageTableauRegional(pptx, ctx, regionaux) {
  const s = pptx.addSlide();
  titrePage(s, 'I', 'TABLEAU RÉGIONAL — NIVEAUX D\'ALERTE');
  const entete = ['Pays', 'Niveau', 'Score', 'Confiance', 'Faits', 'Tendance'].map((t) => ({
    text: t, options: { bold: true, color: 'FFFFFF', fill: { color: VERT }, align: 'center' },
  }));
  const lignes = regionaux.map((d) => [
    { text: d.nom, options: { bold: true } },
    { text: String(d.libelle || ''), options: { bold: true, align: 'center', color: d.niveau === 'jaune' ? TEXTE : 'FFFFFF', fill: { color: COULEUR_NIVEAU[d.niveau] || '6B7280' } } },
    { text: String(d.total100), options: { align: 'center' } },
    { text: d.confiance ? d.confiance.libelle : '—', options: { align: 'center' } },
    { text: String(d.faitsNotables), options: { align: 'center' } },
    { text: lireTendance(d.tendance).court, options: { align: 'center' } },
  ]);
  s.addTable([entete, ...lignes], { x: 0.6, y: 1.3, w: 12.1, colW: [3.2, 1.8, 1.2, 1.9, 1.2, 2.8], fontFace: POLICE, fontSize: 13, color: TEXTE, border: { type: 'solid', color: 'BBBBBB', pt: 0.5 }, rowH: 0.42 });
  s.addText('Un niveau « jaune » n\'est pas l\'absence de risque : lire la confiance avant le niveau.', { x: 0.6, y: 6.0, w: 12.1, h: 0.4, fontFace: POLICE, fontSize: 12, italic: true, color: LEGERE });
  pied(s, ctx, ctx.numero());
}

function pageAngleMort(pptx, ctx, tous) {
  const s = pptx.addSlide();
  titrePage(s, 'V', 'CE QUE NOUS NE SAVONS PAS');
  const lignes = [];
  tous.forEach((d) => {
    const am = d.angleMort || {};
    const motifs = [];
    if (am.muet) motifs.push('aucune actualité récente');
    if (am.horsAlerte) motifs.push('du flux mais aucune source fiable');
    if (am.sourceUnique) motifs.push('une seule source capable d\'alerter');
    if (am.socleAncien) motifs.push('socle de plus de 90 jours');
    if (motifs.length) lignes.push({ text: d.nom + ' : ' + motifs.join(' ; '), options: { bullet: { code: '25AA' }, breakLine: true } });
  });
  if (!lignes.length) lignes.push({ text: 'Aucun angle mort identifié sur ces pays.', options: {} });
  s.addText(lignes, { x: 0.7, y: 1.3, w: 12, h: 4.3, fontFace: POLICE, fontSize: 14, color: TEXTE, valign: 'top', paraSpaceAfter: 5 });
  s.addText('Un pays listé n\'est pas plus dangereux : c\'est un pays que l\'outil voit mal. « Confirmé » veut dire recoupé par une seconde source, pas confirmé officiellement.', {
    x: 0.7, y: 5.6, w: 12, h: 0.8, fontFace: POLICE, fontSize: 12, italic: true, color: ROUGE,
  });
  pied(s, ctx, ctx.numero());
}

// Construit le classeur. `ci` et chaque élément de `regionaux` ont la forme
// de `donneesBulletinPays` (+ `tendance` facultatif : { phrase, court }).
function construire(PptxGenJS, { jour, ci, regionaux }) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = 'Rencontre mensuelle G.R.S.CI — ' + dateLongue(jour);
  pptx.author = 'SentiqS';
  let n = 0;
  const ctx = { jour, numero: () => ++n };
  const drapeauCI = true; // drapeau ivoirien en coin de page

  pageCouverture(pptx, ctx);
  pageSommaire(pptx, ctx, ci, regionaux);
  intercalaire(pptx, ctx, 'FAITS MARQUANTS EN CÔTE D\'IVOIRE', null);
  pageNiveau(pptx, ctx, ci, drapeauCI);
  for (const rub of RUBRIQUES) {
    const faits = ci.faits.filter((f) => rubriqueDe(f) === rub.cle);
    if (!faits.length) continue;
    const pages = paginer(faits, FAITS_PAR_PAGE);
    pages.forEach((p, i) => pageFaits(pptx, ctx, ci, rub, p, i, pages.length, drapeauCI));
  }
  intercalaire(pptx, ctx, 'DYNAMIQUES RÉGIONALES', 'afrique.png');
  pageTableauRegional(pptx, ctx, regionaux);
  regionaux.forEach((d) => {
    const s = pptx.addSlide();
    titrePage(s, 'I', d.nom + ' : situation au ' + dateCourte(jour));
    const col = COULEUR_NIVEAU[d.niveau] || '6B7280';
    s.addText(String(d.libelle || '').toUpperCase(), { x: 0.6, y: 1.2, w: 2.2, h: 0.5, fontFace: POLICE, fontSize: 16, bold: true, color: d.niveau === 'jaune' ? TEXTE : 'FFFFFF', fill: { color: col }, align: 'center', valign: 'middle' });
    const faits = (d.faits || []).slice(0, 4);
    const corps = [];
    faits.forEach((f) => corps.push(...ligneFait(f)));
    if (!faits.length) corps.push({ text: 'Aucun fait au-dessus du normal dans la fenêtre.', options: { color: LEGERE } });
    s.addText(corps, { x: 0.7, y: 1.85, w: 12.0, h: 2.8, fontFace: POLICE, fontSize: 13, valign: 'top', paraSpaceAfter: 3 });
    encadreDecryptage(s, decryptage(d), 4.7, 1.75);
    pied(s, ctx, ctx.numero());
  });
  pageAngleMort(pptx, ctx, [ci, ...regionaux]);
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
  return chemin;
}

module.exports = { lireTendance, PAYS_REGIONAUX, construire, decryptage, doitEcrire, ecrire, cheminRapport, rubriqueDe, RUBRIQUES };
