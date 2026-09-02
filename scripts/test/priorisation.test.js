// Priorisation du travail humain restant — voir scripts/lib/priorisation.js.
//
// Ces deux calculs ne decident rien : ils rangent, pour qu'un humain decide
// dans le bon ordre. Ce sont les tests de ce rangement.
const test = require('node:test');
const assert = require('node:assert');
const P = require('../lib/priorisation.js');

const src = (cy, score) => ({ cy, score });

// ── Sensibilite du seuil ───────────────────────────────────────────────────
test('profilSeuil compte les pays a source unique, pas les sources', () => {
  const s = [src('ML', 80), src('ML', 68), src('BF', 80), src('BF', 75)];
  assert.strictEqual(P.profilSeuil(s, 70).uniques, 1, 'ML n\'a qu\'une source >= 70');
  assert.strictEqual(P.profilSeuil(s, 70).pays, 2);
});

test('un pays sans aucune source au seuil est compte aveugle, pas unique', () => {
  const p = P.profilSeuil([src('ML', 60), src('BF', 80)], 70);
  assert.strictEqual(p.aveugles, 1);
  assert.strictEqual(p.uniques, 1);
});

test('baisser le seuil ne peut jamais reduire la couverture', () => {
  // Propriete de monotonie : si elle tombe, c'est que le calcul a un bug, et
  // le tableau de sensibilite deviendrait trompeur.
  const s = [];
  for (const cy of ['ML', 'BF', 'NE', 'TD']) for (const sc of [80, 68, 64, 58]) s.push(src(cy, sc));
  let precedent = -1;
  for (const seuil of [90, 80, 70, 68, 64, 58, 50]) {
    const p = P.profilSeuil(s, seuil);
    assert.ok(p.sources >= precedent, 'seuil ' + seuil + ' : la couverture a baissé');
    precedent = p.sources;
  }
});

test('INT n est jamais compte comme un pays', () => {
  const p = P.profilSeuil([src('INT', 90), src('ML', 80)], 70);
  assert.strictEqual(p.pays, 1);
});

test('le seuil est inclusif, comme dans getLiveAlertEvents', () => {
  // Verifie les DEUX sorties : une premiere version comparait separement pour
  // le compte par pays et pour le total, et une mutation les a fait diverger
  // sans qu'aucun test ne le voie.
  const pile = P.profilSeuil([src('ML', 70)], 70);
  assert.strictEqual(pile.sources, 1);
  assert.strictEqual(pile.uniques, 1);
  assert.strictEqual(pile.aveugles, 0);

  const dessous = P.profilSeuil([src('ML', 69)], 70);
  assert.strictEqual(dessous.sources, 0);
  assert.strictEqual(dessous.aveugles, 1);
});

// ── Priorite de revue ──────────────────────────────────────────────────────
const pays = (o) => Object.assign(
  { niveau: 'orange', plusRecentJours: 100, total: 10, verifies: 9, live: 0 }, o);

test('a socle egal, un niveau plus eleve passe devant', () => {
  assert.ok(P.prioriteRevue(pays({ niveau: 'rouge' })) > P.prioriteRevue(pays({ niveau: 'jaune' })));
});

test('a niveau egal, un socle plus ancien passe devant', () => {
  assert.ok(P.prioriteRevue(pays({ plusRecentJours: 300 })) > P.prioriteRevue(pays({ plusRecentJours: 30 })));
});

test('a niveau et age egaux, une plus grande part du socle passe devant', () => {
  assert.ok(P.prioriteRevue(pays({ verifies: 9 })) > P.prioriteRevue(pays({ verifies: 2 })));
});

test('la collecte attenue la priorite sans l annuler', () => {
  // Elle corrige a la marge ; elle ne remplace pas une revue humaine.
  const avec = P.prioriteRevue(pays({ live: 3 }));
  const sans = P.prioriteRevue(pays({ live: 0 }));
  assert.ok(avec < sans, 'la collecte doit attenuer');
  assert.ok(avec > 0, 'elle ne doit jamais annuler');
  assert.strictEqual(avec, sans / 2);
});

test('un socle sans date exploitable est traite comme tres ancien', () => {
  // L'absence de date est un probleme, pas une absence de probleme : la
  // traiter comme « neuf » ferait disparaitre de la liste exactement les pays
  // dont personne ne sait quand ils ont ete revus.
  const inconnu = P.prioriteRevue(pays({ plusRecentJours: null }));
  const recent = P.prioriteRevue(pays({ plusRecentJours: 10 }));
  assert.ok(inconnu > recent);
  assert.strictEqual(inconnu, P.prioriteRevue(pays({ plusRecentJours: P.AGE_SI_INCONNU_J })));
});

test('un pays au vert ne remonte jamais la liste', () => {
  // Le vert est le seul niveau ou une donnee perimee ne peut pas produire de
  // faux negatif visible : il n'y a rien a rater en dessous.
  assert.strictEqual(P.prioriteRevue(pays({ niveau: 'vert', plusRecentJours: 900 })), 0);
});

test('un pays sans score total ne casse pas le calcul', () => {
  assert.strictEqual(P.prioriteRevue(pays({ total: 0, verifies: 0 })), 0);
  assert.strictEqual(P.prioriteRevue(null), 0);
});

// ── Triage des incidents vérifiés ──────────────────────────────────────────
const inc = (o) => Object.assign({ niveau: 'marron', niveauSans: 'orange', jours: 300 }, o);

