// Teste rangRotatif(), extrait du fichier de production : la rotation du
// point de depart de la file de collecte dans doCollect() (voir
// web/SentiqS_Web.html, juste avant doCollect).
//
// Ce que ce test protege : mesure du 02/09/2026 sur le run planifie #802,
// les 20 pays sans article frais avaient 35 % de leurs sources dans le
// DERNIER quart du tableau SRCS, contre 23 % pour les 34 autres pays — un
// biais structurel sur qui est collecte en dernier (et donc sacrifie en
// premier si un cycle est rate-limite / n'a pas le temps de tout traiter),
// independant de la fraicheur reelle de l'actualite. rangRotatif() fait
// glisser continument le point de depart dans le temps pour qu'aucune
// tranche du tableau ne soit plus jamais TOUJOURS en queue de collecte —
// simulation sur les 495 sources reelles (voir scripts/verifier-sources.js
// pour le registre) : sur une journee de cycles a 30 min, la part de
// sources "a la traine" dans le dernier quart de la file retombe a ~31 %,
// leur part reelle dans le tableau, au lieu des 35 % fixes d'avant.
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac, exposer, HTML } = require('./_bac.js');

const contexte = exposer(
  bac(tranche('const ROTATION_TOUR_COMPLET_MS', 'async function doCollect')),
  'rangRotatif', 'ROTATION_TOUR_COMPLET_MS'
);
const { rangRotatif, ROTATION_TOUR_COMPLET_MS } = contexte;

test('a un instant fixe, rangRotatif est une bijection sur [0, total)', () => {
  const total = 495;
  const maintenant = 1_800_000_000_000; // instant arbitraire mais fixe
  const rangs = new Set();
  for (let idx = 0; idx < total; idx++) rangs.add(rangRotatif(idx, total, maintenant));
  assert.strictEqual(rangs.size, total, 'chaque indice doit obtenir un rang distinct');
  for (const r of rangs) assert.ok(r >= 0 && r < total, 'rang hors bornes : ' + r);
});

test('a l instant 0, l ordre est inchange (decalage nul)', () => {
  const total = 10;
  for (let idx = 0; idx < total; idx++) {
    assert.strictEqual(rangRotatif(idx, total, 0), idx);
  }
});

test('le dernier de la file redevient parfois le premier au fil d un tour', () => {
  // Le tout dernier indice (total-1) doit, a un instant ou un autre du
  // tour complet, obtenir le rang 0 -- c'est precisement ce que "plus
  // jamais toujours en queue" veut dire.
  const total = 8;
  let vuPremier = false;
  for (let pas = 0; pas < total; pas++) {
    const maintenant = Math.round((pas / total) * ROTATION_TOUR_COMPLET_MS);
    if (rangRotatif(total - 1, total, maintenant) === 0) vuPremier = true;
  }
  assert.ok(vuPremier, 'le dernier indice doit devenir premier a un moment du tour');
});

test('un tour complet ramene exactement au meme ordre', () => {
  const total = 50;
  const maintenant = 12345;
  const unTourPlusTard = maintenant + ROTATION_TOUR_COMPLET_MS;
  for (let idx = 0; idx < total; idx++) {
    assert.strictEqual(
      rangRotatif(idx, total, maintenant),
      rangRotatif(idx, total, unTourPlusTard),
    );
  }
});

test('un tableau vide ne fait pas planter (renvoie l indice tel quel)', () => {
  assert.strictEqual(rangRotatif(0, 0, Date.now()), 0);
});

test('simulation sur les 495 sources reelles : le dernier quart de la file redevient equitable sur une journee', () => {
  const re = /\{id:'([^']+)'[^}]*?cy:'([A-Z]{2,3})'[^}]*?score:(\d+)[^}]*?\}/g;
  const sources = [];
  let m;
  while ((m = re.exec(HTML))) sources.push({ cy: m[2] });
  assert.ok(sources.length > 400, 'registre de sources introuvable ou tronque : ' + sources.length);
  const total = sources.length;

  // Les 20 pays sans article frais releves sur le run planifie #802 (voir
  // le resume de ce run et le message de commit).
  const traine = new Set(['BI','BW','CV','DJ','ER','GQ','KM','LR','LS','LY','MR','NE','RW','SC','SL','SO','SS','ST','SZ','UG']);
  const partReelle = sources.filter((s) => traine.has(s.cy)).length / total;

  const CADENCE_JOB_MS = 30 * 60 * 1000;
  const CYCLES_PAR_JOUR = 48;
  let sommeQ4 = 0;
  for (let c = 0; c < CYCLES_PAR_JOUR; c++) {
    const maintenant = c * CADENCE_JOB_MS;
    const q4 = sources.filter((s, idx) => rangRotatif(idx, total, maintenant) >= total * 0.75);
    sommeQ4 += q4.filter((s) => traine.has(s.cy)).length / q4.length;
  }
  const moyenneQ4 = sommeQ4 / CYCLES_PAR_JOUR;

  // Tolerance large (5 points) : l'objectif n'est pas une egalite parfaite
  // a la decimale pres, mais l'ecart net (35 % vs 23 % mesure avant ce
  // correctif) doit avoir disparu.
  assert.ok(
    Math.abs(moyenneQ4 - partReelle) < 0.05,
    'part moyenne des pays a la traine dans le dernier quart (' + (moyenneQ4 * 100).toFixed(1)
      + ' %) trop eloignee de leur part reelle dans le registre (' + (partReelle * 100).toFixed(1) + ' %)',
  );
});
