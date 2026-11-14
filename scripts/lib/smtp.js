// Envoi d'e-mail par SMTP, sans dépendance (14/11/2026, bulletins programmés).
//
// Pourquoi pas nodemailer : le job n'installe rien d'autre que Node, et
// l'envoi d'un bulletin n'a besoin que du strict SMTP authentifié sur TLS.
// Les deux fournisseurs gratuits recommandés le parlent tous deux :
//   · Gmail : smtp.gmail.com, port 465, mot de passe d'application (500/jour) ;
//   · Brevo : smtp-relay.brevo.com, port 587, clé SMTP (300/jour).
// Port 465 = TLS dès la connexion ; 587 = STARTTLS. Rien d'autre n'est accepté
// (jamais d'envoi en clair : le mot de passe passerait sur le réseau).
//
// Le corps est encodé en base64 par lignes de 76 caractères : aucune ligne ne
// commence par un point (pas de « dot-stuffing » à gérer) et les accents
// passent sans dépendre du serveur.
const net = require('node:net');
const tls = require('node:tls');
const crypto = require('node:crypto');

function lireConfig(env) {
  const e = env || process.env;
  const hote = String(e.SMTP_HOTE || '').trim();
  const utilisateur = String(e.SMTP_UTILISATEUR || '').trim();
  const motDePasse = String(e.SMTP_MOT_DE_PASSE || '');
  if (!hote || !utilisateur || !motDePasse) return null;
  const port = Number(e.SMTP_PORT || 465);
  if (port !== 465 && port !== 587) return null;
  const expediteur = String(e.SMTP_EXPEDITEUR || utilisateur).trim();
  return { hote, port, utilisateur, motDePasse, expediteur, nom: String(e.SMTP_NOM || 'SentiqS').trim() || 'SentiqS' };
}

