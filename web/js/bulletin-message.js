// ═══════════════════════════════════════════════════════════════════════════
//  SentiqS — BULLETINS PROGRAMMÉS : règles et message, partagés page / job
//
//  Demande de YORO du 14/11/2026 : « programmer des bulletins sur des pays
//  précis, à transmettre automatiquement par e-mail, WhatsApp ou Telegram à
//  des horaires précisés ». La page (Paramètres > Bulletins programmés) écrit
//  la programmation ; le job scripts/envoi-bulletins.js l'exécute. Les deux
//  lisent CE fichier, pour ne jamais diverger sur trois points :
//    · ce qu'est une programmation valide (pays, heures, jours, fuseau,
//      destinataires, limites par forfait) ;
//    · quand un créneau est dû (fuseau horaire de l'utilisateur, jamais
//      l'heure du serveur) ;
//    · le texte exact du message — l'aperçu affiché dans Paramètres est le
//      message qui partira.
//
//  Logique PURE (ni DOM, ni réseau, ni stockage), double export navigateur /
//  CommonJS comme noyau.js.
// ═══════════════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  // ── Limites ─────────────────────────────────────────────────────────────
  // Par forfait : nombre de programmations. Le forfait Découverte n'en a pas
  // (un envoi automatique est un service continu, l'essai dure 72 h) ; les
  // règles Firestore portent les mêmes nombres et le job les revérifie avec le
  // profil réel, qu'un navigateur ne peut pas réécrire.
  var LIMITES_FORFAIT = { gratuit: 0, standard: 1, pro: 5, entreprise: 20 };
  var MAX_PAYS = 5;          // pays par programmation
  var MAX_HEURES = 4;        // envois par jour
  var MAX_EMAILS = 5;        // destinataires e-mail par programmation
  var MAX_WHATSAPP = 3;      // numéros WhatsApp par programmation
  var MAX_FAITS = 5;         // faits cités par pays dans un message
  var SIGNATURE_MAX = 60;
  // Un créneau manqué de plus de trois heures (job retardé par GitHub, panne)
  // n'est pas envoyé en retard : un bulletin de 7 h reçu à 15 h tromperait
  // sur sa fraîcheur. Le créneau suivant part normalement.
  var RETARD_MAX_MS = 3 * 3600000;

  // Fuseaux proposés : ceux du continent, plus UTC. Un fuseau inconnu de
  // l'environnement est refusé plutôt que de tomber silencieusement sur UTC.
  var FUSEAUX = ['Africa/Abidjan', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Johannesburg',
    'Africa/Nairobi', 'Africa/Casablanca', 'Africa/Algiers', 'Africa/Tunis', 'Africa/Tripoli',
    'Africa/Khartoum', 'Africa/Addis_Ababa', 'Africa/Kinshasa', 'Africa/Lubumbashi', 'Africa/Maputo',
    'Africa/Luanda', 'Africa/Douala', 'Africa/Dakar', 'Africa/Bamako', 'Africa/Ouagadougou',
    'Africa/Niamey', 'Africa/Ndjamena', 'Indian/Mauritius', 'Indian/Antananarivo', 'Atlantic/Cape_Verde',
    'Europe/Paris', 'UTC'];

  var JOURS = [1, 2, 3, 4, 5, 6, 7]; // ISO : 1 = lundi … 7 = dimanche

  // ── Contrôles élémentaires ──────────────────────────────────────────────
  var RE_HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  // Adresse e-mail : volontairement simple, sans espace ni chevron (une
  // adresse qui contient un saut de ligne pourrait injecter un en-tête SMTP).
  var RE_EMAIL = /^[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
  var RE_WHATSAPP = /^\d{8,15}$/;
  var RE_CODE_TELEGRAM = /^[a-f0-9]{16}$/;

  function fuseauValide(tz) {
    if (FUSEAUX.indexOf(tz) < 0) return false;
    try { new Intl.DateTimeFormat('fr-FR', { timeZone: tz }).format(0); return true; } catch (_) { return false; }
  }
  function emailValide(e) { return typeof e === 'string' && RE_EMAIL.test(e) && e.indexOf('..') < 0; }
  function numeroWhatsapp(n) { return String(n || '').replace(/[\s.()+-]/g, ''); }
  function texteCourt(t, max) { return String(t || '').replace(/[\r\n\t<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }

  /**
   * Nettoie une programmation. Rend { prog, erreurs } : `prog` est null dès
   * qu'une erreur bloque (aucune programmation à moitié valide n'est gardée).
   * `paysValides` : liste des codes connus (les 54 pays du bulletin).
   */
  function normaliserProgrammation(p, paysValides) {
    var e = [];
    p = p || {};
    var valides = Array.isArray(paysValides) ? paysValides : null;
    var pays = [];
    (Array.isArray(p.pays) ? p.pays : []).forEach(function (c) {
      c = String(c || '').toUpperCase();
      if (/^[A-Z]{2}$/.test(c) && (!valides || valides.indexOf(c) >= 0) && pays.indexOf(c) < 0) pays.push(c);
    });
    if (!pays.length) e.push('pays_requis');
    if (pays.length > MAX_PAYS) e.push('trop_de_pays');

    var heures = [];
    (Array.isArray(p.heures) ? p.heures : []).forEach(function (h) {
      h = String(h || '').trim();
      if (RE_HEURE.test(h) && heures.indexOf(h) < 0) heures.push(h);
    });
    heures.sort();
    if (!heures.length) e.push('heure_requise');
    if (heures.length > MAX_HEURES) e.push('trop_d_heures');

    var jours = (Array.isArray(p.jours) ? p.jours : JOURS).map(Number)
      .filter(function (j, i, t) { return JOURS.indexOf(j) >= 0 && t.indexOf(j) === i; }).sort();
    if (!jours.length) e.push('jour_requis');

    var fuseau = String(p.fuseau || '');
    if (!fuseauValide(fuseau)) e.push('fuseau_invalide');

    var c = p.canaux || {};
    var emails = [];
    (Array.isArray(c.emails) ? c.emails : []).forEach(function (m) {
      m = String(m || '').trim().toLowerCase();
      if (!m) return;
      if (!emailValide(m)) { e.push('email_invalide'); return; }
      if (emails.indexOf(m) < 0) emails.push(m);
    });
    if (emails.length > MAX_EMAILS) e.push('trop_d_emails');
    var whatsapp = [];
    (Array.isArray(c.whatsapp) ? c.whatsapp : []).forEach(function (n) {
      n = numeroWhatsapp(n);
      if (!n) return;
      if (!RE_WHATSAPP.test(n)) { e.push('whatsapp_invalide'); return; }
      if (whatsapp.indexOf(n) < 0) whatsapp.push(n);
    });
    if (whatsapp.length > MAX_WHATSAPP) e.push('trop_de_whatsapp');
    // WhatsApp exige l'accord préalable du destinataire (politique de Meta et
    // protection des données) : sans l'attestation, les numéros ne sont pas
    // gardés. Un envoi non sollicité sur un téléphone, c'est ce que ce
    // produit ne doit jamais faire.
    if (whatsapp.length && c.whatsappAccord !== true) e.push('whatsapp_accord_requis');
    var telegram = c.telegram === true;
    var titulaire = c.titulaire !== false; // l'adresse du compte, par défaut
    if (!emails.length && !whatsapp.length && !telegram && !titulaire) e.push('canal_requis');

    var langue = p.langue === 'en' ? 'en' : 'fr';
    var id = String(p.id || '');
    if (!/^[a-z0-9]{6,20}$/.test(id)) e.push('id_invalide');

    if (e.length) return { prog: null, erreurs: e };
    return {
      prog: {
        id: id, actif: p.actif !== false, pays: pays, heures: heures, jours: jours, fuseau: fuseau, langue: langue,
        signature: texteCourt(p.signature, SIGNATURE_MAX),
        canaux: { titulaire: titulaire, emails: emails, telegram: telegram, whatsapp: whatsapp, whatsappAccord: whatsapp.length > 0 },
      },
      erreurs: [],
    };
  }

  function limiteForfait(plan, admin) {
    if (admin) return LIMITES_FORFAIT.entreprise;
    return Object.prototype.hasOwnProperty.call(LIMITES_FORFAIT, plan) ? LIMITES_FORFAIT[plan] : 0;
  }

  // ── Fuseaux et créneaux ─────────────────────────────────────────────────
  var _formats = {};
  function formatTz(tz) {
    if (!_formats[tz]) {
      _formats[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
    }
    return _formats[tz];
  }
  var JOUR_ISO = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  /** Date et heure locales de l'instant `ms` dans le fuseau `tz`. */
  function partiesLocales(ms, tz) {
    var o = {};
    formatTz(tz).formatToParts(new Date(ms)).forEach(function (x) { o[x.type] = x.value; });
    return { an: +o.year, mois: +o.month, jour: +o.day, h: +o.hour, mi: +o.minute, s: +o.second, js: JOUR_ISO[o.weekday] };
  }
  function decalageMs(ms, tz) {
    var p = partiesLocales(ms, tz);
    return Date.UTC(p.an, p.mois - 1, p.jour, p.h, p.mi, p.s) - (ms - (ms % 1000 + 1000) % 1000);
  }
  /** Instant UTC d'une heure locale (`an`, `mois` 1-12, `jour`, `h`, `mi`) dans `tz`. */
  function instantLocal(an, mois, jour, h, mi, tz) {
    var naif = Date.UTC(an, mois - 1, jour, h, mi);
    var t = naif - decalageMs(naif, tz);
    // Seconde passe : le décalage peut changer entre l'heure naïve et l'heure
    // réelle (passage à l'heure d'été au Maroc ou en Égypte).
    return naif - decalageMs(t, tz);
  }

  /**
   * Le créneau à envoyer maintenant, ou null. Seul le DERNIER créneau échu
   * depuis `dernierMs` compte (deux créneaux manqués ne partent pas en
   * rafale), et seulement s'il a moins de RETARD_MAX_MS.
   */
  function creneauDu(prog, dernierMs, maintenantMs, retardMaxMs) {
    if (!prog || !prog.actif) return null;
    var retard = typeof retardMaxMs === 'number' ? retardMaxMs : RETARD_MAX_MS;
    var plancher = Math.max(typeof dernierMs === 'number' ? dernierMs : -Infinity, maintenantMs - retard);
    var meilleur = null;
    // Aujourd'hui et hier, en date locale du fuseau (un créneau de 23 h 30
    // vu à 0 h 10 appartient à la veille).
    for (var k = 0; k <= 1; k++) {
      var p = partiesLocales(maintenantMs - k * 86400000, prog.fuseau);
      if (prog.jours.indexOf(p.js) < 0) continue;
      prog.heures.forEach(function (hh) {
        var m = RE_HEURE.exec(hh);
        if (!m) return;
        var t = instantLocal(p.an, p.mois, p.jour, +m[1], +m[2], prog.fuseau);
        if (t <= maintenantMs && t > plancher && (meilleur === null || t > meilleur)) meilleur = t;
      });
    }
    return meilleur;
  }

  /** Prochain créneau après `maintenantMs` (affiché dans Paramètres). */
  function prochainCreneau(prog, maintenantMs) {
    if (!prog || !prog.actif || !prog.heures || !prog.heures.length) return null;
    for (var k = 0; k <= 7; k++) {
      var p = partiesLocales(maintenantMs + k * 86400000, prog.fuseau);
      if (prog.jours.indexOf(p.js) < 0) continue;
      var trouve = null;
      prog.heures.forEach(function (hh) {
        var m = RE_HEURE.exec(hh);
        var t = instantLocal(p.an, p.mois, p.jour, +m[1], +m[2], prog.fuseau);
        if (t > maintenantMs && (trouve === null || t < trouve)) trouve = t;
      });
      if (trouve !== null) return trouve;
    }
    return null;
  }

  // ── Le message ──────────────────────────────────────────────────────────
  var TXT = {
    fr: {
      bulletin: 'Bulletin sûreté', niveau: 'Niveau', confiance: 'confiance', faits: 'Faits notables',
      fenetre: 'sur {h} h', dont: 'dont {n} recoupé(s)', aucun: 'Aucun fait notable dans la fenêtre.',
      muet: 'Aucune actualité sur ce pays dans la fenêtre : un pays sans signal n\'est pas un pays calme.',
      complet: 'Bulletin complet', donnees: 'Données de la collecte du {d}.',
      programme: 'Programmé par {s} dans SentiqS.', desab: 'Ne plus recevoir ce bulletin', titreAbsent: 'Titre en {l} — traduction indisponible',
      aide: 'Outil d\'aide à la décision : il ne remplace pas l\'appréciation de situation du responsable sûreté.',
      sujet: 'SentiqS — {pays} — {date}', ouvrir: 'Ouvrir SentiqS',
    },
    en: {
      bulletin: 'Security bulletin', niveau: 'Level', confiance: 'confidence', faits: 'Notable events',
      fenetre: 'over {h} h', dont: '{n} cross-checked', aucun: 'No notable event in the window.',
      muet: 'No news on this country in the window: a country without signal is not a calm country.',
      complet: 'Full bulletin', donnees: 'Data collected on {d}.',
      programme: 'Scheduled by {s} in SentiqS.', desab: 'Stop receiving this bulletin', titreAbsent: 'Headline in {l} — translation unavailable',
      aide: 'Decision-support tool: it does not replace the security manager\'s own assessment.',
      sujet: 'SentiqS — {pays} — {date}', ouvrir: 'Open SentiqS',
    },
  };
  var NIVEAU_EN = { vert: ['GREEN', 'Stable'], jaune: ['YELLOW', 'Moderate'], orange: ['ORANGE', 'High'], marron: ['BROWN', 'Critical'], rouge: ['RED', 'Severe'] };
  var NIVEAU_FR = { vert: ['VERT', 'Stable'], jaune: ['JAUNE', 'Modéré'], orange: ['ORANGE', 'Élevé'], marron: ['MARRON', 'Critique'], rouge: ['ROUGE', 'Grave'] };
  var CONFIANCE_EN = { 'élevée': 'high', 'moyenne': 'medium', 'faible': 'low' };
  var COTATION_EN = { confirme: 'Confirmed', probable: 'Probable', non_confirme: 'Unconfirmed', valide: 'Analyst-validated', infirme: 'Refuted by analyst' };
  var COTATION_FR = { confirme: 'Confirmé', probable: 'Probable', non_confirme: 'Non confirmé', valide: 'Validé analyste', infirme: 'Infirmé par l\'analyste' };
  var LANGUES = { fr: { fr: 'français', en: 'French' }, en: { fr: 'anglais', en: 'English' }, pt: { fr: 'portugais', en: 'Portuguese' }, ar: { fr: 'arabe', en: 'Arabic' } };

  function remplir(t, v) { return String(t).replace(/\{(\w+)\}/g, function (_, k) { return v[k] === undefined ? '' : v[k]; }); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function urlSure(u) { return typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : null; }

  function dateLocale(ms, tz, langue) {
    try {
      return new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', { timeZone: tz || 'UTC', day: 'numeric', month: 'long',
        year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms))
        + ' (' + String(tz || 'UTC').replace(/^.*\//, '').replace(/_/g, ' ') + ')';
    } catch (_) { return new Date(ms).toISOString(); }
  }

  // Une seule langue à l'écran comme dans les messages (règle de YORO du
  // 21/10/2026) : un titre dans une autre langue que celle du message n'est
  // jamais recopié brut ; sa traduction, sinon une mention et le lien.
  function titreDans(f, langue) {
    var l = f.langue || 'fr';
    if (langue === 'en') {
      if (f.titreEn) return f.titreEn;
      if (l === 'en') return f.titre;
    } else {
      if (f.titreFr) return f.titreFr;
      if (l === 'fr' || l === 'other' || !l) return f.titre;
    }
    var n = (LANGUES[l] || { fr: 'langue étrangère', en: 'a foreign language' })[langue === 'en' ? 'en' : 'fr'];
    return remplir(TXT[langue === 'en' ? 'en' : 'fr'].titreAbsent, { l: n });
  }

  function blocPays(d, langue) {
    var T = TXT[langue];
    var niv = (langue === 'en' ? NIVEAU_EN : NIVEAU_FR)[d.niveau] || [String(d.libelle || ''), String(d.sous || '')];
    var conf = d.confiance ? (langue === 'en' ? (CONFIANCE_EN[d.confiance] || d.confiance) : d.confiance) : null;
    var nom = langue === 'en' ? (d.nomEn || d.nom) : d.nom;
    var faits = (Array.isArray(d.faits) ? d.faits : []).slice(0, MAX_FAITS).map(function (f) {
      var cot = f.cotation ? ((langue === 'en' ? COTATION_EN : COTATION_FR)[f.cotation] || '') : '';
      return { cot: cot, titre: titreDans(f, langue), source: texteCourt(f.source, 80), url: urlSure(f.url) };
    });
    return { cy: d.cy, nom: nom, niv: niv, niveau: d.niveau, conf: conf, faits: faits,
      nb: Number(d.faitsNotables) || 0, recoupes: Number(d.confirmes) || 0, muet: !!d.muet,
      fenetreH: Number(d.fenetreH) || 36, url: urlSure(d.url) };
  }

  var COULEUR = { vert: '#0F4F2A', jaune: '#854D0E', orange: '#7C4A00', marron: '#78350F', rouge: '#8B1A1A' };

  /**
   * Compose le message d'un créneau. `pays` : données par pays (format de
   * l'instantané écrit par le job de collecte). Rend { sujet, texte, html,
   * court } — `court` sert à Telegram et à l'aperçu sur mobile.
   */
  function composerMessage(pays, o) {
    o = o || {};
    var langue = o.langue === 'en' ? 'en' : 'fr';
    var T = TXT[langue];
    var blocs = (pays || []).map(function (d) { return blocPays(d, langue); });
    var quand = dateLocale(o.creneauMs || Date.now(), o.fuseau, langue);
    var noms = blocs.map(function (b) { return b.nom; });
    var sujet = remplir(T.sujet, { pays: noms.length > 3 ? noms.slice(0, 3).join(', ') + '…' : noms.join(', '), date: quand });
    var signature = texteCourt(o.signature, SIGNATURE_MAX);
    var lignes = [];
    blocs.forEach(function (b) {
      lignes.push(T.bulletin + ' — ' + b.nom);
      lignes.push(T.niveau + ' : ' + b.niv[0] + ' (' + b.niv[1] + ')' + (b.conf ? ' · ' + T.confiance + ' ' + b.conf : ''));
      if (b.muet) lignes.push(T.muet);
      else {
        lignes.push(T.faits + ' ' + remplir(T.fenetre, { h: b.fenetreH }) + ' : ' + b.nb + (b.recoupes ? ', ' + remplir(T.dont, { n: b.recoupes }) : ''));
        if (!b.faits.length) lignes.push(T.aucun);
        b.faits.forEach(function (f) {
          lignes.push('• ' + (f.cot ? '[' + f.cot + '] ' : '') + f.titre + (f.source ? ' — ' + f.source : '') + (f.url ? '\n  ' + f.url : ''));
        });
      }
      if (b.url) lignes.push(T.complet + ' : ' + b.url);
      lignes.push('');
    });
    var pied = [];
    if (o.genereMs) pied.push(remplir(T.donnees, { d: dateLocale(o.genereMs, o.fuseau, langue) }));
    if (signature) pied.push(remplir(T.programme, { s: signature }));
    pied.push(T.aide);
    var texte = quand + '\n\n' + lignes.join('\n') + pied.join('\n')
      + (urlSure(o.lienDesabonnement) ? '\n' + T.desab + ' : ' + o.lienDesabonnement : '');

    var html = '<!doctype html><html lang="' + langue + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
      + '<body style="margin:0;background:#F3F4F6;font:15px/1.5 Arial,Helvetica,sans-serif;color:#1F2937">'
      + '<div style="max-width:640px;margin:0 auto;background:#fff;padding:20px 18px">'
      + '<div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#4B5563">SentiqS · ' + esc(quand) + '</div>'
      + blocs.map(function (b) {
        return '<h2 style="font:700 20px/1.3 Georgia,serif;margin:18px 0 6px">' + esc(T.bulletin + ' — ' + b.nom) + '</h2>'
          + '<p style="margin:0 0 8px"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-weight:700;color:#fff;background:' + (COULEUR[b.niveau] || '#1F2937') + '">'
          + esc(b.niv[0]) + '</span> ' + esc(b.niv[1]) + (b.conf ? ' · ' + esc(T.confiance + ' ' + b.conf) : '') + '</p>'
          + (b.muet ? '<p style="margin:0 0 8px;color:#4B5563">' + esc(T.muet) + '</p>'
            : '<p style="margin:0 0 6px;color:#4B5563">' + esc(T.faits + ' ' + remplir(T.fenetre, { h: b.fenetreH }) + ' : ' + b.nb + (b.recoupes ? ', ' + remplir(T.dont, { n: b.recoupes }) : '')) + '</p>'
              + (b.faits.length ? '<ul style="margin:0 0 8px;padding-left:18px">' + b.faits.map(function (f) {
                return '<li style="margin:0 0 6px">' + (f.cot ? '<b>' + esc(f.cot) + '</b> · ' : '')
                  + (f.url ? '<a href="' + esc(f.url) + '" style="color:#7A4A12">' + esc(f.titre) + '</a>' : esc(f.titre))
                  + (f.source ? ' <span style="color:#4B5563">— ' + esc(f.source) + '</span>' : '') + '</li>';
              }).join('') + '</ul>' : '<p style="margin:0 0 8px">' + esc(T.aucun) + '</p>'))
          + (b.url ? '<p style="margin:0 0 12px"><a href="' + esc(b.url) + '" style="color:#7A4A12;font-weight:700">' + esc(T.complet) + '</a></p>' : '');
      }).join('')
      + '<hr style="border:0;border-top:1px solid #E5E7EB;margin:16px 0">'
      + pied.map(function (l) { return '<p style="margin:0 0 4px;font-size:12px;color:#4B5563">' + esc(l) + '</p>'; }).join('')
      + (urlSure(o.lienDesabonnement) ? '<p style="margin:8px 0 0;font-size:12px"><a href="' + esc(o.lienDesabonnement) + '" style="color:#4B5563">' + esc(T.desab) + '</a></p>' : '')
      + '</div></body></html>';

    // Version courte : Telegram limite un message à 4 096 caractères.
    var court = texte.length > 3900 ? texte.slice(0, 3880) + '…' : texte;
    return { sujet: sujet, texte: texte, html: html, court: court, langue: langue };
  }

  // ── Consentement d'un destinataire e-mail (texte de la demande) ────────
  function composerDemandeAccord(o) {
    var en = o.langue === 'en';
    var qui = texteCourt(o.signature, SIGNATURE_MAX) || (en ? 'A SentiqS user' : 'Un utilisateur de SentiqS');
    var pays = (o.noms || []).join(', ');
    var sujet = en ? 'SentiqS — do you agree to receive security bulletins?' : 'SentiqS — acceptez-vous de recevoir des bulletins sûreté ?';
    var corps = en
      ? qui + ' (' + o.titulaire + ') would like to send you SentiqS security bulletins on: ' + pays + ', at ' + (o.heures || []).join(', ') + '.\n\nNothing will be sent unless you agree.\nI agree: ' + o.lienOui + '\nI decline: ' + o.lienNon + '\n\nIf you take no action, you will not receive anything and this request will not be repeated.'
      : qui + ' (' + o.titulaire + ') souhaite vous adresser les bulletins sûreté SentiqS sur : ' + pays + ', à ' + (o.heures || []).join(', ') + '.\n\nRien ne vous sera envoyé sans votre accord.\nJ\'accepte : ' + o.lienOui + '\nJe refuse : ' + o.lienNon + '\n\nSans réponse de votre part, vous ne recevrez rien et cette demande ne sera pas renouvelée.';
    var html = '<!doctype html><html lang="' + (en ? 'en' : 'fr') + '"><head><meta charset="utf-8"></head><body style="font:15px/1.5 Arial,sans-serif;color:#1F2937">'
      + corps.split('\n').map(function (l) {
        return '<p style="margin:0 0 8px">' + esc(l).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>') + '</p>';
      }).join('') + '</body></html>';
    return { sujet: sujet, texte: corps, html: html };
  }

  function libelleNiveau(niveau, langue) {
    var n = (langue === 'en' ? NIVEAU_EN : NIVEAU_FR)[niveau];
    return n ? n[0] + ' (' + n[1] + ')' : String(niveau || '');
  }

  var API = {
    LIMITES_FORFAIT: LIMITES_FORFAIT, MAX_PAYS: MAX_PAYS, MAX_HEURES: MAX_HEURES, MAX_EMAILS: MAX_EMAILS,
    MAX_WHATSAPP: MAX_WHATSAPP, MAX_FAITS: MAX_FAITS, RETARD_MAX_MS: RETARD_MAX_MS, FUSEAUX: FUSEAUX, JOURS: JOURS,
    RE_CODE_TELEGRAM: RE_CODE_TELEGRAM,
    fuseauValide: fuseauValide, emailValide: emailValide, numeroWhatsapp: numeroWhatsapp,
    normaliserProgrammation: normaliserProgrammation, limiteForfait: limiteForfait,
    partiesLocales: partiesLocales, instantLocal: instantLocal, creneauDu: creneauDu, prochainCreneau: prochainCreneau,
    libelleNiveau: libelleNiveau, composerMessage: composerMessage, composerDemandeAccord: composerDemandeAccord, titreDans: titreDans,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.BulletinsProgrammes = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
