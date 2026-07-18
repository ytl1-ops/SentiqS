// ============================================================
// SENTINEL — Job de collecte planifiée (voir
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
// client (SENTINEL_Surete_Web.html) plutôt que de le réimplémenter en
// Node/Deno — élimine tout risque de divergence entre deux implémentations
// du même parsing RSS/classification/déduplication.
//
// Authentification : établit une session synthétique en LECTURE SEULE via
// COLLECTOR_TOKEN (#collecteur-<jeton>, voir checkCollectorSession() dans
// SENTINEL_Surete_Web.html) — distincte du compte administrateur réel,
// jamais écrite dans sentinel_users_v1, ne regénère ni ne modifie jamais le
// code d'accès de l'admin.
// ============================================================

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.SENTINEL_URL || 'https://sentinel-surete.web.app/SENTINEL_Surete_Web.html';
const HTML_PATH = process.env.SENTINEL_HTML_PATH || path.join(__dirname, '..', 'web', 'SENTINEL_Surete_Web.html');
const COLLECT_TIMEOUT_MS = 6 * 60 * 1000; // ~495 sources par lots de 30-60 : large marge

function lireTokenDepuisSource() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const m = html.match(/const COLLECTOR_TOKEN = '([^']+)'/);
  if (!m) throw new Error('COLLECTOR_TOKEN introuvable dans ' + HTML_PATH + ' — le job et l\'application ont divergé ?');
  return m[1];
}

(async () => {
  const token = lireTokenDepuisSource();
  const url = TARGET_URL + '#collecteur-' + token;
  console.log('SENTINEL collecte planifiée — cible :', TARGET_URL);

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const erreursPage = [];
  page.on('pageerror', e => erreursPage.push(e.message));
  page.on('console', msg => { if (msg.type() === 'warning' || msg.type() === 'error') console.log('  [page]', msg.text()); });

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
    // minimal côté client) : detectProxy() -> doCollect() ->
    // publierCollectePartagee(ALL, true). force=true ignore le garde-fou
    // "déjà publié récemment" — indispensable puisque ce job tourne plus
    // souvent que la fenêtre de fraîcheur (voir COLLECTE_PARTAGEE_FRAICHEUR_MS).
    const collecte = page.evaluate(async () => {
      await detectProxy();
      await doCollect();
      if (typeof publierCollectePartagee !== 'function') {
        return { ok: false, raison: 'publierCollectePartagee indisponible (Supabase non chargé ?)' };
      }
      await publierCollectePartagee(ALL, true);
      return { ok: true, nbArticles: ALL.length, bestProxy: String(bestProxy) };
    });
    // Garde-fou explicite : doCollect() est déjà borné en interne (délais
    // réseau par source), mais un blocage inattendu ne doit jamais laisser
    // le job tourner indéfiniment (au-delà du timeout-minutes du workflow,
    // qui tuerait le runner sans ce message clair dans les logs).
    const resultat = await Promise.race([
      collecte,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Délai dépassé (' + (COLLECT_TIMEOUT_MS/60000) + ' min) pendant la collecte')), COLLECT_TIMEOUT_MS)),
    ]);

    if (!resultat.ok) {
      console.error('Échec :', resultat.raison);
      process.exitCode = 1;
    } else {
      console.log('Collecte publiée avec succès —', resultat.nbArticles, 'articles (proxy:', resultat.bestProxy + ').');
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
