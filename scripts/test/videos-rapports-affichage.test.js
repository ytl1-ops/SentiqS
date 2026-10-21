// Videos, rapports detailles et reglages d'affichage — 20/10/2026.
//
// Trois demandes de l'editeur, le meme jour :
//   - « les videos, comme les liens des sources, doivent permettre d'ouvrir
//     ces videos » : toute la surface du visuel ouvre LA video (la page
//     YouTube, ou le fichier publie par la source), pas seulement un bouton
//     de 44 px qui menait a la page de l'article ;
//   - « les rapports doivent etre les plus detailles possible (ne pas se
//     limiter aux titres) » : resume, cotation, dates et liens sous chaque
//     titre, dans l'apercu HTML, le PDF, le Word et le PowerPoint ;
//   - « prevoir les reglages, config affichage des versions mobile et
//     tablette » : un format tablette, et des reglages par appareil.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { tranche, bac, exposer } = require('./_bac');

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function bacVisuel(o = {}) {
  const ctx = bac(tranche('const VISUEL_OGP_MAX', 'function parseRSS(xml, src) {'));
  exposer(ctx, 'RESUME_RAPPORT_MAX');
  const ogp = [];
  // Couche commune des rapports (langue, cotation, ligne pays au-dessus du titre).
  Object.assign(ctx, { LANG: 'fr', infoPays: (cy) => ({ flag: '', name: (cy === 'CI' ? "Côte d'Ivoire" : 'International') }), PAYS_INFO: { CI: {} },
    detectGeo: () => ({}), _cyNivTexteEtCouleur: () => null, nomMarqueActuelle: () => 'SentiqS', identiteEnvoiActuelle: () => '' });
  vm.runInContext(tranche('const PAYS_EN = {', '// ── UPDATE COMPTEURS DL'), ctx);
  Object.assign(ctx, {
    URL, LANG: 'fr', MEDIA_CACHE: {}, SEUIL_SOURCE_ALERTE: 70, CYS: [{ code: 'CI', flag: '', name: "Côte d'Ivoire" }],
    escHtml, catFr: (c) => c, safeUrl: (u) => u, L: (t) => t, fmtAge: () => '2 h', fmtFull: () => '20/10/2026 08:00',
    fmtSurvenance: () => ({ texte: '20/10/2026 07:00', inconnue: false }),
    articleLienDirect: (a) => a.url, gs: () => ({ score: 80 }), lp: (l) => ['r' + l, l.toUpperCase()],
    srcName: () => 'Fraternité Matin', sourcesVisibles: () => o.sources !== false,
    resolveOGP: (u) => { ogp.push(u); return new Promise(() => {}); },
  });
  if (o.sansImages) ctx.affichageImagesActif = () => false;
  ctx._ogp = ogp;
  return ctx;
}
const art = (o) => Object.assign({ id: 'x', cy: 'CI', cat: 'securite', level: 'high', title: 'Attaque près de Kong', url: 'https://www.fratmat.info/article/1', fiable: true, pubDate: 1, primary: 'fratmat' }, o);

