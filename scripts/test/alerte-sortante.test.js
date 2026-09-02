// Sortie d'alerte vers un canal externe — voir scripts/lib/alerte-sortante.js.
//
// Aucun test n'atteint le reseau : `envoyer` prend son posteur en argument.
const test = require('node:test');
const assert = require('node:assert');
const A = require('../lib/alerte-sortante.js');

const inst = (pays) => ({ jour: '2026-09-02', pays });

test('seules les montees sont detaillees, les descentes sont comptees', () => {
  const c = A.changements(
    { ML: 'marron', BF: 'rouge', SN: 'jaune' },
    inst([{ code: 'ML', niveau: 'rouge' }, { code: 'BF', niveau: 'orange' }, { code: 'SN', niveau: 'jaune' }]),
  );
  assert.deepStrictEqual(c.montees.map((m) => m.code), ['ML']);
  assert.strictEqual(c.descentes, 1);
});

test('un pays nouvellement suivi n est pas une aggravation', () => {
  // Le jour ou l on ajoute un pays, l annoncer comme monte au rouge serait
  // faux : il n a jamais ete ailleurs.
  const c = A.changements(
    { ML: 'rouge' },
    inst([{ code: 'ML', niveau: 'rouge' }, { code: 'SC', niveau: 'rouge' }]),
  );
  assert.deepStrictEqual(c.montees, []);
  assert.strictEqual(c.descentes, 0);
});

test('les montees sortent du plus grave au moins grave', () => {
  const c = A.changements(
    { AA: 'vert', BB: 'marron', CC: 'vert' },
    inst([{ code: 'AA', niveau: 'jaune' }, { code: 'BB', niveau: 'rouge' }, { code: 'CC', niveau: 'orange' }]),
  );
  assert.deepStrictEqual(c.montees.map((m) => m.code), ['BB', 'CC', 'AA'],
    'rouge, puis orange, puis jaune — pas l\'ordre alphabetique');
});

test('un niveau inconnu des deux cotes ne produit pas de changement', () => {
  const c = A.changements(
    { ML: 'ecarlate' },
    inst([{ code: 'ML', niveau: 'rouge' }]),
  );
  assert.deepStrictEqual(c.montees, []);
});

test('sans montee, aucun message n est construit', () => {
  // C est ce qui garde le canal lisible : le job tourne 5 a 15 fois par jour.
  assert.strictEqual(A.construireMessage({ montees: [], descentes: 4 }, { jour: '2026-09-02' }), null);
});

