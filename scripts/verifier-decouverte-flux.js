#!/usr/bin/env node
// Compare le flux RSS configuré dans SRCS (web/SentiqS_Web.html, champ
// `rss:`) à ce que le site annonce lui-même AUJOURD'HUI via l'autodiscovery
// RSS/Atom standard (voir scripts/lib/decouverte-flux.js) — signale une
// dérive (le site a changé de flux sans que SRCS suive) plutôt que de la
// laisser dégrader silencieusement la couverture d'un pays.
//
// Né d'une question restée sans réponse lors de l'audit du 02-03/09/2026
// sur les 20 pays au taux de fraîcheur le plus bas (voir le commit "feat:
// rotation equitable de la file de collecte") : est-ce que ces pays ont
// simplement peu d'actualité récente, ou est-ce qu'une partie de leurs
// sources pointent vers un flux mort/déplacé sans que rien ne le
// signale ? scripts/verifier-sources.js contrôle que le REGISTRE est
// cohérent (score, seuil) mais ne vérifie jamais que les URLs qu'il
// contient sont encore ce que les sites annoncent — ce script comble
// exactement ce point aveugle.
//
// ATTENTION — NÉCESSITE UN ACCÈS RÉSEAU RÉEL vers les ~495 sites listés
// dans SRCS (fetch de chaque page d'accueil). INUTILISABLE dans un
// environnement à liste blanche réseau restreinte (voir la section
// "Contrainte réseau" de .claude/agents/agent-installation.md) — à lancer
// depuis un poste avec accès internet complet, ou un job GitHub Actions
// dédié (comme collecte-planifiee.yml, qui tourne déjà sur un runner à
// accès réseau complet). Ne PAS essayer de le lancer depuis un bac à
// sable Claude Code : il échouera source par source sur des erreurs
// "Host not in allowlist", donnant l'illusion trompeuse que 495 sites sont
// injoignables alors que c'est le bac à sable qui est restreint.
//
// Non-bloquant par conception (jamais process.exit(1) sur une dérive
// détectée) : beaucoup de sites n'ont AUCUN <link alternate> déclaré (ce
// n'est pas une obligation), et une dérive détectée ne prouve pas que le
// flux configuré est cassé — certains sites déclarent un flux "principal"
// différent du flux spécifique déjà choisi ici (filtré par catégorie,
// p.ex.). Un signal à vérifier au cas par cas, jamais une correction
// automatique — cohérent avec scripts/lib/couverture.js, qui traite déjà
// la fraîcheur comme informative plutôt que comme un seuil dur, pour la
// même raison.
const fs = require('node:fs');
const path = require('node:path');
const { fetchRespectueux } = require('./lib/fetch-respectueux');
const { decouvrirFlux } = require('./lib/decouverte-flux');

const cible = process.argv[2] || path.join(__dirname, '../web/SentiqS_Web.html');
// Deuxième argument optionnel : ne vérifier que N sources (utile pour un
// premier passage rapide/manuel avant de lancer les ~495 en entier).
const LIMITE = process.argv[3] ? Number(process.argv[3]) : Infinity;

const HTML = fs.readFileSync(cible, 'utf8');

const sources = [...HTML.matchAll(/\{id:'([^']+)'[^}]*?cy:'([A-Z]{2,3})'[^}]*?url:'([^']+)'[^}]*?rss:'([^']+)'/g)]
  .map((m) => ({ id: m[1], cy: m[2], url: m[3], rss: m[4] }));

if (!sources.length) { console.error('✗ aucune source lue dans SRCS (marqueurs url:/rss: introuvables ou format changé)'); process.exit(1); }

const aVerifier = sources.slice(0, Number.isFinite(LIMITE) ? LIMITE : sources.length);

(async () => {
  let injoignables = 0, sansFluxDeclare = 0, derives = 0, conformes = 0;
  const lignesDerive = [];
  const lignesInjoignable = [];

  for (const s of aVerifier) {
    const page = await fetchRespectueux(s.url);
    if (!page.ok) {
      injoignables++;
      lignesInjoignable.push(`  ? ${s.id} (${s.cy}) — page d'accueil (${s.url}) injoignable : ${page.raison}`);
      continue;
    }
    const flux = decouvrirFlux(page.texte, s.url);
    if (!flux.length) { sansFluxDeclare++; continue; }
    if (flux.some((f) => f.href === s.rss)) { conformes++; continue; }
    derives++;
    lignesDerive.push(
      `  ⚠ ${s.id} (${s.cy})\n` +
      `     SRCS         : ${s.rss}\n` +
      `     site annonce : ${flux.map((f) => f.href).join(', ')}`
    );
  }

  console.log(`Sources vérifiées : ${aVerifier.length}/${sources.length}`);
  console.log(`  conformes (flux SRCS retrouvé dans l'autodiscovery du site) : ${conformes}`);
  console.log(`  sans <link alternate> déclaré (rien à comparer, pas une anomalie) : ${sansFluxDeclare}`);
  console.log(`  page d'accueil injoignable (voir liste ci-dessous) : ${injoignables}`);
  console.log(`  DÉRIVE détectée (le site annonce un flux différent de celui configuré) : ${derives}`);

  if (lignesDerive.length) {
    console.log('\nDérives détectées — à vérifier au cas par cas avant de modifier SRCS :');
    lignesDerive.forEach((l) => console.log(l));
  }
  if (lignesInjoignable.length) {
    console.log('\nPages d\'accueil injoignables :');
    lignesInjoignable.forEach((l) => console.log(l));
  }

  console.log(
    "\nRappel : une dérive signalée n'est PAS une preuve que le flux configuré est cassé, "
    + "et une page injoignable ici n'est pas forcément le flux RSS lui-même (voir SRC_HEALTH, "
    + 'alimenté par le job de collecte réel, pour la santé du flux proprement dit). '
    + 'Ce script pointe vers ce qui mérite un regard humain, il ne corrige rien tout seul.'
  );
})();