test('une video s ouvre elle-meme, depuis toute la surface du visuel', () => {
  const ctx = bacVisuel();
  // Une adresse « embed » ne se lit pas hors d'un cadre : elle devient « watch ».
  assert.strictEqual(ctx.lienVideoActu(art({ _media: { vid: 'https://www.youtube.com/embed/dQw4w9WgXcQ' } })), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  // Le fichier video publie par la source, pas la page de l'article.
  assert.strictEqual(ctx.lienVideoActu(art({ _media: { vid: 'https://cdn.fratmat.info/v.mp4' } })), 'https://cdn.fratmat.info/v.mp4');
  // Une adresse non https ne s'ouvre pas : repli sur l'article.
  assert.strictEqual(ctx.lienVideoActu(art({ _media: { vid: 'http://x.org/v.mp4' } })), 'https://www.fratmat.info/article/1');
  const h = ctx.visuelActu(art({ _media: { vid: 'https://cdn.fratmat.info/v.mp4' } }), 'une');
  assert.match(h, /<a class="vact-play" href="https:\/\/cdn\.fratmat\.info\/v\.mp4"/);
  assert.match(h, /Voir la vidéo/);
});

test('la surface entiere du visuel video est cliquable, credit au-dessus', () => {
  const css = tranche('.vact-play{', '.vact-vignette{width:132px');
  assert.match(css, /\.vact-play\{position:absolute;inset:0/);
  assert.match(css, /\.vact-credit\{z-index:3;pointer-events:none\}/);
});

test('le detail d une actu video porte un bouton « Ouvrir la vidéo »', () => {
  const det = tranche('async function showDet(id) {', 'confHtml+');
  assert.match(det, /mediaActu\(a\)\.video \? '<a class="det-video" href="'\+escHtml\(safeUrl\(lienVideoActu\(a\)\)\)/);
});

test('le rapport detaille une actu : resume, cotation, dates, liens', () => {
  const ctx = bacVisuel();
  const d = ctx.detailRapportActu(art({ analysis: '  Des hommes armés ont attaqué   un poste. ', _media: { vid: 'https://youtu.be/dQw4w9WgXcQ' } }));
  assert.strictEqual(d.resume, 'Des hommes armés ont attaqué un poste.');
  assert.ok(d.infos.some((t) => /^Cotation : /.test(t)), d.infos.join(' | '));
  assert.ok(d.infos.includes('Publié le 20/10/2026 08:00'));
  assert.ok(d.infos.includes('Survenance : 20/10/2026 07:00'));
  assert.strictEqual(d.lienVideo, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.strictEqual(d.lienArticle, 'https://www.fratmat.info/article/1');
  // Un resume qui repete le titre n'est pas un detail.
  assert.strictEqual(ctx.detailRapportActu(art({ analysis: 'Attaque près de Kong' })).resume, '');
  // Coupe a la limite, sur un mot entier.
  const long = ctx.detailRapportActu(art({ analysis: 'mot '.repeat(400) })).resume;
  assert.ok(long.length <= ctx.RESUME_RAPPORT_MAX + 2 && long.endsWith(' …'), long.length);
});

test('sans visibilite des sources, ni nom ni lien d article ; la video reste ouvrable', () => {
  const ctx = bacVisuel({ sources: false });
  const d = ctx.detailRapportActu(art({ analysis: 'Résumé.', _media: { vid: 'https://cdn.fratmat.info/v.mp4' } }));
  assert.strictEqual(d.lienArticle, null);
  assert.ok(!d.infos.some((t) => /Fraternité/.test(t)));
  assert.strictEqual(d.lienVideo, 'https://cdn.fratmat.info/v.mp4');
});

test('l apercu HTML imprime le resume et les liens sous chaque titre', () => {
  const ctx = bacVisuel();
  vm.runInContext(tranche('function _apArticleItem(a) {', 'function _apCorrelationCard(s) {'), ctx);
  Object.assign(ctx, {
    _apEsc: escHtml, _apLevelPill: () => '', _apCyNivPill: () => '',
    detectGeo: () => ({}), infoPays: () => ({ name: "Côte d'Ivoire" }),
  });
  const h = ctx._apArticleItem(art({ analysis: 'Des hommes armés ont attaqué un poste.', _media: { vid: 'https://youtu.be/dQw4w9WgXcQ' } }));
  assert.match(h, /Des hommes armés ont attaqué un poste\./);
  assert.match(h, /href="https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ"[^>]*>Voir la vidéo/);
  assert.match(h, />Lire l&#39;article</);
});

test('PDF, Word et PowerPoint passent tous par le detail', () => {
  assert.match(tranche('    articleItem(a) {', '    // Grille 2 colonnes'), /detailRapportActu\(a\)/);
  const word = tranche('async function exportWord(', 'function initMobileCollapsibles()');
  assert.ok(/detailWord\(a, avecResume\)/.test(word) && /rubriquesW|articleBlocW/.test(word), 'Word : les actus passent par le detail commun');
  const pptx = tranche('async function exportPPTX(type) {', 'function _pdfSafe(text) {');
  assert.ok((pptx.match(/detailPptx\(s, a,/g) || []).length >= 4, 'PowerPoint : quatre sections d actus');
});

test('« economiser les donnees » : aucune image chargee ni demandee', () => {
  const ctx = bacVisuel({ sansImages: true });
  const h = ctx.visuelActu(art({ _media: { img: 'https://cdn.fratmat.info/p.jpg' } }));
  assert.doesNotMatch(h, /<img/);
  assert.match(h, /sans-img/);
  ctx.visuelActu(art({ id: 'y' }));
  assert.strictEqual(ctx._ogp.length, 0, 'pas d apercu Open Graph demande');
  // Une video reste ouvrable.
  assert.match(ctx.visuelActu(art({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })), /class="vact-play"/);
});

function bacAffichage(stocke = {}, largeur = 1024) {
  const classes = new Set();
  const ctx = {
    console, window: { innerWidth: largeur }, LANG: 'fr',
    localStorage: { getItem: (k) => (k in stocke ? stocke[k] : null), setItem: (k, v) => { stocke[k] = String(v); } },
    document: {
      documentElement: { classList: { add: (c) => classes.add(c), remove: (...c) => c.forEach((x) => classes.delete(x)), contains: (c) => classes.has(c) } },
      querySelectorAll: () => [], getElementById: () => null,
    },
  };
  vm.createContext(ctx);
  vm.runInContext(tranche('function setDisplayMode(mode) {', '// détecteLangue(texte)').replace(/^/, 'const MODES_AFFICHAGE = [\'auto\', \'web\', \'tablette\', \'mobile\'];\n'), ctx);
  ctx._classes = classes;
  ctx._stocke = stocke;
  return ctx;
}

test('le format tablette se force et se retient, un seul format a la fois', () => {
  const ctx = bacAffichage({ sentinel_display_mode: 'tablette' });
  assert.ok(ctx._classes.has('force-tablette'), 'relu au chargement');
  ctx.changerAffichage('format', 'mobile');
  assert.deepStrictEqual([...ctx._classes].filter((c) => c.startsWith('force-')), ['force-mobile']);
  assert.strictEqual(ctx._stocke.sentinel_display_mode, 'mobile');
  ctx.changerAffichage('format', 'n-importe-quoi');
  assert.strictEqual(ctx._stocke.sentinel_display_mode, 'auto');
});

test('taille du texte, presentation et images : une classe chacun, relue au chargement', () => {
  const ctx = bacAffichage({ sentinel_aff_texte: 'grand', sentinel_aff_presentation: 'valeur-cassee' });
  assert.ok(ctx._classes.has('texte-grand'));
  assert.ok(!ctx._classes.has('actus-magazine'), 'une valeur illisible revient au defaut');
  ctx.changerAffichage('texte', 'tres-grand');
  assert.ok(ctx._classes.has('texte-tres-grand') && !ctx._classes.has('texte-grand'));
  ctx.changerAffichage('presentation', 'magazine');
  ctx.changerAffichage('images', 'non');
  assert.ok(ctx._classes.has('actus-magazine') && ctx._classes.has('sans-images'));
  assert.strictEqual(ctx.affichageImagesActif(), false);
  assert.strictEqual(ctx._stocke.sentinel_aff_images, 'non');
});

test('les regles tablette existent en automatique ET en force, a l identique', () => {
  const bloc = tranche("REGLAGES D'AFFICHAGE — 20/10/2026", '/* Taille du texte');
  const auto = [...bloc.matchAll(/html:not\(\.force-web\):not\(\.force-mobile\) ([^\n]+)/g)].map((m) => m[1]);
  const force = [...bloc.matchAll(/html\.force-tablette ([^\n]+)/g)].map((m) => m[1]);
  assert.ok(auto.length >= 4, 'regles tablette automatiques');
  assert.deepStrictEqual(force, auto);
  assert.match(bloc, /@media \(min-width:761px\) and \(max-width:1180px\)\{/);
});

// Images des sources dans les rapports bureautiques — 20/10/2026.
test('les images d un rapport : les plus graves d abord, sans doublon, bornees', () => {
  const ctx = bacVisuel();
  const img = { img: 'https://cdn.fratmat.info/p.jpg' };
  const arts = [
    art({ id: 'a', level: 'mod', pubDate: 9, _media: img }),
    art({ id: 'b', level: 'crit', pubDate: 1, _media: img }),
    art({ id: 'b', level: 'crit', pubDate: 1, _media: img }),
    art({ id: 'c', level: 'crit', pubDate: 5, _media: img }),
    art({ id: 'd', level: 'high', pubDate: 7 }), // aucune image : jamais retenue
  ];
  assert.deepStrictEqual(Array.from(ctx.articlesPourImagesRapport(arts), (a) => a.id), ['c', 'b', 'a']);
  assert.strictEqual(ctx.articlesPourImagesRapport(arts, 2).length, 2);
});

test('« economiser les donnees » : aucune image demandee pour un rapport', async () => {
  const ctx = bacVisuel({ sansImages: true });
  const r = await ctx.chargerImagesRapport([art({ id: 'a', _media: { img: 'https://cdn.fratmat.info/p.jpg' } })]);
  assert.strictEqual(r.size, 0);
});

test('PDF, Word et PowerPoint embarquent l image de la source', () => {
  assert.match(tranche('    articleItem(a) {', '    // Grille 2 colonnes'), /b\.imagesActus\.get\(a\.id\)[\s\S]*drawImage\(im\.pdf/);
  assert.match(tranche('async function exportWord(', 'function initMobileCollapsibles()'), /new ImageRun\(\{data:im\.octets\(\)[\s\S]*imagesActus=await chargerImagesRapport\(arts\)/);
  assert.match(tranche('async function exportPPTX(type) {', 'function _pdfSafe(text) {'), /imagesPptx = await chargerImagesRapport\(arts, 16\)[\s\S]*slide\.addImage\(\{data: im\.dataUrl/);
  assert.match(tranche('async function exportPDF(type) {', "if (type === 'synthese') {"), /chargerImagesRapport\(getExportData\(\)\)[\s\S]*embedJpg/);
});
