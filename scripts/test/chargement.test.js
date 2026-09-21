// Ce que la page telecharge avant le premier geste de l'utilisateur.
//
// Mesure du 03/09/2026 : la page (1,44 Mo) chargeait au demarrage quatre
// bibliotheques d'export — Word, PowerPoint, PDF, Excel — soit 2,37 Mo de
// plus, pour une action que la plupart des sessions ne font jamais. Sur une
// connexion mobile africaine, c'est la difference entre une page qui s'ouvre
// et une page qui n'arrive pas. Elles se chargent desormais au premier clic
// sur un export.
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche } = require('./_bac.js');

const BIBLIOTHEQUES = ['docx', 'pptxgen', 'pdf-lib', 'xlsx'];

test('aucune bibliotheque d\'export n\'est chargee par une balise <script> au demarrage', () => {
  const balises = [...HTML.matchAll(/<script[^>]*\ssrc="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  for (const b of BIBLIOTHEQUES) {
    assert.ok(!balises.some((u) => u.includes(b)), b + ' est encore chargee au demarrage : ' + balises.find((u) => u.includes(b)));
  }
});

test('chaque export charge sa bibliotheque avant de s\'en servir', () => {
  const attendus = [
    ['async function exportExcel', "chargerBibliotheque('xlsx')"],
    ['async function exportPPTX', "chargerBibliotheque('pptx')"],
    ['async function exportPDF', "chargerBibliotheque('pdf')"],
    ['async function genererModeEmploiPDF', "chargerBibliotheque('pdf')"],
    ['async function exportWord', "chargerBibliotheque('docx')"],
  ];
  for (const [fn, appel] of attendus) {
    const i = HTML.indexOf(fn);
    assert.ok(i !== -1, fn + ' introuvable');
    // L'appel doit se trouver dans les premieres lignes de la fonction, avant
    // tout usage de la bibliotheque.
    const debut = HTML.slice(i, i + 700);
    assert.ok(debut.includes(appel), fn + ' ne charge pas sa bibliotheque a la demande');
  }
});

test('le chargeur ne charge chaque bibliotheque qu\'une fois et sait echouer', () => {
  const f = tranche('function chargerBibliotheque', '</script>');
  assert.match(f, /typeof window\[b\.global\] !== 'undefined'/, 'une bibliotheque deja presente ne doit pas etre rechargee');
  assert.match(f, /_bibliothequesEnCours\[nom\]/, 'deux clics rapproches ne doivent pas injecter deux balises');
  assert.match(f, /el\.onerror/, 'un echec reseau doit etre signale, pas attendu indefiniment');
});

test('SheetJS est pris a une version corrigee, depuis un CDN que la CSP autorise', () => {
  // 0.18.5 (la derniere sur npm) porte CVE-2023-30533 et CVE-2024-22363 ;
  // les correctifs (0.19.3, 0.20.2) ne sont servis que par cdn.sheetjs.com.
  const m = /xlsx-(\d+)\.(\d+)\.(\d+)\/package\/dist\/xlsx\.full\.min\.js/.exec(HTML);
  assert.ok(m, 'SheetJS doit etre pris sur cdn.sheetjs.com, versionne');
  const [, maj, min, pat] = m.map(Number);
  assert.ok(maj > 0 || min > 20 || (min === 20 && pat >= 2), 'SheetJS doit etre >= 0.20.2');
  const csp = /script-src ([^;]*);/.exec(HTML)[1];
  assert.ok(csp.includes('https://cdn.sheetjs.com'), 'la CSP doit autoriser cdn.sheetjs.com, sinon le chargement echoue en silence');
});

test('le bandeau publicitaire a ete retire, pas seulement masque', () => {
  // 21/09/2026 : le bandeau etait deja masque par defaut (initAdBanner()
  // etait un no-op) et un cadre « emplacement publicitaire » vide sur un
  // outil de surete ne rassurait personne. Demande explicite de retirer la
  // pub : plutot que de laisser du balisage mort en attente d'une
  // reactivation qui n'est plus prevue, HTML/CSS/JS/i18n sont retires.
  assert.doesNotMatch(HTML, /class="ad-banner/, 'le balisage .ad-banner doit avoir disparu');
  assert.doesNotMatch(HTML, /function (dismiss|init)AdBanner/, 'les fonctions du bandeau doivent avoir disparu');
  assert.doesNotMatch(HTML, /ADSENSE_CLIENT_ID|adsbygoogle/, 'aucune trace d\'AdSense ne doit subsister');
});
