// Module « Réseaux sociaux », phase 1 : signaux Facebook transmis par
// l'utilisateur (voir « SIGNAUX FACEBOOK » dans web/SentiqS_Web.html).
//
// Ce que ce lot protège. Facebook ne laisse lire ni le fil ni les groupes d'un
// profil personnel ; le module ne lit donc rien chez eux, il analyse ce que
// l'utilisateur colle. Trois promesses faites à l'utilisateur doivent tenir :
// un signal social reste « Non confirmé » et ne bouge JAMAIS un niveau
// d'alerte ; aucune donnée personnelle de tiers n'est conservée ; tout reste
// local à son compte.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { HTML, tranche, bac, exposer } = require('./_bac.js');

const BLOC = tranche('// ── SIGNAUX FACEBOOK (phase 1)', '// ── FIN SIGNAUX FACEBOOK');

function bacFb() {
  const ctx = bac(
    tranche('const FENETRE_ACTUALITE_MS =', 'function estimeEvenementAncien'),
    tranche('const PAYS_INFO', '};\n') + '};',
    tranche('const CK_CRIT', '//  FIABILITÉ & ANTI-HALLUCINATION')
  );
  // URL est un global de Node/navigateur, pas du langage : le bac ne l'a pas.
  ctx.URL = URL;
  vm.runInContext(BLOC, ctx);
  return exposer(ctx, 'normaliserLienFacebook', 'creerSignalSocial', 'cotationSignalSocial',
    'purgerSignauxFb', 'fusionnerSignalFb', 'rapprocherPresse', 'detecterBuzzFb',
    'extrairePagesSuivies', 'corrigerEncodageFacebook', 'csvSignauxFb',
    'FB_RETENTION_MS', 'FENETRE_ACTUALITE_MS');
}
const fb = bacFb();
// Les tableaux nes dans le bac viennent d'un autre « realm » : deepStrictEqual
// les refuserait pour leur seul prototype. On compare leur contenu.
const nu = (v) => JSON.parse(JSON.stringify(v));
const T0 = Date.UTC(2026, 9, 20, 12, 0, 0);
const H = 3600 * 1000;

test('la tranche examinée contient bien le code visé', () => {
  // Piège récurrent de tranche() : une borne fausse fait passer un test qui
  // n'examine rien.
  assert.ok(BLOC.length > 3000);
  assert.match(BLOC, /function creerSignalSocial/);
  assert.match(BLOC, /function extrairePagesSuivies/);
});

// ── Liens ───────────────────────────────────────────────────────────────────
test('un lien Facebook est nettoyé de son suivi publicitaire', () => {
  assert.strictEqual(
    fb.normaliserLienFacebook('http://m.facebook.com/story.php?story_fbid=123&id=456&fbclid=XYZ&__tn__=%2Cd#ancre'),
    'https://www.facebook.com/story.php?story_fbid=123&id=456');
  assert.strictEqual(fb.normaliserLienFacebook('https://fb.watch/abc123/'), 'https://fb.watch/abc123/');
});

test('un lien qui n\'est pas Facebook est refusé, redirecteur compris', () => {
  assert.strictEqual(fb.normaliserLienFacebook('https://exemple.com/x'), null);
  assert.strictEqual(fb.normaliserLienFacebook('https://l.facebook.com/l.php?u=https%3A%2F%2Fexemple.com'), null);
  assert.strictEqual(fb.normaliserLienFacebook('https://facebook.com.evil.org/a'), null);
  assert.strictEqual(fb.normaliserLienFacebook('javascript:alert(1)'), null);
  assert.strictEqual(fb.normaliserLienFacebook('pas un lien'), null);
});

// ── Création d'un signal ────────────────────────────────────────────────────
test('un signalement est rattaché à son pays et classé par les lexiques du Flux', () => {
  const r = fb.creerSignalSocial({ texte: 'Attaque armée signalée à Bamako, plusieurs morts selon des témoins' }, T0);
  assert.strictEqual(r.signal.cy, 'ML');
  assert.strictEqual(r.signal.lvl, 'crit');
  assert.strictEqual(r.signal.ts, T0);
});

test('le pays choisi par l\'utilisateur l\'emporte sur la détection', () => {
  const r = fb.creerSignalSocial({ texte: 'Marche annoncée demain devant la préfecture', cy: 'CI' }, T0);
  assert.strictEqual(r.signal.cy, 'CI');
  assert.strictEqual(r.signal.paysIncertain, false);
});

test('un texte qui ne nomme aucun pays n\'invente pas un pays', () => {
  const r = fb.creerSignalSocial({ texte: 'Beaucoup de monde devant le marché ce matin' }, T0);
  assert.ok(!r.signal.cy || r.signal.paysIncertain === true || r.signal.cy === 'INT');
});

