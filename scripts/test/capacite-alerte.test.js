// Ce qu'un controle de registre appelle « source d'alerte » doit etre ce
// que la page laisse reellement alerter.
//
// Le 07/09/2026, quinze medias bloques par Cloudflare ont ete rediriges vers
// des requetes Google News `site:`, en gardant leur note (80 a 93). Les deux
// controles de registre les ont aussitot comptes comme des sources
// d'alerte. Or la page ecarte tout article d'une requete Google News de
// recherche avant meme qu'il n'entre dans ALL (sourceDateNonFiable) : ces
// sources ne peuvent rien signaler, et 35 autres requetes notees 70 ou plus
// etaient deja dans ce cas sans que personne ne le voie. Le cliquet disait
// 13 pays a source unique ; la mesure reelle en donne 26.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { tranche, bac, exposer } = require('./_bac');
const { estRequeteGoogleNews, peutAlerter } = require('../lib/capacite-alerte');

const SEUIL = 70;

test('une requete Google News de recherche ne peut pas alerter, quelle que soit sa note', () => {
  assert.strictEqual(peutAlerter({ score: 95, rss: 'https://news.google.com/rss/search?q=site:acleddata.com&hl=en' }, SEUIL), false);
  assert.strictEqual(peutAlerter({ score: 90, rss: 'https://news.google.com/rss/search?q=AIP%20C%C3%B4te%20d%27Ivoire&hl=fr&gl=CI&ceid=CI:fr' }, SEUIL), false);
  // Un flux natif au-dessus du seuil, oui ; en dessous, non.
  assert.strictEqual(peutAlerter({ score: 72, rss: 'https://www.punchng.com/feed/' }, SEUIL), true);
  assert.strictEqual(peutAlerter({ score: 68, rss: 'https://www.punchng.com/feed/' }, SEUIL), false);
  // L'hote se lit avec new URL(), pas par une expression sur la chaine :
  // le premier test de rss_method cherchait `(^|.)news.google.com/` et ne
  // reconnaissait aucune des 318 requetes du registre.
  assert.strictEqual(estRequeteGoogleNews({ rss: 'https://news.google.com/rss/search?q=x' }), true);
  assert.strictEqual(estRequeteGoogleNews({ rss: 'https://example.com/?u=https://news.google.com/rss/search' }), false);
  assert.strictEqual(estRequeteGoogleNews({ rss: 'pas une url' }), false);
});

test('la regle des scripts dit la meme chose que sourceDateNonFiable dans la page, source par source', () => {
  // Deux definitions de « requete Google News » qui divergent feraient dire
  // « couvert » a un pays que la page ne laisse pas alerter. On confronte
  // donc chaque entree du registre a la fonction reelle de la page.
  const ctx = exposer(bac(
    tranche('const SRCS=[', '\n];') + '\n];',
    tranche('function sourceDateNonFiable(article) {', '// FENETRE_ACTUALITE_MS'),
  ), 'SRCS');
  assert.ok(ctx.SRCS.length > 500, 'le registre doit etre lu en entier');
  const articleDe = (s) => ({ analysis: 'Un compte rendu substantiel, pas un filler.', _srcRssMethod: s.rss_method, _srcRssUrl: s.rss });
  let requetes = 0;
  for (const s of ctx.SRCS) {
    const page = ctx.sourceDateNonFiable(articleDe(s));
    assert.strictEqual(estRequeteGoogleNews(s), page,
      s.id + ' : le script dit ' + estRequeteGoogleNews(s) + ', la page dit ' + page);
    if (page) requetes++;
  }
  assert.ok(requetes >= 300, 'la page doit bien ecarter les requetes de recherche (' + requetes + ' vues)');
});

test('le plafond declare de pays a source unique est la dette reelle, Google News exclu', () => {
  // Meme garde que pour les facteurs non dates et les fiches sans donnees :
  // le cliquet doit dire ce qui est mesure, pas ce qu'on aimerait.
  const source = fs.readFileSync(path.join(__dirname, '..', 'verifier-redondance-sources.js'), 'utf8');
  const m = /const PLAFOND_PAYS_SOURCE_UNIQUE = (\d+);/.exec(source);
  assert.ok(m, 'le plafond doit etre declare dans le verificateur');
  assert.match(source, /capacite-alerte/, 'le verificateur doit passer par la regle partagee, pas la recopier');
  const ctx = exposer(bac(tranche('const SRCS=[', '\n];') + '\n];'), 'SRCS');
  const parPays = new Map();
  for (const s of ctx.SRCS) {
    if (!s.cy || s.cy === 'INT') continue;
    parPays.set(s.cy, (parPays.get(s.cy) || 0) + (peutAlerter(s, SEUIL) ? 1 : 0));
  }
  const uniques = [...parPays.values()].filter((n) => n === 1).length;
  const aveugles = [...parPays.values()].filter((n) => n === 0).length;
  assert.strictEqual(aveugles, 0, 'aucun pays ne doit dependre uniquement de requetes Google News');
  assert.strictEqual(uniques, Number(m[1]),
    'dette reelle ' + uniques + ' pays a source unique, plafond declare ' + m[1]);
});
