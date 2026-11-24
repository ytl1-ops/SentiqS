// Formulaire « Nous contacter » (22/11/2026). Voir web/js/contact.js.
//
// L'éditeur n'a pas d'adresse professionnelle et son adresse personnelle ne
// doit plus figurer sur le site : un message part dans Firestore
// (messages_contact), lu par l'administrateur seul. « Signaler un problème »,
// qu'il remplace, rangeait la réclamation dans le navigateur de son auteur :
// l'administrateur ne la voyait jamais, et le tableau l'affichait sans
// l'échapper.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const C = require(path.join(RACINE, 'web', 'js', 'contact.js'));
const HTML = fs.readFileSync(path.join(RACINE, 'web', 'SentiqS_Web.html'), 'utf8');
const REGLES = fs.readFileSync(path.join(RACINE, 'firebase', 'firestore.rules'), 'utf8');
const CFG = { projectId: 'demo', apiKey: 'cle' };
const bon = { nom: 'Awa', email: 'awa@exemple.org', objet: 'droits_acces', message: 'Je souhaite une copie de mes données.' };

test('validation : un message correct passe, chaque défaut a son code', () => {
  const ouvertLe = 0, maintenant = 10000;
  assert.ok(C.valider(bon, { ouvertLe, maintenant }).ok);
  const code = (champs, o) => C.valider(Object.assign({}, bon, champs), Object.assign({ ouvertLe, maintenant }, o)).erreurs;
  assert.deepStrictEqual(code({ piege: 'http://spam' }), ['piege']);
  assert.deepStrictEqual(code({}, { ouvertLe: 9000 }), ['trop_vite']);
  assert.deepStrictEqual(code({ email: 'pas-une-adresse' }), ['email']);
  assert.deepStrictEqual(code({ objet: 'pirate' }), ['objet']);
  assert.deepStrictEqual(code({ message: 'court' }), ['message_court']);
  assert.deepStrictEqual(code({ message: 'x'.repeat(3001) }), ['message_long']);
  assert.deepStrictEqual(code({ message: 'voir https://a.b https://c.d https://e.f https://g.h' }), ['liens']);
  // Les invisibles (contrôle, direction) sont retirés avant de compter.
  const r = C.valider(Object.assign({}, bon, { message: '‮txet‬\u0000 normal, assez long' }), { ouvertLe, maintenant });
  assert.ok(r.ok);
  assert.doesNotMatch(r.donnees.message, /[‮‬\u0000]/);
});

function fauxFetch(reponses) {
  const appels = [];
  const f = (url, opts) => { appels.push({ url, opts }); const st = reponses.shift(); return Promise.resolve({ ok: st === 200, status: st }); };
  f.appels = appels;
  return f;
}

test('un compte connecté : ses trois emplacements du jour, dans l\'ordre, avec son jeton', async () => {
  const d = C.valider(bon, {}).donnees;
  const f = fauxFetch([409, 200]);
  const r = await C.deposer(CFG, { Authorization: 'Bearer j' }, d, { uid: 'u1', lang: 'fr', fetchFn: f, maintenant: 86400000 * 20000 + 5 });
  assert.deepStrictEqual(r, { id: 'u1_20000_1', n: 1 });
  assert.match(f.appels[0].url, /messages_contact\?documentId=u1_20000_0&key=cle$/);
  assert.strictEqual(f.appels[0].opts.headers.Authorization, 'Bearer j');
  const champs = JSON.parse(f.appels[1].opts.body).fields;
  assert.strictEqual(champs.statut.stringValue, 'nouveau');
  assert.strictEqual(champs.uid.stringValue, 'u1');
  // Trois emplacements pris : quota, sans quatrième essai.
  const g = fauxFetch([409, 409, 409]);
  assert.deepStrictEqual(await C.deposer(CFG, {}, d, { uid: 'u1', fetchFn: g }), { erreur: 'quota' });
  assert.strictEqual(g.appels.length, C.LIMITE_COMPTE);
});

test('sans compte : clé anon_, aucun jeton, emplacements tirés au hasard et bornés', async () => {
  const d = C.valider(bon, {}).donnees;
  const f = fauxFetch([200]);
  const r = await C.deposer(CFG, null, d, { uid: '', fetchFn: f, alea: () => 0 });
  assert.match(r.id, /^anon_\d+_\d+$/);
  assert.strictEqual(f.appels[0].opts.headers.Authorization, undefined);
  assert.strictEqual(JSON.parse(f.appels[0].opts.body).fields.uid.stringValue, '');
  const ordre = C.ordreEmplacements('', 0, Math.random);
  assert.ok(ordre.length <= 8 && ordre.every((n) => n >= 0 && n < C.LIMITE_ANONYME));
  // Panne réseau : dite comme telle.
  assert.deepStrictEqual(await C.deposer(CFG, null, d, { fetchFn: () => Promise.reject(new Error('x')) }), { erreur: 'reseau' });
});

