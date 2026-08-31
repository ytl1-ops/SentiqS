// ============================================================
// SentiqS — Ouverture d'un paiement Stripe, fonction Edge
//
// Le panneau Paiements n'affiche aujourd'hui qu'un bouton « Configurer
// Stripe » : rien n'encaisse. Cette fonction ouvre une session Stripe
// Checkout pour un plan du catalogue, et c'est `webhook-stripe` qui
// enregistre l'abonnement une fois le paiement confirmé.
//
// Pourquoi deux fonctions : ne JAMAIS accorder un abonnement sur la foi du
// retour de navigation. Un utilisateur qui atteint l'URL de succès n'a pas
// forcément payé — seul le webhook signé par Stripe fait foi.
//
// Le prix vient de la table subscription_plans, jamais du client : sinon il
// suffirait d'envoyer `price: 0` pour s'offrir le forfait Entreprise.
//
// Secrets à définir (Edge Functions > creer-paiement > Secrets) :
//  - STRIPE_SECRET_KEY : clé secrète Stripe (sk_live_… ou sk_test_…)
//  - SITE_URL          : origine du site, pour les retours de paiement
//    (ex. https://sentiqs.example). À défaut, l'origine de la requête.
//
// Non déployée tant qu'aucun compte Stripe n'existe : le panneau Paiements
// continue d'afficher son invitation à configurer, sans rien casser.
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: enTetesCORS });
  if (req.method !== 'POST') return reponse({ ok: false, raison: 'Méthode non autorisée' }, 405);

  const cleStripe = Deno.env.get('STRIPE_SECRET_KEY');
  if (!cleStripe) {
    return reponse({ ok: false, raison: 'Paiement non configuré (STRIPE_SECRET_KEY absent)' }, 501);
  }

  const autorisation = req.headers.get('Authorization') || '';
  if (!autorisation.startsWith('Bearer ')) {
    return reponse({ ok: false, raison: 'Authentification requise' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const clientAppelant = createClient(url, cleService, {
    global: { headers: { Authorization: autorisation } },
    auth: { persistSession: false },
  });
  const { data: auth, error: erreurAuth } = await clientAppelant.auth.getUser();
  if (erreurAuth || !auth?.user?.email) {
    return reponse({ ok: false, raison: 'Session invalide ou expirée' }, 401);
  }
  const utilisateur = auth.user;

  let charge: { plan?: unknown } = {};
  try { charge = await req.json(); } catch { /* corps optionnel */ }
  const nomPlan = String(charge.plan || '').trim();
  if (!nomPlan) return reponse({ ok: false, raison: 'Plan non précisé' }, 400);

  // Le tarif est LU côté serveur : le client ne fait que nommer le plan.
  const service = createClient(url, cleService, { auth: { persistSession: false } });
  const { data: plan, error: erreurPlan } = await service
    .from('subscription_plans')
    .select('id,name,price,currency,billing_cycle')
    .ilike('name', nomPlan)
    .maybeSingle();

  if (erreurPlan || !plan) {
    return reponse({ ok: false, raison: `Plan inconnu : ${nomPlan}` }, 400);
  }
  if (Number(plan.price) <= 0) {
    return reponse({ ok: false, raison: 'Ce plan ne nécessite pas de paiement' }, 400);
  }

  const origine = Deno.env.get('SITE_URL') || req.headers.get('origin') || '';
  const intervalle = plan.billing_cycle === 'yearly' ? 'year' : 'month';

  // Stripe attend un formulaire encodé, pas du JSON.
  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('customer_email', utilisateur.email!);
  params.set('success_url', `${origine}/?paiement=succes`);
  params.set('cancel_url', `${origine}/?paiement=annule`);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', String(plan.currency || 'EUR').toLowerCase());
  params.set('line_items[0][price_data][unit_amount]', String(Math.round(Number(plan.price) * 100)));
  params.set('line_items[0][price_data][recurring][interval]', intervalle);
  params.set('line_items[0][price_data][product_data][name]', `SentiqS — ${plan.name}`);
  // Repris tel quel par le webhook : c'est ce qui relie le paiement au compte.
  params.set('metadata[user_id]', utilisateur.id);
  params.set('metadata[plan_id]', String(plan.id));
  params.set('metadata[email]', utilisateur.email!);

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cleStripe}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  const d = await r.json();
  if (!r.ok) {
    console.error('Stripe a refusé la session :', d?.error?.message || r.status);
    return reponse({ ok: false, raison: d?.error?.message || 'Stripe indisponible' }, 502);
  }

  return reponse({ ok: true, url: d.url, session_id: d.id });
});
