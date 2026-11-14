// Bulletins programmés (14/11/2026) : règles partagées, créneaux, message,
// consentement, forfait, mode dégradé, SMTP, règles Firestore et câblage.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const B = require('../../web/js/bulletin-message.js');
const coeur = require('../lib/envoi-bulletins.js');
const smtp = require('../lib/smtp.js');
const msg = require('../lib/messageries.js');

const RACINE = path.join(__dirname, '..', '..');
const HTML = fs.readFileSync(path.join(RACINE, 'web/SentiqS_Web.html'), 'utf8');
const REGLES = fs.readFileSync(path.join(RACINE, 'firebase/firestore.rules'), 'utf8');
const PAYS = ['CI', 'ML', 'BF', 'NE', 'SN'];

function prog(o) {
  return Object.assign({ id: 'pab12cd34ef', actif: true, pays: ['CI'], heures: ['07:00'], jours: [1, 2, 3, 4, 5, 6, 7],
    fuseau: 'Africa/Abidjan', langue: 'fr', signature: 'Cellule Sûreté', canaux: { titulaire: true, emails: [], telegram: false, whatsapp: [] } }, o || {});
}

test('une programmation invalide n\'est jamais gardée à moitié', () => {
  assert.deepStrictEqual(B.normaliserProgrammation(prog({ pays: ['XX'] }), PAYS).erreurs, ['pays_requis']);
  assert.ok(B.normaliserProgrammation(prog({ heures: ['25:00'] }), PAYS).erreurs.includes('heure_requise'));
  assert.ok(B.normaliserProgrammation(prog({ fuseau: 'Mars/Olympus' }), PAYS).erreurs.includes('fuseau_invalide'));
  assert.ok(B.normaliserProgrammation(prog({ pays: PAYS.concat(['GH']) }), PAYS.concat(['GH'])).erreurs.includes('trop_de_pays'));
  // Une adresse qui porte un saut de ligne pourrait injecter un en-tête SMTP.
  assert.ok(B.normaliserProgrammation(prog({ canaux: { emails: ['a@b.com\nBcc: x@y.com'] } }), PAYS).erreurs.includes('email_invalide'));
  assert.strictEqual(B.normaliserProgrammation(prog(), PAYS).prog.pays[0], 'CI');
});

test('un numéro WhatsApp exige l\'attestation de l\'accord de son titulaire', () => {
  const sans = B.normaliserProgrammation(prog({ canaux: { whatsapp: ['+225 07 00 00 00 00'] } }), PAYS);
  assert.ok(sans.erreurs.includes('whatsapp_accord_requis'));
  const avec = B.normaliserProgrammation(prog({ canaux: { whatsapp: ['+225 07 00 00 00 00'], whatsappAccord: true } }), PAYS);
  assert.deepStrictEqual(avec.prog.canaux.whatsapp, ['2250700000000']);
});

test('limites par forfait : rien pour la découverte, grille croissante', () => {
  assert.strictEqual(B.limiteForfait('gratuit'), 0);
  assert.strictEqual(B.limiteForfait('standard'), 1);
  assert.strictEqual(B.limiteForfait('pro'), 5);
  assert.strictEqual(B.limiteForfait('entreprise'), 20);
  assert.strictEqual(B.limiteForfait('inconnu'), 0);
  assert.strictEqual(B.limiteForfait('gratuit', true), 20);
});

test('les règles Firestore portent les mêmes limites que la page', () => {
  const m = REGLES.match(/function limiteBulletins\(\)[\s\S]*?\n    \}/)[0];
  assert.match(m, /'entreprise' \? 20/);
  assert.match(m, /'pro' \? 5/);
  assert.match(m, /'standard' \? 1 : 0/);
  // Les réponses des destinataires ne se relisent jamais depuis un navigateur.
  assert.match(REGLES, /match \/reponses_destinataires\/\{jeton\}[\s\S]*?allow read, delete: if false;/);
  assert.match(REGLES, /match \/bulletins_etat\/\{id\}[\s\S]*?allow write: if false;/);
});

