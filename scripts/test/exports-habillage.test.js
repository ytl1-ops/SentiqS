// Habillage des exports — 20/10/2026.
//
// L'editeur a juge le rendu des exports « pas satisfaisant » : un bandeau gris
// plat en tete du PDF, une image posee SOUS le texte de l'actu (elle se lisait
// comme l'illustration du pays suivant), une couverture PowerPoint claire dont
// le titre chevauchait le sous-titre, des titres Word restes dans le bleu par
// defaut du style. Des documents reels ont ete generes (pdf-lib, docx,
// pptxgenjs servis en local), convertis en images et relus avant/apres.
//
// La plupart de ces gardes lisent le texte des generateurs, comme les autres
// tests de ce depot : un export Word ou PDF ne se rejoue pas ici sans les
// bibliotheques. Chacune a ete vue echouer sur le code d'avant.
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac, exposer } = require('./_bac');

const pdfEntete = () => tranche('    bulletinHeader(titre, dateGenStr, creneauStr, syntheseTxt) {', '    // Bandeau de statistiques cle');
const pdfCarte = () => tranche('    articleItem(a, lieuTxt) {', '    // Grille 2 colonnes');

test('PDF : la couverture est bleu nuit avec un filet or, plus un bandeau gris', () => {
  const t = pdfEntete();
  assert.match(t, /drawRectangle\(\{x:0, y:H-headH, width:W, height:headH, color:NUIT\}\)/);
  assert.match(t, /color:OR\}\)/);
  assert.doesNotMatch(t, /color:PAPER/);
});

test('PDF : le logo de l organisation est pose sur une pastille blanche', () => {
  const t = pdfEntete();
  assert.match(t, /if \(b\.logo\)[\s\S]*color:rgb\(1,1,1\)\}\)[\s\S]*drawImage\(b\.logo/);
});

