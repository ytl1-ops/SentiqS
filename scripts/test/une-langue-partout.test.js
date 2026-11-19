'use strict';
// Une seule langue partout — 19/11/2026. YORO : « Tout type de rapport sera
// soit en FR soit en ENG selon le choix de langue », puis « pareil pour les
// paramètres et les autres modules. Boost le skill de traduction via GitHub. »
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { HTML, tranche, bac } = require('./_bac.js');
const RAC = path.join(__dirname, '..', '..');
const lire = (f) => fs.readFileSync(path.join(RAC, f), 'utf8');

test('Paramètres > Affichage propose la langue, branchée sur setLang', () => {
  const aff = HTML.slice(HTML.indexOf('id="pmAffichage"'), HTML.indexOf('id="pmAffichage"') + 4000);
  assert.match(aff, /class="aff-opt lang-opt" data-lang="fr"[^>]*onclick="setLang\('fr'\)"/);
  assert.match(aff, /class="aff-opt lang-opt" data-lang="en"[^>]*onclick="setLang\('en'\)"/);
  assert.match(tranche('function setLang(lang) {', 'document.documentElement.setAttribute'), /\.lang-opt'\)\.forEach\(b => b\.setAttribute\('aria-pressed'/);
});

test('les boîtes natives (alert, confirm) passent par la table en anglais', () => {
  const c = bac();
  global.window = global; require(path.join(RAC, 'web/js/langue.js')); require(path.join(RAC, 'web/js/dico-en.js'));
  c.SentiqLangue = global.SentiqLangue;
  vm.runInContext(tranche('function messageDialogue(m) {', 'if (typeof window !=='), c);
  c.LANG = 'en';
  assert.strictEqual(c.messageDialogue('Aperçu non disponible pour ce type de rapport.'), 'Preview not available for this type of report.');
  assert.strictEqual(c.messageDialogue('Erreur Word: docx is not defined'), 'Word error: docx is not defined');
  assert.strictEqual(c.messageDialogue('Reinitialiser toutes les donnees locales ? (articles, cache, preferences)\nLes comptes utilisateurs seront conserves.'),
    'Reset all local data? (articles, cache, preferences)\nUser accounts will be kept.');
  c.LANG = 'fr';
  assert.strictEqual(c.messageDialogue('Erreur Word: x'), 'Erreur Word: x');
  assert.match(HTML, /\['alert', 'confirm', 'prompt'\]\.forEach/);
});

test('aucun confirm ne garde « definitvement » ni une phrase française sans sa version anglaise', () => {
  assert.doesNotMatch(HTML, /definitvement/);
  assert.match(HTML, /'Permanently delete '/);
});

test('le passage de traduction seul reporte ses traductions et garde la date du cache', () => {
  const { reporterTraductions } = require(path.join(RAC, 'scripts/traduire-cache.js'));
  const { memoire } = require(path.join(RAC, 'scripts/lib/traduction-actus.js'));
  const traduits = [{ title: 'Attaque armée contre un convoi militaire', tr: { en: { t: 'Armed attack on a military convoy' } } }];
  const frais = [{ title: 'Attaque armée contre un convoi militaire' }, { title: 'Autre titre sans traduction' }];
  assert.strictEqual(reporterTraductions(frais, memoire(traduits)), 1);
  assert.strictEqual(frais[0].tr.en.t, 'Armed attack on a military convoy');
  assert.strictEqual(frais[1].tr, undefined);
  const src = lire('scripts/traduire-cache.js');
  assert.match(src, /ecrireCache\(compte, cible, fetch, \{ maintenant: date \}\)/, 'un cache traduit n\'est pas un cache plus frais');
  assert.match(src, /if \(!st\.traduits\)/, 'rien n\'est réécrit sans traduction nouvelle');
});

test('le workflow de traduction a son propre groupe : il ne remplace jamais une collecte en attente', () => {
  const w = lire('.github/workflows/traduction-actus.yml');
  assert.match(w, /group: traduction-actus/);
  assert.doesNotMatch(w, /group: collecte-planifiee/);
  assert.match(w, /node scripts\/traduire-cache\.js/);
});

test('la Présentation 1 reprend les traductions du job avant d\'appeler un service', () => {
  const src = lire('scripts/collecte-planifiee.js');
  assert.match(src, /memoireTraductions = memoireTraductionsActus\(fusionnes\)/);
  assert.match(src, /memoireTraductions\.get\(cleMemoireTraduction\('fr', f\.titre\)\)/);
});