test('créneau : heure locale du fuseau, jamais celle du serveur', () => {
  const p = B.normaliserProgrammation(prog({ fuseau: 'Africa/Nairobi', heures: ['07:00'] }), PAYS).prog; // UTC+3
  const t = Date.parse('2026-11-14T04:20:00Z');
  assert.strictEqual(B.creneauDu(p, null, t), Date.parse('2026-11-14T04:00:00Z'));
  // Déjà envoyé : rien de plus.
  assert.strictEqual(B.creneauDu(p, Date.parse('2026-11-14T04:00:00Z'), t), null);
  // Plus de trois heures de retard : abandonné plutôt qu'envoyé périmé.
  assert.strictEqual(B.creneauDu(p, null, Date.parse('2026-11-14T07:30:00Z')), null);
  // Jour exclu : rien.
  const ouvres = B.normaliserProgrammation(prog({ jours: [1, 2, 3, 4, 5] }), PAYS).prog;
  assert.strictEqual(B.creneauDu(ouvres, null, Date.parse('2026-11-14T07:05:00Z')), null); // samedi
  // Suspendue : rien.
  assert.strictEqual(B.creneauDu(Object.assign({}, p, { actif: false }), null, t), null);
});

test('deux créneaux manqués ne partent pas en rafale : seul le dernier', () => {
  const p = B.normaliserProgrammation(prog({ heures: ['07:00', '08:00'] }), PAYS).prog;
  assert.strictEqual(B.creneauDu(p, null, Date.parse('2026-11-14T08:10:00Z')), Date.parse('2026-11-14T08:00:00Z'));
});

const INSTANTANE = { genere: '2026-11-14T06:00:00Z', pays: {
  CI: { cy: 'CI', nom: 'Côte d\'Ivoire', nomEn: 'Côte d\'Ivoire', niveau: 'jaune', confiance: 'faible', faitsNotables: 2, confirmes: 1, fenetreH: 36,
    url: 'https://ytl1-ops.github.io/SentiqS/bulletins/CI/dernier.html',
    faits: [{ titre: 'Attaque <b>signalée</b> près de Téhini', langue: 'fr', url: 'https://ex.com/a', source: 'AIP', cotation: 'confirme' },
      { titre: 'Bandits attack convoy in the north', langue: 'en', url: 'javascript:alert(1)', source: 'X', cotation: 'probable' }] } } };

test('message : une seule langue, rien d\'exécutable, lien de désabonnement', () => {
  const fr = B.composerMessage([INSTANTANE.pays.CI], { langue: 'fr', fuseau: 'Africa/Abidjan', creneauMs: Date.parse('2026-11-14T07:00:00Z'), lienDesabonnement: 'https://ytl1-ops.github.io/SentiqS/abonnement.html#non=' + 'a'.repeat(40) });
  assert.ok(!fr.texte.includes('Bandits attack'), 'un titre anglais non traduit ne passe pas dans un message français');
  assert.match(fr.texte, /Titre en anglais — traduction indisponible/);
  assert.ok(!fr.html.includes('<b>signalée</b>'), 'le titre est échappé');
  assert.ok(!fr.html.includes('javascript:'), 'aucun lien non https');
  assert.match(fr.texte, /Ne plus recevoir ce bulletin/);
  const en = B.composerMessage([INSTANTANE.pays.CI], { langue: 'en', fuseau: 'Africa/Abidjan', creneauMs: Date.now() });
  assert.ok(!en.texte.includes('Attaque'), 'un titre français non traduit ne passe pas dans un message anglais');
  assert.match(en.texte, /YELLOW \(Moderate\)/);
  assert.match(en.texte, /Bandits attack convoy/);
});

