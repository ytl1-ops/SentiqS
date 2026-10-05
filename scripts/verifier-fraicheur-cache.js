#!/usr/bin/env node
// Verifie que le cache partage a bien ete rafraichi par la collecte qui vient
// de tourner. Un job peut se terminer sans erreur tout en n'ayant rien publie
// (proxys rate-limites, publication refusee...) : on controle donc l'EFFET,
// pas seulement l'absence d'exception.
//
// Le fichier STATIQUE (web/cache/collecte-partagee.json, ecrit par
// scripts/collecte-planifiee.js) est desormais la verification PRIMAIRE :
// c'est lui que lit la quasi-totalite des visiteurs (voir
// lireCollectePartageeStatique() dans web/SentiqS_Web.html), et il doit
// rester fiable meme quand Supabase est indisponible — c'est exactement ce
// qui s'est produit le 05/10/2026 (quota d'egress depasse, projet suspendu,
// Auth comprise). Le lire depuis le disque local evite en plus toute
// dependance reseau pour ce controle.
//
// La verification Supabase est conservee en INFORMATIF seulement : utile
// pour savoir si le repli de lecture (et le RAG/Agenda qui en dependent)
// fonctionne, mais une panne Supabase ne doit plus, a elle seule, faire
// echouer ce controle — ce serait precisement laisser un incident
// d'infrastructure masquer que le cache public, lui, est a jour.
const fs = require('node:fs');
const path = require('node:path');

const AGE_MAX_MIN = Number(process.env.FRAICHEUR_MAX_MIN || 45);

const CHEMIN_STATIQUE = path.join(__dirname, '../web/cache/collecte-partagee.json');

let statiqueOk = false;
if (!fs.existsSync(CHEMIN_STATIQUE)) {
  console.error(`✗ Fichier statique introuvable : ${CHEMIN_STATIQUE}`);
} else {
  try {
    const data = JSON.parse(fs.readFileSync(CHEMIN_STATIQUE, 'utf8'));
    if (!data || !Array.isArray(data.articles) || !data.articles.length) {
      console.error('✗ Fichier statique sans article — rien n\'a ete publie.');
    } else {
      const ageMin = (Date.now() - new Date(data.updated_at).getTime()) / 60000;
      if (!Number.isFinite(ageMin)) {
        console.error(`✗ Horodatage illisible dans le fichier statique : ${data.updated_at}`);
      } else if (ageMin > AGE_MAX_MIN) {
        console.error(`✗ Cache statique publie il y a ${ageMin.toFixed(0)} min (seuil : ${AGE_MAX_MIN} min).`);
        console.error("La collecte s'est terminee sans rafraichir le cache statique.");
      } else {
        console.log(`✓ Cache statique frais : ${data.articles.length} article(s), publie il y a ${ageMin.toFixed(0)} min (seuil : ${AGE_MAX_MIN} min).`);
        statiqueOk = true;
      }
    }
  } catch (e) {
    console.error('✗ Fichier statique illisible : ' + ((e && e.message) || e));
  }
}

(async () => {
  const html = fs.readFileSync(path.join(__dirname, '../web/SentiqS_Web.html'), 'utf8');
  const url = (html.match(/SENTINEL_SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1];
  const key = (html.match(/SENTINEL_SUPABASE_ANON_KEY\s*=\s*'([^']+)'/) || [])[1];

  if (!url || !key) {
    console.warn("⚠ URL ou cle Supabase introuvable dans web/SentiqS_Web.html — repli de lecture non verifiable.");
  } else {
    try {
      const r = await fetch(
        `${url}/rest/v1/collecte_partagee?select=updated_at&id=eq.global`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      if (!r.ok) {
        console.warn(`⚠ Supabase (repli de lecture) injoignable : HTTP ${r.status}. Le cache statique reste la verification qui compte.`);
      } else {
        const lignes = await r.json();
        if (!Array.isArray(lignes) || !lignes.length) {
          console.warn("⚠ Supabase (repli de lecture) : aucune ligne 'global' dans collecte_partagee.");
        } else {
          const ageMin = (Date.now() - new Date(lignes[0].updated_at).getTime()) / 60000;
          console.log(Number.isFinite(ageMin)
            ? `  Supabase (repli de lecture) : publie il y a ${ageMin.toFixed(0)} min.`
            : `⚠ Supabase (repli de lecture) : horodatage illisible (${lignes[0].updated_at}).`);
        }
      }
    } catch (e) {
      console.warn('⚠ Supabase (repli de lecture) injoignable : ' + ((e && e.message) || e));
    }
  }

  process.exit(statiqueOk ? 0 : 1);
})();
