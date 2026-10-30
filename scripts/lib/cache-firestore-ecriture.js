// Écriture du cache d'actus partagé sur Firestore, par le job de collecte.
//
// Pas de dépendance (firebase-admin pèse plus de 100 Mo pour trois appels) :
// le compte de service signe un JWT (RS256, module crypto de Node), l'échange
// contre un jeton OAuth2, puis l'API REST de Firestore reçoit les documents.
// Un compte de service passe par IAM et n'est donc pas soumis aux règles
// Firestore : c'est ce qui permet de garder `allow write: if false` pour tous
// les navigateurs (firebase/firestore.rules).
//
// Le format (annonce + morceaux gzip/base64 sur deux emplacements) est décrit
// dans web/js/cache-firestore.js, qui porte aussi la lecture.
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const commun = require('../../web/js/cache-firestore.js');

const URL_JETON = 'https://oauth2.googleapis.com/token';
const PORTEE = 'https://www.googleapis.com/auth/datastore';

function b64url(x) {
  return Buffer.from(x).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Le secret GitHub contient le JSON du compte de service ; on accepte aussi
// ce même JSON encodé en base64 (certains copier-coller préfèrent une ligne).
function lireCompte(brut) {
  const texte = String(brut || '').trim();
  if (!texte) return null;
  let j = null;
  try { j = JSON.parse(texte); } catch (_) {
    try { j = JSON.parse(Buffer.from(texte, 'base64').toString('utf8')); } catch (__) { j = null; }
  }
  if (!j || typeof j.client_email !== 'string' || typeof j.private_key !== 'string' || !j.project_id) return null;
  return { client_email: j.client_email, private_key: j.private_key, project_id: j.project_id };
}

function signerJwt(compte, maintenantS) {
  const iat = maintenantS || Math.floor(Date.now() / 1000);
  const corps = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.'
    + b64url(JSON.stringify({ iss: compte.client_email, scope: PORTEE, aud: URL_JETON, iat, exp: iat + 3600 }));
  const signature = crypto.createSign('RSA-SHA256').update(corps).sign(compte.private_key);
  return corps + '.' + b64url(signature);
}

async function jetonAcces(compte, fetchFn) {
  const r = await fetchFn(URL_JETON, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')
      + '&assertion=' + encodeURIComponent(signerJwt(compte)),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d || !d.access_token) {
    throw new Error('jeton Google refusé (HTTP ' + r.status + (d && d.error ? ' ' + d.error : '') + ')');
  }
  return d.access_token;
}

function encoder(articles) {
  return zlib.gzipSync(Buffer.from(JSON.stringify(articles), 'utf8'), { level: 9 }).toString('base64');
}

async function ecrireDocument(cfg, fetchFn, jeton, id, champs) {
  const r = await fetchFn(commun.racine(cfg) + '/' + id, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + jeton },
    body: JSON.stringify({ fields: champs }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => null);
    throw new Error('écriture de ' + id + ' refusée (HTTP ' + r.status + (d && d.error && d.error.message ? ' : ' + d.error.message : '') + ')');
  }
}

// Lecture authentifiée : le job relit le cache qu'il s'apprête à remplacer
// pour le fusionner, sans dépendre de la lecture publique.
async function lireCache(compte, fetchFn, options) {
  const o = options || {};
  const jeton = o.jeton || await jetonAcces(compte, fetchFn);
  const cfg = { projectId: compte.project_id, apiKey: '' };
  // Avec un jeton, la clé d'API n'est pas requise : on la retire de l'adresse.
  const lire = (url) => fetchFn(url.replace(/\?key=$/, ''), { headers: { Authorization: 'Bearer ' + jeton } });
  const enveloppe = (url, entetes) => lire(url);
  const annonce = await commun.lireAnnonce(cfg, enveloppe);
  if (!annonce) return null;
  const b64 = await commun.lireMorceaux(cfg, enveloppe, annonce);
  const articles = await commun.decoder(b64);
  return { articles: Array.isArray(articles) ? articles : [], updated_at: annonce.updated_at, annonce };
}

// Publie `articles`. Remplit l'emplacement non annoncé, puis bascule
// l'annonce : l'annonce est écrite en DERNIER, un échec en route laisse donc
// l'ancien cache intact et lisible.
async function ecrireCache(compte, articles, fetchFn, options) {
  const o = options || {};
  const jeton = o.jeton || await jetonAcces(compte, fetchFn);
  const cfg = { projectId: compte.project_id };
  let courant = null;
  try {
    const a = await commun.lireAnnonce({ projectId: compte.project_id, apiKey: '' }, (url) =>
      fetchFn(url.replace(/\?key=$/, ''), { headers: { Authorization: 'Bearer ' + jeton } }));
    courant = a && a.emplacement;
  } catch (_) { courant = null; }
  const emplacement = courant === 'a' ? 'b' : 'a';
  const b64 = encoder(articles);
  const morceaux = commun.decouper(b64);
  for (let n = 0; n < morceaux.length; n++) {
    await ecrireDocument(cfg, fetchFn, jeton, commun.idPartie(emplacement, n), { d: { stringValue: morceaux[n] } });
  }
  const maintenant = (o.maintenant ? new Date(o.maintenant) : new Date()).toISOString();
  await ecrireDocument(cfg, fetchFn, jeton, commun.ID_ANNONCE, {
    updated_at: { stringValue: maintenant },
    parts: { integerValue: String(morceaux.length) },
    emplacement: { stringValue: emplacement },
    nb: { integerValue: String(articles.length) },
  });
  return { ok: true, nbArticles: articles.length, parts: morceaux.length, octets: b64.length, emplacement, updated_at: maintenant };
}

module.exports = { lireCompte, signerJwt, jetonAcces, encoder, ecrireCache, lireCache, ecrireDocument };