// ── Exécution, avec des doubles ─────────────────────────────────────────
function banc(o) {
  const docs = {
    'profiles/uidTest1234567': { role: 'user', status: 'active', email: 'titulaire@exemple.com', data: { plan: o.plan || 'pro' } },
  };
  Object.assign(docs, o.docs || {});
  const ecrits = {};
  const journal = [];
  const envois = { email: [], telegram: [], whatsapp: [] };
  const env = {
    firestore: {
      lister: async () => [{ id: 'uidTest1234567', data: { programmations: o.programmations, email: 'titulaire@exemple.com', telegramCode: o.code || null } }],
      lire: async (c) => (ecrits[c] || docs[c] || null),
      ecrire: async (c, v) => { ecrits[c] = JSON.parse(JSON.stringify(v)); },
    },
    maintenantMs: o.maintenant || Date.parse('2026-11-14T07:05:00Z'),
    instantane: INSTANTANE, paysValides: PAYS,
    canaux: Object.assign({ email: true, telegram: true, whatsapp: false }, o.canaux || {}),
    telegram: o.telegram || { rattachements: [], arrets: [] },
    journal: (l) => journal.push(l),
    aleatoire: (() => { let n = 0; return () => String(++n).padStart(40, 'a'); })(),
    envoyer: {
      email: async (m) => { envois.email.push(...m); return m.map(() => ({ ok: true })); },
      telegram: async (c, t) => { envois.telegram.push({ c, t }); },
      whatsapp: async (n) => { envois.whatsapp.push(n); },
    },
  };
  return { env, ecrits, journal, envois, docs };
}

test('forfait Découverte : rien n\'est envoyé, même avec une programmation écrite', async () => {
  const b = banc({ plan: 'gratuit', programmations: [prog()] });
  const r = await coeur.executer(b.env);
  assert.strictEqual(r.creneaux, 0);
  assert.strictEqual(b.envois.email.length, 0);
  assert.deepStrictEqual(b.ecrits['bulletins_etat/uidTest1234567'].progs.pab12cd34ef.erreurs, ['forfait']);
});

test('au-delà de la limite du forfait, la programmation n\'est pas envoyée', async () => {
  const b = banc({ plan: 'standard', programmations: [prog(), prog({ id: 'pzz99yy88xx' })] });
  await coeur.executer(b.env);
  assert.strictEqual(b.envois.email.length, 1);
  assert.deepStrictEqual(b.ecrits['bulletins_etat/uidTest1234567'].progs.pzz99yy88xx.erreurs, ['limite_forfait']);
});

