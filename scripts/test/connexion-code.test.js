// Connexion et inscription par code envoye par e-mail, sans mot de passe —
// 21/10/2026. Les deux portes (ecran de connexion de l'application et fenetre
// « Essai gratuit » de l'accueil) passent par signInWithOtp (qui cree le
// compte s'il n'existe pas) puis verifyOtp. Le mot de passe reste possible.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { HTML, tranche } = require('./_bac');
const ACCUEIL = fs.readFileSync(path.join(__dirname, '../../web/index.html'), 'utf8');

function bacOtp() {
  const ctx = { t: (k) => k, document: { getElementById: () => null } };
  vm.createContext(ctx);
  vm.runInContext(tranche('function normaliserCodeOtp', 'function _otpErreur') + '\nthis.n = normaliserCodeOtp; this.m = messageErreurOtp;', ctx);
  return ctx;
}

test('un code se lit tel qu\'on le colle : espaces et tirets ignores, 6 a 10 chiffres', () => {
  const { n } = bacOtp();
  assert.strictEqual(n('123456'), '123456');
  assert.strictEqual(n(' 123 456 '), '123456');
  assert.strictEqual(n('123-456'), '123456');
  assert.strictEqual(n('12345'), null, 'trop court');
  assert.strictEqual(n('12345678901'), null, 'trop long');
  assert.strictEqual(n('12a456'), null);
  assert.strictEqual(n(''), null);
  assert.strictEqual(n(undefined), null);
});

test('les erreurs du serveur sont dites en clair, la limite de debit comprise', () => {
  const { m } = bacOtp();
  assert.strictEqual(m({ message: 'For security purposes, you can only request this after 52 seconds' }, true), 'otp_err_rate');
  assert.strictEqual(m({ message: 'email rate limit exceeded' }, true), 'otp_err_rate');
  assert.strictEqual(m({ message: 'Signups not allowed for otp' }, true), 'otp_err_signup');
  assert.strictEqual(m({ message: 'boom' }, true), 'otp_err_send');
  assert.strictEqual(m({ message: 'Token has expired or is invalid' }, false), 'otp_err_code');
});

test('l\'application cree le compte par signInWithOtp et ouvre la session par verifyOtp', () => {
  const f = tranche('async function envoyerCodeEmail', 'function renvoyerCodeEmail');
  assert.match(f, /signInWithOtp\(\{ email, options: \{ shouldCreateUser: true/);
  const v = tranche('async function verifierCodeEmail', '// doRegister()');
  assert.match(v, /verifyOtp\(\{ email: _otpEmail, token: code, type: 'email' \}\)/);
  assert.match(v, /_ouvrirSessionDepuisSupabase\(data\.user\)/, 'meme porte d\'entree que le mot de passe : statut, essai expire, profil');
});

test('le premier passage cree un profil gratuit date (sinon l\'essai de 72 h ne s\'eteint jamais)', () => {
  const f = tranche('async function _ouvrirSessionDepuisSupabase', 'const user = _profilVersUtilisateur(row)');
  assert.match(f, /data: \{ plan: 'gratuit', createdAt: new Date\(\)\.toISOString\(\) \}/);
});

test('la connexion par mot de passe reste disponible', () => {
  assert.match(HTML, /signInWithPassword\(\{ email, password: pass \}\)/);
  assert.match(HTML, /id="loginPassBloc"[^>]*display:none/, 'le champ est la, replie par defaut');
  assert.match(HTML, /onclick="basculerModeConnexion\(\)"/);
  assert.match(HTML, /onclick="showForgotPasswordForm\(\)"/);
  assert.match(HTML, /onclick="showRegisterForm\(\)"/, 'le compte avec mot de passe reste possible');
});

test('chaque ecran qui masque les autres formulaires masque aussi celui du code', () => {
  const n = (HTML.match(/getElementById\('forgotPasswordForm'\)\.style\.display='none';document\.getElementById\('otpForm'\)\.style\.display='none';/g) || []).length;
  assert.strictEqual(n, 4);
  assert.match(tranche('function showForgotPasswordForm', "document.getElementById('fpEmail').value"), /otpForm'\)\.style\.display='none'/);
});

test('le renvoi est limite a une fois par minute', () => {
  assert.match(HTML, /const OTP_RENVOI_MS = 60000;/);
  assert.match(tranche('function renvoyerCodeEmail', 'function _otpDecompte'), /Date\.now\(\) >= _otpProchainEnvoi/);
  assert.match(tranche('async function envoyerCodeEmail', 'function renvoyerCodeEmail'), /renvoi && Date\.now\(\) < _otpProchainEnvoi\) return/);
});

test('le retour d\'un lien e-mail ne contourne pas la reconnexion quotidienne', () => {
  const c = tranche('const _retourLien = ', 'if (session && session.user && (_retourLien');
  assert.match(c, /last_sign_in_at/, 'la fraicheur est lue sur la reponse du serveur');
  assert.match(c, /< 120000/);
  assert.match(c, /session && session\.user/, 'sans session reelle, aucun lien ne suffit');
  assert.match(c, /#connexion-fraiche/);
});

test('l\'accueil : « Essai gratuit » ne demande plus de mot de passe et passe par le code', () => {
  const modal = ACCUEIL.slice(ACCUEIL.indexOf('id="signupOverlay"'), ACCUEIL.indexOf('<!-- Supabase JS'));
  assert.doesNotMatch(modal, /type="password"/);
  assert.match(modal, /id="suEmail"/);
  assert.match(modal, /autocomplete="one-time-code"/);
  assert.match(ACCUEIL, /signInWithOtp\(\{ email, options: \{ shouldCreateUser: true/);
  assert.match(ACCUEIL, /verifyOtp\(\{ email: _suEmail, token: code, type: 'email' \}\)/);
  assert.doesNotMatch(ACCUEIL, /auth\.signUp\(/);
  assert.match(ACCUEIL, /location\.href = 'SentiqS_Web\.html#connexion-fraiche'/);
});

test('l\'accueil n\'ecrase jamais le profil d\'un compte existant', () => {
  const f = ACCUEIL.slice(ACCUEIL.indexOf('async function verifierCodeInscription'));
  assert.match(f, /from\('profiles'\)\.select\('id'\)\.eq\('id', data\.user\.id\)\.maybeSingle\(\)[\s\S]*if \(!existant\)/);
});

test('le nom et l\'organisation sont facultatifs, la case d\'usage professionnel reste exigee', () => {
  const f = ACCUEIL.slice(ACCUEIL.indexOf('async function _envoyerCodeInscription'), ACCUEIL.indexOf('function _suDecompte'));
  assert.match(f, /suTerms'\)\.checked/);
  assert.doesNotMatch(f, /!name|!org/);
});

test('les textes du code existent dans les deux langues', () => {
  for (const k of ['otp_send', 'otp_title', 'otp_verify', 'otp_resend', 'otp_resend_in', 'otp_change', 'otp_err_code', 'otp_err_rate', 'otp_err_send', 'otp_use_password', 'otp_use_code']) {
    assert.strictEqual((HTML.match(new RegExp('\\b' + k + ':', 'g')) || []).length, 2, k + ' doit exister en FR et en EN');
  }
});
