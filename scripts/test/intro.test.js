// Page de garde (web/js/intro.js) : quand l'animation joue, quand elle s'efface,
// et surtout qu'elle ne peut jamais bloquer l'accès à la connexion.
//
// Le module est à injection d'environnement : on le teste ici avec un faux DOM
// minimal, sans navigateur. La lecture réelle (codec, plein écran, enchaînement
// accueil → connexion dans un même onglet) est vérifiée à part avec Playwright —
// voir la section « Page de garde » de CLAUDE.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Intro = require('../../web/js/intro.js');

function elem(tag) {
  const classes = new Set(), ecouteurs = {};
  return {
    tagName: tag || 'DIV', inert: false, classes,
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    addEventListener(t, f) { (ecouteurs[t] = ecouteurs[t] || []).push(f); },
    removeEventListener(t, f) { ecouteurs[t] = (ecouteurs[t] || []).filter((x) => x !== f); },
    emettre(t, e) { (ecouteurs[t] || []).slice().forEach((f) => f(e)); },
    nbEcouteurs(t) { return (ecouteurs[t] || []).length; },
    querySelectorAll() { return []; },
    focus() { this.focused = true; }, blur() { this.focused = false; },
  };
}

// Un « document » avec un overlay, un voisin à rendre inerte et un script à ignorer.
function decor(opts = {}) {
  const doc = elem('DOC');
  doc.documentElement = elem('HTML');
  doc.readyState = opts.readyState || 'complete';
  doc.activeElement = null;
  const overlay = elem('DIV'); overlay.classes.add('hidden');
  const principal = elem('MAIN'), script = elem('SCRIPT');
  overlay.ownerDocument = doc;
  overlay.parentNode = { children: [overlay, principal, script] };
  const video = elem('VIDEO');
  video.joue = 0; video.pauses = 0;
  video.play = () => { video.joue++; return opts.refus ? Promise.reject(new Error('NotAllowedError'))
    : (opts.suspendu ? new Promise(() => {}) : Promise.resolve()); };
  video.pause = () => { video.pauses++; };
  const skip = elem('BUTTON');
  return { doc, overlay, principal, script, video, skip, els: { overlay, video, skip } };
}

function stockage(valeur) {
  const m = new Map(valeur ? [[Intro.CLE, valeur]] : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, v); }, m };
}
const env = (o = {}) => Object.assign({ stockage: stockage(), mouvementReduit: false, connexionLente: false,
  hash: '', referrer: '', origine: 'https://ytl1-ops.github.io' }, o);

test('raisonDeSaut : joue seulement quand rien ne s\'y oppose', () => {
  assert.equal(Intro.raisonDeSaut(env()), null);
  assert.equal(Intro.raisonDeSaut(env({ stockage: stockage('1') })), 'deja-vue');
  assert.equal(Intro.raisonDeSaut(env({ stockage: null })), 'stockage');
  assert.equal(Intro.raisonDeSaut(env({ stockage: { getItem() { throw new Error('refusé'); } } })), 'stockage');
  assert.equal(Intro.raisonDeSaut(env({ mouvementReduit: true })), 'mouvement-reduit');
  assert.equal(Intro.raisonDeSaut(env({ connexionLente: true })), 'connexion-lente');
});

test('raisonDeSaut : un lien profond ou une navigation interne n\'est pas une arrivée (accueil seulement)', () => {
  const lien = env({ hash: '#tarifs' }), interne = env({ referrer: 'https://ytl1-ops.github.io/SentiqS/pays/ghana.html' });
  assert.equal(Intro.raisonDeSaut(lien), null, 'sans l\'option, l\'ancre ne compte pas (écran de connexion)');
  assert.equal(Intro.raisonDeSaut(lien, { ignorerNavigationInterne: true }), 'ancre');
  assert.equal(Intro.raisonDeSaut(interne, { ignorerNavigationInterne: true }), 'navigation-interne');
  assert.equal(Intro.raisonDeSaut(env({ referrer: 'https://www.google.com/' }), { ignorerNavigationInterne: true }), null);
  assert.equal(Intro.raisonDeSaut(env({ hash: '#' }), { ignorerNavigationInterne: true }), null);
});

test('envNavigateur : tolère un sessionStorage qui lève, lit économiseur de données et 2G', () => {
  const base = { matchMedia: () => ({ matches: false }), location: { hash: '', origin: 'https://x.test' }, document: { referrer: '' } };
  const refuse = Object.defineProperty(Object.assign({}, base), 'sessionStorage', { get() { throw new Error('SecurityError'); } });
  assert.equal(Intro.envNavigateur(refuse).stockage, null);
  assert.equal(Intro.raisonDeSaut(Intro.envNavigateur(refuse)), 'stockage');
  const eco = Object.assign({}, base, { sessionStorage: stockage(), navigator: { connection: { saveData: true, effectiveType: '4g' } } });
  assert.equal(Intro.envNavigateur(eco).connexionLente, true);
  const lente = Object.assign({}, base, { sessionStorage: stockage(), navigator: { connection: { saveData: false, effectiveType: 'slow-2g' } } });
  assert.equal(Intro.envNavigateur(lente).connexionLente, true);
  const bonne = Object.assign({}, base, { sessionStorage: stockage(), navigator: { connection: { saveData: false, effectiveType: '4g' } } });
  assert.equal(Intro.envNavigateur(bonne).connexionLente, false);
  const reduit = Object.assign({}, base, { sessionStorage: stockage(), matchMedia: () => ({ matches: true }) });
  assert.equal(Intro.envNavigateur(reduit).mouvementReduit, true);
});

