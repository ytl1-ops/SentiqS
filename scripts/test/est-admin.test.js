// estAdmin(u) — voir web/SentiqS_Web.html, section "Admin".
//
// Correctif du 21/09/2026 : l'adresse reelle de l'administrateur vivait en
// clair dans ADMIN_EMAIL, servie a chaque visiteur via web/SentiqS_Web.html
// (GitHub Pages) — lisible par "Afficher le code source". La vraie
// frontiere de securite (qui recoit le role 'admin') vit deja cote serveur
// (trigger before insert de profiles_auth.sql, jamais servi par Pages) ;
// estAdmin() ne fait plus que LIRE ce role, sans jamais comparer une
// adresse figee dans ce fichier.
const test = require('node:test');
const assert = require('node:assert');
const { bac, exposer, tranche } = require('./_bac.js');

function construireBac(utilisateurs) {
  const mockUsers = `function getUsers() { return ${JSON.stringify(utilisateurs)}; }`;
  const ctx = bac(mockUsers, tranche('function estAdmin', 'function _maskEmail'));
  return exposer(ctx, 'estAdmin');
}

test('un objet qui porte deja .role="admin" est reconnu sans consulter getUsers', () => {
  const ctx = construireBac([]); // getUsers() vide : si estAdmin le consultait, ce test tomberait
  assert.strictEqual(ctx.estAdmin({ email: 'x@y.test', role: 'admin' }), true);
});

test('un objet avec un role different n est jamais admin', () => {
  const ctx = construireBac([]);
  assert.strictEqual(ctx.estAdmin({ email: 'x@y.test', role: 'user' }), false);
  assert.strictEqual(ctx.estAdmin({ email: 'x@y.test', role: 'reader' }), false);
});

test('un objet SANS .role (ex. stats agregees) retombe sur une recherche par email', () => {
  const ctx = construireBac([{ email: 'admin@sentiqs.test', role: 'admin' }, { email: 'autre@sentiqs.test', role: 'user' }]);
  assert.strictEqual(ctx.estAdmin({ email: 'admin@sentiqs.test', n: 42 }), true);
  assert.strictEqual(ctx.estAdmin({ email: 'autre@sentiqs.test', n: 3 }), false);
});

test('une adresse email brute (chaine) est acceptee et cherchee dans les profils', () => {
  const ctx = construireBac([{ email: 'admin@sentiqs.test', role: 'admin' }]);
  assert.strictEqual(ctx.estAdmin('admin@sentiqs.test'), true);
  assert.strictEqual(ctx.estAdmin('inconnu@sentiqs.test'), false);
});

test('une session/valeur vide ou nulle n est jamais admin', () => {
  const ctx = construireBac([{ email: 'admin@sentiqs.test', role: 'admin' }]);
  assert.strictEqual(ctx.estAdmin(null), false);
  assert.strictEqual(ctx.estAdmin(undefined), false);
  assert.strictEqual(ctx.estAdmin(''), false);
  assert.strictEqual(ctx.estAdmin({}), false);
});

test('aucune adresse n est comparee en dur : deux profils admin differents sont tous deux reconnus', () => {
  // Preuve que la reconnaissance passe par le role, jamais par une adresse
  // ecrite dans ce fichier — deux comptes differents, tous deux role=admin,
  // doivent l'un comme l'autre etre reconnus.
  const ctx = construireBac([
    { email: 'proprietaire-a@exemple.test', role: 'admin' },
    { email: 'proprietaire-b@exemple.test', role: 'admin' },
  ]);
  assert.strictEqual(ctx.estAdmin('proprietaire-a@exemple.test'), true);
  assert.strictEqual(ctx.estAdmin('proprietaire-b@exemple.test'), true);
});
