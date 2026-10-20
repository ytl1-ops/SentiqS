// Bulletin quotidien du pays pilote et seuil du flash — décision du 20/10/2026.
//
// Profil pilote : responsable sûreté d'entreprise, Côte d'Ivoire en pays
// pilote n° 1. Un bulletin par jour (scripts/lib/bulletin.js, écrit par le
// job de collecte sous web/bulletins/), et un flash seulement quand un pays
// passe au marron ou au rouge — dès l'orange pour la Côte d'Ivoire.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const N = require('../../web/js/noyau.js');
const B = require('../lib/bulletin');
const A = require('../lib/alerte-sortante');
const { tranche } = require('./_bac.js');

const SRC_FIABLE = { score: 72, rss: 'https://koaci.com/feed/' };
const SRC_GN = { score: 90, rss: 'https://news.google.com/rss/search?q=x' };

test('cotation : recoupé = Confirmé, source unique fiable = Probable, sinon Non confirmé', () => {
  assert.strictEqual(N.cotationArticle({ verified: true }, null, 70).libelle, 'Confirmé');
  assert.strictEqual(N.cotationArticle({ _fusionnes: [{ id: 'x' }] }, null, 70).cle, 'confirme');
  assert.strictEqual(N.cotationArticle({}, SRC_FIABLE, 70).libelle, 'Probable');
  assert.strictEqual(N.cotationArticle({}, { score: 68, rss: 'https://x/feed' }, 70).libelle, 'Non confirmé');
  // Même règle que peutAlerter : une recherche Google News n'est jamais « probable ».
  assert.strictEqual(N.cotationArticle({}, SRC_GN, 70).cle, 'non_confirme');
});

test('flash : marron et rouge partout, orange seulement pour la Côte d\'Ivoire', () => {
  const m = { montees: [
    { code: 'BF', de: 'jaune', vers: 'orange', crans: 1 },
    { code: 'CI', de: 'jaune', vers: 'orange', crans: 1 },
    { code: 'NE', de: 'orange', vers: 'marron', crans: 1 },
    { code: 'GH', de: 'vert', vers: 'jaune', crans: 1 },
  ], descentes: 2 };
  const f = A.filtrerFlash(m);
  assert.deepStrictEqual(f.montees.map((x) => x.code), ['CI', 'NE']);
  assert.strictEqual(f.sousSeuil, 2);
  assert.strictEqual(f.descentes, 2);
  assert.match(A.construireMessage(f).text, /2 autre\(s\) montée\(s\) sous le seuil/);
  assert.strictEqual(A.construireMessage(A.filtrerFlash({ montees: [m.montees[0]], descentes: 0 })), null);
});

test('un bulletin par jour, pour les seuls pays pilotes, à partir de 6 h GMT', () => {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'bulletin-'));
  const t5h = Date.UTC(2026, 9, 21, 5, 59), t6h = Date.UTC(2026, 9, 21, 6, 0);
  assert.strictEqual(B.doitEcrire(racine, 'CI', '2026-10-21', t5h), false);
  assert.strictEqual(B.doitEcrire(racine, 'CI', '2026-10-21', t6h), true);
  assert.strictEqual(B.doitEcrire(racine, 'ML', '2026-10-21', t6h), false);
  B.ecrire(racine, donnees(), { jour: '2026-10-21', genereMs: t6h, serie: null });
  assert.strictEqual(B.doitEcrire(racine, 'CI', '2026-10-21', t6h + 3600e3), false, 'le premier passage fait foi');
  assert.ok(fs.existsSync(path.join(racine, 'CI', 'dernier.html')));
});

function donnees(o) {
  return Object.assign({
    cy: 'CI', nom: "Côte d'Ivoire", niveau: 'jaune', libelle: 'JAUNE', sous: 'Modéré', total100: 22,
    confiance: { cle: 'moyenne', libelle: 'moyenne', ageSocleJ: 113, motif: 'incident vérifié le plus récent : 113 jours' },
    motifPlafond: null, fenetreH: 36, articlesDuJour: 1, faitsNotables: 1,
    faits: [{ titre: 'Braquage <b>armé</b>', url: null, source: 'KOACI', niveau: 'high', publieMs: Date.UTC(2026, 9, 21, 4), cotation: { cle: 'probable', libelle: 'Probable' } }],
    socle: [{ titre: 'Renforcement nord', date: '29/06/2026', ageJ: 113, src: 'KOACI' }],
    facteurs: [{ label: 'Pression transfrontalière nord — FCDO', bonus: 1, revu: '2026-10' }],
    angleMort: { muet: false, horsAlerte: false, sourceUnique: false, socleAncien: true, sourcesAlerte: 5 },
  }, o);
}

test('le bulletin porte ses cinq blocs, échappe les titres et ne se fait pas indexer', () => {
  const html = B.rendre(donnees(), { jour: '2026-10-21', genereMs: Date.now() });
  for (const h of ['1. En bref', '2. Faits des 36 dernières heures', '3. Ce qui porte le niveau', '4. Ce que nous ne savons pas', '5. Conseils officiels aux voyageurs']) {
    assert.ok(html.includes(h), h);
  }
  assert.ok(html.includes('Braquage &lt;b&gt;armé&lt;/b&gt;'));
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /gov\.uk\/foreign-travel-advice\/cote-d-ivoire/);
  assert.match(html, /113 jours/, 'le socle ancien est dit');
  assert.match(html, /pas une confirmation officielle/);
});

test('sans fait du jour, le bulletin ne dit pas « calme »', () => {
  const p = B.phraseEnBref(donnees({ faits: [], faitsNotables: 0, articlesDuJour: 0 }), null);
  assert.match(p, /ne veut pas dire qu'il ne s'est rien passé/);
  assert.doesNotMatch(p, /calme/);
});

test('la tendance compare le niveau imprimé, pas un instantané antérieur du même jour', () => {
  const serie = { pays: { CI: [['2026-10-19', 'orange'], ['2026-10-20', 'orange'], ['2026-10-21', 'orange']] } };
  const t = B.tendanceDuJour(serie, donnees(), '2026-10-21');
  assert.strictEqual(t.vers, 'jaune');
  assert.strictEqual(t.crans, -1);
  assert.match(B.phraseEnBref(donnees(), t), /en baisse de 1 cran depuis le 19\/10\/2026.*revue du socle/);
  // Un seul relevé : aucune tendance annoncée.
  assert.strictEqual(B.tendanceDuJour(null, donnees(), '2026-10-21'), null);
});

test('la page fournit les données, le job écrit le bulletin et le commite', () => {
  const corps = tranche('function donneesBulletinPays(cy) {', '\n// TR_CONCURRENCE_MAX');
  assert.match(corps, /estRecentReel\(a\)/);
  assert.match(corps, /cotationArticle\(a, src, SEUIL_SOURCE_ALERTE\)/);
  assert.match(corps, /angleMortPerimetre\(\[cy\]\)/);
  const job = fs.readFileSync(path.join(__dirname, '..', 'collecte-planifiee.js'), 'utf8');
  assert.match(job, /donneesBulletinPays/);
  assert.match(job, /alerteSortante\.filtrerFlash\(/);
  const wf = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'collecte-planifiee.yml'), 'utf8');
  assert.match(wf, /git add web\/bulletins/);
});
