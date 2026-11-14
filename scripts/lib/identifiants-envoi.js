// Identifiants d'envoi « apportez votre propre compte », côté job (14/11/2026).
//
// La page chiffre le jeton Meta ou le mot de passe SMTP de l'utilisateur avec la clé PUBLIQUE du
// compte de service (web/js/identifiants-envoi.js) ; ce module la publie et
// relit le secret avec la clé PRIVÉE, qui ne vit que dans le secret GitHub
// FIREBASE_SERVICE_ACCOUNT. Aucune clé de plus à créer, aucun coût.
//
// Ce qui ne doit jamais arriver, et que les tests exigent :
//   · le secret en clair dans un journal, un message d'erreur ou un document
//     Firestore (`nettoyer` le retire de tout texte qui sort d'ici) ;
//   · un envoi avec un document illisible : il devient l'état « à ressaisir »,
//     jamais un envoi au hasard.
const crypto = require('node:crypto');
const W = require('../../web/js/identifiants-envoi.js');

/** Clé publique (PEM SPKI) dérivée de la clé privée du compte de service. */
function clePublique(privatePem) {
  return crypto.createPublicKey(privatePem).export({ type: 'spki', format: 'pem' }).toString();
}

/** Empreinte courte de la clé publique : dit à la page si son chiffré est encore lisible. */
function empreinte(pem) { return crypto.createHash('sha256').update(String(pem)).digest('hex').slice(0, 16); }

/** Relit le jeton chiffré par la page. Lève une erreur générique si illisible. */
function dechiffrer(chiffre, privatePem) {
  try {
    const cle = crypto.privateDecrypt({ key: privatePem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(String(chiffre.cle), 'base64'));
    const tout = Buffer.from(String(chiffre.donnees), 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', cle, Buffer.from(String(chiffre.iv), 'base64'));
    d.setAuthTag(tout.subarray(tout.length - 16));
    return Buffer.concat([d.update(tout.subarray(0, tout.length - 16)), d.final()]).toString('utf8');
  } catch (_) {
    throw new Error('identifiants illisibles');
  }
}

function relire(doc, privatePem) {
  if (!doc.chiffre || !doc.chiffre.cle) return { erreur: 'identifiants incomplets : enregistrez-les de nouveau' };
  try { return { secret: dechiffrer(doc.chiffre, privatePem) }; } catch (_) { return { erreur: 'identifiants illisibles : enregistrez-les de nouveau' }; }
}

/**
 * Configuration WhatsApp d'un utilisateur depuis whatsapp_comptes/{uid}.
 * Rend { cfg }, { erreur } (texte sans secret), ou {} sans document.
 */
function configWhatsapp(doc, privatePem) {
  if (!doc) return {};
  const r = relire(doc, privatePem);
  if (r.erreur) return r;
  const cfg = { jeton: r.secret.trim(), numeroId: String(doc.numeroId || ''), modele: String(doc.modele || ''), langue: String(doc.langue || '') };
  const fautes = W.verifierWhatsapp(cfg);
  if (fautes.length) return { erreur: 'identifiants invalides (' + fautes.join(', ') + ')' };
  return { cfg };
}

/** Configuration SMTP d'un utilisateur depuis smtp_comptes/{uid}, au format de scripts/lib/smtp.js. */
function configSmtp(doc, privatePem) {
  if (!doc) return {};
  const r = relire(doc, privatePem);
  if (r.erreur) return r;
  const o = { hote: String(doc.hote || '').trim().toLowerCase(), port: Number(doc.port), utilisateur: String(doc.utilisateur || '').trim(),
    motDePasse: r.secret, expediteur: String(doc.expediteur || '').trim(), nom: String(doc.nom || '').trim() };
  const fautes = W.verifierSmtp(o);
  if (fautes.length) return { erreur: 'identifiants invalides (' + fautes.join(', ') + ')' };
  if (!o.nom) o.nom = 'SentiqS';
  return { cfg: o };
}

/** Retire de tout texte le jeton (et ce qui y ressemble) avant qu'il sorte. */
function nettoyer(texte, secret) {
  let t = String(texte || '');
  if (secret && String(secret).length >= 4) t = t.split(String(secret)).join('•••');
  return t.replace(/EAA[A-Za-z0-9]{20,}/g, '•••').replace(/Bearer\s+\S+/gi, 'Bearer •••').slice(0, 200);
}

module.exports = { clePublique, empreinte, dechiffrer, configWhatsapp, configSmtp, nettoyer };