test('lancer : affiche, rend le reste inerte (sauf les scripts), puis tout rend à la fin', () => {
  const d = decor(), e = env(), fins = [];
  assert.equal(Intro.lancer(d.els, { env: e, onFin: (m) => fins.push(m) }), true);
  assert.equal(d.overlay.classes.has('hidden'), false, 'overlay visible');
  assert.equal(d.doc.documentElement.classes.has('intro-actif'), true);
  assert.equal(d.principal.inert, true, 'le contenu est inerte pendant la lecture');
  assert.equal(d.script.inert, false, 'les scripts ne sont pas touchés');
  assert.equal(d.overlay.inert, false);
  assert.equal(d.video.joue, 1);
  assert.equal(d.skip.focused, true, 'focus sur Passer');
  assert.deepEqual(fins, []);
  d.video.emettre('ended');
  assert.deepEqual(fins, ['terminee']);
  assert.equal(d.overlay.classes.has('hidden'), true);
  assert.equal(d.doc.documentElement.classes.has('intro-actif'), false);
  assert.equal(d.principal.inert, false, 'inertie levée');
  assert.equal(e.stockage.m.get(Intro.CLE), '1', 'drapeau de session posé');
  assert.ok(d.video.pauses >= 1);
});

test('lancer : Passer et Échap arrêtent l\'animation, une seule fois', () => {
  for (const [declencheur, cible] of [['click', 'skip'], ['keydown', 'doc']]) {
    const d = decor(), fins = [];
    Intro.lancer(d.els, { env: env(), onFin: (m) => fins.push(m) });
    d[cible].emettre(declencheur, { key: 'Escape' });
    d.video.emettre('ended'); d.skip.emettre('click'); d.doc.emettre('keydown', { key: 'Escape' });
    assert.deepEqual(fins, ['passee'], declencheur);
  }
  const d = decor(), fins = [];
  Intro.lancer(d.els, { env: env(), onFin: (m) => fins.push(m) });
  d.doc.emettre('keydown', { key: 'Tab' });
  assert.deepEqual(fins, [], 'une autre touche n\'arrête rien');
});

test('lancer : nettoie ses écouteurs (aucune fuite après la fin)', () => {
  const d = decor();
  Intro.lancer(d.els, { env: env() });
  assert.ok(d.doc.nbEcouteurs('keydown') >= 1 && d.skip.nbEcouteurs('click') === 1);
  d.skip.emettre('click');
  assert.equal(d.doc.nbEcouteurs('keydown'), 0);
  assert.equal(d.skip.nbEcouteurs('click'), 0);
  assert.equal(d.video.nbEcouteurs('ended'), 0);
});

test('lancer : lecture refusée → on ouvre directement, sans bloquer', async () => {
  const d = decor({ refus: true }), fins = [], e = env();
  Intro.lancer(d.els, { env: e, onFin: (m) => fins.push(m) });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(fins, ['autoplay-refuse']);
  assert.equal(d.overlay.classes.has('hidden'), true);
  assert.equal(d.principal.inert, false);
  assert.equal(e.stockage.m.get(Intro.CLE), '1', 'pas de nouvelle tentative dans cet onglet');
});

test('lancer : démarrage trop lent → abandon après le délai', async () => {
  const d = decor({ suspendu: true }), fins = [];
  Intro.lancer(d.els, { env: env(), delaiMs: 20, onFin: (m) => fins.push(m) });
  assert.deepEqual(fins, []);
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(fins, ['delai']);
  assert.equal(d.principal.inert, false);
});

test('lancer : « playing » désamorce le délai (une vidéo qui démarre n\'est pas coupée)', async () => {
  const d = decor({ suspendu: true }), fins = [];
  Intro.lancer(d.els, { env: env(), delaiMs: 20, onFin: (m) => fins.push(m) });
  d.video.emettre('playing');
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(fins, []);
  d.video.emettre('ended');
  assert.deepEqual(fins, ['terminee']);
});

test('lancer : fichier illisible → abandon', () => {
  const d = decor(), fins = [];
  Intro.lancer(d.els, { env: env(), onFin: (m) => fins.push(m) });
  d.video.emettre('error');
  assert.deepEqual(fins, ['erreur']);
});

