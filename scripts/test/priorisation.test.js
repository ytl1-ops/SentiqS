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