test('texte trop court ou lien invalide : refusé avec une raison', () => {
  assert.strictEqual(fb.creerSignalSocial({ texte: 'ok' }, T0).erreur, 'texte_court');
  assert.strictEqual(fb.creerSignalSocial({ texte: 'Attaque à Bamako cette nuit', lien: 'https://exemple.com/x' }, T0).erreur, 'lien_invalide');
});

test('le signal ne porte ni auteur ni nom de groupe, seulement un indicateur', () => {
  const r = fb.creerSignalSocial({
    texte: 'Attaque à Bamako cette nuit', groupe: true,
    auteur: 'Jean Dupont', nomGroupe: 'Les amis de Bamako', lien: 'https://www.facebook.com/groups/123/posts/456/',
  }, T0);
  assert.deepStrictEqual(Object.keys(r.signal).sort(),
    ['cat', 'cy', 'extrait', 'groupe', 'id', 'lien', 'lvl', 'paysIncertain', 'ts']);
  assert.strictEqual(r.signal.groupe, true);
  assert.ok(!JSON.stringify(r.signal).includes('Dupont'));
  assert.ok(!JSON.stringify(r.signal).includes('Les amis'));
});

test('l\'extrait est borné', () => {
  const r = fb.creerSignalSocial({ texte: 'Attaque à Bamako ' + 'x'.repeat(900) }, T0);
  assert.ok(r.signal.extrait.length <= 280);
});

test('un même lien, ou un même texte sans lien, ne s\'ajoute pas deux fois', () => {
  const a = fb.creerSignalSocial({ texte: 'Attaque à Bamako cette nuit', lien: 'https://fb.watch/abc/?fbclid=1' }, T0).signal;
  const b = fb.creerSignalSocial({ texte: 'Texte différent mais même lien, Bamako', lien: 'https://fb.watch/abc/?fbclid=2' }, T0 + H).signal;
  const l1 = fb.fusionnerSignalFb([], a);
  assert.strictEqual(l1.doublon, false);
  assert.strictEqual(fb.fusionnerSignalFb(l1.liste, b).doublon, true);
  const c = fb.creerSignalSocial({ texte: 'Même   texte  collé deux fois à Dakar' }, T0).signal;
  const d = fb.creerSignalSocial({ texte: 'même texte collé deux fois à dakar' }, T0 + H).signal;
  assert.strictEqual(c.id, d.id);
});

// ── Cotation : la promesse centrale ─────────────────────────────────────────
test('un signal social est TOUJOURS « Non confirmé »', () => {
  assert.strictEqual(fb.cotationSignalSocial().cle, 'non_confirme');
  assert.strictEqual(fb.cotationSignalSocial({ lvl: 'crit' }, [{ verified: true }]).cle, 'non_confirme');
});

test('aucun code du niveau d\'alerte ne lit un signal Facebook', () => {
  // Le niveau d'un pays vient de calcAlertScore / getLiveAlertEvents /
  // borneRouge* : si l'un d'eux mentionne un signal Facebook, la promesse est
  // rompue. Test de texte, volontairement bête.
  const hors = HTML.replace(BLOC, '');
  const calc = hors.slice(hors.indexOf('function calcAlertScore'), hors.indexOf('function calcAlertScore') + 12000);
  assert.ok(calc.length > 3000, 'tranche calcAlertScore trop courte');
  for (const nom of ['creerSignalSocial', 'lireDonneesFb', 'signauxFb', 'cleStockageFb', 'sentinel_fb_signaux']) {
    assert.ok(!calc.includes(nom), 'calcAlertScore ne doit pas lire ' + nom);
  }
  const live = hors.slice(hors.indexOf('function getLiveAlertEvents'), hors.indexOf('function getLiveAlertEvents') + 6000);
  assert.ok(live.length > 1500, 'tranche getLiveAlertEvents trop courte');
  for (const nom of ['creerSignalSocial', 'lireDonneesFb', 'signauxFb', 'sentinel_fb_signaux']) {
    assert.ok(!live.includes(nom), 'getLiveAlertEvents ne doit pas lire ' + nom);
  }
});

// ── Rapprochement avec la presse ────────────────────────────────────────────
const sig = (texte, ts, cy) => fb.creerSignalSocial({ texte, cy }, ts).signal;

test('un article du même pays sur le même fait est rapproché', () => {
  const s = sig('Attaque armée contre un poste de police à Kayes, plusieurs morts', T0, 'ML');
  const presse = [
    { title: 'Mali : attaque armée contre un poste de police à Kayes', cy: 'ML', pubDate: T0 - 3 * H },
    { title: 'Mali : le gouvernement présente son budget', cy: 'ML', pubDate: T0 - 3 * H },
    { title: 'Attaque armée contre un poste de police à Kayes', cy: 'BF', pubDate: T0 - 3 * H },
  ];
  const r = fb.rapprocherPresse(s, presse);
  assert.strictEqual(r.length, 1);
  assert.match(r[0].title, /Kayes/);
});

