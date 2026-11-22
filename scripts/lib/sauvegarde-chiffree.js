// Sauvegarde chiffrée des données Firebase (22/11/2026).
//
// Demande de YORO : « je n'ai pas de serveur ». Les comptes, profils,
// paiements déclarés, validations d'analyste et bulletins programmés vivent
// dans Firestore, sur le plan gratuit, sans sauvegarde : une erreur de
// manipulation dans la console ou une suppression du projet les perdait.
//
// Le job hebdomadaire (sauvegarde-firebase.yml) les lit avec le compte de
// service et les dépose en artefact GitHub (90 jours). Le dépôt est PUBLIC :
// tout compte GitHub peut télécharger un artefact. D'où le chiffrement :
// AES-256-GCM avec une clé tirée au hasard, elle-même chiffrée (RSA-OAEP,
// SHA-256) par la clé publique du compte de service. Seul le détenteur du
// fichier JSON du compte de service (le secret FIREBASE_SERVICE_ACCOUNT, que
// YORO a téléchargé) peut relire une sauvegarde. Aucune clé de plus à créer.
// Garder ce fichier JSON : sans lui, les sauvegardes sont illisibles.
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const VERSION = 1;

function empreinte(clePublique) {
  const der = clePublique.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
}

/** objet → enveloppe JSON chiffrée (texte). */
function chiffrer(objet, clePrivee) {
  const pub = crypto.createPublicKey(clePrivee);
  const cle = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', cle, iv);
  const clair = zlib.gzipSync(Buffer.from(JSON.stringify(objet), 'utf8'));
  const donnees = Buffer.concat([c.update(clair), c.final()]);
  const enveloppe = crypto.publicEncrypt({ key: pub, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, cle);
  return JSON.stringify({
    format: 'sentiqs-sauvegarde', v: VERSION,
    cleCompte: empreinte(pub),
    cle: enveloppe.toString('base64'),
    iv: iv.toString('base64'),
    tag: c.getAuthTag().toString('base64'),
    donnees: donnees.toString('base64'),
  });
}

/** enveloppe (texte) → objet. Lève si la clé n'est pas la bonne. */
function dechiffrer(texte, clePrivee) {
  const e = JSON.parse(texte);
  if (!e || e.format !== 'sentiqs-sauvegarde') throw new Error('ce fichier n\'est pas une sauvegarde SentiqS');
  const pub = crypto.createPublicKey(clePrivee);
  if (e.cleCompte && e.cleCompte !== empreinte(pub)) {
    throw new Error('sauvegarde chiffrée pour un autre compte de service (' + e.cleCompte + ') : utilisez le fichier JSON en service à cette date');
  }
  const cle = crypto.privateDecrypt({ key: clePrivee, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(e.cle, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', cle, Buffer.from(e.iv, 'base64'));
  d.setAuthTag(Buffer.from(e.tag, 'base64'));
  const clair = Buffer.concat([d.update(Buffer.from(e.donnees, 'base64')), d.final()]);
  return JSON.parse(zlib.gunzipSync(clair).toString('utf8'));
}

module.exports = { chiffrer, dechiffrer, empreinte, VERSION };
