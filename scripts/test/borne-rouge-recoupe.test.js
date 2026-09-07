// Le point qui fait franchir le rouge ne peut pas venir d'un article seul.
//
// Collecte n° 851 du 07/09/2026 : Centrafrique, Niger et Ouganda sont passes
// au rouge sur un seul article eleve chacun — une fraude alimentaire a
// Bangui, un congres de medecine militaire a Niamey, un sermon de mariage sur
// les violences domestiques. Six pays ont un socle a un ou deux points du
// seuil (14) : n'importe quel article classe eleve par une source a 70 les
// faisait basculer, recoupe ou non. borneRougeVerifie ne jouait pas : le
// socle etait deja marron, c'est le cas qu'elle autorise.
//
// Arbitrage de l'editeur, le soir meme : le rouge automatique exige qu'au
// moins un des signaux du jour soit recoupe par une seconde source, ou classe
// critique (un critique n'entre dans getLiveAlertEvents que corrobore).
// Effet mesure sur le cache publie : rouge 8 -> 5, rien d'autre ne bouge.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { borneRougeRecoupe } = require('../../web/js/noyau.js');

const seul = (niveauArticle) => ({ live: true, niveauArticle, recoupe: false });
const recoupe = (niveauArticle) => ({ live: true, niveauArticle, recoupe: true });

test('un rouge porte par des articles seuls redescend au marron', () => {
  assert.strictEqual(borneRougeRecoupe('rouge', 'marron', [seul('high'), seul('high')]), 'marron');
  assert.strictEqual(borneRougeRecoupe('rouge', 'marron', [seul('mod')]), 'marron');
  assert.strictEqual(borneRougeRecoupe('rouge', 'marron', []), 'marron');
});

test('un article recoupe ou critique suffit a laisser passer le rouge', () => {
  assert.strictEqual(borneRougeRecoupe('rouge', 'marron', [seul('high'), recoupe('high')]), 'rouge');
  assert.strictEqual(borneRougeRecoupe('rouge', 'marron', [seul('crit')]), 'rouge');
});

test('un socle deja rouge n\'a rien a prouver, et rien ne bouge sous le rouge', () => {
  // Le dossier humain place le pays au rouge : la collecte n'y est pour rien.
  assert.strictEqual(borneRougeRecoupe('rouge', 'rouge', []), 'rouge');
  for (const k of ['vert', 'jaune', 'orange', 'marron']) {
    assert.strictEqual(borneRougeRecoupe(k, 'marron', []), k);
  }
});

test('la page branche la regle et transmet ce qu\'elle exige', () => {
  // Une regle du noyau que la page n'appelle pas ne protege personne ; et
  // sans les deux champs, tout signal live paraitrait seul (getLiveAlertEvents
  // marquait tout `verified: false` pour l'affichage).
  const html = fs.readFileSync(path.join(__dirname, '../../web/SentiqS_Web.html'), 'utf8');
  const i = html.indexOf('function calcAlertScore(');
  const j = html.indexOf('\nfunction ', i + 10);
  assert.match(html.slice(i, j), /borneRougeRecoupe\(/, 'calcAlertScore doit appliquer la regle');
  const g = html.indexOf('function getLiveAlertEvents(');
  const h = html.indexOf('\nfunction ', g + 10);
  const corps = html.slice(g, h > 0 ? h : undefined);
  assert.match(corps, /recoupe:/, 'chaque signal live doit dire s\'il est recoupe');
  assert.match(corps, /niveauArticle:/, 'chaque signal live doit garder le niveau de l\'article');
});