test('un article hors fenêtre ou issu d\'un réseau social n\'est pas rapproché', () => {
  const s = sig('Attaque armée contre un poste de police à Kayes, plusieurs morts', T0, 'ML');
  const titre = 'Attaque armée contre un poste de police à Kayes';
  const vieux = { title: titre, cy: 'ML', pubDate: T0 - fb.FENETRE_ACTUALITE_MS - H };
  const social = { title: titre, cy: 'ML', pubDate: T0, _isSocial: true };
  assert.deepStrictEqual(nu(fb.rapprocherPresse(s, [vieux, social])), []);
});

// ── Afflux ──────────────────────────────────────────────────────────────────
test('plusieurs signalements du même fait dans la journée font un afflux', () => {
  const l = [
    sig('Attaque armée à Kayes, morts signalés', T0 - 1 * H, 'ML'),
    sig('Nouvelle attaque près de Kayes, des blessés', T0 - 2 * H, 'ML'),
    sig('Attaque revendiquée à Sikasso', T0 - 3 * H, 'ML'),
  ];
  const b = fb.detecterBuzzFb(l, T0);
  assert.strictEqual(b.ML.niveau, 'modere');
  assert.strictEqual(b.ML.n, 3);
});

test('un seul signalement reste « isolé », un ancien ne compte plus', () => {
  const l = [sig('Marche annoncée à Abidjan demain', T0 - 2 * H, 'CI'), sig('Attaque armée à Kayes', T0 - 30 * H, 'ML')];
  const b = fb.detecterBuzzFb(l, T0);
  assert.strictEqual(b.CI.niveau, 'faible');
  assert.strictEqual(b.ML, undefined);
});

// ── Conservation ────────────────────────────────────────────────────────────
test('la purge retire ce qui a plus de 30 jours', () => {
  const vieux = { id: 'a', ts: T0 - fb.FB_RETENTION_MS - 1 };
  const frais = { id: 'b', ts: T0 - fb.FB_RETENTION_MS + 1000 };
  assert.deepStrictEqual(nu(fb.purgerSignauxFb([vieux, frais], T0).map(s => s.id)), ['b']);
  assert.deepStrictEqual(nu(fb.purgerSignauxFb(null, T0)), []);
});

test('la clé de stockage est propre au compte', () => {
  assert.match(BLOC, /sentinel_fb_signaux::/);
  assert.match(BLOC, /getSession\(\)/);
});

// ── Import de l'export ──────────────────────────────────────────────────────
test('l\'import ne retient que les noms de Pages, rien d\'autre', () => {
  const export_ = {
    page_likes_v2: [
      { timestamp: 1, name: 'Police Secours CI', title: 'Police Secours CI', url: 'https://x' },
      { timestamp: 2, name: 'Abidjan.net' },
    ],
    friends_v2: [{ name: 'Marie Martin', timestamp: 3 }],
    messages: { inbox: [{ title: 'Secret perso' }] },
  };
  const r = nu(fb.extrairePagesSuivies(export_));
  assert.deepStrictEqual(r, ['Abidjan.net', 'Police Secours CI']);
  assert.ok(!JSON.stringify(r).includes('Marie'));
  assert.ok(!JSON.stringify(r).includes('Secret'));
});

test('l\'import lit aussi le nouveau format et répare l\'encodage cassé', () => {
  const mojibake = Buffer.from('Bénin Actualités', 'utf8').toString('latin1');
  const r = nu(fb.extrairePagesSuivies({ pages_followed: [{ label_values: [{ label: 'Nom', value: mojibake }] }] }));
  assert.deepStrictEqual(r, ['Bénin Actualités']);
  assert.strictEqual(fb.corrigerEncodageFacebook('Déjà propre'), 'Déjà propre');
});

test('un export vide ou étranger ne donne rien et ne plante pas', () => {
  assert.deepStrictEqual(nu(fb.extrairePagesSuivies({})), []);
  assert.deepStrictEqual(nu(fb.extrairePagesSuivies(null)), []);
  assert.deepStrictEqual(nu(fb.extrairePagesSuivies([1, 'a'])), []);
});

// ── Export CSV ──────────────────────────────────────────────────────────────
test('le CSV neutralise les formules et dit « Non confirmé »', () => {
  const s = sig('=HYPERLINK("http://evil") Attaque à Bamako', T0, 'ML');
  const csv = fb.csvSignauxFb([s]);
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /Non confirmé/);
  assert.strictEqual(csv.split('\n').length, 2);
});

// ── Honnêteté de l'interface ────────────────────────────────────────────────
test('le registre des plateformes ne promet plus « sur demande » une lecture que Meta interdit', () => {
  assert.ok(!/Disponible sur demande/.test(HTML), 'la note Facebook promet encore un accès que Meta ne donne pas');
});
