// Assistant de veille (14/11/2026) : web/js/assistant.js.
// Consigne de YORO : « travailler uniquement la base de données générée par
// l'appli pour éviter toute hallucination » et « éviter des répétitions ou
// redondances improductives ».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const A = require('../../web/js/assistant.js');

const PAYS = [
  { cy: 'CI', noms: ["Côte d'Ivoire", 'Ivory Coast'] }, { cy: 'NE', noms: ['Niger'] }, { cy: 'NG', noms: ['Nigeria'] },
  { cy: 'GN', noms: ['Guinée', 'Guinea'] }, { cy: 'GQ', noms: ['Guinée équatoriale', 'Equatorial Guinea'] },
  { cy: 'ML', noms: ['Mali'] }, { cy: 'BF', noms: ['Burkina Faso'] }, { cy: 'SN', noms: ['Sénégal', 'Senegal'] },
  { cy: 'SS', noms: ['Soudan du Sud', 'South Sudan'] }, { cy: 'SD', noms: ['Soudan', 'Sudan'] }, { cy: 'CF', noms: ['Centrafrique'] },
];
const MAINTENANT = Date.parse('2026-11-14T20:00:00Z');
const ctx = { maintenant: MAINTENANT, pays: PAYS, fenetreMs: 36 * 3600000 };
const q = (t) => A.interpreterQuestion(t, ctx);

test('la question est comprise : pays, période, thème, intention', () => {
  const i = q("Quelle est la situation en Côte d'Ivoire cette semaine ?");
  assert.deepStrictEqual(i.pays, ['CI']);
  assert.strictEqual(i.intention, 'situation');
  assert.strictEqual(i.periode.cle, 'semaine');
  const s = q('enlèvements au Sahel ce mois-ci');
  assert.deepStrictEqual(s.pays, ['ML', 'BF', 'NE', 'TD', 'MR']);
  assert.strictEqual(s.theme.cle, 'enlevement');
  assert.strictEqual(q('Événements à venir au Sénégal').intention, 'agenda');
  assert.strictEqual(q('Quels pays sont au rouge ?').intention, 'classement');
  assert.strictEqual(q('Quels pays sont au rouge ?').niveau, 'rouge');
  assert.strictEqual(q('Pourquoi le Mali est à ce niveau ?').intention, 'pourquoi');
  assert.strictEqual(q('What is the situation in Ivory Coast this week').pays[0], 'CI');
});

test('le nom le plus long gagne, et le mot entier garde Niger de Nigeria', () => {
  assert.deepStrictEqual(q('Guinée équatoriale aujourd\'hui').pays, ['GQ']);
  assert.deepStrictEqual(q('Situation au Soudan du Sud').pays, ['SS']);
  assert.deepStrictEqual(q('Niger et Nigeria').pays, ['NE', 'NG']);
  assert.deepStrictEqual(q('compare Mali vs Burkina Faso').pays, ['ML', 'BF']);
  // « car » est un mot courant : seul le sigle en capitales désigne la RCA.
  assert.deepStrictEqual(q('car je veux savoir').pays, []);
  assert.deepStrictEqual(q('je veux savoir pour la RCA').pays, ['CF']);
});

test('les questions sur l\'outil reçoivent une réponse immédiate (FAQ)', () => {
  assert.strictEqual(q('Comment fonctionne la cotation ?').faq, 'cotation');
  assert.strictEqual(q("Combien coûte l'abonnement ?").faq, 'forfaits');
  assert.strictEqual(q('Comment tu fonctionnes ?').faq, 'assistant');
  assert.strictEqual(q("Bulletin de la Côte d'Ivoire").faq, 'bulletin');
  // Un pays nommé l'emporte : « prix du carburant au Mali » est une question de situation.
  assert.strictEqual(q('prix du carburant au Mali').intention, 'situation');
  const r = A.composerReponse(q("Combien coûte l'abonnement ?"), { forfaits: [{ nom: 'Pro', prix: 39000, periode: '/mois' }] }, 'fr');
  assert.match(JSON.stringify(r.blocs), /Pro — 39\s000 FCFA\/mois/);
});

