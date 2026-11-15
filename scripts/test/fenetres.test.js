// Fenêtres et notifications — 15/11/2026.
//
// Capture de YORO sur téléphone : le popup d'une actu fraîche (renderToast)
// prenait pour fond la teinte du niveau (--gl, --rl…), translucide en thème
// sombre ; le texte de la page se lisait au travers. Ces gardes exigent un
// fond opaque pour toute notification, un voile commun et une croix de 44 px
// pour les fenêtres, la page immobile derrière, et des règles mobiles écrites
// à l'identique pour l'écran étroit et le mode mobile forcé.
const test = require('node:test');
const assert = require('node:assert');
const { HTML } = require('./_bac');

const DEBUT = '/* ═══ FENÊTRES ET NOTIFICATIONS';
function bloc() {
  const i = HTML.indexOf(DEBUT);
  assert.ok(i > 0, 'bloc « FENÊTRES ET NOTIFICATIONS » introuvable');
  return HTML.slice(i, HTML.indexOf('/* ═══ MOBILE : LE CONTENU D\'ABORD', i));
}
function corps(nom) {
  const i = HTML.indexOf('function ' + nom + '(');
  assert.ok(i > 0, nom + ' introuvable');
  return HTML.slice(i, HTML.indexOf('\n}\n', i));
}

test('la notification d\'actu a un fond opaque, jamais la teinte du niveau', () => {
  const r = corps('renderToast');
  assert.doesNotMatch(r, /background:'\+m\.bg/, 'le fond de la notification redevient la teinte translucide du niveau');
  assert.match(r, /background:var\(--w\)/);
  assert.match(r, /class="notif-fermer"/);
});

test('toute notification du conteneur est opaque', () => {
  assert.match(bloc(), /#toastContainer>\*\{background:var\(--w\) !important/);
});

test('fenêtres : voile commun, panneau opaque, croix de 44 px, page immobile', () => {
  const b = bloc();
  for (const sel of ['.admin-panel', '.val-dlg', '#kpiDrillOverlay', '#diagOverlay']) {
    assert.ok(b.includes(sel), sel + ' absent du style commun');
  }
  assert.match(b, /background:var\(--voile\) !important/);
  assert.match(b, /min-width:44px;min-height:44px/);
  assert.match(b, /html\.fenetre-ouverte,html\.fenetre-ouverte body\{overflow:hidden !important\}/);
});

test('les règles mobiles sont identiques pour l\'écran étroit et le mode mobile forcé', () => {
  const lignes = bloc().split('\n').map((l) => l.trim());
  const etroit = lignes.filter((l) => l.startsWith('html:not(.force-web) ')).map((l) => l.split('html:not(.force-web) ').join(''));
  const force = lignes.filter((l) => l.startsWith('html.force-mobile ')).map((l) => l.split('html.force-mobile ').join(''));
  assert.ok(etroit.length >= 5, 'bloc mobile vide');
  assert.deepStrictEqual(force, etroit);
});

test('le menu « Plus » montre ses libellés sur téléphone', () => {
  assert.match(bloc(), /\.tb-more-panel \.actu-btn span\{display:inline !important\}/);
});

test('Échap ferme la fenêtre du dessus, et un clic à côté ne ferme qu\'une fenêtre de lecture', () => {
  const i = HTML.indexOf('const FENETRES_GEREES');
  assert.ok(i > 0);
  const js = HTML.slice(i, i + 6000);
  assert.match(js, /ev\.key === 'Escape'/);
  assert.match(js, /FENETRES_LECTURE = new Set\(\['publicPanel', 'diagOverlay', 'kpiDrillOverlay'\]\)/);
  assert.doesNotMatch(js, /FENETRES_LECTURE = new Set\([^)]*(adminPanel|paiementPanel|reclamPanel|valDlg)/);
});
