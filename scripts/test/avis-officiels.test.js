// Avis officiel du FCDO, second témoin de la confiance (audit du 15/11/2026).
// 35 pays sur 54 étaient à confiance faible le 17/11/2026, presque tous sur un
// socle de plus de 90 jours sans signal du jour. Un avis récent et compatible
// corrobore le socle (faible → moyenne, jamais au-delà) ; un avis divergent
// laisse la confiance faible et le dit. Le niveau ne bouge dans aucun cas.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const noyau = require('../../web/js/noyau.js');
const lib = require('../lib/avis-officiels.js');
const { HTML } = require('./_bac.js');

const J = 86400000;
const MAINTENANT = Date.parse('2026-11-17T12:00:00Z');
const socleAncien = { dernierVerifieMs: MAINTENANT - 502 * J, maintenant: MAINTENANT, signauxDuJour: 0 };
const avisDu = (joursAvant, statuts) => ({ statuts, revu: new Date(MAINTENANT - joursAvant * J).toISOString() });

test('degré FCDO : le statut le plus sévère l\'emporte', () => {
  assert.strictEqual(noyau.degreAvisFcdo([]), 'aucun');
  assert.strictEqual(noyau.degreAvisFcdo(['avoid_all_but_essential_travel_to_parts']), 'aabe_partie');
  assert.strictEqual(noyau.degreAvisFcdo(['avoid_all_but_essential_travel_to_parts', 'avoid_all_travel_to_parts']), 'aat_partie');
  assert.strictEqual(noyau.degreAvisFcdo(['avoid_all_but_essential_travel_to_whole_country']), 'aabe_total');
  assert.strictEqual(noyau.degreAvisFcdo(['avoid_all_travel_to_whole_country', 'avoid_all_travel_to_parts']), 'aat_total');
});

test('un avis récent et compatible fait passer un socle ancien de faible à moyenne', () => {
  const sans = noyau.indiceConfiance({ ...socleAncien, niveau: 'orange' });
  assert.strictEqual(sans.cle, 'faible');
  const avec = noyau.indiceConfiance({ ...socleAncien, niveau: 'orange', avisOfficiel: avisDu(20, ['avoid_all_travel_to_parts']) });
  assert.strictEqual(avec.cle, 'moyenne');
  assert.match(avec.motif, /cohérent avec l'avis du FCDO revu il y a 20 jours/);
});

test('jamais au-delà de « moyenne » : un avis n\'est pas un fait daté', () => {
  const r = noyau.indiceConfiance({ dernierVerifieMs: MAINTENANT - 50 * J, maintenant: MAINTENANT, signauxDuJour: 0,
    niveau: 'rouge', avisOfficiel: avisDu(2, ['avoid_all_travel_to_whole_country']) });
  assert.strictEqual(r.cle, 'moyenne');
});

test('un avis divergent laisse la confiance faible et demande la relecture du socle', () => {
  // Pays affiché marron alors que le FCDO ne restreint rien.
  const r = noyau.indiceConfiance({ ...socleAncien, niveau: 'marron', avisOfficiel: avisDu(10, []) });
  assert.strictEqual(r.cle, 'faible');
  assert.match(r.motif, /avis du FCDO divergent \(aucune restriction\) : socle à relire/);
  // L'inverse : déconseillé en totalité, affiché jaune.
  assert.strictEqual(noyau.indiceConfiance({ ...socleAncien, niveau: 'jaune',
    avisOfficiel: avisDu(10, ['avoid_all_travel_to_whole_country']) }).cle, 'faible');
});

test('un avis trop ancien ou sans date ne témoigne de rien', () => {
  assert.strictEqual(noyau.indiceConfiance({ ...socleAncien, niveau: 'orange', avisOfficiel: avisDu(120, ['avoid_all_travel_to_parts']) }).cle, 'faible');
  assert.strictEqual(noyau.indiceConfiance({ ...socleAncien, niveau: 'orange', avisOfficiel: { statuts: [] } }).cle, 'faible');
});

test('l\'avis ne touche pas au niveau : calcAlertScore calcule la confiance après la clé', () => {
  const i = HTML.indexOf('const confiance = indiceConfiance({');
  assert.ok(i > HTML.indexOf('const key   = borneRougeRecoupe('), 'la confiance doit suivre la clé');
  assert.match(HTML.slice(i, i + 400), /niveau: key,\s*avisOfficiel: \(typeof avisOfficielPays === 'function'\) \? avisOfficielPays\(cy\) : null/);
});

test('lecture de l\'API gov.uk, et un pays muet garde son ancien avis', () => {
  const lu = lib.lireReponse({ public_updated_at: '2026-11-10T09:00:00Z',
    details: { alert_status: ['avoid_all_travel_to_parts'], reviewed_at: '2026-11-12T09:00:00Z' } }, 'mali');
  assert.deepStrictEqual(lu, { statuts: ['avoid_all_travel_to_parts'], revu: '2026-11-12T09:00:00Z',
    maj: '2026-11-10T09:00:00Z', url: 'https://www.gov.uk/foreign-travel-advice/mali' });
  assert.strictEqual(lib.lireReponse({ details: {} }, 'mali'), null);
  const pays = lib.fusionner({ pays: { LS: { statuts: [], revu: '2026-11-01' } } }, { ML: lu, LS: null });
  assert.deepStrictEqual(Object.keys(pays).sort(), ['LS', 'ML']);
  assert.strictEqual(lib.slugFcdo('https://www.gov.uk/foreign-travel-advice/the-gambia'), 'the-gambia');
});

test('la liste de relecture ne retient que les avis récents qui divergent', () => {
  const pays = { LS: avisDu(5, []), ML: avisDu(5, ['avoid_all_travel_to_whole_country']), BW: avisDu(200, []) };
  const inst = { pays: [{ code: 'LS', niveau: 'orange' }, { code: 'ML', niveau: 'rouge' }, { code: 'BW', niveau: 'marron' }] };
  assert.deepStrictEqual(lib.divergences(pays, inst, MAINTENANT).map((d) => d.code), ['LS']);
});

test('le job attend l\'avis avant d\'archiver la confiance', () => {
  const job = fs.readFileSync(path.join(__dirname, '..', 'collecte-planifiee.js'), 'utf8');
  const i = job.indexOf('chargerAvisOfficiels()');
  assert.ok(i > 0 && i < job.indexOf('const niveaux = await page.evaluate'));
});