test('PDF : la carte d actu mesure sa hauteur avant de dessiner, image A DROITE du texte', () => {
  const t = pdfCarte();
  assert.ok(t.indexOf('b.ensure(h + 12)') > 0 && t.indexOf('b.ensure(h + 12)') < t.indexOf('drawText(label'),
    'la carte doit tenir d un bloc : ensure() avant tout dessin');
  assert.match(t, /const ix = W - M - imgW/);
  // L'ancien code posait l'image sous le texte, a x = M.
  assert.doesNotMatch(t, /drawImage\(im\.pdf, \{x:M, y:b\.y - ih/);
});

test('Word : les titres portent leur couleur dans le texte, pas dans le style par defaut', () => {
  const t = tranche("    const heading=(text,lvl=1,color='0B1A27')=>new Paragraph({", '    const para=(text,opts={})');
  assert.match(t, /children:\[new TextRun\(\{text,bold:true,color/);
  const top = tranche('    const topBar=(text,color)=>new Paragraph({', '    // Encadré de mise en avant');
  assert.match(top, /children:\[new TextRun\(\{text,bold:true,size:26/);
});

test('Word : couverture bleu nuit en cellules a largeur fixe (les % ne tiennent pas dans LibreOffice)', () => {
  const t = tranche("    const NUIT_W='071431'", "    if (syntheseTxtW) {");
  assert.match(t, /fill:NUIT_W/);
  assert.match(t, /columnWidths:logoRun\?\[1800,7200\]:\[9000\]/);
  assert.doesNotMatch(t, /PERCENTAGE/);
});

test('Word : avec une image, le texte est a gauche et l image a droite, dans une ligne qui ne se coupe pas', () => {
  const t = tranche('    const detailWord=(a, avecResume=true)=>{', '    const arts=getExportData();');
  assert.match(t, /new TableRow\(\{cantSplit:true/);
  assert.match(t, /alignment:AlignmentType\.RIGHT,children:\[new ImageRun/);
});

test('PowerPoint : couverture bleu nuit, nom ajuste a sa longueur, plus de nom en double', () => {
  const t = tranche("    const NUIT_P = '071431'", '    // ── Calculs préalables');
  assert.match(t, /newSlide\(NUIT_P\)/);
  assert.match(t, /taillNom/);
  // L'ancien code repetait le nom de marque dans le panneau de droite.
  assert.doesNotMatch(t, /const mots = nomMarqueActuelle\(\)\.split/);
});

test('PowerPoint : la taille du nom suit sa longueur (a 52 pt un nom de 19 caracteres passait sur deux lignes)', () => {
  const t = tranche("    const taillNom = ", '    s.addText(nomCouv');
  const taille = (n) => { const Math_ = Math; return Math_.max(26, Math_.min(52, Math_.floor(7.2 * 72 / (Math_.max(n, 1) * 0.56)))); };
  assert.match(t, /7\.2 \* 72/);
  assert.ok(taille('Groupe Alpha Sûreté'.length) < 52, 'un nom de 19 caracteres doit etre reduit');
  assert.strictEqual(taille('SentiqS'.length), 52, 'un nom court garde la grande taille');
});

test('PowerPoint : les actus du Flux sont des cartes, image a droite, texte retreci d autant', () => {
  const t = tranche('        chunk.forEach((a,i)=>{', '    // ── Slide — Réseaux sociaux');
  assert.match(t, /const twF = 11\.7 - \(imF \? iwF \+ 0\.2 : 0\)/);
  assert.match(t, /detailPptx\(s, a, 0\.85, y\+0\.47, twF, 300, true\)/);
});

test('PowerPoint : le mot « Page » ne recouvre plus le numero', () => {
  assert.match(tranche('    const newSlide = (bg) => {', '    // Titre de section numéroté'), /x:12\.1, y:ribbonY, w:0\.78/);
});

test('apercu HTML : meme couverture bleu nuit que les autres formats', () => {
  const t = tranche('function _apPageWrap(', 'function _apStatsGrid(');
  assert.match(t, /linear-gradient\(135deg,#071431,#0F2450\)/);
  assert.match(t, /border-bottom:3px solid #E6BA6E/);
  // Imprime, un fond sans cette consigne sort blanc : texte blanc sur blanc.
  assert.match(t, /print-color-adjust:exact/);
});

function bacDetail(pub, surv) {
  const ctx = bac(tranche('const VISUEL_OGP_MAX', 'function parseRSS(xml, src) {'));
  exposer(ctx, 'RESUME_RAPPORT_MAX');
  Object.assign(ctx, {
    URL, LANG: 'fr', MEDIA_CACHE: {}, SEUIL_SOURCE_ALERTE: 70, CYS: [], escHtml: (s) => s, catFr: (c) => c,
    safeUrl: (u) => u, L: (t) => t, fmtAge: () => '2 h', fmtFull: () => pub,
    fmtSurvenance: () => ({ texte: surv, inconnue: false }), articleLienDirect: (a) => a.url,
    gs: () => ({ score: 80 }), lp: (l) => [l, l], srcName: () => 'X', sourcesVisibles: () => false,
    resolveOGP: () => new Promise(() => {}),
  });
  return ctx;
}
const unArticle = { id: 'x', cy: 'CI', cat: 'securite', level: 'high', title: 'Attaque', url: 'https://a.test/1', fiable: true, pubDate: 1, primary: 'p', srcs: ['p'], analysis: 'Un résumé.' };

test('la survenance n est pas redite quand elle tombe a la minute de la publication', () => {
  const memes = bacDetail('mar. 20 oct. 15:30', 'mar. 20 oct. 15:30').detailRapportActu(unArticle).infos;
  assert.ok(!memes.some((t) => /^Survenance/.test(t)), 'meme instant : une seule mention');
  const autres = bacDetail('mar. 20 oct. 15:30', 'lun. 19 oct. 09:00').detailRapportActu(unArticle).infos;
  assert.ok(autres.some((t) => /^Survenance/.test(t)), 'un autre instant doit rester dit');
});
