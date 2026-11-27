'use strict';
// Les crons des passages annexes sont étranglés par GitHub (27/11/2026 :
// agent 2 passages en 24 h, traduction 1, avis officiels et agenda aucun
// depuis le 26/11). Le job « relance » de la collecte les redemande.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const wf = fs.readFileSync(path.join(__dirname, '../../.github/workflows/collecte-planifiee.yml'), 'utf8');
const relance = wf.slice(wf.indexOf('\n  relance:'), wf.indexOf('\n  alerte:'));

test('la relance redemande la traduction et l\'agent à chaque passage', () => {
  assert.ok(relance.length > 200, 'job relance introuvable');
  for (const f of ['traduction-actus.yml', 'agent-recherche.yml']) {
    assert.match(relance, new RegExp('for wf in [^\\n]*' + f.replace('.', '\\.')), f);
  }
  // Avant l'attente : le cache est frais juste après la collecte.
  assert.ok(relance.indexOf('traduction-actus.yml') < relance.indexOf('sleep'), 'demandées avant l\'attente');
});

test('les passages quotidiens sont redemandés une fois par jour seulement', () => {
  assert.match(relance, /for wf in avis-officiels\.yml sources-agenda\.yml/);
  assert.match(relance, /created=%3E%3D\$jour/);
  assert.match(relance, /conclusion == "success"/);
});

test('chaque passage annexe accepte workflow_dispatch', () => {
  for (const f of ['traduction-actus', 'agent-recherche', 'avis-officiels', 'sources-agenda']) {
    const y = fs.readFileSync(path.join(__dirname, '../../.github/workflows/' + f + '.yml'), 'utf8');
    assert.match(y, /^\s*workflow_dispatch:/m, f);
  }
});
