'use strict';
// YORO, 14/11/2026 : « les conf sont incompréhensibles, à supprimer ».
// L'indice de confiance reste à l'écran (marqueConfiance) mais ne figure
// plus dans aucun document : exports Word / PDF / PowerPoint / aperçu
// imprimable, bulletin quotidien, index des bulletins, annonce sur le canal,
// bulletins programmés. La cotation des faits reste partout.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const bulletin = require('../lib/bulletin.js');
const message = require('../../web/js/bulletin-message.js');

const RACINE = path.join(__dirname, '..', '..');
const page = fs.readFileSync(path.join(RACINE, 'web', 'SentiqS_Web.html'), 'utf8');

const d = {
  cy: 'CI', nom: 'Côte d\'Ivoire', niveau: 'jaune', libelle: 'JAUNE', sous: 'Modéré',
  confiance: { cle: 'faible', libelle: 'faible', ageSocleJ: 140, motif: 'incident vérifié le plus récent : 140 jours' },
  faitsNotables: 1, fenetreH: 36,
  faits: [{ titre: 'Manifestation à Abidjan', source: 'AIP', url: 'https://aip.ci/x', pubMs: Date.UTC(2026, 10, 14, 6),
    cotation: { cle: 'probable', libelle: 'Probable' }, niveau: 'eleve' }],
  socle: [], facteurs: [], angleMort: { muet: false, horsAlerte: false, sourceUnique: false, sourcesAlerte: 3, socleAncien: true },
};

test('aucun générateur de document n\'appelle la ligne de confiance', () => {
  const appels = page.match(/texteConfianceRapport\(/g) || [];
  assert.strictEqual(appels.length, 1, 'seule la définition doit rester');
});

test('la confiance reste à l\'écran', () => {
  assert.ok((page.match(/marqueConfiance\(/g) || []).length >= 3);
});

test('le bulletin quotidien, son index et son annonce ne disent plus la confiance', () => {
  const html = bulletin.rendre(d, { jour: '2026-11-14', genereMs: Date.UTC(2026, 10, 14, 7), serie: null });
  assert.doesNotMatch(html, /[Cc]onfiance/);
  assert.match(html, /Probable/, 'la cotation reste');
  assert.doesNotMatch(bulletin.messageAnnonce(d, '2026-11-14').text, /confiance/i);
  const idx = { pays: { CI: bulletin.resumeBulletin(d, '2026-11-14', Date.now()) } };
  assert.doesNotMatch(bulletin.rendreIndex(idx), /[Cc]onfiance/);
});

test('le bulletin programmé ne dit plus la confiance, en français comme en anglais', () => {
  const pays = [{ cy: 'CI', nom: 'Côte d\'Ivoire', niveau: 'jaune', confiance: 'faible', faitsNotables: 1, confirmes: 0, fenetreH: 36,
    faits: [{ titre: 'Manifestation à Abidjan', cotation: 'probable', source: 'AIP' }] }];
  for (const langue of ['fr', 'en']) {
    const m = message.composerMessage(pays, { langue, creneauMs: Date.UTC(2026, 10, 14, 7) });
    assert.doesNotMatch(m.texte + m.html, /confian|confidence/i, langue);
  }
});
