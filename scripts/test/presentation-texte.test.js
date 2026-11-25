// Présentation 1, 25/11/2026 : « donner plus de texte dans l'actu ».
// Le début de l'article est lu sur sa page (texte-article.js), gardé dans le
// cumul, et cité en courte citation. Jamais l'article entier.
const test = require('node:test');
const assert = require('node:assert');
const ta = require('../lib/texte-article');
const photos = require('../lib/photos-grsci');
const faits = require('../lib/faits-grsci');
const redaction = require('../lib/redaction-grsci');

const P1 = 'Des hommes armés ont attaqué dans la nuit de lundi à mardi un poste de gendarmerie situé à la sortie de la ville, selon plusieurs sources locales jointes par notre rédaction.';
const P2 = 'Le bilan provisoire fait état de deux gendarmes blessés, évacués vers le centre hospitalier régional. Les assaillants ont pris la fuite en direction de la frontière.';
const P3 = 'Le gouverneur de la région s’est rendu sur les lieux dans la matinée et a annoncé le renforcement du dispositif sécuritaire sur l’ensemble des axes routiers du département.';
const PAGE = '<html><head><meta property="og:description" content="Résumé court déclaré par la page, assez long pour passer le seuil minimal fixé.">'
  + '<meta property="og:image" content="https://exemple.ci/photo-attaque.jpg"></head><body>'
  + '<nav><p>Accueil Politique Société Sécurité Économie Sport Culture International Contact</p></nav>'
  + '<article><h1>Attaque d’un poste</h1><p class="date">Publié le 03/11/2026 à 10:12 — mis à jour le 03/11/2026 11:40</p>'
  + '<p>' + P1 + '</p><figure><figcaption>Une photo d’illustration du poste attaqué, prise hier en fin de journée.</figcaption></figure>'
  + '<p>Lire aussi : les autres attaques de la semaine dans la région du nord du pays</p>'
  + '<p>' + P2 + '</p><p>' + P3 + '</p><p>' + P3.replace('gouverneur', 'préfet') + '</p></article>'
  + '<footer><p>Tous droits réservés — abonnez-vous à notre newsletter pour ne rien manquer</p></footer></body></html>';

test('le début de l’article : premiers paragraphes, sans menu, date, légende ni « Lire aussi »', () => {
  const t = ta.extraitArticle(PAGE, 'Attaque d’un poste');
  assert.ok(t.startsWith(P1), t);
  assert.ok(t.includes('deux gendarmes blessés'));
  for (const bruit of ['Accueil', 'Publié le', 'illustration', 'Lire aussi', 'droits réservés', 'newsletter']) assert.ok(!t.includes(bruit), bruit);
});

test('jamais l’article entier : au plus 650 caractères, coupé en fin de phrase', () => {
  const t = ta.extraitArticle(PAGE, '');
  assert.ok(t.length <= ta.TEXTE_MAX_CAR, String(t.length));
  assert.ok(/[.!?]$|…$/.test(t), t.slice(-20));
  assert.ok(!t.includes('préfet'), 'le dernier paragraphe dépasse la limite et n’est pas cité');
});

test('une page sans paragraphe lisible retombe sur sa description, sinon rien', () => {
  assert.match(ta.extraitArticle('<meta name="description" content="Une description déclarée assez longue pour être citée en dernier recours ici.">', ''), /description déclarée/);
  assert.strictEqual(ta.extraitArticle('<p>Trop court.</p>', ''), null);
});

test('le job lit la page une fois, garde le texte et pose son og:image', async () => {
  let appels = 0;
  const fetchFn = async () => { appels++; return new Response(PAGE, { status: 200 }); };
  const f = { titre: 'Attaque d’un poste', extraits: [{ source: 'Média', url: 'https://exemple.ci/a', resume: 'Chapô court.' }] };
  const gardes = {};
  const n = await photos.lireDebuts([f], { fetchFn, garder: (u, t) => { gardes[u] = t; } });
  assert.strictEqual(n, 1); assert.strictEqual(appels, 1);
  assert.ok(f.extraits[0].long.startsWith(P1));
  assert.strictEqual(f.img, 'https://exemple.ci/photo-attaque.jpg');
  assert.ok(gardes['https://exemple.ci/a']);
  // Déjà gardé dans le cumul : la page n'est pas relue.
  const g = { titre: 'x', extraits: [{ url: 'https://exemple.ci/a' }] };
  await photos.lireDebuts([g], { fetchFn, connu: () => ({ texte: 'Texte gardé.', fr: false }) });
  assert.strictEqual(appels, 1); assert.strictEqual(g.extraits[0].long, 'Texte gardé.');
});

test('la fiche cite le début de l’article plutôt que le chapô, et le texte du cumul le porte', () => {
  const debut = ta.extraitArticle(PAGE, '');
  const cumul = { mois: '2026-11', pays: { CI: [{ titre: 'Attaque d’un poste de gendarmerie à Kong', url: 'https://exemple.ci/a', source: 'Média', niveau: 'crit', cat: 'securite', publieMs: Date.parse('2026-11-03T10:00:00Z'), langue: 'fr', resume: 'Chapô court du flux, deux lignes à peine.', texte: debut }] } };
  const f = faits.faitsDuMois(cumul, 'CI', "Côte d'Ivoire")[0];
  const r = redaction.rediger(f, '');
  assert.ok(r.extraits[0].texte.startsWith('Des hommes armés'), r.extraits[0].texte);
  assert.ok(r.extraits[0].texte.length > 300);
});

test('un début d’article en anglais non traduit n’est pas cité', () => {
  const f = { titre: 'Attack', langue: 'en', extraits: [{ source: 'M', langue: 'en', resume: null, long: 'Gunmen attacked a police post overnight, according to several local sources reached by phone.', longFr: false }] };
  assert.strictEqual(redaction.rediger(f, '').extraits.length, 0);
});
