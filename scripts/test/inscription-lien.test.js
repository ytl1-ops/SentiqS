// La fenêtre d'inscription de l'accueil est remise à neuf à chaque ouverture
// (SIGNUP_FORM_HTML, capturé avant le passage en mode « lien »). Constat du
// 13/11/2026 : chaque clic sur « Essai gratuit » ou un forfait annonçait un
// « code » alors que Firebase envoie un lien, et MASQUAIT « Continuer avec
// Google », seule porte d'entrée une fois atteint le quota de cinq liens par
// jour du plan gratuit — le message d'erreur renvoyait même vers ce bouton.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'index.html'), 'utf8');
const corps = (nom) => {
  const i = HTML.indexOf('function ' + nom + '(');
  assert.ok(i !== -1, nom + ' introuvable');
  return HTML.slice(i, HTML.indexOf('\n}\n', i));
};

test("ouvrir l'inscription réapplique le mode lien APRÈS la remise à neuf du formulaire", () => {
  const f = corps('openSignup');
  const reset = f.indexOf('SIGNUP_FORM_HTML');
  const rappel = f.indexOf('appliquerModeLienInscription()');
  assert.ok(reset !== -1, 'la remise à neuf a disparu : revoir ce test');
  assert.ok(rappel > reset, 'appliquerModeLienInscription() doit suivre la remise à neuf');
  // ... et après les textes « code » posés par openSignup, sinon ils l'emportent.
  assert.ok(rappel > f.lastIndexOf("'Recevoir mon code'"), 'le mode lien doit passer après les textes « code »');
});

test('le mode lien rend visible « Continuer avec Google »', () => {
  assert.match(corps('appliquerModeLienInscription'), /suGoogleBtn[^\n]*display\s*=\s*'block'/);
});
