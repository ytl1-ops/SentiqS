'use strict';
// Le job sert les demandes de traduction des navigateurs — 20/11/2026.
//
// Demande de YORO : « garder la bonne traduction ». Un navigateur ne range
// jamais une traduction partagée (il pourrait en ranger une fausse, vue
// ensuite par tous) ; il dépose seulement le texte qu'il n'a pas trouvé dans
// `traductions_demandes/{clé}` (web/js/traductions-partagees.js). Ce module,
// appelé chaque heure par scripts/traduire-cache.js avec le compte de
// service, traduit ces textes avec les mêmes services que le job (Google
// « gtx », puis MyMemory : scripts/lib/traduction-job.js), range le résultat
// dans `traductions/{clé}` et efface la demande.
//
// Garde-fous : la clé est recalculée (une demande sous la clé d'un autre
// texte est effacée sans être servie) ; une traduction déjà rangée n'est
// jamais réécrite ; une demande que les services n'ont pas su traduire est
// gardée pour le passage suivant, puis effacée au bout de DEMANDE_MAX_AGE_MS.

const crypto = require('crypto');
const { jetonAcces } = require('./cache-firestore-ecriture');
const { traduire } = require('./traduction-job');
const TP = require('../../web/js/traductions-partagees.js');

const DEMANDES_PAR_PASSAGE = 300;
const DEMANDE_MAX_AGE_MS = 3 * 24 * 3600 * 1000;
const PAUSE_MS = 400;

const empreinte = (c, s) => crypto.createHash('sha256').update(c + '\n' + s).digest('hex');
const racine = (projet) => 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(projet) + '/databases/(default)/documents/';
const chaine = (f, nom) => (f && f[nom] && typeof f[nom].stringValue === 'string' ? f[nom].stringValue : null);

/**
 * Sert les demandes en attente. Rend des comptes, jamais une exception pour
 * une demande isolée.
 * @param compte    compte de service (lireCompte)
 * @param fetchFn   fetch
 * @param opts.echeance  instant (ms) au-delà duquel on s'arrête
 * @param opts.traduireFn (texte, source, {cible, fetchFn}) → traduction | null
 * @param opts.jeton  jeton d'accès déjà obtenu (tests)
 * @param opts.pauseMs, opts.maintenant
 */
async function servirDemandes(compte, fetchFn, opts) {
  const o = opts || {};
  const st = { lues: 0, traduites: 0, dejaRangees: 0, echecs: 0, invalides: 0, perimees: 0, reportees: 0 };
  const jeton = o.jeton || await jetonAcces(compte, fetchFn);
  const base = racine(compte.project_id);
  const entetes = { Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' };
  const traduireFn = o.traduireFn || traduire;
  const pause = o.pauseMs === undefined ? PAUSE_MS : o.pauseMs;
  const maintenant = o.maintenant === undefined ? Date.now() : o.maintenant;
  const echeance = o.echeance || Infinity;

  const r = await fetchFn(base + TP.COLLECTION_DEMANDES + '?pageSize=' + DEMANDES_PAR_PASSAGE, { headers: entetes });
  if (!r.ok) throw new Error('lecture des demandes de traduction refusée (HTTP ' + r.status + ')');
  const liste = ((await r.json()) || {}).documents || [];
  const effacer = (nom) => fetchFn('https://firestore.googleapis.com/v1/' + nom, { method: 'DELETE', headers: entetes }).catch(() => null);

  for (const d of liste) {
    if (Date.now() >= echeance) { st.reportees++; continue; }
    st.lues++;
    const cle = String(d.name || '').split('/').pop();
    const f = d.fields || {};
    const c = chaine(f, 'c'), s = chaine(f, 's');
    const l = chaine(f, 'l');
    if (TP.CIBLES.indexOf(c) === -1 || !s || s.length > TP.SOURCE_MAX || empreinte(c, s) !== cle) {
      st.invalides++; await effacer(d.name); continue;
    }
    // Déjà rangée (une autre demande du même texte, ou un passage précédent) :
    // on ne la réécrit pas.
    const existe = await fetchFn(base + TP.COLLECTION + '/' + cle, { headers: entetes });
    if (existe && existe.ok) { st.dejaRangees++; await effacer(d.name); continue; }

    const source = TP.LANGUES_SOURCE.indexOf(l) !== -1 && l !== 'other' ? l : 'auto';
    let t = null;
    try { t = await traduireFn(s, source, { cible: c, fetchFn }); } catch (_) { t = null; }
    if (pause) await new Promise((ok) => setTimeout(ok, pause));
    if (!t || !String(t).trim() || String(t).length > TP.TRADUCTION_MAX || String(t).trim() === s.trim()) {
      st.echecs++;
      const at = f.at && f.at.timestampValue ? Date.parse(f.at.timestampValue) : NaN;
      if (!(at > maintenant - DEMANDE_MAX_AGE_MS)) { st.perimees++; await effacer(d.name); }
      continue;
    }
    // Création seule : si un autre passage l'a rangée entre-temps, Firestore
    // refuse (409) et la première traduction reste.
    const w = await fetchFn(base + TP.COLLECTION + '?documentId=' + cle, {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify({ fields: {
        c: { stringValue: c }, s: { stringValue: s }, t: { stringValue: String(t).trim() },
        par: { stringValue: 'job' }, at: { timestampValue: new Date(maintenant).toISOString() },
      } }),
    });
    if (w.ok || w.status === 409) { st.traduites += w.ok ? 1 : 0; st.dejaRangees += w.ok ? 0 : 1; await effacer(d.name); }
    else st.echecs++;
  }
  return st;
}

module.exports = { servirDemandes, empreinte, DEMANDES_PAR_PASSAGE, DEMANDE_MAX_AGE_MS };
