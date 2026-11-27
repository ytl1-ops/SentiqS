#!/usr/bin/env node
// Construit web/js/presentation-1.js : le générateur de la Présentation 1
// (scripts/lib/*-grsci.js), rendu chargeable par le navigateur pour composer
// un rapport filtré dans le module Rapports (25/11/2026).
//
// Pourquoi un fichier construit plutôt qu'une copie à la main : le rapport
// composé dans l'appli et celui du job doivent être LE MÊME code, sinon leurs
// pages divergent au premier correctif. Ce script les enveloppe tels quels ;
// scripts/test/presentation-filtres.test.js refuse un fichier servi qui ne
// correspond plus aux sources (« node scripts/construire-presentation-web.js »
// le remet à jour). Il n'y a pas d'étape de build pour web/ : le fichier
// construit est commité.
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const MODULES = ['hors-surete', 'faits-grsci', 'redaction-grsci', 'rapport-grsci', 'rapport-grsci-word'];
// Modules partagés avec la page (double export), lus hors de scripts/lib :
// la rédaction lit les repères de sûreté de web/js depuis le 26/11/2026.
const MODULES_WEB = ['reperes-surete'];
const cheminSource = (m) => MODULES_WEB.includes(m)
  ? path.join(RACINE, 'web', 'js', m + '.js')
  : path.join(RACINE, 'scripts', 'lib', m + '.js');
const SORTIE = path.join(RACINE, 'web', 'js', 'presentation-1.js');

// « Le terme GRSCI ne doit pas figurer dans l'appli » (YORO, 01/11/2026) :
// le nom historique des fichiers sources est remplacé dans le fichier servi,
// identifiants compris (remplacement uniforme, donc sans effet sur le code).
const sansSigle = (t) => t.replace(/GRSCI/g, 'P1').replace(/Grsci/g, 'P1').replace(/grsci/g, 'p1');

function construire() {
  const parties = [...MODULES_WEB, ...MODULES].map((m) => {
    const src = sansSigle(fs.readFileSync(cheminSource(m), 'utf8').replace(/^#!.*\n/, ''));
    return '  definir(' + JSON.stringify('./' + sansSigle(m)) + ', function (module, exports, require, __dirname) {\n' + src + '\n  });\n';
  });
  return '// FICHIER CONSTRUIT — ne pas modifier : node scripts/construire-presentation-web.js\n'
    + '// Sources : le générateur de la Présentation 1 du job (scripts/lib), ' + (MODULES.length + MODULES_WEB.length) + ' modules.\n'
    + '(function (racine) {\n'
    + '  \'use strict\';\n'
    + '  const defs = {}; const faits = {};\n'
    + '  // Le navigateur n\'a ni disque ni chemins : le générateur n\'y lit que ce\n'
    + '  // qu\'on lui donne (images du modèle par utiliserRessources, émetteur et\n'
    + '  // logo dans les données). Une lecture de fichier y est une erreur.\n'
    + '  const fsNav = { readFileSync() { throw new Error(\'fichier indisponible dans le navigateur\'); }, existsSync() { return false; }, writeFileSync() { throw new Error(\'écriture indisponible dans le navigateur\'); }, mkdirSync() {}, readdirSync() { return []; }, statSync() { throw new Error(\'indisponible\'); } };\n'
    + '  const pathNav = { join: (...p) => p.join(\'/\').replace(/\\/+/g, \'/\'), resolve: (...p) => p.join(\'/\').replace(/\\/+/g, \'/\'), dirname: (p) => String(p).replace(/\\/[^/]*$/, \'\') || \'/\', basename: (p) => String(p).replace(/^.*\\//, \'\') };\n'
    + '  function definir(nom, f) { defs[nom] = f; }\n'
    + '  function exiger(nom) {\n'
    + '    if (nom === \'node:fs\' || nom === \'fs\') return fsNav;\n'
    + '    if (nom === \'node:path\' || nom === \'path\') return pathNav;\n'
    + '    const k = \'./\' + nom.replace(/^.*\\//, \'\').replace(/\\.js$/, \'\');\n'
    + '    if (faits[k]) return faits[k].exports;\n'
    + '    if (!defs[k]) throw new Error(\'module absent : \' + nom);\n'
    + '    const m = faits[k] = { exports: {} };\n'
    + '    defs[k](m, m.exports, exiger, \'/lib\');\n'
    + '    return m.exports;\n'
    + '  }\n'
    + parties.join('')
    + '  racine.SentiqPresentation1 = { faits: exiger(\'./faits-p1\'), redaction: exiger(\'./redaction-p1\'), rapport: exiger(\'./rapport-p1\'), word: exiger(\'./rapport-p1-word\') };\n'
    + '}(typeof self !== \'undefined\' ? self : this));\n';
}

if (require.main === module) {
  fs.writeFileSync(SORTIE, construire());
  console.log('Écrit : ' + path.relative(RACINE, SORTIE));
}
module.exports = { construire, SORTIE };
