// Exécution des bulletins programmés (14/11/2026) — le cœur, sans réseau.
//
// Le script scripts/envoi-bulletins.js branche ce module sur Firestore, SMTP,
// Telegram et WhatsApp ; les tests le branchent sur des doubles. Les règles
// (programmation valide, créneau dû, texte du message) vivent dans
// web/js/bulletin-message.js, partagé avec la page.
//
// Ce que ce module garantit, et que les tests exigent :
//   · aucun envoi sans forfait qui l'autorise, relu dans le PROFIL (qu'un
//     navigateur ne peut pas réécrire), jamais dans la programmation ;
//   · aucun envoi à une adresse tierce sans son accord explicite (lien
//     « J'accepte » reçu une seule fois) ; un refus ou un désabonnement est
//     définitif pour ce compte ;
//   · un créneau n'est traité qu'une fois, et l'état avance même quand un
//     canal n'est pas branché (sinon le jour du branchement déverserait tout
//     l'arriéré) ;
//   · aucune adresse ni aucun numéro en clair dans le journal : les journaux
//     GitHub Actions d'un dépôt public se lisent sans compte.
const crypto = require('node:crypto');
const B = require('../../web/js/bulletin-message.js');

const URL_SITE = 'https://ytl1-ops.github.io/SentiqS/';
const URL_REPONSE = URL_SITE + 'abonnement.html';

function masquer(v) {
  const s = String(v || '');
  if (s.includes('@')) { const [u, d] = s.split('@'); return (u[0] || '') + '•••@' + d; }
  return s.length > 4 ? '•••' + s.slice(-3) : '•••';
}
function cleAdresse(email) { return crypto.createHash('sha256').update(String(email).toLowerCase()).digest('hex').slice(0, 16); }

/** Forfait effectif d'un profil : { plan, limite, raison }. */
function droitsProfil(profil, maintenantMs) {
  if (!profil) return { plan: null, limite: 0, raison: 'profil_absent' };
  const admin = profil.role === 'admin';
  if (profil.status !== 'active') return { plan: null, limite: 0, raison: 'compte_inactif' };
  const d = profil.data || {};
  if (!admin && d.accesJusquau) {
    const fin = Date.parse(String(d.accesJusquau) + 'T23:59:59Z');
    if (isFinite(fin) && fin < maintenantMs) return { plan: d.plan || 'gratuit', limite: 0, raison: 'acces_expire' };
  }
  const plan = admin ? 'entreprise' : (d.plan || 'gratuit');
  const limite = B.limiteForfait(plan, admin);
  return { plan, limite, raison: limite ? null : 'forfait' };
}

/** Données du message pour une liste de pays, dans l'ordre demandé. */
function donneesPays(instantane, codes) {
  const p = (instantane && instantane.pays) || {};
  return codes.map((c) => p[c]).filter(Boolean);
}

/**
 * Traite toutes les programmations. `env` :
 *   firestore: { lire(chemin), lister(col), ecrire(chemin, obj) }
 *   maintenantMs, instantane: { genere, pays }, paysValides,
 *   canaux: { email: bool, telegram: bool, whatsapp: bool, telegramRobot },
 *   envoyer: { email(msgs) -> [{ok,raison}], telegram(chatId, texte), whatsapp(num, langue, vars) },
 *   telegram: { rattachements, arrets } (déjà lus), traduire(texte, source, cible) -> string|null,
 *   journal(ligne), aleatoire() -> hex 40
 */
