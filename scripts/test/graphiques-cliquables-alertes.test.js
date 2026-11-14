// Fiches d'alerte : la jauge de score et ses chiffres mènent aux données
// qu'ils résument (demande de YORO du 14/11/2026, « les graphiques doivent
// être des boutons cliquables »). Gardes vues échouer sur l'ancien code.
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche, bac } = require('./_bac');

const CARTE = tranche('async function renderAlertCard(score)', '// ════');

test('la jauge de score de chaque fiche est un bouton vers la fiche du pays', () => {
  const m = CARTE.match(/<div class="al-jauge"[^>]*>/);
  assert.ok(m, 'jauge absente ou sans classe al-jauge');
  assert.match(m[0], /role="button"/);
  assert.match(m[0], /tabindex="0"/);
  assert.match(m[0], /onclick="ouvrirVuePays\('\$\{score\.cy\}'\)"/);
  assert.match(m[0], /aria-label="/);
});

test('« Incidents : N » ouvre la chronologie du pays, « Aggravants » et « Total » sa fiche', () => {
  assert.match(CARTE, /data-filtre="alinc:\$\{score\.cy\}"[^>]*>Incidents/);
  assert.match(CARTE, /data-filtre="pays:\$\{score\.cy\}"[^>]*>Aggravants/);
  assert.match(CARTE, /data-filtre="pays:\$\{score\.cy\}"[^>]*>Total/);
});

test('allerIncidentsPays bascule sur la chronologie filtrée sur le pays', () => {
  const src = tranche('function allerIncidentsPays(cy)', '\n}\n') + '\n}\n';
  const c = bac(src);
  const appels = [];
  c.fermerAlertePleinEcran = () => appels.push('fermer');
  c.moduleAffiche = (v) => v === 'dashboard';
  c.switchView = (v) => appels.push('vue:' + v);
  c.setAlerteVue = (v) => appels.push('alvue:' + v);
  c.setChronoCy = (cy) => appels.push('cy:' + cy);
  c.document = { querySelector: () => null, getElementById: () => ({ scrollIntoView: () => appels.push('defile') }) };
  c.allerIncidentsPays('ML');
  assert.deepStrictEqual(Array.from(appels), ['fermer', 'vue:alertes', 'alvue:chrono', 'cy:ML', 'defile']);
});

test('la pastille alinc: est reconnue par actionPastille', () => {
  const src = tranche('function actionPastille(', '\n}\n');
  assert.match(src, /alinc/);
  assert.match(src, /allerIncidentsPays/);
});

test('la zone de clic de la jauge atteint 24 px sans grossir la fiche', () => {
  assert.match(HTML, /\.al-jauge\{position:relative;height:5px;[^}]*cursor:pointer/);
  assert.match(HTML, /\.al-jauge::after\{content:'';position:absolute;inset:-10px 0\}/);
});
