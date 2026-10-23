// Rapport mensuel GRSCI en Word (.docx) : mêmes pages, mêmes couleurs, même
// ordre que la version PowerPoint (voir rapport-grsci.js), mais en VRAIS
// textes, tableaux et images que l'on peut modifier — jamais une page aplatie
// en image. Une page Word = une diapositive (page 16:9 en paysage).
//
// La bibliothèque `docx` est injectée comme pptxgenjs l'est : le module se
// teste sans elle, avec un faux qui enregistre ce qu'on lui demande.
const fs = require('node:fs');
const path = require('node:path');
const g = require('./rapport-grsci.js');

// Comme le PowerPoint, il respecte la présentation du modèle du groupe : pas de
// niveau d'alerte, de confiance, de score ni de cotation (notions de l'appli).
//
// Page 16:9 du modèle (954 × 540 pt), en vingtièmes de point.
const LARGEUR = 19080;
const HAUTEUR = 10800;
const MARGE = 700;
const UTILE = LARGEUR - 2 * MARGE;

function construireWord(D, { jour, ci, regionaux }) {
  const {
    Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType,
    BorderStyle, ImageRun, Footer, PageNumber, PageOrientation, HeightRule, VerticalAlign,
    HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType, ExternalHyperlink,
  } = D;
  const img = (f) => fs.readFileSync(path.join(g.ASSETS, f));
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
        cell([par(run(num, { font: g.POLICE_TITRE, size: num.length > 2 ? 32 : 44, color: 'FFFFFF' }), { alignment: AlignmentType.CENTER })], 1000, { shading: { type: ShadingType.CLEAR, fill: g.VERT, color: 'auto' } }),
        cell([par(run(titre, Object.assign({ font: g.POLICE_TITRE, size: 56, color: g.VERT }, /^- /.test(titre) ? { underline: {} } : {})), { indent: { left: 200 } })], UTILE - 1000 - 1500),
        cell([drapeau(pays)], 1500),
      ] })],
    });
    return [new Paragraph({ children: [], pageBreakBefore: debutPage(), spacing: { after: 0, before: 0 }, run: { size: 2 } }), tableau, par(run('', { size: 12 }), { border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'A3A3A3', space: 1 } } })];
  }

  // Le modèle : titre ❑ en majuscules vertes soulignées, puis la source et la date.
  function lignesFaits(faits) {
    const out = [];
    faits.forEach((f) => {
      const t = g.faitTexte(f);
      out.push(par([run('\u2751  ', { color: g.VERT, size: 28 }), run(t.titre, { bold: true, underline: {}, color: g.VERT, size: 28 })], { indent: { left: 360 }, spacing: { before: 160 } }));
      const source = t.url
        ? new ExternalHyperlink({ link: t.url, children: [run(t.source, { color: g.VERT, size: 26, underline: {} })] })
        : run(t.source, { size: 26 });
      out.push(par([run('\u25AA  ' + t.etiquette, { size: 26 }), source, run(t.quand ? ' \u2014 ' + t.quand : '', { size: 26 })], { indent: { left: 720 } }));
    });
    return out;
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
  corps.push(par(run('RENCONTRE MENSUELLE', { font: g.POLICE_TITRE, size: 96, color: 'FFFFFF' }), { alignment: AlignmentType.CENTER, spacing: { before: 200 } }));
  corps.push(par(run('G.R.S.CI', { font: g.POLICE_TITRE, size: 96, color: 'FFFFFF' }), { alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: '000000', space: 6 } } }));
  for (let i = 0; i < 12; i++) corps.push(par(run('', { size: 40 })));
  corps.push(par(run(g.dateLongue(jour).toUpperCase(), { bold: true, size: 40, color: 'FFFFFF' }), { alignment: AlignmentType.RIGHT }));
  corps.push(par(run(g.libellePeriode(jour), { size: 28, color: 'FFFFFF' }), { alignment: AlignmentType.RIGHT }));

  // — Table des matières : deux cadres, comme le modèle.
  corps.push(...entete('0', '- TABLE DES MATIÈRES'));
  {
    const court = (t) => (t.length > 84 ? t.slice(0, 81) + '…' : t);
    const gauche = [];
    for (const r of g.RUBRIQUES) {
      const faits = g.faitsRubrique(ci, r);
      if (!faits.length) continue;
      gauche.push(par(run(r.titre, { bold: true, color: g.VERT, size: 20 }), { spacing: { before: 100 } }));
      faits.slice(0, 6).forEach((f) => gauche.push(par([run('\u2751  ', { size: 18 }), run(court(g.titreDeFait(f)), { size: 18 })], { indent: { left: 240 } })));
    }
    if (!gauche.length) gauche.push(par(run('Aucun fait marquant relevé sur la période.', { italics: true })));
    const droite = [];
    regionaux.forEach((d) => {
      droite.push(par(run(d.nom.toUpperCase(), { bold: true, color: g.VERT, size: 20 }), { spacing: { before: 100 } }));
      (d.faits || []).slice(0, 1).forEach((f) => droite.push(par([run('\u2751  ', { size: 18 }), run(court(g.titreDeFait(f)), { size: 18 })], { indent: { left: 240 } })));
    });
    const bloc = (titre, enfants) => new TableCell({
      borders: CADRE, width: { size: Math.floor(UTILE / 2) - 100, type: WidthType.DXA }, margins: { top: 100, left: 150, right: 150 },
      children: [par(run(titre, { font: g.POLICE_TITRE, color: g.VERT, size: 30 }), { alignment: AlignmentType.CENTER }), ...enfants],
    });
    corps.push(par(run('', { size: 12 })));
    corps.push(new Table({
      width: { size: UTILE, type: WidthType.DXA }, columnWidths: [Math.floor(UTILE / 2), UTILE - Math.floor(UTILE / 2)],
      rows: [new TableRow({ children: [bloc('FAITS MARQUANTS EN CÔTE D\'IVOIRE', gauche), bloc('DYNAMIQUES SOUS-RÉGIONALES', droite)] })],
    }));
  }

  // — Intercalaire : bloc gris, carte au centre, titre en police étroite.
  const intercalaire = (titre, image) => {
    corps.push(new Paragraph({ children: [], pageBreakBefore: debutPage(), spacing: { after: 0 }, run: { size: 2 } }));
    corps.push(new Table({
      width: { size: UTILE, type: WidthType.DXA }, columnWidths: [UTILE],
      rows: [new TableRow({ height: { value: 8200, rule: HeightRule.EXACT }, children: [new TableCell({
        borders: SANS_BORDURE, width: { size: UTILE, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: 'CDCDCD', color: 'auto' },
        children: [
          par(new ImageRun({ data: img(image), transformation: { width: 300, height: 300 } }), { alignment: AlignmentType.CENTER }),
          par(run(titre, { font: g.POLICE_TITRE, size: 88, color: '111111' }), { alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: '000000', space: 8 } } }),
        ],
      })] })],
    }));
  };
  intercalaire('FAITS MARQUANTS EN CÔTE D\'IVOIRE', 'carte-ci.jpg');

  // — Rubriques de la Côte d'Ivoire
  for (const rub of g.RUBRIQUES) {
    const faits = g.faitsRubrique(ci, rub);
    if (!faits.length) continue;
    g.paginer(faits, g.FAITS_PAR_PAGE).forEach((p) => {
      corps.push(...entete(rub.num, '- ' + rub.titre, 'CI'));
      corps.push(...lignesFaits(p));
    });
  }

  // — Dynamiques régionales : une rubrique numérotée par pays, avec son drapeau.
  intercalaire('DYNAMIQUES RÉGIONALES', 'afrique.png');
  regionaux.forEach((d, i) => {
    const pages = g.paginer((d.faits || []).slice(0, g.MAX_FAITS_PAYS), g.FAITS_PAR_PAGE);
    if (!pages.length) pages.push([]);
    pages.forEach((p, k) => {
      corps.push(...entete(g.ROMAIN[i + 1], k > 0 ? d.nom : (i === 0 ? d.nom + ' : situation ' + g.periode(jour) : d.nom), d.cy));
      if (p.length) corps.push(...lignesFaits(p));
      else corps.push(par(run('Aucun fait marquant relevé sur la période.', { italics: true, color: g.LEGERE }), { spacing: { before: 160 } }));
    });
  });

  // — Dernière page, comme le modèle.
  corps.push(new Paragraph({ children: [], pageBreakBefore: debutPage(), spacing: { after: 0 }, run: { size: 2 } }));
  corps.push(new Table({
    width: { size: UTILE, type: WidthType.DXA }, columnWidths: [UTILE],
    rows: [new TableRow({ height: { value: 8200, rule: HeightRule.EXACT }, children: [new TableCell({
      borders: SANS_BORDURE, width: { size: UTILE, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: 'CDCDCD', color: 'auto' },
      children: [par(run('MERCI', { font: g.POLICE_TITRE, size: 120, color: '111111' }), { alignment: AlignmentType.CENTER })],
    })] })],
  }));

  // Pied de page : logo, nom du groupe encadré, date et numéro — comme le modèle.
  const pied = new Footer({ children: [new Table({
    width: { size: UTILE, type: WidthType.DXA }, columnWidths: [1500, UTILE - 1500 - 3000, 3000],
    rows: [new TableRow({ children: [
      new TableCell({ borders: SANS_BORDURE, width: { size: 1500, type: WidthType.DXA }, children: [par(new ImageRun({ data: img('logo-grsci.png'), transformation: { width: 48, height: 55 } }))] }),
      new TableCell({ borders: CADRE, verticalAlign: VerticalAlign.CENTER, width: { size: UTILE - 4500, type: WidthType.DXA }, children: [par(run('Groupe des Responsables Sûreté de Côte d\'Ivoire', { size: 22 }), { alignment: AlignmentType.CENTER })] }),
      new TableCell({ borders: SANS_BORDURE, verticalAlign: VerticalAlign.CENTER, width: { size: 3000, type: WidthType.DXA }, children: [par([run('|  ' + g.dateCourte(jour) + '   |   ', { size: 20 }), new TextRun({ children: [PageNumber.CURRENT], font: g.POLICE, size: 20, color: g.TEXTE })], { alignment: AlignmentType.RIGHT })] }),
    ] })],
  })] });

  return new Document({
    creator: 'SentiqS',
    title: 'Rencontre mensuelle G.R.S.CI — ' + g.dateLongue(jour),
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
  fs.copyFileSync(chemin, path.join(racine, 'dernier.docx'));
  g.reconstruireIndex(racine);
  return chemin;
}

module.exports = { construireWord, ecrireWord, cheminWord };
