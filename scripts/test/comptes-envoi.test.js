// Identifiants d'envoi apportés par l'utilisateur (14/11/2026) : son compte
// WhatsApp Business et l'adresse e-mail qui envoie ses bulletins. Chiffrement
// dans la page, déchiffrement par le job seul, aucun secret dans un journal ni
// dans un document relisible, essais, règles Firestore et câblage.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const W = require('../../web/js/identifiants-envoi.js');
const ident = require('../lib/identifiants-envoi.js');
const coeur = require('../lib/envoi-bulletins.js');

const RACINE = path.join(__dirname, '..', '..');
const HTML = fs.readFileSync(path.join(RACINE, 'web/SentiqS_Web.html'), 'utf8');
const REGLES = fs.readFileSync(path.join(RACINE, 'firebase/firestore.rules'), 'utf8');
const FLUX = fs.readFileSync(path.join(RACINE, '.github/workflows/envoi-bulletins.yml'), 'utf8');

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PRIVEE = privateKey.export({ type: 'pkcs8', format: 'pem' });
const PUBLIQUE = ident.clePublique(PRIVEE);
const JETON = 'EAAG' + 'x'.repeat(180);
const MDP = 'abcd efgh ijkl mnop';

test('le secret chiffré par la page n\'est relu que par la clé privée du job', async () => {
  const c = await W.chiffrer(JETON, PUBLIQUE);
  assert.deepStrictEqual(Object.keys(c).sort(), ['cle', 'donnees', 'iv', 'v']);
  assert.ok(!JSON.stringify(c).includes(JETON.slice(0, 20)), 'rien de lisible dans le chiffré');
  assert.strictEqual(ident.dechiffrer(c, PRIVEE), JETON);
  // Une autre clé (rotation du compte de service) : illisible, jamais un envoi au hasard.
  const autre = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  const r = ident.configWhatsapp({ chiffre: c, numeroId: '123456789012345', modele: 'bulletin_surete', langue: 'fr' }, autre);
  assert.match(r.erreur, /illisibles/);
  assert.ok(!r.cfg);
  // Chiffré altéré : refusé (AES-GCM authentifie).
  const altere = Object.assign({}, c, { donnees: Buffer.from('z'.repeat(220)).toString('base64') });
  assert.match(ident.configWhatsapp({ chiffre: altere, numeroId: '123456789012345', modele: 'm', langue: 'fr' }, PRIVEE).erreur, /illisibles/);
});

test('formats vérifiés avant tout envoi : WhatsApp et SMTP', () => {
  assert.deepStrictEqual(W.verifierWhatsapp({ jeton: JETON, numeroId: '123456789012345', modele: 'bulletin_surete', langue: 'fr' }), []);
  assert.ok(W.verifierWhatsapp({ jeton: 'court', numeroId: '+225 07', modele: 'Bulletin Sûreté', langue: 'français' }).length === 4);
  assert.deepStrictEqual(W.verifierSmtp({ hote: 'smtp.gmail.com', port: 465, utilisateur: 'a@b.com', motDePasse: MDP, expediteur: 'a@b.com' }), []);
  // Un port en clair ou un saut de ligne (injection d'en-tête) sont refusés.
  assert.ok(W.verifierSmtp({ hote: 'smtp.gmail.com', port: 25, utilisateur: 'a', motDePasse: MDP, expediteur: 'a@b.com' }).includes('smtp_port'));
  assert.ok(W.verifierSmtp({ hote: 'smtp.gmail.com', port: 465, utilisateur: 'a', motDePasse: MDP, expediteur: 'a@b.com', nom: 'X\r\nBcc: y' }).includes('smtp_nom'));
  assert.ok(W.verifierSmtp({ hote: '127.0.0.1', port: 465, utilisateur: 'a', motDePasse: MDP, expediteur: 'a@b.com' }).includes('smtp_hote'));
});

test('le nettoyage retire le secret de tout texte qui sort du job', () => {
  assert.ok(!ident.nettoyer('Invalid OAuth ' + JETON + ' token', JETON).includes(JETON));
  assert.ok(!/EAA[A-Za-z0-9]{20}/.test(ident.nettoyer('jeton EAABBBBBBBBBBBBBBBBBBBBBBBBBB refusé')));
  assert.ok(!ident.nettoyer('535 auth failed for ' + MDP, MDP).includes(MDP));
});

// ── Exécution, avec des doubles ─────────────────────────────────────────
function prog(o) {
  return Object.assign({ id: 'pab12cd34ef', actif: true, pays: ['CI'], heures: ['07:00'], jours: [1, 2, 3, 4, 5, 6, 7],
    fuseau: 'Africa/Abidjan', langue: 'fr', signature: '', canaux: { titulaire: true, emails: [], telegram: false, whatsapp: [] } }, o || {});
}
const INSTANTANE = { genere: '2026-11-14T06:00:00Z', pays: { CI: { cy: 'CI', nom: 'Côte d\'Ivoire', niveau: 'jaune', faitsNotables: 2, faits: [], url: 'https://ytl1-ops.github.io/SentiqS/bulletins/CI/dernier.html' } } };