async function executer(env) {
  const now = env.maintenantMs;
  const log = env.journal || (() => {});
  const aleatoire = env.aleatoire || (() => crypto.randomBytes(20).toString('hex'));
  const tg = env.telegram || { rattachements: [], arrets: [] };
  const bilan = { comptes: 0, creneaux: 0, emails: 0, telegram: 0, whatsapp: 0, demandes: 0, degrade: 0, refus: 0 };
  const codesUtilises = new Set();
  const traductions = new Map();

  async function traduireFait(f, cible) {
    const l = f.langue || 'fr';
    if (l === cible || (cible === 'fr' && l === 'other')) return;
    if (cible === 'en' && f.titreEn) return;
    if (cible === 'fr' && f.titreFr) return;
    if (!env.traduire) return;
    const k = cible + '|' + f.titre;
    if (!traductions.has(k)) traductions.set(k, await env.traduire(f.titre, l === 'other' ? 'auto' : l, cible).catch(() => null));
    const t = traductions.get(k);
    if (t) f[cible === 'en' ? 'titreEn' : 'titreFr'] = t;
  }

  const docs = await env.firestore.lister('bulletins_programmes');
  for (const doc of docs) {
    const uid = doc.id;
    if (!/^[A-Za-z0-9]{10,64}$/.test(uid)) continue;
    bilan.comptes++;
    const prog = doc.data || {};
    const profil = await env.firestore.lire('profiles/' + uid).catch(() => null);
    const droits = droitsProfil(profil, now);
    const titulaire = String((profil && (profil.email || (profil.data && profil.data.email))) || prog.email || '').toLowerCase();
    const etat = (await env.firestore.lire('bulletins_etat/' + uid).catch(() => null)) || {};
    etat.destinataires = etat.destinataires || {};
    etat.progs = etat.progs || {};
    etat.plan = droits.plan; etat.limite = droits.limite; etat.raison = droits.raison;

    // ── Telegram : rattachement et détachement ──────────────────────────
    const code = typeof prog.telegramCode === 'string' && B.RE_CODE_TELEGRAM.test(prog.telegramCode) ? prog.telegramCode : null;
    const lien = code && tg.rattachements.filter((r) => r.code === code).pop();
    if (lien && droits.limite > 0) {
      codesUtilises.add(code);
      etat.telegram = { chatId: lien.chatId, titre: lien.titre, lieLe: new Date(now).toISOString() };
      try {
        await env.envoyer.telegram(lien.chatId, 'SentiqS : cette conversation est reliée au compte ' + masquer(titulaire)
          + '. Elle recevra les bulletins programmés dans Paramètres. Envoyez /stop pour ne plus rien recevoir.');
      } catch (e) { log('  Telegram : message de bienvenue non envoyé (' + e.message + ')'); }
    }
    if (etat.telegram && tg.arrets.indexOf(etat.telegram.chatId) >= 0) {
      const chat = etat.telegram.chatId;
      etat.telegram = { arreteLe: new Date(now).toISOString() };
      try { await env.envoyer.telegram(chat, 'SentiqS : plus aucun bulletin ne sera envoyé dans cette conversation.'); } catch (_) { /* rien à dire */ }
    }

    // ── Programmations ──────────────────────────────────────────────────
    const liste = Array.isArray(prog.programmations) ? prog.programmations : [];
    const gardes = new Set();
    for (let i = 0; i < liste.length; i++) {
      const n = B.normaliserProgrammation(liste[i], env.paysValides);
      const id = n.prog ? n.prog.id : (liste[i] && /^[a-z0-9]{6,20}$/.test(String(liste[i].id || '')) ? String(liste[i].id) : null);
      if (!id) continue;
      gardes.add(id);
      const e = etat.progs[id] = etat.progs[id] || {};
      if (!n.prog) { e.erreurs = n.erreurs; continue; }
      e.erreurs = [];
      const p = n.prog;
      if (i >= droits.limite) { e.erreurs = [droits.limite ? 'limite_forfait' : (droits.raison || 'forfait')]; e.prochainMs = null; continue; }
      e.prochainMs = B.prochainCreneau(p, now);

      // Destinataires e-mail tiers : demande d'accord, une seule fois.
      const adresses = [];
      if (p.canaux.titulaire && titulaire && B.emailValide(titulaire)) adresses.push({ email: titulaire, titulaire: true });
      p.canaux.emails.filter((m) => m !== titulaire).forEach((m) => adresses.push({ email: m, titulaire: false }));
      for (const a of adresses) {
        const k = cleAdresse(a.email);
        const d = etat.destinataires[k] = etat.destinataires[k] || { email: a.email, jeton: aleatoire(), statut: a.titulaire ? 'titulaire' : 'non_demande' };
        if (['accepte', 'en_attente', 'titulaire'].indexOf(d.statut) >= 0 || d.statut === 'non_demande') {
          const rep = await env.firestore.lire('reponses_destinataires/' + d.jeton).catch(() => null);
          if (rep && rep.decision === 'non') { d.statut = 'desabonne'; d.reponseLe = new Date(now).toISOString(); }
          else if (rep && rep.decision === 'oui' && d.statut === 'en_attente') { d.statut = 'accepte'; d.reponseLe = new Date(now).toISOString(); }
        }
        if (d.statut === 'non_demande' && env.canaux.email && droits.limite > 0) {
          const dem = B.composerDemandeAccord({ langue: p.langue, signature: p.signature, titulaire, noms: donneesPays(env.instantane, p.pays).map((x) => (p.langue === 'en' ? x.nomEn || x.nom : x.nom)),
            heures: p.heures, lienOui: URL_REPONSE + '#oui=' + d.jeton, lienNon: URL_REPONSE + '#non=' + d.jeton });
          const [r] = await env.envoyer.email([{ a: d.email, sujet: dem.sujet, texte: dem.texte, html: dem.html, desabonnement: URL_REPONSE + '#non=' + d.jeton }]);
          if (r && r.ok) { d.statut = 'en_attente'; d.demandeLe = new Date(now).toISOString(); bilan.demandes++; log('  Demande d\'accord envoyée à ' + masquer(d.email)); }
          else log('  Demande d\'accord non envoyée à ' + masquer(d.email) + ' (' + ((r && r.raison) || 'échec') + ')');
        }
      }

      const creneau = B.creneauDu(p, typeof e.dernierMs === 'number' ? e.dernierMs : null, now);
      if (creneau === null) continue;
      bilan.creneaux++;
      e.dernierMs = creneau; e.dernierLe = new Date(now).toISOString();
      const pays = donneesPays(env.instantane, p.pays).map((x) => Object.assign({}, x, { faits: (x.faits || []).map((f) => Object.assign({}, f)) }));
      for (const x of pays) for (const f of x.faits.slice(0, B.MAX_FAITS)) await traduireFait(f, p.langue);
      const base = { langue: p.langue, fuseau: p.fuseau, creneauMs: creneau, signature: p.signature, genereMs: env.instantane && Date.parse(env.instantane.genere) };
      const res = {};
      if (!pays.length) { e.resultat = { sansDonnees: true }; log('  Créneau ' + id + ' : aucune donnée pour ces pays.'); continue; }

      const cibles = adresses.map((a) => etat.destinataires[cleAdresse(a.email)])
        .filter((d) => d && (d.statut === 'titulaire' || d.statut === 'accepte'));
      const attente = adresses.length - cibles.length;
      if (cibles.length) {
        const messages = cibles.map((d) => {
          const m = B.composerMessage(pays, Object.assign({ lienDesabonnement: URL_REPONSE + '#non=' + d.jeton }, base));
          return { a: d.email, sujet: m.sujet, texte: m.texte, html: m.html, desabonnement: URL_REPONSE + '#non=' + d.jeton };
        });
        if (env.canaux.email) {
          const r = await env.envoyer.email(messages);
          const ok = r.filter((x) => x.ok).length;
          bilan.emails += ok;
          res.email = { envoyes: ok, echecs: r.length - ok };
          log('  Créneau ' + id + ' : e-mail ' + ok + '/' + r.length + ' (' + cibles.map((d) => masquer(d.email)).join(', ') + ')');
        } else {
          res.email = { degrade: cibles.length };
          bilan.degrade++;
          log('  Créneau ' + id + ' : e-mail NON branché — ' + cibles.length + ' message(s) qui seraient partis. Sujet : ' + messages[0].sujet);
        }
      }
      if (attente) res.emailEnAttente = attente;

      if (p.canaux.telegram) {
        const chat = etat.telegram && etat.telegram.chatId;
        const m = B.composerMessage(pays, base);
        if (!chat) res.telegram = { nonRelie: true };
        else if (env.canaux.telegram) {
          try { await env.envoyer.telegram(chat, m.court); res.telegram = { envoyes: 1 }; bilan.telegram++; }
          catch (er) { res.telegram = { echecs: 1, raison: er.message.slice(0, 120) }; }
        } else { res.telegram = { degrade: 1 }; bilan.degrade++; log('  Créneau ' + id + ' : Telegram NON branché.'); }
      }

      if (p.canaux.whatsapp.length) {
        if (env.canaux.whatsapp) {
          let ok = 0;
          for (const num of p.canaux.whatsapp) {
            for (const x of pays) {
              try {
                await env.envoyer.whatsapp(num, p.langue, [p.langue === 'en' ? (x.nomEn || x.nom) : x.nom, B.libelleNiveau(x.niveau, p.langue), String(x.faitsNotables || 0), x.url || URL_SITE]);
                ok++;
              } catch (er) { log('  WhatsApp ' + masquer(num) + ' : ' + er.message.slice(0, 120)); }
            }
          }
          bilan.whatsapp += ok;
          res.whatsapp = { envoyes: ok };
        } else { res.whatsapp = { degrade: p.canaux.whatsapp.length }; bilan.degrade++; log('  Créneau ' + id + ' : WhatsApp NON branché (' + p.canaux.whatsapp.length + ' numéro(s)).'); }
      }
      e.resultat = res;
    }
    // Une programmation supprimée dans la page n'a plus d'état ; les
    // destinataires, eux, restent : une demande d'accord ne se renouvelle pas.
    Object.keys(etat.progs).forEach((k) => { if (!gardes.has(k)) delete etat.progs[k]; });
    etat.maj = new Date(now).toISOString();
    await env.firestore.ecrire('bulletins_etat/' + uid, etat);
  }

  // Un code Telegram qui ne correspond à aucun compte : on le dit au chat.
  for (const r of tg.rattachements) {
    if (codesUtilises.has(r.code)) continue;
    try { await env.envoyer.telegram(r.chatId, 'SentiqS : ce code est inconnu ou n\'est plus valable. Relancez le lien depuis Paramètres > Bulletins programmés.'); } catch (_) { /* tant pis */ }
  }
  return bilan;
}

module.exports = { executer, droitsProfil, masquer, cleAdresse, donneesPays, URL_REPONSE };
