// Direction « Bleu nuit » et visuels d'actu — 20/10/2026.
//
// L'editeur ne veut plus de l'affichage clair par defaut, et veut une image
// liee a chaque actu, dans toute l'appli. Ces tests gardent ce qui casserait
// sans bruit :
//   - le sombre est le defaut, et seul un choix EXPLICITE du clair le garde
//     (l'ancienne cle etait reecrite a chaque chargement : la relire aurait
//     fige tous les anciens utilisateurs en clair) ;
//   - le visuel n'affiche qu'une image https (la CSP refuse le reste, et une
//     adresse non echappee serait une injection), credite la source, et ne
//     lit jamais une video sur place ;
//   - « A la une » met la gravite d'abord et un seul fait par pays.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { tranche, bac, exposer } = require('./_bac');

test('le theme sombre est le defaut, seul un choix explicite du clair le garde', () => {
  const script = tranche("document.documentElement.setAttribute('data-theme', 'dark');", '</script>');
  const lancer = (stocke) => {
    const attrs = {};
    const ctx = {
      document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; } } },
      localStorage: { getItem: (k) => stocke[k] ?? null },
    };
    vm.runInNewContext(script, ctx);
    return attrs['data-theme'];
  };
  assert.strictEqual(lancer({}), 'dark');
  // L'ancienne cle, reecrite a chaque chargement, ne dit rien d'un choix.
  assert.strictEqual(lancer({ sentinel_theme: 'light' }), 'dark');
  assert.strictEqual(lancer({ sentinel_theme_choix: 'light' }), 'light');
});

test('la synchronisation au chargement n enregistre aucun choix', () => {
  const ctx = bac(tranche('function appliquerTheme(theme, choixExplicite) {', '// Synchronise le bouton'));
  const ecrits = [];
  Object.assign(ctx, {
    document: { documentElement: { setAttribute() {}, getAttribute: () => 'dark' }, getElementById: () => null },
    localStorage: { setItem: (k, v) => ecrits.push([k, v]) },
  });
  ctx.appliquerTheme('dark');
  assert.deepStrictEqual(ecrits, []);
  ctx.toggleTheme();
  assert.deepStrictEqual(ecrits, [['sentinel_theme_choix', 'light']]);
});

function bacVisuel() {
  const ctx = bac(tranche('const VISUEL_OGP_MAX', 'function parseRSS(xml, src) {'));
  exposer(ctx, 'VISUEL_OGP_MAX');
  const ogp = [];
  Object.assign(ctx, {
    URL, LANG: 'fr', MEDIA_CACHE: {}, SEUIL_SOURCE_ALERTE: 70, CYS: [{ code: 'CI', flag: '', name: "Côte d'Ivoire" }],
    escHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    catFr: (c) => c, safeUrl: (u) => u, L: (t) => t, fmtAge: () => '2 h',
    articleLienDirect: (a) => a.url, gs: () => ({ score: 80 }), lp: (l) => ['r' + l, l.toUpperCase()],
    resolveOGP: (u) => { ogp.push(u); return new Promise(() => {}); },
  });
  ctx._ogp = ogp;
  return ctx;
}
const art = (o) => Object.assign({ id: 'x', cy: 'CI', cat: 'securite', level: 'high', url: 'https://www.fratmat.info/article/1', fiable: false, pubDate: 1 }, o);

test('le visuel n affiche qu une image https, creditee a la source', () => {
  const ctx = bacVisuel();
  const h = ctx.visuelActu(art({ _media: { img: 'https://cdn.fratmat.info/p.jpg' } }), 'vignette');
  assert.match(h, /<img src="https:\/\/cdn\.fratmat\.info\/p\.jpg"/);
  assert.match(h, /© fratmat\.info/);
  assert.match(h, /class="vact-repli"/, 'le repli reste sous l image, pour le cas ou elle ne charge pas');
  assert.doesNotMatch(ctx.visuelActu(art({ _media: { img: 'http://x.org/p.jpg' } })), /<img/);
  assert.doesNotMatch(ctx.visuelActu(art({ _media: { img: 'https://x.org/p.jpg" onload="alert(1)' } })), /<img/);
});

test('une video se montre en vignette officielle et s ouvre chez la source', () => {
  const ctx = bacVisuel();
  const h = ctx.visuelActu(art({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }), 'une');
  assert.match(h, /src="https:\/\/i\.ytimg\.com\/vi\/dQw4w9WgXcQ\/hqdefault\.jpg"/);
  assert.match(h, /<a class="vact-play" href="https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ" target="_blank"/);
  assert.doesNotMatch(h, /<iframe|<video/);
});

test('sans image, le repli dit le pays et la gravite, et l apercu Open Graph est borne', () => {
  const ctx = bacVisuel();
  const h = ctx.visuelActu(art({ level: 'crit' }));
  assert.match(h, /sans-img/);
  assert.match(h, /<span class="vact-code">CI<\/span>/);
  assert.match(h, /--vact-niv:var\(--r\)/);
  assert.strictEqual(ctx._ogp.length, 0, 'source non fiable : pas de requete');
  for (let i = 0; i < ctx.VISUEL_OGP_MAX + 10; i++) ctx.visuelActu(art({ id: 'f' + i, fiable: true }));
  assert.strictEqual(ctx._ogp.length, ctx.VISUEL_OGP_MAX);
});

test('A la une : gravite d abord, un seul fait par pays, rien hors d Afrique, l image departage', () => {
  const ctx = bacVisuel();
  const choix = ctx.choisirALaUne([
    art({ id: 'a', cy: 'CI', level: 'mod', pubDate: 9 }),
    art({ id: 'b', cy: 'ML', level: 'crit', pubDate: 1 }),
    art({ id: 'c', cy: 'ML', level: 'crit', pubDate: 5 }),
    art({ id: 'd', cy: 'BF', level: 'high', pubDate: 2 }),
    art({ id: 'e', cy: 'BF', level: 'high', pubDate: 1, _media: { img: 'https://x.org/i.jpg' } }),
    art({ id: 'i', cy: 'INT', level: 'crit', pubDate: 99 }),
  ], 4);
  assert.deepStrictEqual(Array.from(choix, (a) => a.id), ['c', 'e', 'a']);
});
