#!/usr/bin/env node
// Google Search Console sans navigateur (18/11/2026).
//
// YORO a demandé que la vérification du site soit faite à sa place. Aucun
// connecteur ne sait vérifier un site, et son Chrome n'était pas joignable.
// Le compte de service Firebase du projet (secret FIREBASE_SERVICE_ACCOUNT),
// qui publie déjà le site, prouve donc la propriété par l'API Site
// Verification, méthode FICHIER, puis :
//   - ajoute les administrateurs du projet (ceux de firebase/firestore.rules,
//     jamais une adresse écrite ici) comme propriétaires : la propriété
//     apparaît alors dans LEUR Search Console, sans autre geste ;
//   - déclare le site et son sitemap dans Search Console.
//
// Deux temps, autour de la publication Firebase (gh-pages-deploy.yml) :
//   node scripts/search-console.js preparer   écrit web/google<jeton>.html
//   node scripts/search-console.js verifier   après la publication
// Informatif : un refus de Google est expliqué dans le journal, jamais
// bloquant. Les API à activer (Site Verification, Search Console) le sont
// par le compte de service s'il en a le droit ; sinon le journal donne le
// lien d'activation.
'use strict';
const fs = require('fs');
const path = require('path');
const ecriture = require('./lib/cache-firestore-ecriture');
const { SITE } = require('./generer-seo.js');

const RACINE = path.join(__dirname, '..');
const ADRESSE = SITE + '/';
const PORTEE = ['https://www.googleapis.com/auth/siteverification',
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/cloud-platform'].join(' ');
const SERVICES = { siteVerification: 'siteverification.googleapis.com', searchConsole: 'searchconsole.googleapis.com' };

/** Adresses des administrateurs, lues dans les règles Firestore. */
function administrateurs(regles) {
  const m = String(regles).match(/function emailAdmin\(\)[\s\S]*?in \[([^\]]+)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/'([^'@\s]+@[^'\s]+)'/g)].map((x) => x[1]);
}

/** Nom et contenu du fichier de vérification que Google attend. */
function fichierVerification(jeton) {
  if (!/^google[0-9a-f]+\.html$/.test(jeton)) throw new Error('jeton de vérification inattendu : ' + jeton);
  return { nom: jeton, contenu: 'google-site-verification: ' + jeton };
}

async function appel(jeton, methode, url, corps) {
  const r = await fetch(url, {
    method: methode,
    headers: { authorization: 'Bearer ' + jeton, 'content-type': 'application/json' },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const texte = await r.text();
  let d = null; try { d = texte ? JSON.parse(texte) : {}; } catch (_) { d = { brut: texte.slice(0, 300) }; }
  return { ok: r.ok, status: r.status, d };
}

// Une API non activée répond 403 SERVICE_DISABLED : on tente de l'activer.
async function avecActivation(jeton, compte, service, faire) {
  let r = await faire();
  const desactivee = !r.ok && JSON.stringify(r.d).includes('SERVICE_DISABLED');
  if (!desactivee) return r;
  console.log('API ' + service + ' non activée sur le projet ' + compte.project_id + ' : tentative d\'activation…');
  const a = await appel(jeton, 'POST', 'https://serviceusage.googleapis.com/v1/projects/' + compte.project_id + '/services/' + service + ':enable');
  if (!a.ok) {
    console.log('✗ Activation refusée (HTTP ' + a.status + '). À activer une fois, d\'un clic :');
    console.log('  https://console.cloud.google.com/apis/library/' + service + '?project=' + compte.project_id);
    return r;
  }
  // L'activation met jusqu'à une minute à se propager.
  for (let i = 0; i < 6; i++) {
    await new Promise((ok) => setTimeout(ok, 10000));
    r = await faire();
    if (r.ok || !JSON.stringify(r.d).includes('SERVICE_DISABLED')) break;
  }
  return r;
}

async function preparer(compte, jeton) {
  const r = await avecActivation(jeton, compte, SERVICES.siteVerification, () => appel(jeton, 'POST',
    'https://www.googleapis.com/siteVerification/v1/token',
    { site: { type: 'SITE', identifier: ADRESSE }, verificationMethod: 'FILE' }));
  if (!r.ok) { console.log('✗ Jeton de vérification refusé (HTTP ' + r.status + ') : ' + JSON.stringify(r.d).slice(0, 300)); return false; }
  const f = fichierVerification(r.d.token);
  fs.writeFileSync(path.join(RACINE, 'web', f.nom), f.contenu);
  console.log('✓ Fichier de vérification prêt : web/' + f.nom);
  return true;
}

async function verifier(compte, jeton) {
  const v = await appel(jeton, 'POST', 'https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=FILE',
    { site: { type: 'SITE', identifier: ADRESSE } });
  if (!v.ok) { console.log('✗ Vérification refusée (HTTP ' + v.status + ') : ' + JSON.stringify(v.d).slice(0, 300)); return false; }
  console.log('✓ Site vérifié pour ' + compte.client_email);

  const admins = administrateurs(fs.readFileSync(path.join(RACINE, 'firebase', 'firestore.rules'), 'utf8'));
  const proprietaires = [...new Set([...(v.d.owners || []), compte.client_email, ...admins])];
  const p = await appel(jeton, 'PUT', 'https://www.googleapis.com/siteVerification/v1/webResource/' + encodeURIComponent(v.d.id),
    { id: v.d.id, site: v.d.site, owners: proprietaires });
  console.log(p.ok ? '✓ Propriétaires : ' + admins.length + ' administrateur(s) du projet ajouté(s)'
    : '✗ Ajout des propriétaires refusé (HTTP ' + p.status + ') : ' + JSON.stringify(p.d).slice(0, 300));

  const site = encodeURIComponent(ADRESSE);
  const s = await avecActivation(jeton, compte, SERVICES.searchConsole,
    () => appel(jeton, 'PUT', 'https://www.googleapis.com/webmasters/v3/sites/' + site));
  if (!s.ok) { console.log('✗ Ajout dans Search Console refusé (HTTP ' + s.status + ') : ' + JSON.stringify(s.d).slice(0, 300)); return false; }
  const sm = await appel(jeton, 'PUT', 'https://www.googleapis.com/webmasters/v3/sites/' + site + '/sitemaps/' + encodeURIComponent(SITE + '/sitemap.xml'));
  console.log(sm.ok ? '✓ Sitemap envoyé à Google : ' + SITE + '/sitemap.xml'
    : '✗ Envoi du sitemap refusé (HTTP ' + sm.status + ') : ' + JSON.stringify(sm.d).slice(0, 300));
  return sm.ok;
}

async function principal(etape) {
  const compte = ecriture.lireCompte(process.env.FIREBASE_SERVICE_ACCOUNT || '');
  if (!compte) { console.log('Secret FIREBASE_SERVICE_ACCOUNT absent : rien à faire.'); return; }
  let jeton;
  try { jeton = await ecriture.jetonAcces(compte, fetch, PORTEE); } catch (e) { console.log('✗ ' + e.message); return; }
  if (etape === 'preparer') await preparer(compte, jeton);
  else if (etape === 'verifier') await verifier(compte, jeton);
  else console.log('usage : node scripts/search-console.js preparer|verifier');
}

module.exports = { administrateurs, fichierVerification, ADRESSE };
if (require.main === module) principal(process.argv[2]).catch((e) => console.log('✗ ' + e.message));