function donnees() {
  const h = 3600000;
  return {
    pays: { NE: { nom: 'Niger', niveau: 'marron', angleMort: { sourceUnique: true } } },
    classement: [{ cy: 'NE', nom: 'Niger', niveau: 'marron', total100: 70 }],
    faits: [
      { id: 'a', titre: 'Terrorists Abduct 14 Students, Teacher In Niger Community', cy: 'NE', niveau: 'crit', publieMs: MAINTENANT - 2 * h, source: 'Punch', url: 'https://a/1', cotation: 'probable' },
      { id: 'b', titre: 'Niger police confirm 14 Islamiya students abducted', cy: 'NE', niveau: 'crit', publieMs: MAINTENANT - 20 * h, source: 'Daily Trust', url: 'https://b/2', cotation: 'non_confirme' },
      { id: 'c', titre: 'Niamey : hausse du prix du riz sur les marchés', cy: 'NE', niveau: 'mod', publieMs: MAINTENANT - 5 * h, source: 'ActuNiger', url: 'https://c/3', cotation: 'probable' },
    ],
    couverture: { fenetreH: 36 },
    bulletinsBase: 'bulletins/',
  };
}

test('un même fait repris par deux médias est une ligne, cotée « Confirmé »', () => {
  const r = A.composerReponse(q('situation au Niger'), donnees(), 'fr');
  const faits = r.blocs.filter((b) => b.t === 'faits').flatMap((b) => b.faits);
  assert.strictEqual(faits.length, 2, 'les deux titres de l\'enlèvement se replient en un');
  const enl = faits.find((f) => /Abduct/.test(f.titre));
  assert.deepStrictEqual(enl.sources, ['Punch', 'Daily Trust']);
  assert.strictEqual(enl.cotation, 'confirme');
  assert.strictEqual(enl.liens.length, 2);
});

test('une même source qui republie ne recoupe rien', () => {
  const d = donnees();
  d.faits[1].source = 'Punch';
  const r = A.composerReponse(q('situation au Niger'), d, 'fr');
  const enl = r.blocs.filter((b) => b.t === 'faits').flatMap((b) => b.faits).find((f) => /Abduct/.test(f.titre));
  assert.strictEqual(enl.cotation, 'probable');
});

test('rien n\'est affirmé hors de la base : chaque titre de fait vient des données', () => {
  const d = donnees();
  for (const question of ['situation au Niger', 'enlèvements au Niger', 'Pourquoi ce niveau au Niger ?', 'Quels pays sont au marron ?']) {
    const r = A.composerReponse(q(question), d, 'fr');
    r.blocs.filter((b) => b.t === 'faits').forEach((b) => b.faits.forEach((f) => {
      assert.ok(d.faits.some((x) => x.titre === f.titre), 'titre inventé : ' + f.titre);
    }));
  }
  const vide = A.composerReponse(q('situation au Niger'), Object.assign(donnees(), { faits: [] }), 'fr');
  assert.match(JSON.stringify(vide.blocs), /Aucun fait au-dessus du normal dans la base/);
});

test('le niveau est dit une fois, l\'avertissement de méthode n\'est pas répété sous chaque réponse', () => {
  const r = A.composerReponse(q('situation au Niger'), donnees(), 'fr');
  const texte = JSON.stringify(r.blocs);
  assert.strictEqual((texte.match(/Marron \(critique\)/g) || []).length, 1);
  assert.ok(!r.blocs.some((b) => b.t === 'source'));
});

test('chaque réponse sur un pays mène à son bulletin quotidien gratuit, et l\'angle mort est dit', () => {
  const r = A.composerReponse(q('situation au Niger'), donnees(), 'fr');
  const lien = r.blocs.find((b) => b.t === 'lien');
  assert.strictEqual(lien.url, 'bulletins/NE/dernier.html');
  assert.match(JSON.stringify(r.blocs), /une seule source capable d'alerter/);
});

test('anglais : une seule langue dans la réponse', () => {
  const r = A.composerReponse(q('situation in Niger'), donnees(), 'en');
  const t = r.blocs.filter((b) => b.t !== 'faits').map((b) => b.texte || b.titre || '').join(' ');
  assert.doesNotMatch(t, /\b(Aucun|faits|Réserve|depuis|Bulletin quotidien)\b/);
  assert.match(t, /Maroon \(critical\)/);
});

test('la page charge le module et ne l\'appelle qu\'avec ses propres données', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../web/SentiqS_Web.html'), 'utf8');
  assert.match(html, /<script src="js\/assistant\.js"><\/script>/);
  const glue = html.slice(html.indexOf('ASSISTANT DE VEILLE — 14/11/2026 (voir CLAUDE.md et web/js/assistant.js)'), html.indexOf('function fermerAccesRapide('));
  assert.ok(glue.length > 1000);
  // Aucune requête hors de l'application : seul le cumul mensuel publié par le job est lu.
  const fetchs = glue.match(/fetch\('[^']+/g) || [];
  fetchs.forEach((f) => assert.match(f, /fetch\('(rapports\/mensuel\/faits-|agenda\/externe\.json)/));
});