async function banc(o) {
  const cols = {
    bulletins_programmes: o.programmations ? [{ id: 'uidTest1234567', data: { programmations: o.programmations, email: 'titulaire@exemple.com' } }] : [],
    whatsapp_comptes: o.wa ? [{ id: 'uidTest1234567', data: o.wa }] : [],
    smtp_comptes: o.smtp ? [{ id: 'uidTest1234567', data: o.smtp }] : [],
  };
  const docs = { 'profiles/uidTest1234567': { role: 'user', status: 'active', email: 'titulaire@exemple.com', data: { plan: o.plan || 'pro' } } };
  const ecrits = {};
  const journal = [];
  const envois = { email: [], whatsapp: [], essais: [] };
  const env = {
    firestore: {
      lister: async (c) => cols[c] || [],
      lire: async (c) => (ecrits[c] || docs[c] || null),
      ecrire: async (c, v) => { ecrits[c] = JSON.parse(JSON.stringify(v)); },
    },
    maintenantMs: Date.parse('2026-11-14T07:05:00Z'),
    instantane: INSTANTANE, paysValides: ['CI'],
    canaux: { email: !!o.emailEditeur, telegram: false },
    configs: { whatsapp: (d) => ident.configWhatsapp(d, PRIVEE), smtp: (d) => ident.configSmtp(d, PRIVEE) },
    journal: (l) => journal.push(l),
    aleatoire: (() => { let n = 0; return () => String(++n).padStart(40, 'a'); })(),
    envoyer: {
      email: async (m, cfg) => { envois.email.push(...m.map((x) => Object.assign({ cfg }, x))); return m.map(() => ({ ok: true })); },
      telegram: async () => {},
      whatsapp: async (cfg, num) => { if (o.waEchec) throw new Error('Invalid token ' + cfg.jeton); envois.whatsapp.push({ cfg, num }); },
      whatsappEssai: async (cfg, num) => { envois.essais.push({ cfg, num }); },
    },
  };
  return { env, ecrits, journal, envois, cols };
}
const doc = async (secret, extra) => Object.assign({ chiffre: await W.chiffrer(secret, PUBLIQUE) }, extra);

test('WhatsApp part du compte de l\'utilisateur, jamais sans lui', async () => {
  const sans = await banc({ programmations: [prog({ canaux: { titulaire: false, whatsapp: ['2250700000000'], whatsappAccord: true } })] });
  await coeur.executer(sans.env);
  assert.strictEqual(sans.envois.whatsapp.length, 0);
  assert.deepStrictEqual(sans.ecrits['bulletins_etat/uidTest1234567'].progs.pab12cd34ef.resultat.whatsapp, { degrade: 1, sansCompte: true });

  const avec = await banc({ programmations: [prog({ canaux: { titulaire: false, whatsapp: ['2250700000000'], whatsappAccord: true } })],
    wa: await doc(JETON, { numeroId: '123456789012345', modele: 'bulletin_surete', langue: 'fr' }) });
  await coeur.executer(avec.env);
  assert.strictEqual(avec.envois.whatsapp.length, 1);
  assert.strictEqual(avec.envois.whatsapp[0].cfg.jeton, JETON);
  assert.strictEqual(avec.envois.whatsapp[0].cfg.numeroId, '123456789012345');
  const etat = JSON.stringify(avec.ecrits['bulletins_etat/uidTest1234567']);
  assert.ok(!etat.includes(JETON) && !avec.journal.join('\n').includes(JETON));
  assert.match(avec.ecrits['bulletins_etat/uidTest1234567'].comptes.whatsapp.resume, /•••2345/);
});

test('une erreur de Meta qui cite le jeton est nettoyée avant d\'être écrite', async () => {
  const b = await banc({ waEchec: true, programmations: [prog({ canaux: { titulaire: false, whatsapp: ['2250700000000'], whatsappAccord: true } })],
    wa: await doc(JETON, { numeroId: '123456789012345', modele: 'bulletin_surete', langue: 'fr' }) });
  await coeur.executer(b.env);
  const tout = JSON.stringify(b.ecrits) + b.journal.join('\n');
  assert.ok(!tout.includes(JETON), 'aucun jeton dans l\'état ni le journal');
  assert.strictEqual(b.ecrits['bulletins_etat/uidTest1234567'].progs.pab12cd34ef.resultat.whatsapp.echecs, 1);
});

