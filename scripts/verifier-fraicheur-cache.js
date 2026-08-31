#!/usr/bin/env node
// Verifie que le cache partage a bien ete rafraichi par la collecte qui vient
// de tourner. Un job peut se terminer sans erreur tout en n'ayant rien publie
// (proxys rate-limites, publication refusee...) : on controle donc l'EFFET,
// pas seulement l'absence d'exception.
const fs = require('node:fs');
const path = require('node:path');

const AGE_MAX_MIN = Number(process.env.FRAICHEUR_MAX_MIN || 45);

const html = fs.readFileSync(path.join(__dirname, '../web/SentiqS_Web.html'), 'utf8');
const url = (html.match(/SENTINEL_SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1];
const key = (html.match(/SENTINEL_SUPABASE_ANON_KEY\s*=\s*'([^']+)'/) || [])[1];

if (!url || !key) {
  console.error("✗ URL ou cle Supabase introuvable dans web/SentiqS_Web.html");
  process.exit(1);
}

(async () => {
  const r = await fetch(
    `${url}/rest/v1/collecte_partagee?select=updated_at&id=eq.global`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!r.ok) {
    console.error(`✗ Lecture du cache impossible : HTTP ${r.status}`);
    process.exit(1);
  }
  const lignes = await r.json();
  if (!Array.isArray(lignes) || !lignes.length) {
    console.error("✗ Aucune ligne 'global' dans collecte_partagee — rien n'a jamais ete publie.");
    process.exit(1);
  }
  const ageMin = (Date.now() - new Date(lignes[0].updated_at).getTime()) / 60000;
  if (!Number.isFinite(ageMin)) {
    console.error(`✗ Horodatage illisible : ${lignes[0].updated_at}`);
    process.exit(1);
  }
  if (ageMin > AGE_MAX_MIN) {
    console.error(`✗ Cache publie il y a ${ageMin.toFixed(0)} min (seuil : ${AGE_MAX_MIN} min).`);
    console.error("La collecte s'est terminee sans rafraichir le cache partage.");
    process.exit(1);
  }
  console.log(`✓ Cache frais : publie il y a ${ageMin.toFixed(0)} min (seuil : ${AGE_MAX_MIN} min).`);
})().catch((e) => { console.error('✗ ' + (e && e.message || e)); process.exit(1); });
