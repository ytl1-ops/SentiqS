'use strict';
// Le sport hors de la Présentation 1, sauf impact avéré sur la sûreté
// (YORO, 27/11/2026). Vu échouer sur l'ancien code : « frappe fort » et
// « à l'assaut » passaient la garde générale, et une rixe de supporters
// classée « sport » disparaissait avec les matchs.
const test = require('node:test');
const assert = require('node:assert');
const { faitsDuMois } = require('../lib/faits-grsci');

function cumul(faits) {
  return { pays: { SN: faits.map((f, i) => Object.assign({ id: 'f' + i, date: '2026-11-1' + i, niveau: 'high', cat: 'divers', source: 'S' + i, url: 'https://ex.sn/' + i }, f)) } };
}
const titres = (c) => faitsDuMois(c, 'SN', 'Sénégal').map((g) => g.titre || (g.fait && g.fait.titre) || JSON.stringify(g));

test('un fait sportif sans impact sort du rapport, même avec un mot de la garde', () => {
  const t = titres(cumul([
    { titre: '37e Tour du Faso 2026 : Tom Wijfje frappe fort d’entrée', cat: 'securite', niveau: 'crit' },
    { titre: 'Football scolaire : 38 jeunes à l’assaut de la phase zonale de l’UFOA-A', cat: 'securite', niveau: 'crit' },
    { titre: 'CAN Beach Soccer Dakar 2026 : les Lions fixés sur leurs adversaires', cat: 'politique' },
  ]));
  assert.deepStrictEqual(t, []);
});

test('un fait sportif avec un impact avéré reste, même classé sport', () => {
  const t = titres(cumul([
    { titre: 'Fass Mbao : trois morts dans des affrontements entre supporters de lutteurs rivaux', cat: 'sport', niveau: 'crit' },
    { titre: 'Lutte : le Préfet de Dakar interdit la signature du combat Franc-Reug Reug', cat: 'politique' },
  ])).join(' / ');
  assert.match(t, /Fass Mbao/);
  assert.match(t, /Préfet de Dakar/);
});

test('« lutte contre », « course-poursuite » et les JOJ seuls ne font pas du sport', () => {
  const t = titres(cumul([
    { titre: 'Lutte contre l’orpaillage clandestin : saisies dans la région de Kédougou', cat: 'securite' },
    { titre: 'Insécurité à Richard-Toll : trois individus armés arrêtés après une course-poursuite', cat: 'securite' },
    { titre: 'Santé : l’alliance And Gueusseum décrète une trêve pour les JOJ 2026 et reporte sa grève', cat: 'humanitaire' },
  ]));
  assert.strictEqual(t.length, 3);
});
