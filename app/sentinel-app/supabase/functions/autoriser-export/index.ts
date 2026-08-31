// ============================================================
// SentiqS — Autorisation d'export, fonction Edge
//
// Applique le quota de téléchargement de l'abonnement, CÔTÉ SERVEUR.
//
// Jusqu'ici, tout le paywall vivait dans le navigateur : plan, quota et
// compteur dans localStorage. Vider le stockage du site remettait le quota
// à zéro, éditer une valeur suffisait à passer au forfait Entreprise. Pour
// une offre affichée à 290 €/mois, le droit doit être vérifié là où
// l'utilisateur ne peut pas le réécrire.
//
// Déroulé d'un appel :
//   1. l'utilisateur est identifié par SON JWT (en-tête Authorization),
//      jamais par une valeur qu'il déclare ;
//   2. le solde est calculé par telechargements_restants() à partir de
//      l'abonnement réel ;
//   3. si le droit existe, la consommation est ENREGISTRÉE avant de
//      répondre — c'est cet enregistrement, inaccessible au client, qui
//      rend le compteur infalsifiable.
//
// Le point 3 est volontairement « réserver d'abord » : un export qui
// échouerait après coup consomme une unité. C'est le sens prudent pour un
// paywall — l'inverse permettrait de lancer autant d'exports que voulu en
// interrompant la réponse.
//
// Secrets : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis
// automatiquement par Supabase à l'exécution. Aucun secret à définir.
//
// Déploiement : voir supabase/README.md. Tant que cette fonction n'est pas
// déployée, le client retombe sur son contrôle local (comportement actuel).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const enTetesCORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reponse = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), {
    status,
    headers: { ...enTetesCORS, 'content-type': 'application/json' },
  });

const FORMATS = new Set(['pdf', 'docx', 'pptx', 'xlsx', 'csv', 'png', 'jpg']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: enTetesCORS });
  if (req.method !== 'POST') return reponse({ ok: false, raison: 'Méthode non autorisée' }, 405);

  const autorisation = req.headers.get('Authorization') || '';
  if (!autorisation.startsWith('Bearer ')) {
    return reponse({ ok: false, autorise: false, raison: 'Authentification requise' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Client « au nom de l'appelant » : sert UNIQUEMENT à valider le jeton et
  // à en extraire l'identité. Aucune décision ne s'appuie sur le corps de
  // la requête pour savoir QUI demande.
  const clientAppelant = createClient(url, cleService, {
    global: { headers: { Authorization: autorisation } },
    auth: { persistSession: false },
  });

  const { data: auth, error: erreurAuth } = await clientAppelant.auth.getUser();
  if (erreurAuth || !auth?.user) {
    return reponse({ ok: false, autorise: false, raison: 'Session invalide ou expirée' }, 401);
  }
  const utilisateur = auth.user;

  let charge: { format?: unknown; nom?: unknown } = {};
  try {
    charge = await req.json();
  } catch {
    return reponse({ ok: false, raison: 'JSON invalide' }, 400);
  }

  const format = String(charge.format || '').toLowerCase();
  if (!FORMATS.has(format)) {
    return reponse({ ok: false, raison: `Format inconnu : ${format || '(vide)'}` }, 400);
  }
  const nom = typeof charge.nom === 'string' ? charge.nom.slice(0, 300) : null;

  // Client de service : calcul du solde et écriture du journal.
  const service = createClient(url, cleService, { auth: { persistSession: false } });

  const { data: restants, error: erreurSolde } = await service.rpc(
    'telechargements_restants', { uid: utilisateur.id },
  );

  if (erreurSolde) {
    console.error('Calcul du solde impossible :', erreurSolde.message);
    return reponse({ ok: false, raison: 'Calcul du droit impossible' }, 500);
  }

  // NULL = illimité (administrateur, ou forfait sans plafond).
  const illimite = restants === null;

  if (!illimite && Number(restants) <= 0) {
    return reponse({
      ok: true,
      autorise: false,
      restants: 0,
      raison: 'Quota de téléchargements atteint pour cet abonnement',
    });
  }

  const { error: erreurJournal } = await service.from('telechargements').insert({
    user_id: utilisateur.id,
    email: utilisateur.email,
    format,
    nom,
  });

  if (erreurJournal) {
    // Échouer ici plutôt que d'autoriser sans compter : un compteur qui
    // n'enregistre pas ne compte pas, et le quota redeviendrait fictif.
    console.error('Enregistrement du téléchargement impossible :', erreurJournal.message);
    return reponse({ ok: false, raison: 'Enregistrement impossible' }, 500);
  }

  return reponse({
    ok: true,
    autorise: true,
    restants: illimite ? null : Number(restants) - 1,
  });
});
