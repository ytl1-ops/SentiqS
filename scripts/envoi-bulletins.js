#!/usr/bin/env node
// Envoi des bulletins programmés (14/11/2026) — lancé toutes les quinze
// minutes par .github/workflows/envoi-bulletins.yml, sans navigateur.
//
// Données : l'instantané des 54 pays que le job de collecte écrit à chaque
// passage (Firestore, bulletins_instantanes/courant) ; à défaut, le résumé du
// dernier bulletin quotidien (web/bulletins/index.json, dans le dépôt).
// Rien n'est recalculé ici : niveau, confiance, cotation et faits sont ceux
// de la page.
//
// Canaux, tous facultatifs (sans eux, le job journalise ce qui serait parti) :
//   · e-mail : le serveur d'envoi que CHAQUE UTILISATEUR désigne dans
//     Paramètres (smtp_comptes/{uid}, chiffré) ; à défaut, celui de l'éditeur
//     s'il en a posé un (SMTP_HOTE, SMTP_PORT, SMTP_UTILISATEUR,
//     SMTP_MOT_DE_PASSE, SMTP_EXPEDITEUR) ;
//   · WhatsApp : le compte Meta de CHAQUE UTILISATEUR (whatsapp_comptes/{uid},
//     chiffré), jamais un compte SentiqS (décision du 14/11/2026) ;
//   · Telegram : le robot de l'éditeur (TELEGRAM_BOT_TOKEN).
// Indispensable : FIREBASE_SERVICE_ACCOUNT (sans lui, aucune programmation
// n'est lisible et le job s'arrête sans erreur).
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const ecriture = require('./lib/cache-firestore-ecriture');
const firestoreRest = require('./lib/firestore-rest');
const smtp = require('./lib/smtp');
const msg = require('./lib/messageries');
const coeur = require('./lib/envoi-bulletins');
const bulletin = require('./lib/bulletin');
const traduction = require('./lib/traduction-job');
const ident = require('./lib/identifiants-envoi');

const MAX_TRADUCTIONS = 40;

function instantaneDepuisIndex() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'web', 'bulletins', 'index.json'), 'utf8'));
    const pays = {};
    Object.keys(j.pays || {}).forEach((cy) => {
      const r = j.pays[cy];
      pays[cy] = { cy, nom: r.nom, niveau: r.niveau, libelle: r.libelle, sous: r.sous, confiance: r.confiance,
        faitsNotables: r.faitsNotables, confirmes: r.confirmes, muet: r.muet, faits: [], url: bulletin.URL_SITE + 'bulletins/' + cy + '/dernier.html' };
    });
    return { genere: j.genere, pays, source: 'index' };
  } catch (_) { return null; }
}

async function lireInstantane(fsc) {
  try {
    const d = await fsc.lire('bulletins_instantanes/courant');
    if (d && typeof d.d === 'string') {
      const j = JSON.parse(zlib.gunzipSync(Buffer.from(d.d, 'base64')).toString('utf8'));
      if (j && j.pays) return Object.assign(j, { source: 'collecte' });
    }
  } catch (e) { console.warn('Instantané illisible (' + e.message + ') : repli sur le dernier bulletin quotidien.'); }
  return instantaneDepuisIndex();
}

async function principal() {
  const compte = ecriture.lireCompte(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (!compte) {
    console.log('FIREBASE_SERVICE_ACCOUNT absent : aucune programmation lisible, rien à envoyer.');
    return;
  }
  const jeton = await ecriture.jetonAcces(compte, fetch);
  const fsc = firestoreRest.client(compte.project_id, jeton, fetch);
  const cfgSmtp = smtp.lireConfig(process.env);
  const cfgTg = msg.telegramConfig(process.env);
  const canaux = { email: !!cfgSmtp, telegram: !!cfgTg, telegramRobot: null };
  console.log('Canaux de l\'éditeur : e-mail ' + (canaux.email ? 'oui' : 'non') + ', Telegram ' + (canaux.telegram ? 'oui' : 'non')
    + '. WhatsApp et e-mail peuvent aussi partir des comptes que chaque utilisateur apporte.');
  // Clé publique avec laquelle la page chiffre les identifiants apportés.
  const clePub = ident.clePublique(compte.private_key);

  const general = (await fsc.lire('bulletins_etat/_canaux').catch(() => null)) || {};
  let tg = { rattachements: [], arrets: [], offset: general.telegramOffset || 0 };
  if (cfgTg) {
    try {
      const moi = await msg.appelTelegram(cfgTg, 'getMe', {});
      canaux.telegramRobot = moi && moi.username ? String(moi.username) : null;
      const updates = await msg.appelTelegram(cfgTg, 'getUpdates', { offset: tg.offset, timeout: 0, allowed_updates: ['message', 'channel_post'] });
      tg = Object.assign(tg, msg.lireCommandes(updates, tg.offset));
      console.log('Telegram : ' + tg.rattachements.length + ' rattachement(s), ' + tg.arrets.length + ' arrêt(s).');
    } catch (e) { console.warn('Telegram : ' + e.message); }
  }

  const instantane = await lireInstantane(fsc);
  console.log('Données : ' + (instantane ? instantane.source + ' du ' + instantane.genere : 'aucune'));
  let traduites = 0;
  const bilan = await coeur.executer({
    firestore: fsc,
    maintenantMs: Date.now(),
    instantane,
    paysValides: bulletin.paysAEcrire(),
    canaux,
    telegram: tg,
    configs: { whatsapp: (d) => ident.configWhatsapp(d, compte.private_key), smtp: (d) => ident.configSmtp(d, compte.private_key) },
    journal: (l) => console.log(l),
    traduire: async (texte, source, cible) => {
      if (traduites >= MAX_TRADUCTIONS) return null;
      traduites++;
      return traduction.traduire(texte, source, { cible, delaiMs: 8000 });
    },
    envoyer: {
      // Le serveur de l'utilisateur d'abord, sinon celui de l'éditeur. Les
      // erreurs remontent sans le mot de passe.
      email: (messages, cfgU) => {
        const cfg = cfgU || cfgSmtp;
        if (!cfg) return Promise.resolve(messages.map(() => ({ ok: false, raison: 'aucun serveur d\'envoi' })));
        return smtp.envoyer(cfg, messages).catch((e) => messages.map(() => ({ ok: false, raison: ident.nettoyer(e.message, cfg.motDePasse) })));
      },
      telegram: (chatId, texte) => msg.telegramMessage(cfgTg, chatId, texte),
      whatsapp: (cfg, num, langue, vars) => msg.whatsappModele(cfg, num, langue, vars),
      whatsappEssai: (cfg, num) => msg.whatsappEssai(cfg, num),
    },
  });
  // L'état des canaux est lu par la page (Paramètres) : elle dit à
  // l'utilisateur ce qui est réellement branché au lieu de le lui promettre.
  await fsc.ecrire('bulletins_etat/_canaux', {
    email: canaux.email, telegram: canaux.telegram, whatsapp: 'compte_utilisateur', smtpUtilisateur: true,
    clePublique: clePub, clePubliqueEmpreinte: ident.empreinte(clePub),
    telegramRobot: canaux.telegramRobot, telegramOffset: tg.offset || 0,
    donnees: instantane ? instantane.genere || null : null, maj: new Date().toISOString(),
  });
  console.log('Bilan : ' + JSON.stringify(bilan));
}

principal().catch((e) => {
  console.error('Envoi des bulletins programmés en échec : ' + ((e && e.message) || e));
  process.exitCode = 1;
});