function b64(s) { return Buffer.from(String(s), 'utf8').toString('base64'); }
function lignes76(s) { return b64(s).replace(/.{76}/g, '$&\r\n'); }
function enteteMot(s) { return /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?='; }
function propre(s) { return String(s || '').replace(/[\r\n]+/g, ' ').trim(); }

/** Le message MIME complet (texte + HTML). */
function construireMessage(o) {
  const frontiere = 'sentiqs-' + crypto.randomBytes(8).toString('hex');
  const de = enteteMot(propre(o.nom || 'SentiqS')) + ' <' + propre(o.de) + '>';
  const entetes = [
    'From: ' + de,
    'To: <' + propre(o.a) + '>',
    'Subject: ' + enteteMot(propre(o.sujet)),
    'Date: ' + new Date(o.dateMs || Date.now()).toUTCString(),
    'Message-ID: <' + crypto.randomBytes(12).toString('hex') + '@sentiqs>',
    'MIME-Version: 1.0',
    'Auto-Submitted: auto-generated',
  ];
  // Désabonnement en un clic dans le client de messagerie (RFC 2369).
  if (o.desabonnement) entetes.push('List-Unsubscribe: <' + propre(o.desabonnement) + '>');
  entetes.push('Content-Type: multipart/alternative; boundary="' + frontiere + '"');
  return entetes.join('\r\n') + '\r\n\r\n'
    + '--' + frontiere + '\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + lignes76(o.texte || '') + '\r\n'
    + '--' + frontiere + '\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + lignes76(o.html || '') + '\r\n'
    + '--' + frontiere + '--\r\n';
}

// Une conversation SMTP : lit les réponses ligne à ligne (réponses sur
// plusieurs lignes « 250-… » comprises) et vérifie chaque code attendu.
function conversation(socket, delaiMs) {
  let tampon = '';
  let attente = null;
  const lire = () => new Promise((ok, ko) => {
    attente = { ok, ko };
    verifier();
  });
  function verifier() {
    if (!attente) return;
    const lignes = tampon.split('\r\n');
    for (let i = 0; i < lignes.length - 1; i++) {
      if (/^\d{3} /.test(lignes[i]) || /^\d{3}$/.test(lignes[i])) {
        const reponse = lignes.slice(0, i + 1).join('\n');
        tampon = lignes.slice(i + 1).join('\r\n');
        const a = attente; attente = null;
        a.ok({ code: Number(lignes[i].slice(0, 3)), texte: reponse });
        return;
      }
    }
  }
  const surDonnees = (d) => { tampon += d.toString('utf8'); verifier(); };
  const surErreur = (e) => { if (attente) { const a = attente; attente = null; a.ko(e); } };
  socket.on('data', surDonnees);
  socket.on('error', surErreur);
  socket.setTimeout(delaiMs || 20000, () => { surErreur(new Error('délai SMTP dépassé')); socket.destroy(); });
  async function commande(ligne, attendus) {
    if (ligne !== null) socket.write(ligne + '\r\n');
    const r = await lire();
    if (attendus.indexOf(r.code) < 0) {
      // Jamais le mot de passe dans un message d'erreur : seule la commande
      // (et pas son argument) est citée.
      throw new Error('SMTP ' + r.code + ' après ' + (ligne === null ? 'connexion' : String(ligne).split(' ')[0]) + ' : ' + r.texte.slice(0, 160));
    }
    return r;
  }
  return { commande, detacher() { socket.removeListener('data', surDonnees); } };
}

function connecter(cfg, options) {
  return new Promise((ok, ko) => {
    const o = Object.assign({ host: cfg.hote, port: cfg.port, servername: cfg.hote }, options || {});
    const s = cfg.port === 465 ? tls.connect(o) : net.connect(o);
    s.once(cfg.port === 465 ? 'secureConnect' : 'connect', () => ok(s));
    s.once('error', ko);
  });
}

/**
 * Envoie un ou plusieurs messages sur UNE connexion. `messages` : [{ a, sujet,
 * texte, html, desabonnement }]. Rend [{ ok, raison }] dans le même ordre :
 * un destinataire refusé n'empêche pas les suivants.
 */
async function envoyer(cfg, messages, options) {
  const o = options || {};
  let socket = await (o.connecter || connecter)(cfg, o.tls);
  let c = conversation(socket, o.delaiMs);
  await c.commande(null, [220]);
  await c.commande('EHLO sentiqs.local', [250]);
  if (cfg.port === 587) {
    await c.commande('STARTTLS', [220]);
    c.detacher();
    socket = await new Promise((ok, ko) => {
      const t = tls.connect(Object.assign({ socket, servername: cfg.hote }, o.tls || {}), () => ok(t));
      t.once('error', ko);
    });
    c = conversation(socket, o.delaiMs);
    await c.commande('EHLO sentiqs.local', [250]);
  }
  await c.commande('AUTH LOGIN', [334]);
  await c.commande(b64(cfg.utilisateur), [334]);
  await c.commande(b64(cfg.motDePasse), [235]);
  const resultats = [];
  for (const m of messages) {
    try {
      await c.commande('MAIL FROM:<' + propre(cfg.expediteur) + '>', [250]);
      await c.commande('RCPT TO:<' + propre(m.a) + '>', [250, 251]);
      await c.commande('DATA', [354]);
      socket.write(construireMessage(Object.assign({ de: cfg.expediteur, nom: cfg.nom }, m)));
      await c.commande('.', [250]);
      resultats.push({ ok: true });
    } catch (e) {
      resultats.push({ ok: false, raison: (e && e.message) || String(e) });
      try { await c.commande('RSET', [250]); } catch (_) { break; }
    }
  }
  while (resultats.length < messages.length) resultats.push({ ok: false, raison: 'connexion SMTP interrompue' });
  try { await c.commande('QUIT', [221]); } catch (_) { /* déjà fermé */ }
  socket.end();
  return resultats;
}

module.exports = { lireConfig, construireMessage, envoyer, enteteMot };