test('lecture côté admin : un document douteux est assaini, un identifiant forgé écarté', () => {
  const doc = (id, f) => ({ name: 'projects/p/databases/(default)/documents/messages_contact/' + id, fields: f });
  const s = (v) => ({ stringValue: v });
  const m = C.messageDepuisDoc(doc('u_1_0', { email: s('pas valide'), objet: s('inconnu'), statut: s('bizarre'), message: s('<img src=x onerror=alert(1)>') }));
  assert.strictEqual(m.email, '');
  assert.strictEqual(m.objet, 'autre');
  assert.strictEqual(m.statut, 'nouveau');
  assert.strictEqual(C.messageDepuisDoc(doc("x'onclick=1", { message: s('bonjour à vous') })), null);
  const l = C.trierMessages([{ statut: 'traite', at: '2026-11-23' }, { statut: 'nouveau', at: '2026-11-01' }, { statut: 'nouveau', at: '2026-11-20' }]);
  assert.deepStrictEqual(l.map((x) => x.at), ['2026-11-20', '2026-11-01', '2026-11-23']);
  assert.strictEqual(C.lienReponse({ email: 'a@b.org', objet: 'facturation', lang: 'fr' }), 'mailto:a@b.org?subject=' + encodeURIComponent('SentiqS — Abonnement et facturation'));
});

test('la page : formulaire et tableau de l\'admin échappent tout, plus aucun stockage local des réclamations', () => {
  const corps = HTML.slice(HTML.indexOf('async function renderMessagesContact()'), HTML.indexOf('async function statutMessageContact('));
  assert.ok(corps.length > 500, 'tranche vide');
  for (const champ of ['m.nom', 'm.email', 'm.message', 'm.id']) assert.ok(corps.includes('escHtml(' + champ), champ);
  assert.ok(!HTML.includes('sentinel_reclamations_v1'));
  assert.ok(HTML.includes('<script src="js/contact.js"></script>'));
  // Accessible sans compte : écran de connexion et lien #contact.
  assert.match(HTML, /onclick="ouvrirContact\(\)" role="button" tabindex="0"><i class="ti ti-mail"><\/i><span data-i18n="public_contact">Nous contacter/);
  assert.match(HTML, /public_contact:'Nous contacter'[\s\S]*public_contact:'Contact us'/);
});

test('aucune adresse e-mail personnelle dans ce que sert le site', () => {
  const servis = [];
  const parcourir = (d) => {
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, n.name);
      if (n.isDirectory()) { if (!['assets', 'historique', 'rapports', 'bulletins'].includes(n.name)) parcourir(p); }
      else if (/\.(html|js|json|xml|txt)$/.test(n.name)) servis.push(p);
    }
  };
  parcourir(path.join(RACINE, 'web'));
  assert.ok(servis.length > 20);
  for (const f of servis) assert.ok(!/yorot225|a3fyee/i.test(fs.readFileSync(f, 'utf8')), path.relative(RACINE, f));
});

test('les règles : création seule, clé comptée, lecture par l\'admin seul', () => {
  const bloc = REGLES.slice(REGLES.indexOf('function messageContactBienForme'), REGLES.indexOf('// Configuration partagée'));
  assert.ok(bloc.length > 500, 'bloc absent');
  assert.match(bloc, /d\.n < \(compte \? 3 : 40\)/);
  assert.match(bloc, /id == \(compte \? d\.uid : 'anon'\) \+ '_' \+ string\(d\.jour\) \+ '_' \+ string\(d\.n\)/);
  assert.match(bloc, /allow get, list: if estAdmin\(\);/);
  assert.match(bloc, /allow create: if messageContactBienForme\(request\.resource\.data, id\);/);
  assert.match(bloc, /d\.statut == 'nouveau'/);
  // Mêmes limites que le module.
  assert.strictEqual(C.LIMITE_COMPTE, 3);
  assert.strictEqual(C.LIMITE_ANONYME, 40);
  for (const o of C.OBJETS) assert.ok(bloc.includes("'" + o.id + "'"), o.id);
});
