// ============================================================
// SentiqS — Job de collecte planifiée (voir
// .github/workflows/collecte-planifiee.yml)
//
// Déclenche UNE collecte réelle (~495 sources RSS) via un navigateur
// headless pointé sur l'application déployée, puis publie le résultat dans
// le cache partagé Supabase (collecte_partagee) — pour que ce cache reste
// quasi toujours frais, indépendamment du trafic réel de visiteurs.
// Auparavant, le cache n'était alimenté que par hasard (un visiteur
// déclenchant lui-même une collecte) : dès qu'il expirait, le prochain
// visiteur relançait une collecte complète depuis SON PROPRE navigateur.
//
// Réutilise entièrement le moteur de collecte déjà écrit et testé côté
// client (SentiqS_Web.html) plutôt que de le réimplémenter en
// Node/Deno — élimine tout risque de divergence entre deux implémentations
// du même parsing RSS/classification/déduplication.
//
// Authentification : établit une session synthétique en LECTURE SEULE via
// COLLECTOR_TOKEN (#collecteur-<jeton>, voir checkCollectorSession() dans
// SentiqS_Web.html) — distincte du compte administrateur réel,
// jamais écrite dans sentinel_users_v1, ne regénère ni ne modifie jamais le
// code d'accès de l'admin.
// ============================================================

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { USER_AGENT } = require('./lib/fetch-respectueux');
const { creerIntercepteur } = require('./lib/interception-proxy-directe');

// Firebase Hosting retire (sentinel-surete.web.app ne recoit plus de
// deploiement) — GitHub Pages est desormais l'hebergement reel.
const TARGET_URL = process.env.SENTINEL_URL || 'https://ytl1-ops.github.io/SentiqS/SentiqS_Web.html';
const HTML_PATH = process.env.SENTINEL_HTML_PATH || path.join(__dirname, '..', 'web', 'SentiqS_Web.html');
// Premier run réel (18/07) : les proxys CORS partagés (allorigins,
// corsproxy.org, codetabs...) renvoient énormément de 429 (rate-limit) face
// à une rafale de ~495 requêtes concentrées depuis UNE SEULE IP (le runner
// GitHub Actions) — un pattern que ces services voient probablement comme
// un abus, contrairement au trafic organique de vrais visiteurs, réparti
// sur des milliers d'IP différentes. Une fois ce throttling déclenché, le
// débit s'effondre (~1 source toutes les 5-8s au lieu de lots de 30-60 en
// parallèle) : boucler sur les ~495 sources peut alors prendre bien plus de
// 6 min. D'où COLLECT_TIMEOUT_MS large ET la publication du résultat
// PARTIEL au lieu d'un échec sec (voir plus bas) — ALL est déjà mis à jour
// progressivement par doCollect() toutes les 20 sources terminées, un
// instantané partiel reste largement utile pour le cache partagé.
const COLLECT_TIMEOUT_MS = 8 * 60 * 1000;

function lireTokenDepuisSource() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const m = html.match(/const COLLECTOR_TOKEN = '([^']+)'/);
  if (!m) throw new Error('COLLECTOR_TOKEN introuvable dans ' + HTML_PATH + ' — le job et l\'application ont divergé ?');
  return m[1];
}

// Interception des proxys CORS publics → fetch direct et respectueux (voir
// scripts/lib/interception-proxy-directe.js pour le détail et le
// raisonnement complet). Transparente pour le code client, filet de
// sécurité automatique (route.continue()) si le fetch direct échoue.
const { interceptionProxyDirecte, stats: statsInterception } = creerIntercepteur();

