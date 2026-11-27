#!/usr/bin/env node
'use strict';
// Écrit web/version.json au déploiement (Pages et Firebase) : la signature du
// code de SentiqS_Web.html (voir scripts/lib/signature-page.js) et l'heure du
// déploiement. Jamais commité : il décrit ce qui est servi, pas le dépôt.
const fs = require('fs');
const path = require('path');
const { signaturePage } = require('./lib/signature-page');
const web = path.join(__dirname, '..', 'web');
const html = fs.readFileSync(path.join(web, 'SentiqS_Web.html'), 'utf8');
const v = { signature: signaturePage(html), deploye: new Date().toISOString(), commit: process.env.GITHUB_SHA || null };
fs.writeFileSync(path.join(web, 'version.json'), JSON.stringify(v) + '\n');
console.log('version.json : ' + v.signature + ' (' + v.deploye + ')');
