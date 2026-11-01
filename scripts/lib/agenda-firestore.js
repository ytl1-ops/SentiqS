// Agenda partagé sur Firestore (collecte_partagee/agenda) — 01/11/2026.
//
// Supabase refuse toute lecture et écriture depuis le 27/10/2026 (402, quota
// de transfert dépassé) : l'agenda partagé, écrit par le job dans la table
// agenda_partagee, ne se mettait plus à jour pour personne. Il suit désormais
// le cache d'actus sur Firestore, même format (web/js/cache-firestore.js,
// clé « agenda »).
//
// Firestore n'a pas d'upsert par ligne dans ce format (un seul blob découpé) :
// le job relit l'agenda en place et le fusionne ici. Même règle que la table :
// une entrée par id, la plus récente gagne ; on ne garde que la fenêtre de
// l'agenda (AGENDA_MAX_AGE, lue DANS la page par l'appelant pour ne pas la
// recopier) et au plus MAX entrées, comme la lecture Supabase (limit 500).
'use strict';

const MAX = 500;

function tempsDe(l, champ) {
  const t = l && l[champ] ? new Date(l[champ]).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

function fusionnerAgenda(existants, nouvelles, maintenantMs, maxAgeMs) {
  const seuil = maintenantMs - maxAgeMs;
  const parId = new Map();
  for (const l of [].concat(existants || [], nouvelles || [])) {
    if (!l || !l.id || !l.title) continue;
    if (tempsDe(l, 'pub_date') <= seuil) continue;
    const deja = parId.get(l.id);
    if (!deja || tempsDe(l, 'updated_at') >= tempsDe(deja, 'updated_at')) parId.set(l.id, l);
  }
  return [...parId.values()]
    .sort((a, b) => tempsDe(b, 'pub_date') - tempsDe(a, 'pub_date'))
    .slice(0, MAX);
}

module.exports = { fusionnerAgenda, MAX };
