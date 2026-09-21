// Alerte sur les pays sans actualité fraîche — voir scripts/lib/alerte-couverture.js.
//
// Aucun test n'atteint le reseau : ce module ne fait que construire le
// message et l'etat, l'envoi lui-meme est deja teste dans
// alerte-sortante.test.js (meme fonction `envoyer`, reutilisee).
const test = require('node:test');
const assert = require('node:assert');
const AC = require('../lib/alerte-couverture.js');

test('au tout premier run, un pays sans actualite produit deja un message', () => {
  // Contrairement a un changement de niveau, il n y a pas de « pays
  // nouvellement suivi » a exclure ici : un pays sans actualite des le
  // premier signalement est une information utile, pas un faux depart.
  const m = AC.construireMessage(['BI', 'ER'], null);
  assert.notStrictEqual(m, null);
  assert.match(m.text, /2 pays sans actualité/);
  assert.match(m.text, /• BI/);
  assert.match(m.text, /• ER/);
});

test('un ensemble identique au dernier signalement ne repart pas', () => {
  const etat = AC.etatSuivant(['BI', 'ER', 'KM']);
  const m = AC.construireMessage(['BI', 'ER', 'KM'], etat);
  assert.strictEqual(m, null, 'le job tourne 5 a 15 fois par jour : sans ce garde-fou chaque passage reenverrait la meme alerte');
});

test('un ensemble identique mais dans un autre ordre ne repart pas non plus', () => {
  // La cle est triee : l ordre dans lequel couverture.paysSansArticleFrais
  // liste les codes ne doit jamais, a lui seul, declencher un nouvel envoi.
  const etat = AC.etatSuivant(['ER', 'BI', 'KM']);
  const m = AC.construireMessage(['KM', 'BI', 'ER'], etat);
  assert.strictEqual(m, null);
});

test('un pays de plus dans l ensemble repart comme une alerte neuve', () => {
  const etat = AC.etatSuivant(['BI', 'ER']);
  const m = AC.construireMessage(['BI', 'ER', 'SC'], etat);
  assert.notStrictEqual(m, null);
  assert.match(m.text, /3 pays sans actualité/);
  assert.match(m.text, /• SC/);
});

test('un pays de moins dans l ensemble repart aussi', () => {
  // Une amelioration partielle reste un changement d ensemble : silence
  // total ici masquerait qu un pays est repasse muet un peu plus tot.
  const etat = AC.etatSuivant(['BI', 'ER', 'SC']);
  const m = AC.construireMessage(['BI', 'ER'], etat);
  assert.notStrictEqual(m, null);
  assert.match(m.text, /2 pays sans actualité/);
});

test('le retour a un ensemble vide annonce la couverture retablie', () => {
  const etat = AC.etatSuivant(['BI', 'ER']);
  const m = AC.construireMessage([], etat);
  assert.notStrictEqual(m, null);
  assert.match(m.text, /couverture rétablie/);
});

test('un ensemble vide qui reste vide ne produit rien', () => {
  const etat = AC.etatSuivant([]);
  const m = AC.construireMessage([], etat);
  assert.strictEqual(m, null);
});

test("l'alerte ne porte pas de nom de pays, seulement des codes", () => {
  // Volontairement pas de lexique code->nom ici : le format reprend tel
  // quel ce que collecte-planifiee.js journalise deja.
  const m = AC.construireMessage(['ML'], null);
  assert.doesNotMatch(m.text, /Mali/i);
  assert.match(m.text, /• ML/);
});

test('la charge utile est le denominateur commun Slack/Teams', () => {
  const m = AC.construireMessage(['ML'], null);
  assert.deepStrictEqual(Object.keys(m), ['text'],
    'un seul champ : tout ajout casserait la compatibilite avec un des deux');
});

test('etatSuivant normalise l ordre, independamment de celui recu', () => {
  assert.deepStrictEqual(AC.etatSuivant(['SC', 'BI']), AC.etatSuivant(['BI', 'SC']));
});

test('etatSuivant sur un ensemble vide produit une cle vide, pas absente', () => {
  const e = AC.etatSuivant([]);
  assert.strictEqual(e.cle, '');
  assert.deepStrictEqual(e.pays, []);
});