test('essai : une seule fois par demande, résultat sans secret, même sans programmation', async () => {
  const b = await banc({ wa: await doc(JETON, { numeroId: '123456789012345', modele: 'bulletin_surete', langue: 'fr', essai: '2250700000000', essaiDemande: '2026-11-14T07:00:00Z' }) });
  await coeur.executer(b.env);
  assert.strictEqual(b.envois.essais.length, 1);
  assert.strictEqual(b.envois.essais[0].num, '2250700000000');
  const c = b.ecrits['bulletins_etat/uidTest1234567'].comptes.whatsapp;
  assert.strictEqual(c.statut, 'ok');
  assert.ok(!c.message.includes('2250700000000'), 'le numéro est masqué');
  await coeur.executer(b.env);
  assert.strictEqual(b.envois.essais.length, 1, 'la même demande ne repart pas à chaque passage');
});

test('forfait Découverte : ni essai ni envoi avec un compte apporté', async () => {
  const b = await banc({ plan: 'gratuit', wa: await doc(JETON, { numeroId: '123456789012345', modele: 'bulletin_surete', langue: 'fr', essai: '2250700000000', essaiDemande: '2026-11-14T07:00:00Z' }) });
  await coeur.executer(b.env);
  assert.strictEqual(b.envois.essais.length, 0);
  assert.match(b.ecrits['bulletins_etat/uidTest1234567'].comptes.whatsapp.message, /forfaits payants/);
});

test('e-mail : l\'adresse désignée par l\'utilisateur envoie, même sans serveur de l\'éditeur', async () => {
  const smtpDoc = await doc(MDP, { hote: 'smtp.gmail.com', port: 465, utilisateur: 'veille@exemple.com', expediteur: 'veille@exemple.com', nom: 'Cellule Sûreté', essaiDemande: '2026-11-14T07:00:00Z' });
  const b = await banc({ emailEditeur: false, programmations: [prog()], smtp: smtpDoc });
  await coeur.executer(b.env);
  const bulletin = b.envois.email.find((m) => m.a === 'titulaire@exemple.com');
  assert.ok(bulletin, 'le bulletin part');
  assert.strictEqual(bulletin.cfg.expediteur, 'veille@exemple.com');
  assert.strictEqual(bulletin.cfg.motDePasse, MDP);
  const essai = b.envois.email.find((m) => m.a === 'veille@exemple.com');
  assert.match(essai.sujet, /essai/);
  const etat = b.ecrits['bulletins_etat/uidTest1234567'];
  assert.strictEqual(etat.comptes.smtp.statut, 'ok');
  assert.ok(!JSON.stringify(etat).includes(MDP) && !b.journal.join('\n').includes(MDP));

  // Sans compte apporté ni serveur de l'éditeur : rien ne part, l'état avance.
  const rien = await banc({ emailEditeur: false, programmations: [prog()] });
  await coeur.executer(rien.env);
  assert.strictEqual(rien.envois.email.length, 0);
  assert.deepStrictEqual(rien.ecrits['bulletins_etat/uidTest1234567'].progs.pab12cd34ef.resultat.email, { degrade: 1 });
});

test('règles : identifiants jamais relisibles, écrits par leur titulaire seul, déjà chiffrés', () => {
  for (const col of ['whatsapp_comptes', 'smtp_comptes']) {
    const bloc = REGLES.match(new RegExp('match /' + col + '/\\{uid\\} \\{[\\s\\S]*?\\n    \\}'))[0];
    assert.match(bloc, /allow read: if false;/);
    assert.match(bloc, /request\.auth\.uid == uid && profilActif\(\)/);
    assert.match(bloc, /chiffreBienForme\(request\.resource\.data\.chiffre\)/);
    assert.ok(!/jeton|motDePasse/.test(bloc.replace(/\/\/.*$/gm, '')), 'aucun champ en clair pour le secret');
  }
  assert.match(REGLES, /request\.resource\.data\.port in \[465, 587\]/);
});

test('aucun secret WhatsApp côté éditeur, et la page chiffre avant d\'écrire', () => {
  assert.ok(!/WHATSAPP_/.test(FLUX), 'le job ne lit plus de compte WhatsApp de l\'éditeur');
  assert.match(HTML, /<script src="js\/identifiants-envoi\.js"><\/script>/);
  const f = HTML.slice(HTML.indexOf('async function bpEnregistrerCompte'), HTML.indexOf('async function bpEssaiCompte'));
  assert.ok(f.indexOf('IdentifiantsEnvoi.chiffrer') > 0 && f.indexOf('IdentifiantsEnvoi.chiffrer') < f.indexOf('.upsert('), 'chiffré avant l\'écriture');
  assert.ok(!/ligne\.(jeton|motDePasse)\s*=/.test(f), 'le secret en clair n\'est jamais dans la ligne écrite');
  // Champs secrets : masqués, jamais pré-remplis.
  assert.match(HTML, /type="password" id="bpWaJeton" autocomplete="new-password">/);
  assert.match(HTML, /type="password" id="bpSmtpMdp" autocomplete="new-password">/);
  // Guide pas à pas dans les deux langues.
  assert.match(HTML, /Utilisateurs système/);
  assert.match(HTML, /System users/);
  assert.match(HTML, /bulletin_surete/);
});
