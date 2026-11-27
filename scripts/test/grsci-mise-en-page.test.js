// Mise en page de la Présentation 1, relue page par page le 14/11/2026
// (« les rendus doivent être agencés comme après un traitement de texte par
// un expert ») : sommaire qui débordait, titre long qui chevauchait le
// contexte, « Cotation : Non confirmé » coupé en fin de ligne, titres en
// capitales au milieu de titres en casse de phrase.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const redaction = require('../lib/redaction-grsci.js');

const src = fs.readFileSync(path.join(__dirname, '../lib/rapport-grsci.js'), 'utf8');
const srcWord = fs.readFileSync(path.join(__dirname, '../lib/rapport-grsci-word.js'), 'utf8');

test('un titre tout en capitales est ramené en casse de phrase, noms propres et sigles gardés', () => {
  const t = redaction.phraseDe({
    titre: "MALI : LE BILAN HUMAIN S'ALOURDIT À NEUF MORTS PARMI LES ORPAILLEURS REFOULÉS DE GUINÉE",
    resume: "Le bilan de la traque des orpailleurs en Haute Guinée s'est alourdi, selon Mali 24.",
  });
  assert.strictEqual(t, "Mali : le bilan humain s'alourdit à neuf morts parmi les orpailleurs refoulés de Guinée");
  assert.strictEqual(redaction.phraseDe({ titre: "ATTAQUE À KIDAL : L'ONU RÉAGIT", resume: 'À Kidal, hier.' }), "Attaque à Kidal : l'ONU réagit");
  // Un titre déjà en casse de phrase n'est pas touché.
  assert.strictEqual(redaction.phraseDe({ titre: 'Le Mali et la CEDEAO', resume: '' }), 'Le Mali et la CEDEAO');
});

test('le sommaire est en casse de phrase, coupé au mot, et borné en lignes', () => {
  assert.match(src, /const LIGNES_SOMMAIRE = \d+/);
  assert.match(src, /const t = marque \+ redaction\.phraseDe\(f\);\n\s+return t\.length > 72/);
  // Le Word lit les mêmes cadres que le PowerPoint depuis le 25/11/2026.
  assert.match(srcWord, /g\.cadresSommaire\(P\)/);
  assert.doesNotMatch(srcWord, /court\(g\.titreDeFait\(f\)\)/);
});

test('« Cotation : … » ne se coupe jamais en fin de ligne', () => {
  assert.match(src, /non_confirme: 'Non\\u00a0confirmé'/);
  assert.match(src, /const COTATION_LIB = 'Cotation\\u00a0:\\u00a0'/);
  assert.doesNotMatch(src, /'   ·   Cotation : '/);
});

test('le cadre du titre d\'un fait rédigé grandit avec sa longueur', () => {
  assert.match(src, /const hTitre = lignesTitre \* tailleTitre \* 1\.2 \/ 72/);
  assert.match(src, /y \+= hTitre/);
});
