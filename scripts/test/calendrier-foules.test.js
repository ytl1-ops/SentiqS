// Calendrier des grands rassemblements et jours fériés officiels (14/11/2026).
const test = require('node:test');
const assert = require('node:assert');
const C = require('../../web/js/calendrier-foules.js');

test('Pâques suit le comput grégorien', () => {
  assert.strictEqual(new Date(C.paques(2026)).toISOString().slice(0, 10), '2026-04-05');
  assert.strictEqual(new Date(C.paques(2027)).toISOString().slice(0, 10), '2027-03-28');
});

test('les fêtes musulmanes sont calculées, et dites estimées', () => {
  const ev = C.evenementsCalendrier(Date.UTC(2027, 0, 1), Date.UTC(2027, 11, 31), { paysConnus: ['SN', 'CI', 'ML'] });
  const tab = ev.find((e) => /Tabaski/.test(e.title));
  assert.ok(tab, 'Tabaski 2027 présente');
  assert.strictEqual(tab.year + tab.month + tab.day, '2027Mai16');
  assert.ok(tab._estime && /date estimée/.test(tab.title));
  assert.ok(ev.some((e) => /Grand Magal de Touba/.test(e.title) && e._pays.join() === 'SN'));
  assert.ok(ev.some((e) => /Namugongo/.test(e.title) && e.day === '03' && e.month === 'Jun'));
});

test('une fête publiée comme jour férié officiel ne s\'affiche pas deux fois', () => {
  const feries = [{ cy: 'SN', date: '2027-05-16', titreEn: 'Tabaski', titre: 'Tabaski' }];
  const ev = C.evenementsCalendrier(Date.UTC(2027, 4, 10), Date.UTC(2027, 4, 20), { paysConnus: ['SN', 'CI'], feriesOfficiels: feries });
  const tab = ev.find((e) => /Tabaski/.test(e.title));
  assert.ok(!tab._pays.includes('SN'));
  assert.ok(tab._pays.includes('CI'));
});

test('le même jour férié dans plusieurs pays est une seule ligne', () => {
  const l = [
    { cy: 'CI', date: '2026-12-25', titreEn: 'Christmas Day', titre: 'Christmas Day' },
    { cy: 'SN', date: '2026-12-25', titreEn: 'Christmas Day', titre: 'Christmas Day' },
    { cy: 'GH', date: '2026-12-26', titreEn: 'Boxing Day', titre: 'Boxing Day' },
    { cy: 'KE', date: '2026-12-26', titreEn: "St. Stephen's Day", titre: "St. Stephen's Day" },
  ];
  const r = C.feriesVersAgenda(l, 'fr', (cy) => cy);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].title, 'Noël');
  assert.deepStrictEqual(r[0]._pays, ['CI', 'SN']);
  assert.strictEqual(r[0].cy, '2 pays');
  assert.strictEqual(r[1].title, 'Lendemain de Noël');
});

test('un nom de fête sans équivalent n\'est jamais une phrase anglaise seule en français', () => {
  assert.strictEqual(C.titreFerie({ titreEn: 'Jamhuri Day', titre: 'Jamhuri Day' }, 'fr'), 'Jour férié : Jamhuri Day');
  assert.strictEqual(C.titreFerie({ titreEn: 'Jamhuri Day', titre: 'Jamhuri Day' }, 'en'), 'Jamhuri Day');
});

test('aucun incident n\'entre par ces sources : ce sont des calendriers', () => {
  const ext = require('../../web/agenda/externe.json');
  assert.ok(Array.isArray(ext.evenements));
  ext.evenements.forEach((e) => {
    assert.strictEqual(e.nature, 'ferie');
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
  });
});
