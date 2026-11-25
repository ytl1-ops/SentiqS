'use strict';
// Sonde du traducteur hors ligne (25/11/2026), lancée par
// .github/workflows/sonde-traduction.yml depuis un runner GitHub : le bac à
// sable de développement n'atteint pas les modèles (argos-net.com).
//
// Deux mesures, rien n'est écrit dans le cache :
//   1. couverture : part des articles du cache partagé qui portent une
//      traduction (a.tr), et part de ceux qui ressemblent à de l'anglais
//      sans traduction française (masqués en français) ;
//   2. débit : un même échantillon de titres et de chapôs anglais du cache,
//      traduit en français par le nouveau traducteur (CTranslate2 en direct)
//      et, si SONDE_ARGOS=1, par l'ancienne bibliothèque Argos.
// Le journal ne porte que des comptes et six exemples de titres, jamais un
// secret (le compte de service n'est lu que par cache-firestore-ecriture).
const { spawnSync } = require('child_process');
const path = require('path');
const cacheFirestore = require('./lib/cache-firestore-ecriture');
const { demarrerTraducteurLocal } = require('./lib/traducteur-local');
const { ressembleAnglais } = require('./lib/traduction-job');
const { PAQUET_LOCAL_LIGNES } = require('./lib/traduction-actus');

const TAILLE = Number(process.env.SONDE_TAILLE || 300);

async function main() {
  const compte = cacheFirestore.lireCompte(process.env.FIREBASE_SERVICE_ACCOUNT || '');
  if (!compte) { console.log('FIREBASE_SERVICE_ACCOUNT absent : rien à mesurer.'); return; }
  const lu = await cacheFirestore.lireCache(compte, fetch);
  const arts = (lu && lu.articles) || [];
  const aTr = (a, l) => !!(a && a.tr && a.tr[l] && a.tr[l].t);
  const anglais = arts.filter((a) => a && ressembleAnglais(a.title));
  console.log('Cache : ' + arts.length + ' articles, mis à jour ' + (lu && lu.updated_at) + '.');
  console.log('Couverture : ' + arts.filter((a) => aTr(a, 'fr') || aTr(a, 'en')).length + ' avec au moins une traduction, '
    + arts.filter((a) => aTr(a, 'en')).length + ' avec l\'anglais, ' + arts.filter((a) => aTr(a, 'fr')).length + ' avec le français.');
  console.log('Titres anglais : ' + anglais.length + ', dont ' + anglais.filter((a) => !aTr(a, 'fr')).length + ' sans traduction française (masqués en français).');

  const titres = anglais.map((a) => a.title).slice(0, Math.round(TAILLE * 2 / 3));
  const chapos = anglais.map((a) => a.analysis).filter((s) => typeof s === 'string' && s.length > 80)
    .map((s) => s.slice(0, 320)).slice(0, TAILLE - titres.length);
  const echantillon = titres.concat(chapos);
  console.log('Échantillon : ' + titres.length + ' titres et ' + chapos.length + ' chapôs anglais, '
    + echantillon.reduce((n, t) => n + t.length, 0) + ' caractères.');
  if (!echantillon.length) return;

  // Nouveau traducteur, par paquets comme le job.
  const t0 = Date.now();
  const local = await demarrerTraducteurLocal();
  if (!local) { console.log('Nouveau traducteur : absent (Python ou modèles manquants).'); }
  else {
    const pret = Date.now();
    let ok = 0; let vides = 0; const sorties = [];
    for (let i = 0; i < echantillon.length; i += PAQUET_LOCAL_LIGNES) {
      const lot = echantillon.slice(i, i + PAQUET_LOCAL_LIGNES);
      const r = await local(lot, 'en', 'fr');
      lot.forEach((_, j) => { const v = r && r[j]; if (v) { ok++; sorties.push(v); } else { vides++; sorties.push(null); } });
    }
    local.arreter();
    const s = (Date.now() - pret) / 1000;
    console.log('Nouveau traducteur : démarrage ' + Math.round((pret - t0) / 1000) + ' s, ' + ok + ' traduites, ' + vides
      + ' vides, en ' + s.toFixed(1) + ' s, soit ' + (ok / Math.max(s, 0.1)).toFixed(1) + ' lignes/s.');
    titres.slice(0, 6).forEach((t, i) => console.log('  ' + t.slice(0, 100) + '  →  ' + String(sorties[i]).slice(0, 100)));
  }

  if (process.env.SONDE_ARGOS === '1') {
    const py = 'import json,sys,time\nimport argostranslate.translate as T\nl=json.load(sys.stdin)\nt=time.time()\n'
      + 'o=[T.translate(x,"en","fr") for x in l]\nprint(json.dumps({"n":sum(1 for x in o if x),"s":time.time()-t}))';
    const r = spawnSync(process.env.SONDE_ARGOS_PYTHON || 'python3', ['-c', py], { input: JSON.stringify(echantillon), encoding: 'utf8', timeout: 25 * 60 * 1000, cwd: path.join(__dirname, '..') });
    let m = null;
    try { m = JSON.parse(String(r.stdout || '').trim().split('\n').pop()); } catch (_) {}
    console.log(m ? 'Argos (ancienne bibliothèque) : ' + m.n + ' traduites en ' + m.s.toFixed(1) + ' s, soit ' + (m.n / Math.max(m.s, 0.1)).toFixed(1) + ' lignes/s.'
      : 'Argos (ancienne bibliothèque) : mesure impossible (' + (r.error ? r.error.code : 'sortie illisible') + ').');
  }
}

main().catch((e) => { console.error('Sonde en échec : ' + ((e && e.message) || e)); process.exitCode = 1; });