test('le message nomme les pays, les niveaux et le nombre de crans', () => {
  const m = A.construireMessage(
    { montees: [{ code: 'ML', de: 'marron', vers: 'rouge', crans: 1 }], descentes: 2 },
    { jour: '2026-09-02', noms: { ML: 'Mali' }, url: 'https://exemple.test/' },
  );
  assert.match(m.text, /1 pays en aggravation \(2026-09-02\)/);
  assert.match(m.text, /• Mali : marron → rouge \(\+1\)/);
  assert.match(m.text, /2 pays en amélioration, non détaillés\./);
  assert.match(m.text, /https:\/\/exemple\.test\//);
});

test('le message tombe sur le code pays quand le nom est inconnu', () => {
  const m = A.construireMessage({ montees: [{ code: 'ZZ', de: 'vert', vers: 'jaune', crans: 1 }], descentes: 0 }, {});
  assert.match(m.text, /• ZZ : vert → jaune/);
  assert.doesNotMatch(m.text, /amélioration/, 'aucune ligne d\'amélioration quand il n\'y en a pas');
});

test('la charge utile est le denominateur commun Slack/Teams', () => {
  const m = A.construireMessage({ montees: [{ code: 'ML', de: 'vert', vers: 'jaune', crans: 1 }], descentes: 0 }, {});
  assert.deepStrictEqual(Object.keys(m), ['text'],
    'un seul champ : tout ajout casserait la compatibilite avec un des deux');
});

test('envoyer poste bien du JSON et rend compte du succes', async () => {
  const vus = [];
  const r = await A.envoyer('https://exemple.test/hook', { text: 'coucou' }, async (u, o) => {
    vus.push({ u, o }); return { ok: true, status: 200 };
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(vus[0].o.method, 'POST');
  assert.strictEqual(vus[0].o.headers['content-type'], 'application/json');
  assert.deepStrictEqual(JSON.parse(vus[0].o.body), { text: 'coucou' });
});

test('envoyer ne leve jamais, meme si le canal explose', async () => {
  // La collecte est le service, l alerte est le confort : elle ne doit
  // jamais faire tomber un run qui a publie son cache.
  const r = await A.envoyer('https://exemple.test/hook', {}, async () => { throw new Error('canal injoignable'); });
  assert.strictEqual(r.ok, false);
  assert.match(r.raison, /canal injoignable/);
});

test('envoyer signale un refus HTTP sans le confondre avec un succes', async () => {
  const r = await A.envoyer('https://exemple.test/hook', {}, async () => ({ ok: false, status: 403 }));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.statut, 403);
});

test('sans URL configuree, envoyer le dit au lieu d appeler', async () => {
  let appele = false;
  const r = await A.envoyer('', {}, async () => { appele = true; return { ok: true, status: 200 }; });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(appele, false, 'aucun appel ne doit partir sans URL');
});

test('au tout premier run, rien ne part', () => {
  // Inaugurer un canal en y deversant les 54 pays d un coup est le meilleur
  // moyen de le faire couper des la premiere heure.
  const c = A.changements({}, inst([{ code: 'ML', niveau: 'rouge' }, { code: 'BF', niveau: 'marron' }]));
  assert.deepStrictEqual(c.montees, []);
  assert.strictEqual(A.construireMessage(c, {}), null);
});

test('une aggravation deja annoncee ne repart pas au cycle suivant', () => {
  // Le job tourne 5 a 15 fois par jour : sans cet etat, chaque passage
  // reenverrait la meme alerte.
  const courant = inst([{ code: 'ML', niveau: 'rouge' }]);
  const etat0 = { ML: 'marron' };
  const premier = A.changements(etat0, courant);
  assert.strictEqual(premier.montees.length, 1);

  const etat1 = A.etatSuivant(etat0, courant);
  const second = A.changements(etat1, courant);
  assert.deepStrictEqual(second.montees, [], 'le meme etat ne doit plus rien produire');
});

test('un pays qui redescend puis remonte est annonce une seconde fois', () => {
  // C est un evenement, pas un doublon — d ou l enregistrement des descentes
  // dans l etat, alors qu elles ne sont jamais annoncees.
  let etat = { ML: 'rouge' };
  etat = A.etatSuivant(etat, inst([{ code: 'ML', niveau: 'orange' }]));
  assert.strictEqual(etat.ML, 'orange');

  const remontee = A.changements(etat, inst([{ code: 'ML', niveau: 'rouge' }]));
  assert.deepStrictEqual(remontee.montees.map((m) => m.vers), ['rouge']);
});

test('etatDepuis reconstruit un etat a partir d un instantane d archive', () => {
  assert.deepStrictEqual(
    A.etatDepuis(inst([{ code: 'ML', niveau: 'rouge' }, { code: 'BF', niveau: 'jaune' }])),
    { ML: 'rouge', BF: 'jaune' },
  );
  assert.deepStrictEqual(A.etatDepuis(null), {});
});

test('etatSuivant ignore un niveau que le noyau ne connait pas', () => {
  const e = A.etatSuivant({ ML: 'rouge' }, inst([{ code: 'ML', niveau: 'ecarlate' }]));
  assert.strictEqual(e.ML, 'rouge', 'un niveau invalide ne doit pas effacer un etat valide');
});
