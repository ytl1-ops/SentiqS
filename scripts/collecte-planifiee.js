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
const { evaluerAccessibilite } = require('./lib/couverture');
const historique = require('./lib/historique');

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

// L'archive vit sous web/ et non sous data/ : c'est web/ que GitHub Pages
// sert, et l'interface doit pouvoir lire la serie sans passer par Supabase
// ni par une API qui n'existe pas. Voir scripts/lib/historique.js.
const RACINE_HISTORIQUE = process.env.RACINE_HISTORIQUE
  || path.join(__dirname, '..', 'web', 'historique');

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

// Instant de depart du cycle : sert a n'attribuer a CE run que les
// succes et echecs de source releves apres lui.
const debutRun = Date.now();

// ecrireResumeActions(md) : depose un resume Markdown sur la page du run
// GitHub Actions ($GITHUB_STEP_SUMMARY). Hors CI la variable est absente et
// la fonction ne fait rien — le job doit rester lancable en local.
function ecrireResumeActions(md) {
  const dest = process.env.GITHUB_STEP_SUMMARY;
  if (!dest) return;
  try { fs.appendFileSync(dest, md + '\n'); }
  catch (e) { console.warn('Resume Actions non ecrit :', e && e.message ? e.message : e); }
}

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

    // ── CADENCE RÉELLE ───────────────────────────────────────────────────
    // Le cron demande une collecte toutes les 30 min ; GitHub déprioritise
    // et jette une grande partie des déclenchements infra-horaires, et rien
    // ne mesurait l'écart. On lit l'âge du cache qu'on s'apprête à remplacer :
    // c'est exactement le temps pendant lequel les visiteurs ont vu une
    // donnée périmée. Lecture directe (lireCollectePartagee renvoie null
    // au-delà de la fenêtre de fraîcheur, donc ne peut pas servir ici).
    const ageCachePrecedent = await page.evaluate(async () => {
      try {
        const client = getSentinelSupabase();
        if (!client) return null;
        const { data, error } = await client.from('collecte_partagee')
          .select('updated_at').eq('id', COLLECTE_PARTAGEE_ID).maybeSingle();
        if (error || !data || !data.updated_at) return null;
        return Date.now() - new Date(data.updated_at).getTime();
      } catch (_) { return null; }
    });
    if (ageCachePrecedent !== null) {
      const min = Math.round(ageCachePrecedent / 60000);
      const attendu = 30;
      console.log('Cadence réelle : ' + min + ' min depuis la publication précédente'
        + ' (cadence demandée : ' + attendu + ' min).');
      if (min > attendu * 2) {
        console.log('  Au-delà du double de la cadence demandée : les déclenchements planifiés'
          + ' sont jetés par GitHub, et le cache a été périmé pendant ' + (min - 40) + ' min.');
      }
    } else {
      console.log('Cadence réelle : aucune publication précédente lisible (première collecte ?).');
    }

    // Jeton de publication : injecté dans la session, JAMAIS écrit dans le
    // fichier public ni dans ce dépôt. Il autorise l'appel à la fonction
    // Edge `publier-collecte`, qui détient la clé de service et écrit à
    // notre place — de sorte que la table n'ait plus à être ouverte au rôle
    // anon (voir supabase/README.md).
    //
    // Absent : la publication retombe sur l'écriture directe, encore valide
    // tant que la migration de verrouillage n'est pas appliquée. On le
    // signale, sans faire échouer le job — l'ordre de bascule est
    // volontairement progressif.
    const jetonPublication = process.env.COLLECTEUR_JETON || '';
    if (jetonPublication) {
      await page.evaluate((jeton) => {
        if (typeof _MEM_SESSION === 'object' && _MEM_SESSION) _MEM_SESSION.collecteurJeton = jeton;
      }, jetonPublication);
      console.log('Jeton de publication injecté : publication via la fonction Edge.');
    } else {
      console.warn(
        'COLLECTEUR_JETON absent : publication par écriture directe (voie héritée). ' +
        'Définissez ce secret avant d\'appliquer la migration de verrouillage.'
      );
    }

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
      //
      // Le verdict est distingue en trois : un succes ayant publie, un succes
      // sans rien a publier (le cas courant), et un echec. L'ancienne version
      // ne distinguait rien : elle criait « a echoue : raison inconnue » des
      // que le retour etait falsy, et la fonction ne retournait alors JAMAIS
      // rien. Chaque cycle vert portait donc une fausse alarme.
      if (typeof publierAgendaPartagee === 'function') {
        try {
          const pubAgenda = await publierAgendaPartagee(ALL);
          if (!pubAgenda || typeof pubAgenda.ok !== 'boolean') {
            console.error('[collecte-planifiee] publierAgendaPartagee n\'a rendu aucun verdict '
              + '— contrat rompu, publication non verifiable.');
          } else if (!pubAgenda.ok) {
            console.error('[collecte-planifiee] publierAgendaPartagee a echoue :', pubAgenda.raison);
          } else if (pubAgenda.publiees > 0) {
            console.log('[collecte-planifiee] agenda partage : ' + pubAgenda.publiees + ' entree(s) publiee(s).');
          } else {
            console.log('[collecte-planifiee] agenda partage : rien a publier (' + pubAgenda.raison + ').');
          }
        } catch (e) {
          console.error('[collecte-planifiee] publierAgendaPartagee a leve une exception :', (e && e.message) || e);
        }
      }
      return { ok: true, nbArticles: pub.nbArticles, bestProxy: String(typeof bestProxy !== 'undefined' ? bestProxy : '?') };
    });

    // ── COUVERTURE DE LA COLLECTE ────────────────────────────────────────
    // Un run vert disait seulement « N articles publiés ». Il ne disait pas
    // combien de sources avaient répondu, ni quels pays étaient repartis les
    // mains vides — or c'est exactement ce qui distingue une collecte saine
    // d'une collecte à moitié rate-limitée qui publie quand même. La santé
    // par source vivait dans le localStorage du navigateur et personne, hors
    // ce navigateur, ne pouvait la lire.
    //
    // Mesuré dans un evaluate SÉPARÉ, exécuté même quand la publication a
    // échoué : c'est précisément là que le détail a le plus de valeur.
    // Deux mesures DISTINCTES, et c'est tout l'interet de ce bloc.
    //
    // Premiere version de ce rapport : elle ne comptait que les sources
    // presentes dans ALL, en croyant mesurer l'accessibilite. Or ALL est
    // filtre a 12 h et dedoublonne (voir « Separation stricte » dans
    // web/SentiqS_Web.html) : elle mesurait donc la FRAICHEUR. Un media
    // national qui n'a rien publie depuis douze heures y apparaissait comme
    // une source en echec — et vingt-neuf petits pays comme « muets », alors
    // que leurs sites repondaient normalement. Conclusion fausse tiree d'un
    // chiffre juste.
    //
    //   joignables / en echec  -> la source a-t-elle REPONDU ? (SRC_HEALTH,
    //                             alimente par recordSrcOk/recordSrcFail)
    //   article frais          -> a-t-elle publie quelque chose depuis 12 h ?
    //
    // Seule la premiere dit si la collecte fonctionne. La seconde varie
    // legitimement avec l'heure et la taille du pays.
    const couverture = await page.evaluate((debutRun) => {
      const vide = {
        sourcesTotal: 0, joignables: 0, enEchec: 0, tentees: 0,
        sourcesAvecArticleFrais: 0, paysTotal: 0, paysAvecArticleFrais: 0,
        paysSansArticleFrais: [], enVeille: 0, mesurable: false,
      };
      try {
        if (!Array.isArray(ALL)) return vide;
        const sourcesTotal = (typeof SRCS !== 'undefined' && Array.isArray(SRCS)) ? SRCS.length : 0;
        const paysConnus = (typeof PAYS_INFO !== 'undefined') ? Object.keys(PAYS_INFO) : [];

        // Accessibilite. Le navigateur du job demarre avec un localStorage
        // vide : tout ce que SRC_HEALTH contient vient donc de CE cycle. Le
        // filtrage sur debutRun n'est qu'une ceinture de securite au cas ou
        // un profil serait reutilise.
        const sante = (typeof SRC_HEALTH !== 'undefined') ? Object.values(SRC_HEALTH) : [];
        const joignables = sante.filter((h) => h && (h.lastOk || 0) >= debutRun).length;
        const enEchec = sante.filter((h) => h && (h.lastFail || 0) >= debutRun && (h.lastOk || 0) < debutRun).length;

        // Fraicheur.
        const avecArticle = new Set(ALL.map((a) => a && a.primary).filter(Boolean));
        const paysFrais = new Set(ALL.map((a) => a && a.cy).filter((c) => c && c !== 'INT'));

        const enVeille = (typeof SRC_FAIL_THRESHOLD !== 'undefined')
          ? sante.filter((h) => h && (h.fails || 0) >= SRC_FAIL_THRESHOLD).length
          : 0;

        return {
          sourcesTotal,
          joignables,
          enEchec,
          tentees: joignables + enEchec,
          sourcesAvecArticleFrais: avecArticle.size,
          paysTotal: paysConnus.length,
          paysAvecArticleFrais: paysFrais.size,
          paysSansArticleFrais: paysConnus.filter((c) => !paysFrais.has(c)),
          enVeille,
          mesurable: sante.length > 0,
        };
      } catch (_) { return vide; }
    }, debutRun);

    // ── ARCHIVE DES NIVEAUX ──────────────────────────────────────────────
    // Le cache partage expire a six heures et rien ne lui survit : jusqu'ici
    // le produit ne pouvait montrer qu'un etat, jamais une trajectoire, et
    // aucune question de qualite ne pouvait etre tranchee autrement qu'en
    // disant « il faudrait compter sur plusieurs cycles ». Personne ne
    // comptait.
    //
    // On interroge la page APRES la collecte : les niveaux enregistres
    // incluent donc le live du jour, ce qui est precisement ce qui bouge.
    // scripts/tableau-niveaux.js, lui, coupe le reseau volontairement pour
    // mesurer le plancher fige — ce sont deux mesures differentes, et
    // melanger les deux archives n'aurait aucun sens.
    //
    // Le calcul n'est pas reimplemente ici : c'est calcAlertScore de la page
    // qui repond, comme partout ailleurs dans ce depot.
    try {
      const niveaux = await page.evaluate(() => {
        if (typeof calcAlertScore !== 'function' || typeof CYS === 'undefined') return null;
        return CYS.filter((c) => c && c.code && c.code !== 'all').map((c) => {
          const s = calcAlertScore(c.code);
          const d = (s && s.debug) || {};
          return {
            code: c.code, niveau: s && s.key, total: s && s.total,
            verifies: d.verifies, facteurs: d.specials,
            live: d.liveApplique, historique: d.historiqueApplique,
          };
        });
      });

      if (!niveaux || !niveaux.length) {
        // Ne jamais ecrire un instantane vide : il occuperait la journee et
        // empecherait le passage suivant d'en ecrire un bon.
        console.warn('  Archive : la page n\'a pas rendu de niveaux — rien enregistre pour aujourd\'hui.');
      } else {
        const jour = historique.jourUTC(Date.now());
        const inst = historique.construireInstantane({
          jour, commit: process.env.GITHUB_SHA || null, pays: niveaux,
        });
        const ecrit = historique.ecrireInstantane(RACINE_HISTORIQUE, inst);
        if (ecrit) {
          const serie = historique.construireSerie(historique.lireSerie(RACINE_HISTORIQUE));
          fs.writeFileSync(path.join(RACINE_HISTORIQUE, 'serie.json'), JSON.stringify(serie) + '\n');
          console.log('  Archive : instantane du ' + jour + ' ecrit (' + inst.pays.length
            + ' pays), serie sur ' + serie.jours.length + ' jour(s).');
        } else {
          console.log('  Archive : le ' + jour + ' est deja couvert — le premier passage du jour fait foi.');
        }
      }
    } catch (e) {
      // L'archive est un bonus : son echec ne doit jamais faire tomber une
      // collecte qui a, elle, reussi.
      console.warn('  Archive : non ecrite (' + ((e && e.message) || e) + ')');
    }

    const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
    const tauxJoignables = pct(couverture.joignables, couverture.tentees);

    const lignesCouverture = [
      'ACCESSIBILITÉ — sources ayant répondu : ' + couverture.joignables + '/' + couverture.tentees
        + ' tentées (' + tauxJoignables + ' %), sur ' + couverture.sourcesTotal + ' déclarées',
      'FRAÎCHEUR — sources ayant publié depuis 12 h : ' + couverture.sourcesAvecArticleFrais
        + ', couvrant ' + couverture.paysAvecArticleFrais + '/' + couverture.paysTotal + ' pays',
      'Sources en veille (échecs répétés) : ' + couverture.enVeille,
      'Interception directe : ' + statsInterception.direct_ok + '/' + statsInterception.intercepte
        + ' requêtes servies sans proxy public, ' + statsInterception.repli_proxy + ' repli.',
    ];
    if (couverture.paysSansArticleFrais.length) {
      // Formule prudente : un pays sans actualité fraîche n'est pas un pays
      // injoignable. Beaucoup de petits pays n'ont rien à publier en 12 h.
      lignesCouverture.push('Pays sans actualité de moins de 12 h : '
        + couverture.paysSansArticleFrais.join(', '));
    }
    lignesCouverture.forEach(l => console.log('  ' + l));

    // Seuil d'alerte. Il ne porte QUE sur l'accessibilité : la fraîcheur varie
    // légitimement avec l'heure et la taille du pays, et un seuil posé dessus
    // serait rouge en permanence ou jamais — inutile dans les deux cas.
    //
    // Pas de ligne de base historique pour calibrer finement : on se limite
    // donc à ce qui est vrai quel que soit le régime habituel — si quatre
    // sources sur cinq réellement tentées échouent, quelque chose est cassé.
    const verdict = evaluerAccessibilite(
      couverture,
      process.env.SEUIL_JOIGNABLES_PCT ? Number(process.env.SEUIL_JOIGNABLES_PCT) : undefined
    );
    if (!verdict.ok) {
      console.error('\n✗ ' + verdict.message);
      process.exitCode = 1;
    } else if (verdict.code === 'non_mesurable') {
      console.log('  (' + verdict.message + ')');
    }

    // Résumé lisible sur la page du run, sans avoir à ouvrir les journaux.
    ecrireResumeActions([
      '### Couverture de la collecte',
      '',
      '| Mesure | Valeur |',
      '|---|---|',
      '| **Sources ayant répondu** | ' + couverture.joignables + ' / ' + couverture.tentees
        + ' tentées (' + tauxJoignables + ' %) |',
      '| Sources ayant publié depuis 12 h | ' + couverture.sourcesAvecArticleFrais + ' |',
      '| Pays avec une actualité fraîche | ' + couverture.paysAvecArticleFrais + ' / ' + couverture.paysTotal + ' |',
      '| Sources en veille | ' + couverture.enVeille + ' |',
      '| Requêtes sans proxy public | ' + statsInterception.direct_ok + ' / ' + statsInterception.intercepte + ' |',
      '| Écart depuis la publication précédente | '
        + (ageCachePrecedent === null ? 'inconnu' : Math.round(ageCachePrecedent / 60000) + ' min (demandé : 30 min)') + ' |',
      '',
      couverture.paysSansArticleFrais.length
        ? '**Pays sans actualité de moins de 12 h :** ' + couverture.paysSansArticleFrais.join(', ')
          + '\n\n_Un pays sans actualité fraîche n\'est pas un pays injoignable : la ligne'
          + ' « sources ayant répondu » ci-dessus est la seule qui dise si la collecte fonctionne._'
        : 'Tous les pays connus ont une actualité de moins de 12 h.',
    ].join('\n'));

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