test('une adresse tierce reçoit une demande d\'accord, jamais le bulletin sans « J\'accepte »', async () => {
  const b = banc({ programmations: [prog({ canaux: { titulaire: true, emails: ['tiers@exemple.org'] } })] });
  await coeur.executer(b.env);
  const aTiers = b.envois.email.filter((m) => m.a === 'tiers@exemple.org');
  assert.strictEqual(aTiers.length, 1);
  assert.match(aTiers[0].sujet, /acceptez-vous/);
  assert.strictEqual(b.envois.email.filter((m) => m.a === 'titulaire@exemple.com').length, 1);
  const etat = b.ecrits['bulletins_etat/uidTest1234567'];
  const d = Object.values(etat.destinataires).find((x) => x.email === 'tiers@exemple.org');
  assert.strictEqual(d.statut, 'en_attente');

  // Second passage, créneau suivant : sans réponse, ni bulletin ni nouvelle demande.
  b.env.maintenantMs = Date.parse('2026-11-15T07:05:00Z');
  b.envois.email.length = 0;
  await coeur.executer(b.env);
  assert.strictEqual(b.envois.email.filter((m) => m.a === 'tiers@exemple.org').length, 0);

  // « J'accepte » : le bulletin part au créneau suivant.
  b.docs['reponses_destinataires/' + d.jeton] = { decision: 'oui' };
  b.env.maintenantMs = Date.parse('2026-11-16T07:05:00Z');
  await coeur.executer(b.env);
  const bull = b.envois.email.filter((m) => m.a === 'tiers@exemple.org');
  assert.strictEqual(bull.length, 1);
  assert.match(bull[0].texte, /Bulletin sûreté — Côte d'Ivoire/);
  assert.ok(bull[0].desabonnement.endsWith('#non=' + d.jeton));

  // « Ne plus recevoir » : plus rien, définitivement.
  b.docs['reponses_destinataires/' + d.jeton] = { decision: 'non' };
  b.env.maintenantMs = Date.parse('2026-11-17T07:05:00Z');
  b.envois.email.length = 0;
  await coeur.executer(b.env);
  assert.strictEqual(b.envois.email.filter((m) => m.a === 'tiers@exemple.org').length, 0);
});

test('canal non branché : rien ne part, l\'état avance, aucune adresse dans le journal', async () => {
  const b = banc({ canaux: { email: false }, programmations: [prog({ canaux: { titulaire: true, emails: ['tiers@exemple.org'] } })] });
  const r = await coeur.executer(b.env);
  assert.strictEqual(b.envois.email.length, 0);
  assert.strictEqual(r.degrade, 1);
  const e = b.ecrits['bulletins_etat/uidTest1234567'].progs.pab12cd34ef;
  assert.strictEqual(e.dernierMs, Date.parse('2026-11-14T07:00:00Z'));
  assert.deepStrictEqual(e.resultat.email, { degrade: 1 });
  const tout = b.journal.join('\n');
  assert.ok(!tout.includes('titulaire@exemple.com') && !tout.includes('tiers@exemple.org'), tout);
  // La demande d'accord reste à faire : elle partira à l'activation.
  assert.strictEqual(Object.values(b.ecrits['bulletins_etat/uidTest1234567'].destinataires).find((x) => x.email === 'tiers@exemple.org').statut, 'non_demande');
});

test('Telegram : seul le chat qui a envoyé le code du compte est relié, /stop le détache', async () => {
  const code = '0123456789abcdef';
  const b = banc({ code, programmations: [prog({ canaux: { titulaire: false, telegram: true } })],
    telegram: { rattachements: [{ code, chatId: 42, titre: 'Moi' }, { code: 'ffffffffffffffff', chatId: 7, titre: 'Autre' }], arrets: [] } });
  await coeur.executer(b.env);
  assert.strictEqual(b.ecrits['bulletins_etat/uidTest1234567'].telegram.chatId, 42);
  assert.ok(b.envois.telegram.some((x) => x.c === 42 && /Bulletin sûreté/.test(x.t)));
  assert.ok(b.envois.telegram.some((x) => x.c === 7 && /inconnu/.test(x.t)));
  assert.ok(!b.envois.telegram.some((x) => x.c === 7 && /Bulletin sûreté/.test(x.t)));
  b.env.telegram = { rattachements: [], arrets: [42] };
  b.env.maintenantMs = Date.parse('2026-11-15T07:05:00Z');
  b.envois.telegram.length = 0;
  await coeur.executer(b.env);
  assert.ok(!b.envois.telegram.some((x) => /Bulletin sûreté/.test(x.t)));
});

test('lecture des commandes Telegram', () => {
  const r = msg.lireCommandes([
    { update_id: 10, message: { chat: { id: 1, first_name: 'A' }, text: '/start 0123456789abcdef' } },
    { update_id: 11, message: { chat: { id: 2, title: 'G' }, text: '/start@SentiqsBot 0123456789abcdef' } },
    { update_id: 12, message: { chat: { id: 3 }, text: '/stop' } },
    { update_id: 13, message: { chat: { id: 4 }, text: '/start <script>' } },
  ], 5);
  assert.strictEqual(r.offset, 14);
  assert.deepStrictEqual(r.rattachements.map((x) => x.chatId), [1, 2]);
  assert.deepStrictEqual(r.arrets, [3]);
});

test('SMTP : en-têtes sûrs et conversation complète', async () => {
  const m = smtp.construireMessage({ de: 'veille@exemple.com', a: 'x@y.com', sujet: 'Bulletin sûreté\r\nBcc: z@w.com', texte: 'é', html: '<p>é</p>' });
  assert.ok(!/\r\nBcc:/i.test(m), 'aucun en-tête injecté par le sujet');
  assert.match(m, /Subject: =\?UTF-8\?B\?/);
  assert.strictEqual(smtp.lireConfig({ SMTP_HOTE: 'h', SMTP_UTILISATEUR: 'u', SMTP_MOT_DE_PASSE: 'p', SMTP_PORT: '25' }), null, 'jamais en clair');

  const recu = [];
  const serveur = net.createServer((s) => {
    s.write('220 ok\r\n');
    let donnees = false; let tampon = '';
    s.on('data', (d) => {
      tampon += d.toString();
      let i;
      while ((i = tampon.indexOf('\r\n')) >= 0) {
        const l = tampon.slice(0, i); tampon = tampon.slice(i + 2);
        recu.push(l);
        if (donnees) { if (l === '.') { donnees = false; s.write('250 ok\r\n'); } continue; }
        if (/^EHLO/.test(l)) s.write('250-ok\r\n250 AUTH LOGIN\r\n');
        else if (l === 'AUTH LOGIN') s.write('334 VXNlcm5hbWU6\r\n');
        else if (l === Buffer.from('u@x.com').toString('base64')) s.write('334 UGFzc3dvcmQ6\r\n');
        else if (l === Buffer.from('secret').toString('base64')) s.write('235 ok\r\n');
        else if (/^MAIL FROM/.test(l)) s.write('250 ok\r\n');
        else if (/^RCPT TO:<refuse@/.test(l)) s.write('550 non\r\n');
        else if (/^RCPT TO/.test(l)) s.write('250 ok\r\n');
        else if (l === 'DATA') { donnees = true; s.write('354 go\r\n'); }
        else if (l === 'RSET') s.write('250 ok\r\n');
        else if (l === 'QUIT') { s.write('221 bye\r\n'); s.end(); }
      }
    });
  });
  await new Promise((r) => serveur.listen(0, r));
  const port = serveur.address().port;
  const cfg = { hote: '127.0.0.1', port: 465, utilisateur: 'u@x.com', motDePasse: 'secret', expediteur: 'u@x.com', nom: 'SentiqS' };
  const res = await smtp.envoyer(cfg, [{ a: 'refuse@x.com', sujet: 's', texte: 't', html: 'h' }, { a: 'ok@x.com', sujet: 's', texte: 't', html: 'h' }],
    { connecter: () => new Promise((ok) => { const so = net.connect(port, '127.0.0.1', () => ok(so)); }) });
  serveur.close();
  assert.deepStrictEqual(res.map((x) => x.ok), [false, true], 'un refus n\'empêche pas les suivants');
  assert.ok(!res[0].raison.includes('secret'));
  assert.ok(recu.includes('RCPT TO:<ok@x.com>'));
});

test('la page charge le module partagé et rend la section', () => {
  assert.ok(HTML.indexOf('<script src="js/bulletin-message.js"></script>') > 0);
  assert.ok(HTML.indexOf('js/bulletin-message.js') < HTML.indexOf('function resumeBulletinProgramme('));
  assert.match(HTML, /id="pmBulletins"/);
  assert.match(HTML, /function renderBulletinsProgrammes\(\)/);
  // Le job de collecte écrit l'instantané lu par l'envoi.
  const collecte = fs.readFileSync(path.join(RACINE, 'scripts/collecte-planifiee.js'), 'utf8');
  assert.match(collecte, /resumeBulletinProgramme\(c\)/);
  assert.match(collecte, /bulletins_instantanes\/courant/);
});

test('revue de Paramètres : sommaire, sous-groupes, suppression du compte en dernier', () => {
  const zone = HTML.slice(HTML.indexOf('id="pmClientArea"'), HTML.indexOf('id="pmAdminOnly"'));
  assert.match(zone, /id="pmSommaire"/);
  const ordre = ['id="pmAffichage"', 'id="pmBulletins"', 'id="pmMarque"', 'id="pmCanaux"', 'id="pmCompte"', 'id="mesConnexionsBody"', 'id="pmSuppression"'];
  const pos = ordre.map((x) => zone.indexOf(x));
  pos.forEach((p, i) => assert.ok(p > 0, ordre[i] + ' absent'));
  for (let i = 1; i < pos.length; i++) assert.ok(pos[i] > pos[i - 1], ordre[i] + ' mal placé');
  // Plus de mention d'un fournisseur abandonné dans l'aide EmailJS.
  assert.ok(!/envoyés par Supabase Auth/.test(HTML));
});

test('la page de réponse des destinataires n\'écrit qu\'un jeton et une décision', () => {
  const js = fs.readFileSync(path.join(RACINE, 'web/js/abonnement.js'), 'utf8');
  assert.match(js, /\^#\(oui\|non\)=\(\[a-f0-9\]\{40\}\)\$/);
  assert.match(js, /history\.replaceState/);
  const page = fs.readFileSync(path.join(RACINE, 'web/abonnement.html'), 'utf8');
  assert.match(page, /noindex/);
  assert.match(page, /connect-src https:\/\/firestore\.googleapis\.com/);
});
