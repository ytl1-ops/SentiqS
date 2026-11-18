// Plusieurs témoins officiels pour la confiance (18/11/2026). Demande de
// YORO : « passer la confiance à 54 pays ». Le FCDO seul laissait 14 pays à
// confiance faible, dont cinq que Londres n'avait pas revus depuis 342 jours.
// Les avis du Canada et des États-Unis sont deux témoins de plus, avec la même
// règle : récent (90 jours), compatible, jamais au-delà de « moyenne », et le
// niveau ne bouge pas. Deux administrations qui se contredisent laissent le
// socle à relire.
const test = require('node:test');
const assert = require('node:assert');
const noyau = require('../../web/js/noyau.js');
const lib = require('../lib/avis-officiels.js');

const J = 86400000;
const MAINTENANT = Date.parse('2026-11-18T12:00:00Z');
const socleAncien = { dernierVerifieMs: MAINTENANT - 342 * J, maintenant: MAINTENANT, signauxDuJour: 0 };
const il = (j) => new Date(MAINTENANT - j * J).toISOString();
const fcdoAncien = { statuts: [], revu: il(342) };

test('un avis canadien récent et compatible corrobore un socle que le FCDO n\'a pas revu', () => {
  const sans = noyau.indiceConfiance({ ...socleAncien, niveau: 'orange', avisOfficiel: fcdoAncien });
  assert.strictEqual(sans.cle, 'faible');
  const avec = noyau.indiceConfiance({ ...socleAncien, niveau: 'orange',
    avisOfficiel: { ...fcdoAncien, temoins: [{ source: 'Canada', degre: 'prudence', revu: il(12) }] } });
  assert.strictEqual(avec.cle, 'moyenne');
  assert.match(avec.motif, /cohérent avec l'avis du Canada revu il y a 12 jours \(grande prudence\)/);
});

test('jamais au-delà de « moyenne », même avec trois témoins d\'accord', () => {
  const r = noyau.indiceConfiance({ dernierVerifieMs: MAINTENANT - 10 * J, maintenant: MAINTENANT, signauxDuJour: 0, niveau: 'rouge',
    avisOfficiel: { statuts: ['avoid_all_travel_to_whole_country'], revu: il(3),
      temoins: [{ source: 'Canada', degre: 'aat_total', revu: il(3) }, { source: 'États-Unis', degre: 'aat_total', revu: il(3) }] } });
  assert.strictEqual(r.cle, 'moyenne');
});

test('deux administrations qui se contredisent laissent le socle à relire', () => {
  // FCDO compatible, Canada divergent : égalité, la confiance reste faible.
  const r = noyau.indiceConfiance({ ...socleAncien, niveau: 'marron',
    avisOfficiel: { statuts: ['avoid_all_travel_to_parts'], revu: il(5), temoins: [{ source: 'Canada', degre: 'aucun', revu: il(5) }] } });
  assert.strictEqual(r.cle, 'faible');
  assert.match(r.motif, /avis du Canada divergent \(aucune restriction\) : socle à relire/);
  // Deux pour, un contre : corroboré, mais la divergence reste écrite.
  const m = noyau.indiceConfiance({ ...socleAncien, niveau: 'marron',
    avisOfficiel: { statuts: ['avoid_all_travel_to_parts'], revu: il(5),
      temoins: [{ source: 'Canada', degre: 'aucun', revu: il(5) }, { source: 'États-Unis', degre: 'aabe_total', revu: il(5) }] } });
  assert.strictEqual(m.cle, 'moyenne');
  assert.match(m.motif, /avis du Canada divergent/);
  assert.doesNotMatch(m.motif, /socle à relire/);
});

test('un témoin trop ancien, sans date ou de degré inconnu ne compte pas', () => {
  const o = (t) => noyau.indiceConfiance({ ...socleAncien, niveau: 'orange', avisOfficiel: { ...fcdoAncien, temoins: [t] } }).cle;
  assert.strictEqual(o({ source: 'Canada', degre: 'prudence', revu: il(120) }), 'faible');
  assert.strictEqual(o({ source: 'Canada', degre: 'prudence' }), 'faible');
  assert.strictEqual(o({ source: 'Canada', degre: 'inconnu', revu: il(2) }), 'faible');
});

test('le niveau ne dépend pas des témoins : indiceConfiance ne renvoie aucune clé de niveau', () => {
  const r = noyau.indiceConfiance({ ...socleAncien, niveau: 'rouge', avisOfficiel: { ...fcdoAncien, temoins: [{ source: 'Canada', degre: 'aucun', revu: il(1) }] } });
  assert.ok(!('niveau' in r) && !('key' in r));
});

test('degrés canadiens et américains', () => {
  assert.strictEqual(lib.degreAvisCanada(0, false), 'aucun');
  assert.strictEqual(lib.degreAvisCanada(0, true), 'aat_partie');
  assert.strictEqual(lib.degreAvisCanada(1, false), 'prudence');
  assert.strictEqual(lib.degreAvisCanada(1, true), 'prudence_partie');
  assert.strictEqual(lib.degreAvisCanada(2, false), 'aabe_total');
  assert.strictEqual(lib.degreAvisCanada(3, true), 'aat_total');
  assert.strictEqual(lib.degreAvisCanada('x', false), null);
  assert.deepStrictEqual([1, 2, 3, 4, 5].map(lib.degreAvisUsa), ['aucun', 'prudence_partie', 'aabe_total', 'aat_total', null]);
  Object.values({ a: lib.degreAvisCanada(1, true), b: lib.degreAvisUsa(2) }).forEach((d) => assert.ok(noyau.AVIS_COMPATIBLE[d] && noyau.AVIS_LIBELLES[d]));
});

test('lecture du fichier canadien et du flux américain', () => {
  const ca = lib.lireCanada({ data: { LS: { 'advisory-state': 1, 'has-regional-advisory': 0,
    'date-published': { timestamp: 1789000000, date: '2026-09-10 00:26:40' }, eng: { 'url-slug': 'lesotho' } }, XX: {} } }, ['LS', 'GQ']);
  assert.deepStrictEqual(ca, { LS: { source: 'Canada', degre: 'prudence', revu: '2026-09-10T00:26:40.000Z', url: 'https://travel.gc.ca/destinations/lesotho' } });
  assert.deepStrictEqual(lib.lireCanada({ data: { LS: { 'advisory-state': 1, 'date-published': { date: '2026-09-10 00:26:40' } } } }, ['LS']).LS.revu, '2026-09-10T00:26:40.000Z');
  assert.deepStrictEqual(lib.lireCanada(null, ['LS']), {});
  const xml = '<rss><channel><item><title><![CDATA[Equatorial Guinea - Level 1: Exercise Normal Precautions]]></title>'
    + '<link>https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/equatorial-guinea-travel-advisory.html</link>'
    + '<pubDate>Mon, 02 Nov 2026 00:00:00 GMT</pubDate></item><item><title>Peru - Level 2</title>'
    + '<link>https://travel.state.gov/x/traveladvisories/peru-travel-advisory.html</link><pubDate>Mon, 02 Nov 2026</pubDate></item></channel></rss>';
  const us = lib.lireUsa(xml, { GQ: 'equatorial-guinea' });
  assert.deepStrictEqual(Object.keys(us), ['GQ']);
  assert.strictEqual(us.GQ.degre, 'aucun');
  assert.strictEqual(us.GQ.revu, '2026-11-02T00:00:00.000Z');
});

test('une source muette garde ses témoins précédents', () => {
  const pays = { LS: { statuts: [], revu: il(342) }, GQ: { statuts: [], revu: il(342) } };
  const ancien = { LS: { temoins: [{ source: 'États-Unis', degre: 'aucun', revu: il(30) }] } };
  lib.attacherTemoins(pays, ancien, { Canada: { LS: { source: 'Canada', degre: 'prudence', revu: il(3) } }, 'États-Unis': {} });
  assert.deepStrictEqual(pays.LS.temoins.map((t) => t.source), ['Canada', 'États-Unis']);
  assert.ok(!pays.GQ.temoins);
});

test('la liste de relecture nomme la source qui diverge', () => {
  const pays = { MG: { statuts: [], revu: il(2), temoins: [{ source: 'Canada', degre: 'prudence', revu: il(2) }] } };
  const d = lib.divergences(pays, { pays: [{ code: 'MG', niveau: 'marron' }] }, MAINTENANT);
  assert.deepStrictEqual(d.map((x) => x.source), ['FCDO']);
});

test('flux américain sans lien reconnu : le pays se lit dans le titre', () => {
  const xml = '<item><title>Cote d&#39;Ivoire - Level 2: Exercise Increased Caution</title><pubDate>Mon, 02 Nov 2026 00:00:00 GMT</pubDate></item>'
    + '<item><title>The Gambia - Level 1: Exercise Normal Precautions</title><pubDate>Mon, 02 Nov 2026 00:00:00 GMT</pubDate></item>';
  assert.deepStrictEqual(Object.keys(lib.lireUsa(xml, { CI: 'cote-d-ivoire', GM: 'the-gambia' })).sort(), ['CI', 'GM']);
});

test('« grande prudence » n\'est pas incompatible avec un pays vert', () => {
  // Botswana, 18/11/2026 : Canada « grande prudence » (délinquance), FCDO
  // sans restriction, affiché vert. Ce n'est pas une divergence.
  assert.ok(noyau.AVIS_COMPATIBLE.prudence.includes('vert'));
  const r = noyau.indiceConfiance({ ...socleAncien, niveau: 'vert',
    avisOfficiel: { statuts: [], revu: il(5), temoins: [{ source: 'Canada', degre: 'prudence', revu: il(35) }] } });
  assert.strictEqual(r.cle, 'moyenne');
  assert.doesNotMatch(r.motif, /divergent/);
});
