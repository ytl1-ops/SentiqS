// Bulletins quotidiens des 54 pays — demande de YORO du 13/11/2026 : « que
// chaque pays autre que la Côte d'Ivoire ait des rapports également ».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const B = require('../lib/bulletin');
const { tranche } = require('./_bac.js');

const HTML = fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'SentiqS_Web.html'), 'utf8');

function codesPage() {
  const s = HTML.slice(HTML.indexOf('const PAYS_INFO'), HTML.indexOf('const PAYS_INFO') + 20000);
  const re = /\b([A-Z]{2})\s*:\s*\{[^}]*?name\s*:/g; const o = new Set(); let m;
  while ((m = re.exec(s))) o.add(m[1]);
  return o;
}

function donnees(cy, o) {
  return Object.assign({
    cy, nom: B.PAYS_BULLETIN[cy].nom, niveau: 'jaune', libelle: 'JAUNE', sous: 'Modéré', total100: 22,
    confiance: { cle: 'moyenne', libelle: 'moyenne', ageSocleJ: 50, motif: 'x' },
    motifPlafond: null, fenetreH: 36, articlesDuJour: 0, faitsNotables: 0, faits: [], socle: [], facteurs: [],
    angleMort: { muet: true, horsAlerte: false, sourceUnique: false, socleAncien: false, sourcesAlerte: 2 },
  }, o || {});
}

test('les 54 pays suivis par la page ont un bulletin, et aucun autre', () => {
  const page = codesPage();
  page.add('CI');
  assert.strictEqual(page.size, 54, 'la page suit 54 pays');
  assert.deepStrictEqual(Object.keys(B.PAYS_BULLETIN).sort(), [...page].sort());
});

test('chaque bulletin porte les trois avis officiels, sur le bon domaine', () => {
  for (const cy of Object.keys(B.PAYS_BULLETIN)) {
    const c = B.PAYS_BULLETIN[cy].conseils;
    assert.strictEqual(c.length, 3, cy);
    assert.match(c[0].url, /^https:\/\/www\.gov\.uk\/foreign-travel-advice\/[a-z-]+$/, cy);
    assert.match(c[1].url, /^https:\/\/travel\.state\.gov\/.+\/[a-z-]+-travel-advisory\.html$/, cy);
    assert.match(c[2].url, /^https:\/\/www\.diplomatie\.gouv\.fr\/fr\/(conseils-aux-voyageurs\/conseils-par-pays-destination\/[a-z-]+\/|information-par-pays\/[a-z-]+\/conseils-aux-voyageurs-securite)$/, cy);
  }
  // Les trois administrations n'écrivent pas le même nom : le Congo n'est pas la RD Congo.
  assert.match(B.PAYS_BULLETIN.CG.conseils[1].url, /republic-of-the-congo-/);
  assert.match(B.PAYS_BULLETIN.CD.conseils[0].url, /democratic-republic-of-the-congo$/);
  assert.match(B.PAYS_BULLETIN.CV.conseils[1].url, /cabo-verde/);
  // Mesuré depuis GitHub le 13/11/2026 : ces deux adresses répondaient 404.
  assert.match(B.PAYS_BULLETIN.GW.conseils[2].url, /guinee-bissao\/$/);
  assert.match(B.PAYS_BULLETIN.CI.conseils[2].url, /information-par-pays\/cote-d-ivoire\//);
});

test('le pays pilote est écrit en premier, les 53 autres suivent', () => {
  const o = B.paysAEcrire();
  assert.strictEqual(o[0], 'CI');
  assert.strictEqual(o.length, 54);
  assert.strictEqual(new Set(o).size, 54);
});

test('l\'index liste chaque pays écrit, le plus grave d\'abord après le pilote, et garde une ligne non réécrite', () => {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'bulletins-'));
  const t = Date.UTC(2026, 10, 13, 7);
  B.mettreAJourIndex(racine, donnees('ML', { niveau: 'rouge', libelle: 'ROUGE' }), '2026-11-12', t);
  B.mettreAJourIndex(racine, donnees('GH'), '2026-11-13', t);
  B.mettreAJourIndex(racine, donnees('CI'), '2026-11-13', t);
  const j = JSON.parse(fs.readFileSync(path.join(racine, 'index.json'), 'utf8'));
  assert.deepStrictEqual(Object.keys(j.pays).sort(), ['CI', 'GH', 'ML']);
  const html = fs.readFileSync(path.join(racine, 'index.html'), 'utf8');
  const pos = (cy) => html.indexOf('href="' + cy + '/dernier.html"');
  assert.ok(pos('CI') < pos('ML') && pos('ML') < pos('GH'), 'pilote, puis rouge, puis jaune');
  assert.match(html, /class="ancien"><span class="lbl">du <\/span>12\/11\/2026/, 'un bulletin non réécrit ce jour-là se voit');
  assert.match(html, /aucune actualité/);
});

test('le pilote est annoncé seul, les autres en une seule ligne qui nomme les plus graves', () => {
  const r = [B.resumeBulletin(donnees('ML', { niveau: 'rouge', libelle: 'ROUGE' }), '2026-11-13'),
    B.resumeBulletin(donnees('GH'), '2026-11-13')];
  const m = B.messageResume(r, '2026-11-13');
  assert.strictEqual(m.text.split('\n').length, 2);
  assert.match(m.text, /2 bulletins pays du 13\/11\/2026 ; marron ou rouge : Mali \(ROUGE\)/);
  assert.match(m.text, /bulletins\/index\.html$/);
  assert.strictEqual(B.messageResume([], '2026-11-13'), null);
  assert.deepStrictEqual(B.PAYS_PILOTES, ['CI']);
});

test('le bulletin d\'un pays hors pilote renvoie à ses avis et à l\'index', () => {
  const html = B.rendre(donnees('NE'), { jour: '2026-11-13', genereMs: Date.UTC(2026, 10, 13, 7), serie: null });
  assert.match(html, /foreign-travel-advice\/niger"/);
  assert.match(html, /href="\.\.\/index\.html"/);
});

test('le job écrit tous les pays et met l\'index à jour', () => {
  const job = fs.readFileSync(path.join(__dirname, '..', 'collecte-planifiee.js'), 'utf8');
  assert.match(job, /for \(const cy of bulletin\.paysAEcrire\(\)\)/);
  assert.match(job, /bulletin\.mettreAJourIndex\(/);
  assert.doesNotMatch(job, /Object\.keys\(bulletin\.PAYS_BULLETIN\)/);
});

test('le module Rapports propose les bulletins des pays publiés', () => {
  const f = tranche('function chargerBulletinsPays(){', 'function updateDLCounts(){');
  assert.match(f, /bulletins\/index\.json/);
  assert.match(f, /\/dernier\.html/);
  assert.match(HTML, /function updateDLCounts\(\)\{\n  chargerRapportsAuto\(\);\n  chargerBulletinsPays\(\);/);
});
