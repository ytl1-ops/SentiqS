// Rapport mensuel de sûreté en Word (.docx) : mêmes pages, mêmes couleurs, même
// ordre que la version PowerPoint (voir rapport-grsci.js), mais en VRAIS
// textes, tableaux et images que l'on peut modifier — jamais une page aplatie
// en image. Une page Word = une diapositive (page 16:9 en paysage).
//
// La bibliothèque `docx` est injectée comme pptxgenjs l'est : le module se
// teste sans elle, avec un faux qui enregistre ce qu'on lui demande.
const fs = require('node:fs');
const path = require('node:path');
const g = require('./rapport-grsci.js');
const redaction = require('./redaction-grsci');

// Comme le PowerPoint, il respecte la présentation du modèle du groupe : pas de
// niveau d'alerte, de confiance, de score ni de cotation (notions de l'appli).
//
// Page 16:9 du modèle (954 × 540 pt), en vingtièmes de point.
const LARGEUR = 19080;
const HAUTEUR = 10800;
const MARGE = 700;
const UTILE = LARGEUR - 2 * MARGE;

function construireWord(D, { jour, ci, regionaux, emetteur }) {
  const em = emetteur || g.lireEmetteur();
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
        cell([par(run(num, { font: g.POLICE_TITRE, size: g.taillePastille(num) * 2 - 4, color: 'FFFFFF' }), { alignment: AlignmentType.CENTER })], 1000, { shading: { type: ShadingType.CLEAR, fill: g.VERT, color: 'auto' } }),
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
      out.push(par([run('\u25AA  ' + t.etiquette, { size: 26 }), source, run(t.quand ? ' \u2014 ' + t.quand : '', { size: 26 }),
        ...(t.cotation ? [run('   \u00B7   Cotation : ' + t.cotation, { size: 26, bold: true })] : [])], { indent: { left: 720 } }));
    });
    return out;
  }

  // Indice de confiance du pays, sous l'en-tête de sa première page.
  function ligneConf(d) {
    const t = g.ligneConfiance(d);
    return t ? [par(run(t, { italics: true, color: g.LEGERE, size: 22 }), { spacing: { before: 60 } })] : [];
  }

  // Un fait marquant rédigé (demande du 23/10/2026) : même texte que la page
  // PowerPoint (redaction-grsci.js), photo de la source à droite avec son
  // crédit et le lien ; sans photo, le texte prend toute la largeur.
  function faitMarquant(f, nomPays) {
    const r = redaction.rediger(f, nomPays);
    const t = g.faitTexte(f);
    const inter = (x) => par(run(x, { bold: true, color: g.VERT, size: 28 }), { spacing: { before: 120, after: 20 } });
    const texte = [
      par(run(r.titre, { bold: true, color: g.VERT, size: 40, font: g.POLICE_TITRE }), { spacing: { before: 120, after: 60 } }),
      inter('Contexte'), par(run(r.contexte, { size: 26 })),
      inter('Ce que rapportent les sources'),
      ...(r.extraits.length
        ? r.extraits.map((e) => par([run(e.source + ' : ', { bold: true, size: 26 }), run('« ' + e.texte + ' »', { italics: true, size: 26 })], { spacing: { after: 60 } }))
        : [par(run(r.sansExtrait, { italics: true, color: g.LEGERE, size: 26 }))]),
      inter('Enjeux sûreté'), par(run(r.enjeux, { size: 26 })),
    ];
    const liens = r.liens.slice(0, 4);
    const restants = r.sources.filter((x) => !liens.some((l) => l.source === x));
    texte.push(par([
      run(t.etiquette, { bold: true, size: 26 }),
      ...liens.flatMap((l, i) => [run(i ? ' · ' : '', { size: 26 }), new ExternalHyperlink({ link: l.url, children: [run(l.source || 'article', { color: g.VERT, size: 26, underline: {} })] })]),
      ...(liens.length ? [] : [run(t.source, { size: 26 })]),
      run((restants.length && liens.length ? ' · ' + restants.join(' · ') : '') + (t.quand ? ' \u2014 ' + t.quand : ''), { size: 26 }),
      ...(t.cotation ? [run('   \u00B7   Cotation : ' + t.cotation, { size: 26, bold: true })] : []),
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
        children: [par(new ImageRun({ data: fs.readFileSync(em.logo), transformation: t }))] })] })],
    }));
    for (let i = 0; i < 1; i++) corps.push(par(run('', { size: 40 })));
  } else {
    for (let i = 0; i < 10; i++) corps.push(par(run('', { size: 40 })));
  }
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
  const intercalaire = (titre, image, note) => {
    corps.push(new Paragraph({ children: [], pageBreakBefore: debutPage(), spacing: { after: 0 }, run: { size: 2 } }));
    corps.push(new Table({
      width: { size: UTILE, type: WidthType.DXA }, columnWidths: [UTILE],
      rows: [new TableRow({ height: { value: 8200, rule: HeightRule.EXACT }, children: [new TableCell({
        borders: SANS_BORDURE, width: { size: UTILE, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: 'CDCDCD', color: 'auto' },
        children: [
          par(new ImageRun({ data: img(image), transformation: { width: 300, height: 300 } }), { alignment: AlignmentType.CENTER }),
          par(run(titre, { font: g.POLICE_TITRE, size: 88, color: '111111' }), { alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: '000000', space: 8 } } }),
          ...(note ? [par(run(note, { italics: true, size: 22, color: '333333' }), { alignment: AlignmentType.CENTER, spacing: { before: 240 } })] : []),
        ],
      })] })],
    }));
  };
  intercalaire('FAITS MARQUANTS EN CÔTE D\'IVOIRE', 'carte-ci.jpg', redaction.NOTE_REDACTION);
  const plan = g.planRapport(ci, regionaux);

  // — Rubriques de la Côte d'Ivoire : faits rédigés d'abord, puis la liste.
  for (const { rub, marquants, liste } of plan.ci) {
    let k = 0;
    marquants.forEach((f) => {
      corps.push(...entete(rub.num, '- ' + rub.titre, 'CI'));
      if (k++ === 0) corps.push(...ligneConf(ci));
      corps.push(...faitMarquant(f, ci.nom || 'Côte d\'Ivoire'));
    });
    g.paginer(liste, g.FAITS_PAR_PAGE).forEach((p) => {
      corps.push(...entete(rub.num, '- ' + rub.titre, 'CI'));
      if (k++ === 0) corps.push(...ligneConf(ci));
      corps.push(...lignesFaits(p));
    });
  }

  // — Dynamiques régionales : une rubrique numérotée par pays, avec son drapeau.
  intercalaire('DYNAMIQUES RÉGIONALES', 'afrique.png');
  plan.regionaux.forEach(({ d, marquants, liste }, i) => {
    const titre0 = i === 0 ? d.nom + ' : situation ' + g.periode(jour) : d.nom;
    let k = 0;
    marquants.forEach((f) => {
      corps.push(...entete(g.ROMAIN[i + 1], k ? d.nom : titre0, d.cy));
      if (k++ === 0) corps.push(...ligneConf(d));
      corps.push(...faitMarquant(f, d.nom));
    });
    const pages = g.paginer(liste, g.FAITS_PAR_PAGE);
    if (!pages.length && !k) pages.push([]);
    pages.forEach((p) => {
      corps.push(...entete(g.ROMAIN[i + 1], k ? d.nom : titre0, d.cy));
      if (k++ === 0) corps.push(...ligneConf(d));
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

  // Pied de page : logo et identité de l'émetteur encadrée, date et numéro —
  // comme le modèle, sans le nom ni le logo du groupe (27/10/2026).
  const pied = new Footer({ children: [new Table({
    width: { size: UTILE, type: WidthType.DXA }, columnWidths: [1500, UTILE - 1500 - 3000, 3000],
    rows: [new TableRow({ children: [
      new TableCell({ borders: SANS_BORDURE, width: { size: 1500, type: WidthType.DXA }, children: [par(em.logo ? new ImageRun({ data: fs.readFileSync(em.logo), transformation: logoPx(90, 40) }) : run(''))] }),
      new TableCell({ borders: CADRE, verticalAlign: VerticalAlign.CENTER, width: { size: UTILE - 4500, type: WidthType.DXA }, children: [par(run(g.piedTexte(em), { size: 22 }), { alignment: AlignmentType.CENTER })] }),
      new TableCell({ borders: SANS_BORDURE, verticalAlign: VerticalAlign.CENTER, width: { size: 3000, type: WidthType.DXA }, children: [par([run('|  ' + g.dateCourte(jour) + '   |   ', { size: 20 }), new TextRun({ children: [PageNumber.CURRENT], font: g.POLICE, size: 20, color: g.TEXTE })], { alignment: AlignmentType.RIGHT })] }),
    ] })],
  })] });

  return new Document({
    creator: em.identite,
    title: g.TITRE_DOCUMENT(jour),
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