(async () => {
  const token = lireTokenDepuisSource();
  const url = TARGET_URL + '#collecteur-' + token;
  console.log('SentiqS collecte planifiée — cible :', TARGET_URL);

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  // User-Agent identifiable pour CE job (voir scripts/lib/fetch-respectueux.js)
  // — le chargement de la page elle-même s'identifie donc aussi clairement,
  // cohérent avec l'esprit "respectueux" de l'ensemble du job.
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, userAgent: USER_AGENT });
  const erreursPage = [];
  page.on('pageerror', e => erreursPage.push(e.message));
  page.on('console', msg => { if (msg.type() === 'warning' || msg.type() === 'error') console.log('  [page]', msg.text()); });
  await page.route('**/*', interceptionProxyDirecte);

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });

    // Attend que checkCollectorSession() ait bien pris la main (session
    // synthétique établie, écran de connexion masqué) — voir
    // window.addEventListener('load', checkAuth) dans le fichier source.
    await page.waitForFunction(
      () => typeof _MEM_SESSION !== 'undefined' && _MEM_SESSION && _MEM_SESSION.email === 'collecteur@sentinel.interne',
      { timeout: 15000 }
    );
    console.log('Session collecteur établie.');

    // Orchestration explicite (voir checkCollectorSession, volontairement
    // minimal côté client) : detectProxy() -> doCollect(). Ne PAS chaîner
    // publierCollectePartagee() à l'intérieur de cet evaluate : si
    // doCollect() n'a pas fini dans les temps (rate-limit proxy, voir plus
    // haut), on veut quand même publier l'instantané PARTIEL déjà présent
    // dans ALL plutôt que de tout perdre sur un timeout.
    const collecte = page.evaluate(async () => {
      await detectProxy();
      await doCollect();
    });
    let collecteComplete = true;
    try {
      await Promise.race([
        collecte,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), COLLECT_TIMEOUT_MS)),
      ]);
    } catch (e) {
      collecteComplete = false;
      console.log('Collecte non terminée sous ' + (COLLECT_TIMEOUT_MS / 60000) + ' min (proxys probablement rate-limités) — publication du résultat PARTIEL déjà accumulé.');
      // La collecte continue en tâche de fond dans la page tant que le
      // navigateur reste ouvert (Promise.race n'annule pas le perdant) —
      // sans effet indésirable puisqu'on ferme le navigateur juste après
      // avoir lu/publié l'instantané courant de ALL.
    }

    const resultat = await page.evaluate(async () => {
      if (!Array.isArray(ALL) || !ALL.length) return { ok: false, raison: 'Aucun article dans ALL' };
      if (typeof publierCollectePartagee !== 'function') return { ok: false, raison: 'publierCollectePartagee indisponible (Supabase non chargé ?)' };
      // La raison d'etre UNIQUE de ce job est de garder collecte_partagee a
      // jour pour tous les visiteurs (voir en-tete du fichier) — publier ne
      // suffit pas, la publication doit REELLEMENT reussir. Avant ce
      // controle, ce job rapportait "succes" meme quand la table
      // n'existait pas / que Supabase refusait l'ecriture (RLS, quota...) :
      // publierCollectePartagee avalait l'erreur en interne (console.warn
      // seul), rien ne la faisait remonter jusqu'ici. Consequence reelle
      // constatee : la table collecte_partagee est restee absente du projet
      // Supabase pendant des semaines sans qu'aucun run planifie ne l'ait
      // jamais signale — dans une application de surete, une donnee perimee
      // presentee comme a jour est un facteur de risque grave ; ce job doit
      // echouer BRUYAMMENT (exit code non nul, run rouge dans GitHub
      // Actions) plutot que de masquer une panne de publication.
      const pub = await publierCollectePartagee(ALL, true);
      if (!pub || !pub.ok) return { ok: false, raison: 'publierCollectePartagee a echoue : ' + (pub && pub.raison || 'raison inconnue') };
      // Alimente aussi l'index de recherche de l'Assistant IA (RAG) — best-
      // effort, ne doit jamais faire echouer la publication du cache
      // principal si absent/en echec (voir articles_rag, migration
      // 20260718030000).
      if (typeof publierArticlesRagPartages === 'function') { try { await publierArticlesRagPartages(ALL); } catch (_) {} }
      // Persiste les evenements Agenda detectes automatiquement (agent
      // AGENDA, voir agenda_partagee/migration 20260719000000) —
      // best-effort, meme raisonnement que le RAG ci-dessus. C'est ce job
      // planifie (toutes les ~30 min, sans dependre qu'un visiteur ait la
      // page ouverte) qui couvre effectivement les 54 pays de facon fiable :
      // sans lui, un evenement detecte reste invisible des que l'article
      // source sort de ALL (12h), quel que soit le trafic reel de visiteurs.
      if (typeof publierAgendaPartagee === 'function') { try { await publierAgendaPartagee(ALL); } catch (_) {} }
      return { ok: true, nbArticles: pub.nbArticles, bestProxy: String(typeof bestProxy !== 'undefined' ? bestProxy : '?') };
    });

    console.log(
      'Interception directe (voir scripts/lib/fetch-respectueux.js) : ' +
      statsInterception.direct_ok + '/' + statsInterception.intercepte + ' requêtes proxy servies directement, ' +
      statsInterception.repli_proxy + ' repli sur le vrai proxy.'
    );

    if (!resultat.ok) {
      console.error('Échec :', resultat.raison);
      process.exitCode = 1;
    } else {
      console.log(
        (collecteComplete ? 'Collecte complète publiée avec succès — ' : 'Collecte PARTIELLE publiée avec succès — ') +
        resultat.nbArticles + ' articles (proxy: ' + resultat.bestProxy + ').'
      );
    }
  } catch (e) {
    console.error('Erreur pendant la collecte planifiée :', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    if (erreursPage.length) {
      console.warn('Erreurs JS détectées sur la page :', JSON.stringify(erreursPage));
    }
    await browser.close();
  }
})();
