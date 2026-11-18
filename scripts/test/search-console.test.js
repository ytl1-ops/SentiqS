// Vérification Search Console par le compte de service (18/11/2026).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const SC = require('../search-console.js');

const RACINE = path.join(__dirname, '..', '..');

test('les propriétaires ajoutés sont les administrateurs des règles Firestore, rien d\'autre', () => {
  const regles = fs.readFileSync(path.join(RACINE, 'firebase', 'firestore.rules'), 'utf8');
  const admins = SC.administrateurs(regles);
  assert.ok(admins.length >= 1, 'aucun administrateur lu dans les règles');
  for (const a of admins) assert.match(a, /^[^@\s]+@[^@\s]+\.[a-z]+$/);
  assert.deepEqual(SC.administrateurs('rules_version = "2";'), []);
  // Aucune adresse écrite dans le script lui-même.
  const src = fs.readFileSync(path.join(RACINE, 'scripts', 'search-console.js'), 'utf8');
  assert.ok(!/[a-z0-9._-]+@[a-z0-9-]+\.[a-z]{2,}/i.test(src.replace(/@\w+\.iam\.gserviceaccount/g, '')), 'adresse en dur');
});

test('le fichier de preuve a la forme que Google attend, et refuse un jeton suspect', () => {
  const f = SC.fichierVerification('google1a2b3c4d5e6f.html');
  assert.equal(f.nom, 'google1a2b3c4d5e6f.html');
  assert.equal(f.contenu, 'google-site-verification: google1a2b3c4d5e6f.html');
  for (const mauvais of ['../index.html', 'google12.html/../x', 'evil.html', 'googleXYZ.html']) {
    assert.throws(() => SC.fichierVerification(mauvais), /inattendu/);
  }
  assert.equal(SC.ADRESSE, 'https://sentiqs-235ce.web.app/');
});

test('le déploiement prépare le fichier avant de publier, et vérifie après', () => {
  const w = fs.readFileSync(path.join(RACINE, '.github', 'workflows', 'gh-pages-deploy.yml'), 'utf8');
  const prep = w.indexOf('search-console.js preparer');
  const dep = w.indexOf('firebase-tools@15.34.0 deploy');
  const ver = w.indexOf('search-console.js verifier');
  assert.ok(prep > 0 && prep < dep && dep < ver);
  assert.match(w.slice(w.lastIndexOf('- name:', ver), ver), /continue-on-error: true/);
});
