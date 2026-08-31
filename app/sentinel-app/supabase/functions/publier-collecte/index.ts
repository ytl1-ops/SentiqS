// ============================================================
// SentiqS — Publication du cache de collecte partagé, fonction Edge
//
// Remplace l'écriture DIRECTE que le navigateur faisait dans
// collecte_partagee. Cette écriture imposait d'ouvrir la table au rôle
// `anon` (voir 20260718000000_collecte_partagee.sql : INSERT et UPDATE
// TO anon WITH CHECK (true)) — or la clé anonyme est publique par
// conception, en clair dans web/SentiqS_Web.html. N'importe qui pouvait
// donc réécrire le cache servi à TOUS les visiteurs. Sur un produit de
// veille sûreté, l'injection d'une fausse alerte n'est pas un incident
// technique mais un incident de crédibilité.
//
// Ce que cette fonction change :
//  - la clé de service ne quitte jamais le serveur (secret de fonction) ;
//  - seul le porteur de COLLECTEUR_JETON peut publier — en pratique le
//    job planifié (.github/workflows/collecte-planifiee.yml) ;
//  - la fusion avec l'existant se fait ICI, pas dans le navigateur : deux
//    publications concurrentes ne s'écrasent plus mutuellement ;
//  - le contenu est validé avant écriture (forme, taille, fraîcheur).
//
// Changement de comportement assumé : un visiteur ordinaire ne contribue
// plus au cache partagé. C'était déjà l'intention du job planifié — garder
// le cache frais INDÉPENDAMMENT du trafic réel — et la panne du 2 août a
// montré ce que vaut un cache alimenté « au gré des visiteurs ». La
// collecte locale d'un visiteur continue de fonctionner pour lui-même.
//
// Secrets à définir (Edge Functions > publier-collecte > Secrets) :
//  - COLLECTEUR_JETON : jeton partagé avec le job planifié. À générer
//    aléatoirement, jamais commité, différent de l'ancien COLLECTOR_TOKEN
//    qui, lui, est public.
//  - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY : fournis automatiquement
//    par Supabase à l'exécution.
//
// Déploiement : voir supabase/README.md — cette fonction doit être
// déployée ET vérifiée AVANT d'appliquer la migration qui retire
// l'écriture anonyme, sinon la collecte s'arrête.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ID_CACHE = 'global';
const FENETRE_MS = 12 * 60 * 60 * 1000; // même fenêtre que le client
const MAX_ARTICLES = 5000;              // ~495 sources × marge
const MAX_OCTETS = 8 * 1024 * 1024;     // garde-fou de charge utile

const enTetesCORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-collecteur-jeton',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reponse = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), {
    status,
    headers: { ...enTetesCORS, 'content-type': 'application/json' },
  });

// Comparaison à temps constant : évite qu'un attaquant ne devine le jeton
// caractère par caractère en mesurant le temps de réponse.
function jetonsEgaux(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Un article n'est retenu que s'il porte de quoi être vérifié : identifiant,
// titre exploitable, source, et un horodatage récent. Mêmes exigences que
// antiHalluFilter côté client — la validation ne doit pas être plus laxiste
// côté serveur, sinon elle ne sert à rien.
function articleValide(a: unknown, maintenant: number): boolean {
  if (!a || typeof a !== 'object') return false;
  const o = a as Record<string, unknown>;
  return (
    typeof o.id === 'string' && o.id.length > 0 && o.id.length <= 200 &&
    typeof o.title === 'string' && o.title.length >= 8 && o.title.length <= 2000 &&
    typeof o.primary === 'string' && o.primary.length > 0 &&
    typeof o.pubDate === 'number' &&
    o.pubDate > 0 &&
    maintenant - o.pubDate < FENETRE_MS &&
    o.pubDate < maintenant + 60 * 60 * 1000 // pas de date dans le futur
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: enTetesCORS });
  if (req.method !== 'POST') return reponse({ ok: false, raison: 'Méthode non autorisée' }, 405);

  const attendu = Deno.env.get('COLLECTEUR_JETON');
  if (!attendu) {
    console.error('COLLECTEUR_JETON non défini : la fonction refuse toute écriture.');
    return reponse({ ok: false, raison: 'Fonction non configurée' }, 500);
  }

  const fourni = req.headers.get('x-collecteur-jeton') || '';
  if (!jetonsEgaux(fourni, attendu)) {
    return reponse({ ok: false, raison: 'Jeton de collecteur invalide' }, 401);
  }

  const brut = await req.text();
  if (brut.length > MAX_OCTETS) {
    return reponse({ ok: false, raison: 'Charge utile trop volumineuse' }, 413);
  }

  let charge: { articles?: unknown; force?: unknown };
  try {
    charge = JSON.parse(brut);
  } catch {
    return reponse({ ok: false, raison: 'JSON invalide' }, 400);
  }

  if (!Array.isArray(charge.articles) || charge.articles.length === 0) {
    return reponse({ ok: false, raison: 'Aucun article à publier' }, 400);
  }
  if (charge.articles.length > MAX_ARTICLES) {
    return reponse({ ok: false, raison: `Plus de ${MAX_ARTICLES} articles` }, 413);
  }

  const maintenant = Date.now();
  const recus = charge.articles.filter((a) => articleValide(a, maintenant));
  if (recus.length === 0) {
    return reponse({ ok: false, raison: 'Aucun article valide (date, source ou titre manquant)' }, 400);
  }

  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Fusion côté serveur : on relit l'existant juste avant d'écrire, plutôt
  // que de faire confiance à un tableau complet fabriqué par l'appelant.
  const { data: existant, error: erreurLecture } = await client
    .from('collecte_partagee')
    .select('articles,updated_at')
    .eq('id', ID_CACHE)
    .maybeSingle();

  if (erreurLecture) {
    console.error('Lecture du cache impossible :', erreurLecture.message);
    return reponse({ ok: false, raison: 'Lecture du cache impossible' }, 500);
  }

  const parId = new Map<string, Record<string, unknown>>();
  const anciens = Array.isArray(existant?.articles) ? existant!.articles : [];
  anciens
    .filter((a: Record<string, unknown>) =>
      a && typeof a.pubDate === 'number' && maintenant - a.pubDate < FENETRE_MS)
    .forEach((a: Record<string, unknown>) => parId.set(a.id as string, a));
  recus.forEach((a) => parId.set((a as Record<string, unknown>).id as string, a as Record<string, unknown>));

  const fusionnes = [...parId.values()];

  const { error } = await client.from('collecte_partagee').upsert({
    id: ID_CACHE,
    articles: fusionnes,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Écriture du cache impossible :', error.message);
    return reponse({ ok: false, raison: 'Écriture du cache impossible' }, 500);
  }

  console.log(`Cache publié : ${recus.length} reçus, ${fusionnes.length} après fusion.`);
  return reponse({
    ok: true,
    nbArticles: fusionnes.length,
    nbRecus: recus.length,
    nbRejetes: charge.articles.length - recus.length,
  });
});
