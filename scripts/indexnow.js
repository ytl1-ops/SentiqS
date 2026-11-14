#!/usr/bin/env node
// IndexNow (14/11/2026) : prévient Bing, Yandex, Seznam, Naver… qu'une page
// publique a changé, au lieu d'attendre leur prochain passage. Lancé après
// chaque publication Firebase (gh-pages-deploy.yml). Google n'utilise pas
// IndexNow : pour lui, c'est le sitemap déclaré dans la Search Console.
//
// La clé est publique par construction (fichier web/<clé>.txt, que le moteur
// relit pour vérifier que l'envoi vient bien du propriétaire du site).
// N'envoie que les pages changées aujourd'hui (bulletins réécrits) plus
// l'accueil FR/EN : renvoyer chaque fois les 68 adresses serait du bruit.
// Informatif : un échec réseau ne fait jamais échouer le déploiement.
'use strict';
const fs = require('fs');
const path = require('path');
const { SITE } = require('./generer-seo.js');

const WEB = path.join(__dirname, '..', 'web');

function cle() {
  const f = fs.readdirSync(WEB).find((n) => /^[0-9a-f]{32}\.txt$/.test(n));
  if (!f) throw new Error('fichier de clé IndexNow introuvable dans web/');
  const k = fs.readFileSync(path.join(WEB, f), 'utf8').trim();
  if (k + '.txt' !== f) throw new Error('le fichier ' + f + ' ne contient pas sa propre clé');
  return k;
}

function adressesDuJour(xml, jour) {
  const urls = [SITE + '/', SITE + '/en.html'];
  const re = /<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/g;
  let m;
  while ((m = re.exec(xml))) if (m[2] === jour && !urls.includes(m[1])) urls.push(m[1]);
  return urls;
}

async function principal() {
  const k = cle();
  const xml = fs.readFileSync(path.join(WEB, 'sitemap.xml'), 'utf8');
  const urlList = adressesDuJour(xml, new Date().toISOString().slice(0, 10));
  const corps = { host: new URL(SITE).host, key: k, keyLocation: SITE + '/' + k + '.txt', urlList };
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(corps),
    });
    console.log('IndexNow : ' + urlList.length + ' adresse(s), réponse ' + r.status
      + (r.status === 403 ? ' (clé pas encore lisible sur le site : normal au tout premier déploiement)' : ''));
  } catch (e) {
    console.log('IndexNow injoignable : ' + e.message);
  }
}

module.exports = { adressesDuJour, cle };
if (require.main === module) principal();