test('un incident qui ne porte pas le niveau est differable', () => {
  // Le retirer ne change rien a ce que voit l utilisateur : le relire non plus.
  assert.strictEqual(P.triageIncident(inc({ niveauSans: 'marron' })), 'differable');
});

test('porteur et ancien : urgent', () => {
  assert.strictEqual(P.triageIncident(inc({ jours: 300 })), 'urgent');
});

test('porteur mais recent : a relire, pas urgent', () => {
  // Un incident porteur de trois semaines est probablement encore vrai.
  assert.strictEqual(P.triageIncident(inc({ jours: 20 })), 'porteur');
});

test('une date non analysable compte comme ancienne', () => {
  // On ne sait pas, donc on regarde. La traiter comme recente ferait
  // disparaitre de la liste les incidents les moins bien saisis — exactement
  // ceux qui meritent un oeil.
  assert.strictEqual(P.triageIncident(inc({ jours: null })), 'urgent');
  assert.strictEqual(P.triageIncident(inc({ jours: undefined })), 'urgent');
  assert.strictEqual(P.triageIncident(inc({ jours: 'hier' })), 'urgent');
});

test('un age negatif est aujourd hui, pas une date inconnue', () => {
  // La premiere version confondait les deux et classait « urgents » douze
  // incidents qui sont les PLUS RECENTS du socle : dateEvenementMs resout une
  // date imprecise (« Juin 2026 ») a un point qui peut tomber un jour dans le
  // futur, d'ou des ages a -1. Le comptage passait de 36 a 48.
  assert.strictEqual(P.triageIncident(inc({ jours: -1 })), 'porteur');
  assert.strictEqual(P.triageIncident(inc({ jours: -400 })), 'porteur');
});

test('le seuil d anciennete est inclusif', () => {
  assert.strictEqual(P.triageIncident(inc({ jours: P.AGE_SUSPECT_J })), 'urgent');
  assert.strictEqual(P.triageIncident(inc({ jours: P.AGE_SUSPECT_J - 1 })), 'porteur');
});

test('un incident non porteur reste differable meme tres ancien', () => {
  // L anciennete seule ne suffit pas : sans effet sur le niveau, elle ne
  // coute rien a l utilisateur.
  assert.strictEqual(P.triageIncident(inc({ niveauSans: 'marron', jours: 900 })), 'differable');
});

// ── Sourcage des fiches pays ───────────────────────────────────────────────
//
// Le generateur EXIGEAIT depuis toujours un champ « sources » non vide et
// refusait de produire la fiche sans lui. Mais le gabarit ne l'affichait
// nulle part : la regle etait appliquee a la generation et invisible au
// lecteur. Une page d'evaluation de risque pays, publique, sans rien qui
// permette de verifier ce qu'elle avance.
const fsSrc = require('node:fs');
const pathSrc = require('node:path');

const RACINE_FICHES = pathSrc.join(__dirname, '../../web/pays');
const RACINE_DONNEES = pathSrc.join(__dirname, '../../data/pays');

test('le gabarit prevoit une section sources', () => {
  const g = fsSrc.readFileSync(pathSrc.join(__dirname, '../templates/fiche-country.template.html'), 'utf8');
  assert.match(g, /<section class="sources">/);
  assert.match(g, /\{\{SOURCES_HTML\}\}/);
});

test('le generateur refuse une source qui pointe sur SentiqS lui-meme', () => {
  // Le fichier de donnees du Ghana citait la fiche Ghana deja publiee comme
  // sa propre source : la regle etait satisfaite formellement, et le lecteur
  // n'avait toujours rien pour verifier.
  const gen = fsSrc.readFileSync(pathSrc.join(__dirname, '../generate-country-fiche.js'), 'utf8');
  assert.match(gen, /ytl1-ops\\\.github\\\.io\|sentiqs\\\.com/);
  assert.match(gen, /source EXTERNE verifiable par le lecteur/);
});

test('toute fiche adossee a des donnees affiche ses sources', () => {
  const donnees = fsSrc.readdirSync(RACINE_DONNEES)
    .filter((f) => f.endsWith('.json') && f !== 'schema.json')
    .map((f) => f.replace(/\.json$/, ''));
  const AUTO = /(ytl1-ops\.github\.io|sentiqs\.com)/i;

  for (const slug of donnees) {
    const d = JSON.parse(fsSrc.readFileSync(pathSrc.join(RACINE_DONNEES, slug + '.json'), 'utf8'));
    const externes = (d.sources || []).filter((s) => !AUTO.test(String(s)));
    const fiche = pathSrc.join(RACINE_FICHES, slug + '.html');
    if (!fsSrc.existsSync(fiche)) continue;
    const html = fsSrc.readFileSync(fiche, 'utf8');

    if (externes.length === 0) {
      // Cas connu et nomme : Ghana. Sa fiche existe, mais ses donnees ne
      // portent aucune source externe — elle ne peut donc pas etre regeneree
      // tant que quelqu'un ne lui en donne pas une.
      assert.strictEqual(slug, 'ghana',
        slug + ' n\'a aucune source externe : ajoutez-en une ou retirez la fiche');
      continue;
    }
    assert.match(html, /<section class="sources">/, slug + ' : la fiche n\'affiche pas ses sources');
    for (const s of externes) {
      const url = String(s).match(/https?:\/\/\S+?(?=\s|\)|$)/);
      if (url) assert.ok(html.includes(url[0]), slug + ' : la source ' + url[0] + ' n\'apparait pas dans la fiche');
    }
  }
});
