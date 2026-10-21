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

// Page 16:9 du modèle (954 × 540 pt), en vingtièmes de point.
const LARGEUR = 19080;
const HAUTEUR = 10800;
const MARGE = 700;
const UTILE = LARGEUR - 2 * MARGE;

function construireWord(D, { jour, ci, regionaux }) {
  const {
    Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType,
    BorderStyle, ImageRun, Footer, PageNumber, PageOrientation, HeightRule, VerticalAlign,
    HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType,
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
        cell([par(run(num, { font: g.POLICE_TITRE, size: 44, color: 'FFFFFF' }), { alignment: AlignmentType.CENTER })], 1000, { shading: { type: ShadingType.CLEAR, fill: g.VERT, color: 'auto' } }),
        cell([par(run(titre, { font: g.POLICE_TITRE, size: 56, color: g.VERT, underline: {} }), { indent: { left: 200 } })], UTILE - 1000 - 1500),
        cell([drapeau(pays)], 1500),
      ] })],
    });
    return [new Paragraph({ children: [], pageBreakBefore: debutPage(), spacing: { after: 0, before: 0 }, run: { size: 2 } }), tableau, par(run('', { size: 12 }), { border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'A3A3A3', space: 1 } } })];
  }

  const puce = (t, o) => par([run('▪  '), run(t, o)], { indent: { left: 360 }, spacing: { after: 60 } });

  function lignesFaits(faits) {
    const out = [];
    faits.forEach((f) => {
      const { titre, meta } = g.faitTexte(f);
      out.push(par([run('✓  ', { bold: true }), run(titre, { bold: true, size: 26 })], { indent: { left: 360 }, spacing: { before: 100 } }));
      if (meta) out.push(par(run(meta, { italics: true, color: g.LEGERE, size: 20 }), { indent: { left: 720 } }));
    });
    return out;
  }

  function encadre(lignes) {
    const cellule = new TableCell({
      borders: CADRE, width: { size: UTILE, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: g.GRIS, color: 'auto' },
      margins: { top: 100, bottom: 100, left: 200, right: 200 },
      children: [
        par(run('DÉCRYPTAGE — lecture automatique, à valider par l\'analyste', { bold: true, underline: {}, color: g.ROUGE, size: 24 }), { alignment: AlignmentType.CENTER, spacing: { after: 80 } }),
        ...lignes.map((t) => par([run('▪  ', { color: g.ROUGE }), run(t, { color: g.ROUGE, size: 22 })], { indent: { left: 240 }, spacing: { after: 40 } })),
      ],
    });
    return [par(run('', { size: 12 })), new Table({ width: { size: UTILE, type: WidthType.DXA }, columnWidths: [UTILE], rows: [new TableRow({ cantSplit: true, children: [cellule] })] })];
  }

  const badge = (d) => {
    const col = g.COULEUR_NIVEAU[d.niveau] || '6B7280';
    return new Table({
      width: { size: 3400, type: WidthType.DXA }, columnWidths: [3400],
      rows: [new TableRow({ height: { value: 900, rule: HeightRule.ATLEAST }, children: [new TableCell({
        borders: SANS_BORDURE, width: { size: 3400, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, fill: col, color: 'auto' },
        children: [par(run(String(d.libelle || '').toUpperCase(), { bold: true, size: 48, color: d.niveau === 'jaune' ? g.TEXTE : 'FFFFFF' }), { alignment: AlignmentType.CENTER })],
      })] })],
    });
  };

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

  // — Table des matières
  corps.push(...entete('0', 'TABLE DES MATIÈRES'));
  {
    const gauche = [];
    for (const r of g.RUBRIQUES) {
      const faits = ci.faits.filter((f) => g.rubriqueDe(f) === r.cle);
      if (!faits.length) continue;
      gauche.push(par(run(r.titre, { bold: true, underline: {}, color: g.VERT }), { spacing: { before: 80 } }));
      faits.slice(0, 5).forEach((f) => gauche.push(puce(f.titre.length > 70 ? f.titre.slice(0, 67) + '…' : f.titre, { size: 20 })));
    }
    if (!gauche.length) gauche.push(par(run('Aucun fait au-dessus du normal dans la fenêtre.')));
    const droite = [];
    regionaux.forEach((d) => {
      droite.push(par(run(d.nom.toUpperCase(), { bold: true, underline: {}, color: g.VERT }), { spacing: { before: 80 } }));
      droite.push(puce(String(d.libelle || '') + ' · confiance ' + (d.confiance ? d.confiance.libelle : '—') + ' · ' + d.faitsNotables + ' fait(s)', { size: 20 }));
    });
    const bloc = (titre, enfants) => new TableCell({
      borders: CADRE, width: { size: Math.floor(UTILE / 2) - 100, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: g.GRIS, color: 'auto' }, margins: { top: 100, left: 150, right: 150 },
      children: [par(run(titre, { bold: true, underline: {}, color: g.VERT }), { alignment: AlignmentType.CENTER }), ...enfants],
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

  // — En bref
  corps.push(...entete('0', 'EN BREF — ' + ci.nom.toUpperCase(), 'CI'));
  corps.push(par(run('', { size: 12 })), badge(ci));
  corps.push(par([run('Niveau ' + String(ci.sous || '').toLowerCase() + ' · score ' + ci.total100 + '/100', { bold: true, size: 28 })], { spacing: { before: 120 } }));
  corps.push(par(run('Confiance ' + (ci.confiance ? ci.confiance.libelle : 'non évaluée') + (ci.confiance && ci.confiance.motif ? ' — ' + ci.confiance.motif : ''), { color: g.LEGERE, size: 24 })));
  corps.push(par(run(g.lireTendance(ci.tendance).phrase || 'Tendance : moins de deux relevés, aucune trajectoire annoncée.', { color: g.LEGERE, size: 24 })));
  corps.push(par(run('CE QUI PORTE LE NIVEAU', { bold: true, underline: {}, color: g.VERT, size: 26 }), { spacing: { before: 160 } }));
  const portes = [].concat((ci.socle || []).slice(0, 4).map((x) => x.titre + ' — ' + x.date + ' (' + x.ageJ + ' j)'),
    (ci.facteurs || []).slice(0, 3).map((x) => x.label + (x.revu ? ' — revu ' + x.revu : ' — non daté')));
  (portes.length ? portes : ['Aucun incident vérifié ni facteur structurel : le niveau est celui du signal du jour.']).forEach((t) => corps.push(puce(t, { size: 22 })));
  corps.push(...encadre(g.decryptage(ci)));

  // — Rubriques
  for (const rub of g.RUBRIQUES) {
    const faits = ci.faits.filter((f) => g.rubriqueDe(f) === rub.cle);
    if (!faits.length) continue;
    const pages = g.paginer(faits, g.FAITS_PAR_PAGE);
    pages.forEach((p, i) => {
      corps.push(...entete(rub.num, '- ' + rub.titre + (pages.length > 1 ? ' (' + (i + 1) + '/' + pages.length + ')' : ''), 'CI'));
      corps.push(par(run(ci.nom.toUpperCase() + ' — ' + p.length + ' FAIT(S) DE LA FENÊTRE', { bold: true, underline: {}, color: g.VERT, size: 26 }), { spacing: { before: 120 } }));
      corps.push(...lignesFaits(p));
    });
  }

  // — Dynamiques régionales
  intercalaire('DYNAMIQUES RÉGIONALES', 'afrique.png');
  corps.push(...entete('I', 'TABLEAU RÉGIONAL — NIVEAUX D\'ALERTE'));
  {
    const larg = [3400, 2800, 1800, 3000, 1800, UTILE - 12800];
    const cel = (t, i, o) => new TableCell(Object.assign({ width: { size: larg[i], type: WidthType.DXA }, borders: { top: FILET('BBBBBB'), bottom: FILET('BBBBBB'), left: FILET('BBBBBB'), right: FILET('BBBBBB') }, verticalAlign: VerticalAlign.CENTER, children: [par(run(t, (o && o.run) || {}), { alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER })] }, (o && o.cell) || {}));
    const tete = new TableRow({ tableHeader: true, children: ['Pays', 'Niveau', 'Score', 'Confiance', 'Faits', 'Tendance'].map((t, i) => cel(t, i, { run: { bold: true, color: 'FFFFFF' }, cell: { shading: { type: ShadingType.CLEAR, fill: g.VERT, color: 'auto' } } })) });
    const lignes = regionaux.map((d) => new TableRow({ children: [
      cel(d.nom, 0, { run: { bold: true } }),
      cel(String(d.libelle || ''), 1, { run: { bold: true, color: d.niveau === 'jaune' ? g.TEXTE : 'FFFFFF' }, cell: { shading: { type: ShadingType.CLEAR, fill: g.COULEUR_NIVEAU[d.niveau] || '6B7280', color: 'auto' } } }),
      cel(String(d.total100), 2), cel(d.confiance ? d.confiance.libelle : '—', 3), cel(String(d.faitsNotables), 4), cel(g.lireTendance(d.tendance).court, 5),
    ] }));
    corps.push(par(run('', { size: 12 })), new Table({ width: { size: UTILE, type: WidthType.DXA }, columnWidths: larg, rows: [tete, ...lignes] }));
    corps.push(par(run('Un niveau « jaune » n\'est pas l\'absence de risque : lire la confiance avant le niveau.', { italics: true, color: g.LEGERE, size: 22 }), { spacing: { before: 120 } }));
  }
  regionaux.forEach((d) => {
    corps.push(...entete('I', d.nom + ' : situation au ' + g.dateCourte(jour), d.cy));
    corps.push(par(run('', { size: 12 })), badge(d));
    const faits = (d.faits || []).slice(0, 4);
    if (faits.length) corps.push(...lignesFaits(faits));
    else corps.push(par(run('Aucun fait au-dessus du normal dans la fenêtre.', { color: g.LEGERE }), { spacing: { before: 120 } }));
    corps.push(...encadre(g.decryptage(d)));
  });

  // — Ce que nous ne savons pas
  corps.push(...entete('V', 'CE QUE NOUS NE SAVONS PAS'));
  {
    const lignes = [];
    [ci, ...regionaux].forEach((d) => {
      const am = d.angleMort || {};
      const motifs = [];
      if (am.muet) motifs.push('aucune actualité récente');
      if (am.horsAlerte) motifs.push('du flux mais aucune source fiable');
      if (am.sourceUnique) motifs.push('une seule source capable d\'alerter');
      if (am.socleAncien) motifs.push('socle de plus de 90 jours');
      if (motifs.length) lignes.push(d.nom + ' : ' + motifs.join(' ; '));
    });
    if (!lignes.length) lignes.push('Aucun angle mort identifié sur ces pays.');
    corps.push(par(run('', { size: 12 })));
    lignes.forEach((t) => corps.push(puce(t, { size: 26 })));
    corps.push(par(run('Un pays listé n\'est pas plus dangereux : c\'est un pays que l\'outil voit mal. « Confirmé » veut dire recoupé par une seconde source, pas confirmé officiellement.', { italics: true, color: g.ROUGE, size: 24 }), { spacing: { before: 200 } }));
  }

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