test('lancer : motifs de saut → rien n\'est affiché ni lu, onFin prévient quand même', () => {
  const cas = [
    [{ stockage: stockage('1') }, 'deja-vue'], [{ mouvementReduit: true }, 'mouvement-reduit'],
    [{ connexionLente: true }, 'connexion-lente'], [{ stockage: null }, 'stockage'],
  ];
  for (const [surcharge, motif] of cas) {
    const d = decor(), fins = [], e = env(surcharge);
    assert.equal(Intro.lancer(d.els, { env: e, onFin: (m) => fins.push(m) }), false, motif);
    assert.deepEqual(fins, [motif]);
    assert.equal(d.video.joue, 0, motif + ' : aucune lecture');
    assert.equal(d.overlay.classes.has('hidden'), true, motif + ' : overlay masqué');
    assert.equal(d.principal.inert, false);
    if (e.stockage && motif !== 'deja-vue') assert.equal(e.stockage.m.has(Intro.CLE), false, motif + ' : drapeau non posé');
  }
});

test('lancer : éléments absents → on ne casse rien', () => {
  const fins = [];
  assert.equal(Intro.lancer({ overlay: null, video: null }, { env: env(), onFin: (m) => fins.push(m) }), false);
  assert.deepEqual(fins, ['absente']);
  assert.doesNotThrow(() => Intro.lancer(undefined, { env: env() }));
});

test('lancer : sur la page d\'accueil les voisins arrivent après le lancement', () => {
  const d = decor({ readyState: 'loading' }), fins = [];
  d.overlay.parentNode.children.length = 1; // seul l'overlay est analysé pour l'instant
  Intro.lancer(d.els, { env: env(), onFin: (m) => fins.push(m) });
  const tardif = elem('SECTION');
  d.overlay.parentNode.children.push(tardif);
  d.doc.emettre('DOMContentLoaded');
  assert.equal(tardif.inert, true, 'le contenu analysé plus tard est lui aussi inerte');
  d.skip.emettre('click');
  assert.equal(tardif.inert, false);
});

test('l\'enchaînement accueil → connexion partage le même drapeau de session', () => {
  const partage = stockage();
  const accueil = decor(), connexion = decor();
  Intro.lancer(accueil.els, { env: env({ stockage: partage }) });
  accueil.skip.emettre('click');
  const fins = [];
  assert.equal(Intro.lancer(connexion.els, { env: env({ stockage: partage }), onFin: (m) => fins.push(m) }), false);
  assert.deepEqual(fins, ['deja-vue']);
  assert.equal(connexion.video.joue, 0);
});

test('câblage des deux pages : même module, mêmes identifiants, aucune dépendance bloquante', () => {
  const racine = path.join(__dirname, '..', '..', 'web');
  const accueil = fs.readFileSync(path.join(racine, 'index.html'), 'utf8');
  const appli = fs.readFileSync(path.join(racine, 'SentiqS_Web.html'), 'utf8');
  for (const [nom, html] of [['index.html', accueil], ['SentiqS_Web.html', appli]]) {
    assert.match(html, /<script src="js\/intro\.js"><\/script>/, nom + ' charge js/intro.js');
    assert.match(html, /id="introVideoOverlay"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-label="[^"]+"/, nom + ' : overlay nommé');
    assert.match(html, /<video id="introVideoEl"[^>]*preload="none"[^>]*aria-hidden="true"/, nom + ' : la vidéo ne se télécharge qu\'à la lecture');
    assert.match(html, /id="introVideoSkip"/, nom + ' : bouton Passer');
  }
  // L'accueil : le décor animé ne démarre qu'après l'intro (pas de double téléchargement).
  assert.match(accueil, /id="heroVideo"[^>]*preload="none"/);
  assert.doesNotMatch(accueil, /<video[^>]*class="scene-video"[^>]*autoplay/);
  // L'appli : plus de logique dupliquée, uniquement l'appel au module.
  assert.match(appli, /SentiqIntro\.lancer\(/);
  assert.doesNotMatch(appli, /sessionStorage\.getItem\('sentinel_intro_vue'\)/, 'plus de seconde copie de la logique');
});

test('les deux vidéos restent légères et sans piste audio inutile', () => {
  const dossier = path.join(__dirname, '..', '..', 'web', 'assets');
  const plafonds = { 'hero.mp4': 2.5e6, 'intro-sentiqs.mp4': 1.0e6 };
  for (const [f, max] of Object.entries(plafonds)) {
    const taille = fs.statSync(path.join(dossier, f)).size;
    assert.ok(taille <= max, `${f} : ${(taille / 1e6).toFixed(2)} Mo > plafond ${(max / 1e6).toFixed(1)} Mo`);
  }
  // Pas de piste audio : l'élément est « muted », l'AAC ne servait à rien (~0,3 Mo).
  const intro = fs.readFileSync(path.join(dossier, 'intro-sentiqs.mp4'));
  assert.equal(intro.includes(Buffer.from('soun')), false, 'intro-sentiqs.mp4 ne doit plus contenir de piste audio');
});
